import Foundation

// MARK: - DesktopService

/// iOS 端核心服务 — 连接桌面端 WebSocket，管理会话和消息
/// 对标 CodexMobile 的 CodexService，但使用我们自己的协议
@MainActor
@Observable
final class DesktopService {
    // MARK: - Published State

    var sessions: [Session] = []
    var recentProjects: [RecentProject] = []
    var messagesBySession: [String: [Message]] = [:]
    var connectionState: ConnectionState = .disconnected
    var activeSessionId: String?
    var pendingPermissions: [PermissionRequest] = []
    var lastError: String?
    var streamingText: [String: String] = [:]  // sessionId -> streaming text

    // MARK: - Connection State

    enum ConnectionState: Sendable, Equatable {
        case disconnected
        case connecting
        case connected
        case failed(String)
    }

    // MARK: - Private State

    private var globalWebSocket: URLSessionWebSocketTask?
    private var sessionWebSockets: [String: URLSessionWebSocketTask] = [:]
    private var connectedSessionIds: Set<String> = []
    private var pendingOutboundMessages: [String: [PendingOutboundMessage]] = [:]
    private var baseURL: URL?
    private var h5Token: String?
    private var pingTimer: Timer?
    private let maxPendingOutboundMessages = 20
    private let jsonDecoder: JSONDecoder = {
        let d = JSONDecoder()
        d.dateDecodingStrategy = .millisecondsSince1970
        return d
    }()

    // MARK: - Singleton

    static let shared = DesktopService()

    // MARK: - Connection

    /// 输入局域网地址即可连接；未提供端口时使用桌面服务默认端口 3456。
    func connectToServer(_ serverURL: URL) async throws {
        connectionState = .connecting

        do {
            // 用户明确输入局域网地址和端口；未填端口时使用桌面服务默认端口。
            let resolvedURL = try normalizeServerURL(serverURL)
            baseURL = resolvedURL
            print("[DesktopService] 解析后的服务器地址: \(resolvedURL)")

            // 先验证服务器可达性
            let healthURL = apiURL("health", base: resolvedURL)
            print("[DesktopService] 检查健康状态: \(healthURL)")
            let (_, healthResponse) = try await URLSession.shared.data(from: healthURL)
            guard let healthHTTP = healthResponse as? HTTPURLResponse, healthHTTP.statusCode == 200 else {
                throw DesktopServiceError.connectionFailed("无法连接到桌面端，请确认地址正确且桌面端正在运行")
            }
            print("[DesktopService] 服务器可达，开始配对")

            // 后台换取移动端访问 token。UI 只暴露局域网地址连接。
            var codeRequest = URLRequest(url: apiURL("api/mobile/pairing-code", base: resolvedURL))
            codeRequest.httpMethod = "POST"
            codeRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
            codeRequest.httpBody = Data("{}".utf8)

            let (codeData, codeResponse) = try await URLSession.shared.data(for: codeRequest)
            guard let codeHTTP = codeResponse as? HTTPURLResponse, codeHTTP.statusCode == 200 else {
                if let httpResp = codeResponse as? HTTPURLResponse, httpResp.statusCode == 403 {
                    throw DesktopServiceError.connectionFailed("桌面端未启用远程访问，请在桌面端设置中开启 H5 访问")
                }
                throw DesktopServiceError.connectionFailed("配对请求被拒绝 (HTTP \((codeResponse as? HTTPURLResponse)?.statusCode ?? 0))，请确认桌面端正在运行")
            }
            print("[DesktopService] 配对码获取成功")

            let codeResult = try JSONDecoder().decode(PairingCodeResponse.self, from: codeData)

            var pairRequest = URLRequest(url: apiURL("api/mobile/pair", base: resolvedURL))
            pairRequest.httpMethod = "POST"
            pairRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
            pairRequest.httpBody = try JSONEncoder().encode(["code": codeResult.pairingCode])

            let (pairData, pairResponse) = try await URLSession.shared.data(for: pairRequest)
            guard let pairHTTP = pairResponse as? HTTPURLResponse, pairHTTP.statusCode == 200 else {
                throw DesktopServiceError.connectionFailed("连接授权失败，请重试")
            }

            let pairResult = try JSONDecoder().decode(PairResponse.self, from: pairData)
            self.h5Token = pairResult.token

            // 启用桌面端 H5 远程访问，否则 WebSocket 连接会被服务器拦截
            var enableRequest = URLRequest(url: apiURL("api/h5-access/enable", base: resolvedURL))
            enableRequest.httpMethod = "POST"
            enableRequest.setValue("Bearer \(pairResult.token)", forHTTPHeaderField: "Authorization")
            _ = try? await URLSession.shared.data(for: enableRequest)

            saveCredentials(token: pairResult.token, serverURL: resolvedURL)

            try await connect()
        } catch {
            connectionState = .failed(error.localizedDescription)
            throw error
        }
    }

    private func normalizeServerURL(_ inputURL: URL) throws -> URL {
        guard var components = URLComponents(url: inputURL, resolvingAgainstBaseURL: false) else {
            throw DesktopServiceError.invalidURL
        }
        if components.scheme == nil {
            components.scheme = "http"
        }
        if components.port == nil {
            components.port = 3456
        }
        components.path = ""
        components.query = nil
        components.fragment = nil
        guard let url = components.url else {
            throw DesktopServiceError.invalidURL
        }
        return url
    }

    /// 获取桌面端网络信息
    func fetchNetworkInfo(serverURL: URL) async throws -> NetworkInfo {
        let url = apiURL("api/mobile/network-info", base: serverURL)
        let (data, _) = try await URLSession.shared.data(from: url)
        return try JSONDecoder().decode(NetworkInfo.self, from: data)
    }

    // MARK: - Connection

    /// 使用已保存的凭证连接
    func connectWithSavedCredentials() async throws {
        guard let (token, url) = loadCredentials() else {
            throw DesktopServiceError.noSavedCredentials
        }
        self.h5Token = token
        self.baseURL = url

        try await connect()
    }

    /// 建立 WebSocket 连接
    func connect() async throws {
        guard let baseURL = baseURL, let token = h5Token else {
            throw DesktopServiceError.notConfigured
        }

        connectionState = .connecting

        // 连接全局 WebSocket 通道
        let wsURL = try webSocketURL("ws/global", token: token, base: baseURL)

        var request = URLRequest(url: wsURL)
        request.timeoutInterval = 15

        let ws = URLSession.shared.webSocketTask(with: request)
        globalWebSocket = ws
        ws.resume()

        // 等待 WebSocket 连接建立 — 用 sendPing 验证
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            var resumed = false
            ws.sendPing { error in
                guard !resumed else { return }
                resumed = true
                if let error {
                    continuation.resume(throwing: DesktopServiceError.connectionFailed(
                        "WebSocket 连接失败: \(error.localizedDescription)"
                    ))
                } else {
                    continuation.resume()
                }
            }
            // 超时保护
            Task {
                try? await Task.sleep(nanoseconds: 10_000_000_000) // 10秒
                guard !resumed else { return }
                resumed = true
                continuation.resume(throwing: DesktopServiceError.connectionFailed(
                    "WebSocket 连接超时，请确认手机和桌面端在同一局域网"
                ))
            }
        }

        // 启动消息接收循环
        receiveGlobalMessages()

        // 启动心跳
        startPingTimer()

        // 获取会话列表
        await refreshSessions()

        connectionState = .connected
    }

    /// 断开连接
    func disconnect() {
        globalWebSocket?.cancel(with: .normalClosure, reason: nil)
        globalWebSocket = nil

        for (_, ws) in sessionWebSockets {
            ws.cancel(with: .normalClosure, reason: nil)
        }
        sessionWebSockets.removeAll()
        connectedSessionIds.removeAll()
        pendingOutboundMessages.removeAll()

        pingTimer?.invalidate()
        pingTimer = nil

        connectionState = .disconnected
    }

    // MARK: - Session Management

    /// 刷新会话列表
    func refreshSessions() async {
        guard let baseURL = baseURL, let token = h5Token else { return }

        var request = URLRequest(url: apiURL("api/sessions", base: baseURL))
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
                return
            }
            let result = try jsonDecoder.decode(SessionsResponse.self, from: data)
            self.sessions = result.sessions
        } catch {
            lastError = "获取会话列表失败: \(error.localizedDescription)"
        }
    }

    /// 获取桌面端最近项目，用于手机端选择路径新建对话。
    func refreshRecentProjects(limit: Int = 30) async {
        guard let baseURL = baseURL, let token = h5Token else { return }

        var components = URLComponents(url: apiURL("api/sessions/recent-projects", base: baseURL), resolvingAgainstBaseURL: false)
        components?.queryItems = [URLQueryItem(name: "limit", value: "\(limit)")]
        guard let url = components?.url else { return }

        var request = URLRequest(url: url)
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
                return
            }
            let result = try jsonDecoder.decode(RecentProjectsResponse.self, from: data)
            self.recentProjects = result.projects
        } catch {
            lastError = "获取最近项目失败: \(error.localizedDescription)"
        }
    }

    /// 创建新会话
    func createSession(workDir: String? = nil) async throws -> Session {
        guard let baseURL = baseURL, let token = h5Token else {
            throw DesktopServiceError.notConfigured
        }

        var request = URLRequest(url: apiURL("api/sessions", base: baseURL))
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        var body: [String: String] = [:]
        if let workDir { body["workDir"] = workDir }
        request.httpBody = try JSONEncoder().encode(body)

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 201 else {
            throw DesktopServiceError.requestFailed("创建会话失败")
        }

        let result = try jsonDecoder.decode(CreateSessionResponse.self, from: data)
        let session = Session(
            id: result.sessionId,
            title: "新对话",
            createdAt: Date(),
            updatedAt: Date(),
            workDir: result.workDir,
            state: .idle
        )
        sessions.insert(session, at: 0)
        return session
    }

    /// 删除会话
    func deleteSession(_ sessionId: String) async throws {
        guard let baseURL = baseURL, let token = h5Token else {
            throw DesktopServiceError.notConfigured
        }

        var request = URLRequest(url: apiURL("api/sessions/\(sessionId)", base: baseURL))
        request.httpMethod = "DELETE"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        let (_, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            throw DesktopServiceError.requestFailed("删除会话失败")
        }

        sessions.removeAll { $0.id == sessionId }
        messagesBySession.removeValue(forKey: sessionId)
        if activeSessionId == sessionId { activeSessionId = nil }
    }

    // MARK: - Chat

    /// 连接到特定会话的 WebSocket 通道
    func connectToSession(_ sessionId: String) {
        activeSessionId = sessionId

        // 如果已连接该会话，跳过
        if sessionWebSockets[sessionId] != nil { return }

        guard let baseURL = baseURL, let token = h5Token else { return }

        guard let wsURL = try? webSocketURL("ws/\(sessionId)", token: token, base: baseURL) else { return }

        let request = URLRequest(url: wsURL)
        let ws = URLSession.shared.webSocketTask(with: request)
        sessionWebSockets[sessionId] = ws
        connectedSessionIds.remove(sessionId)
        ws.resume()

        receiveSessionMessages(sessionId)

        // 加载历史消息
        Task { await loadHistory(sessionId) }
    }

    /// 发送消息
    func sendMessage(sessionId: String, content: String, attachments: [String] = []) {
        if sessionWebSockets[sessionId] == nil {
            connectToSession(sessionId)
        }

        let clientMsg = ClientMessage.userMessage(content: content)
        guard let data = clientMsg.jsonData,
              let string = String(data: data, encoding: .utf8) else { return }

        // 本地先添加用户消息
        let userMessageId = UUID().uuidString
        let userMsg = Message(
            id: userMessageId,
            sessionId: sessionId,
            role: .user,
            kind: .userText,
            text: content,
            createdAt: Date(),
            isStreaming: false,
            deliveryState: .pending,
            orderIndex: (messagesBySession[sessionId]?.count ?? 0)
        )
        messagesBySession[sessionId, default: []].append(userMsg)

        guard let ws = sessionWebSockets[sessionId] else {
            lastError = "会话连接未建立，消息已等待重试"
            queueOutboundMessage(sessionId: sessionId, payload: string, localMessageId: userMessageId)
            return
        }

        guard connectedSessionIds.contains(sessionId) else {
            queueOutboundMessage(sessionId: sessionId, payload: string, localMessageId: userMessageId)
            return
        }

        sendOutboundMessage(sessionId: sessionId, ws: ws, payload: string, localMessageId: userMessageId)
    }

    private func queueOutboundMessage(sessionId: String, payload: String, localMessageId: String) {
        var queue = pendingOutboundMessages[sessionId, default: []]
        if queue.count >= maxPendingOutboundMessages {
            let dropped = queue.removeFirst()
            updateMessageDeliveryState(
                sessionId: sessionId,
                messageId: dropped.localMessageId,
                deliveryState: .failed
            )
        }
        queue.append(PendingOutboundMessage(payload: payload, localMessageId: localMessageId))
        pendingOutboundMessages[sessionId] = queue
    }

    private func flushPendingOutboundMessages(sessionId: String) {
        guard let ws = sessionWebSockets[sessionId],
              connectedSessionIds.contains(sessionId),
              let queued = pendingOutboundMessages.removeValue(forKey: sessionId) else {
            return
        }

        for message in queued {
            sendOutboundMessage(
                sessionId: sessionId,
                ws: ws,
                payload: message.payload,
                localMessageId: message.localMessageId
            )
        }
    }

    private func sendOutboundMessage(
        sessionId: String,
        ws: URLSessionWebSocketTask,
        payload: String,
        localMessageId: String
    ) {
        ws.send(.string(payload)) { [weak self] error in
            Task { @MainActor in
                guard let self else { return }
                if let error {
                    self.lastError = "发送失败，消息已等待重试: \(error.localizedDescription)"
                    self.connectedSessionIds.remove(sessionId)
                    self.queueOutboundMessage(
                        sessionId: sessionId,
                        payload: payload,
                        localMessageId: localMessageId
                    )
                    self.sessionWebSockets[sessionId]?.cancel(with: .goingAway, reason: nil)
                    self.sessionWebSockets.removeValue(forKey: sessionId)
                    self.connectToSession(sessionId)
                    return
                }

                self.updateMessageDeliveryState(
                    sessionId: sessionId,
                    messageId: localMessageId,
                    deliveryState: .confirmed
                )
            }
        }
    }

    /// 停止生成
    func stopGeneration(sessionId: String) {
        let ws = sessionWebSockets[sessionId] ?? globalWebSocket
        guard let ws else { return }

        let clientMsg = ClientMessage.stopGeneration
        guard let data = clientMsg.jsonData,
              let string = String(data: data, encoding: .utf8) else { return }
        ws.send(.string(string)) { _ in }
    }

    /// 回复权限请求
    func respondToPermission(sessionId: String, requestId: String, approved: Bool) {
        let ws = sessionWebSockets[sessionId] ?? globalWebSocket
        guard let ws else { return }

        let clientMsg = ClientMessage.permissionResponse(requestId: requestId, approved: approved)
        guard let data = clientMsg.jsonData,
              let string = String(data: data, encoding: .utf8) else { return }
        ws.send(.string(string)) { _ in }

        // 移除待处理权限
        pendingPermissions.removeAll { $0.id == requestId }
    }

    // MARK: - Message Receiving

    private func receiveGlobalMessages() {
        guard let ws = globalWebSocket else { return }

        ws.receive { [weak self] result in
            guard let self else { return }
            Task { @MainActor in
                switch result {
                case .success(let message):
                    self.handleGlobalMessage(message)
                    self.receiveGlobalMessages() // 继续接收
                case .failure(let error):
                    // 已断开或正在连接中，不重复报错
                    if case .disconnected = self.connectionState { return }
                    if case .connecting = self.connectionState { return }
                    self.connectionState = .failed("连接断开: \(error.localizedDescription)")
                    // 自动重连
                    Task {
                        try? await Task.sleep(for: .seconds(3))
                        try? await self.connectWithSavedCredentials()
                    }
                }
            }
        }
    }

    private func receiveSessionMessages(_ sessionId: String) {
        guard let ws = sessionWebSockets[sessionId] else { return }

        ws.receive { [weak self] result in
            guard let self else { return }
            Task { @MainActor in
                switch result {
                case .success(let message):
                    self.handleSessionMessage(message, sessionId: sessionId)
                    self.receiveSessionMessages(sessionId) // 继续接收
                case .failure:
                    self.sessionWebSockets.removeValue(forKey: sessionId)
                    self.connectedSessionIds.remove(sessionId)
                }
            }
        }
    }

    // MARK: - Message Handling

    private func handleGlobalMessage(_ message: URLSessionWebSocketTask.Message) {
        guard case .string(let text) = message else { return }
        guard let data = text.data(using: .utf8) else { return }

        do {
            let serverMsg = try JSONDecoder().decode(ServerMessage.self, from: data)
            switch serverMsg {
            case .connected:
                connectionState = .connected
            case .sessionsUpdated(let summaries):
                // 更新会话列表的 state
                for summary in summaries {
                    if let idx = sessions.firstIndex(where: { $0.id == summary.sessionId }) {
                        var session = sessions[idx]
                        if let title = summary.title { session.title = title }
                        if let state = summary.state { session.state = state }
                        sessions[idx] = session
                    }
                }
            case .sessionBroadcast(let sessionId, let event):
                handleBroadcastEvent(event, sessionId: sessionId)
            case .sessionActivated(let sessionId, let title):
                upsertActivatedSession(sessionId: sessionId, title: title)
                Task { await refreshSessions() }
            case .pong:
                break
            default:
                break
            }
        } catch {
            print("[DesktopService] 全局消息解析失败: \(error)")
        }
    }

    private func handleBroadcastEvent(_ event: ServerMessage, sessionId: String) {
        switch event {
        case .status(_, let state):
            if let idx = sessions.firstIndex(where: { $0.id == sessionId }) {
                sessions[idx].state = state
            }
        case .sessionTitleUpdated(_, let title):
            if let idx = sessions.firstIndex(where: { $0.id == sessionId }) {
                sessions[idx].title = title
            }
        case .permissionRequest(_, let requestId, let toolName, let input):
            guard !pendingPermissions.contains(where: { $0.id == requestId }) else { return }
            let req = PermissionRequest(
                id: requestId,
                sessionId: sessionId,
                toolName: toolName,
                input: input
            )
            pendingPermissions.append(req)
        case .messageComplete:
            updateSessionState(sessionId: sessionId, state: .idle)
            Task { await refreshSessions() }
        case .error(_, let message):
            lastError = message
            updateSessionState(sessionId: sessionId, state: .idle)
        case .userMessageReplay(_, let content):
            appendReplayedUserMessage(content, sessionId: sessionId)
        default:
            break
        }
    }

    private func handleSessionMessage(_ message: URLSessionWebSocketTask.Message, sessionId: String) {
        guard case .string(let text) = message else { return }
        guard let data = text.data(using: .utf8) else { return }

        do {
            let serverMsg = try JSONDecoder().decode(ServerMessage.self, from: data)
            switch serverMsg {
            case .connected:
                connectedSessionIds.insert(sessionId)
                flushPendingOutboundMessages(sessionId: sessionId)

            case .contentDelta(_, let itemId, let delta):
                appendStreamingDelta(delta, sessionId: sessionId, itemId: itemId)
            case .contentStart(_, let itemId, let role):
                if role == "assistant" {
                    ensureStreamingAssistantMessage(sessionId: sessionId, itemId: itemId)
                }
            case .toolUseComplete(_, let itemId, let name, let input):
                flushStreamingText(sessionId: sessionId)
                let msg = Message(
                    id: itemId ?? UUID().uuidString,
                    sessionId: sessionId,
                    role: .assistant,
                    kind: .toolUse,
                    text: name ?? "tool",
                    createdAt: Date(),
                    isStreaming: false,
                    deliveryState: .confirmed,
                    orderIndex: nextOrderIndex(sessionId: sessionId),
                    toolName: name,
                    toolInput: input
                )
                messagesBySession[sessionId, default: []].append(msg)

            case .toolResult(_, let itemId, let output):
                let msg = Message(
                    id: itemId ?? UUID().uuidString,
                    sessionId: sessionId,
                    role: .system,
                    kind: .toolResult,
                    text: output ?? "",
                    createdAt: Date(),
                    isStreaming: false,
                    deliveryState: .confirmed,
                    orderIndex: nextOrderIndex(sessionId: sessionId),
                    toolOutput: output
                )
                messagesBySession[sessionId, default: []].append(msg)

            case .thinking(_, let itemId, let text):
                appendThinkingText(text ?? "", sessionId: sessionId, itemId: itemId)

            case .messageComplete(_, _, _):
                flushStreamingText(sessionId: sessionId)
                updateSessionState(sessionId: sessionId, state: .idle)

            case .status(_, let state):
                updateSessionState(sessionId: sessionId, state: state)

            case .permissionRequest(_, let requestId, let toolName, let input):
                guard !pendingPermissions.contains(where: { $0.id == requestId }) else { break }
                let req = PermissionRequest(
                    id: requestId,
                    sessionId: sessionId,
                    toolName: toolName,
                    input: input
                )
                pendingPermissions.append(req)

            case .sessionTitleUpdated(_, let title):
                if let idx = sessions.firstIndex(where: { $0.id == sessionId }) {
                    sessions[idx].title = title
                }

            case .userMessageReplay(_, let content):
                appendReplayedUserMessage(content, sessionId: sessionId)

            case .error(_, let message):
                lastError = message
                updateSessionState(sessionId: sessionId, state: .idle)

            default:
                break
            }
        } catch {
            print("[DesktopService] 会话消息解析失败: \(error)")
        }
    }

    // MARK: - Streaming Helpers

    private func ensureStreamingAssistantMessage(sessionId: String, itemId: String?) {
        var msgs = messagesBySession[sessionId, default: []]
        // 检查是否已有该 itemId 的流式消息
        if let itemId, msgs.contains(where: { $0.id == itemId }) { return }

        let msg = Message(
            id: itemId ?? UUID().uuidString,
            sessionId: sessionId,
            role: .assistant,
            kind: .assistantText,
            text: "",
            createdAt: Date(),
            isStreaming: true,
            deliveryState: .pending,
            orderIndex: nextOrderIndex(sessionId: sessionId)
        )
        msgs.append(msg)
        messagesBySession[sessionId] = msgs
    }

    private func appendStreamingDelta(_ delta: String, sessionId: String, itemId: String?) {
        var msgs = messagesBySession[sessionId, default: []]

        if let itemId, let idx = msgs.firstIndex(where: { $0.id == itemId }) {
            msgs[idx].text += delta
            messagesBySession[sessionId] = msgs
        } else {
            // 附加到最后一个流式 assistant 消息
            if let idx = msgs.lastIndex(where: { $0.role == .assistant && $0.isStreaming }) {
                msgs[idx].text += delta
                messagesBySession[sessionId] = msgs
            } else {
                // 创建新的流式消息
                ensureStreamingAssistantMessage(sessionId: sessionId, itemId: itemId)
                appendStreamingDelta(delta, sessionId: sessionId, itemId: itemId)
            }
        }
    }

    private func appendThinkingText(_ text: String, sessionId: String, itemId: String?) {
        guard !text.isEmpty else { return }

        var msgs = messagesBySession[sessionId, default: []]
        if let itemId, let idx = msgs.firstIndex(where: { $0.id == itemId }) {
            msgs[idx].text += text
            msgs[idx].thinkingText = msgs[idx].text
            messagesBySession[sessionId] = msgs
            return
        }

        if let idx = msgs.lastIndex(where: { $0.kind == .thinking && $0.isStreaming }) {
            msgs[idx].text += text
            msgs[idx].thinkingText = msgs[idx].text
            messagesBySession[sessionId] = msgs
            return
        }

        let messageId = itemId ?? UUID().uuidString
        let msg = Message(
            id: messageId,
            sessionId: sessionId,
            role: .assistant,
            kind: .thinking,
            text: text,
            createdAt: Date(),
            isStreaming: true,
            deliveryState: .pending,
            orderIndex: nextOrderIndex(sessionId: sessionId),
            thinkingText: text
        )
        msgs.append(msg)
        messagesBySession[sessionId] = msgs
    }

    private func flushStreamingText(sessionId: String) {
        var msgs = messagesBySession[sessionId, default: []]
        for i in msgs.indices where msgs[i].isStreaming {
            msgs[i].isStreaming = false
            msgs[i].deliveryState = .confirmed
        }
        messagesBySession[sessionId] = msgs
    }

    private func nextOrderIndex(sessionId: String) -> Int {
        (messagesBySession[sessionId]?.last?.orderIndex ?? -1) + 1
    }

    private func updateSessionState(sessionId: String, state: ChatState) {
        if let idx = sessions.firstIndex(where: { $0.id == sessionId }) {
            sessions[idx].state = state
        }
    }

    private func upsertActivatedSession(sessionId: String, title: String?) {
        if let idx = sessions.firstIndex(where: { $0.id == sessionId }) {
            if let title, !title.isEmpty {
                sessions[idx].title = title
            }
        } else {
            sessions.insert(Session(
                id: sessionId,
                title: title?.isEmpty == false ? title : "新对话",
                createdAt: Date(),
                updatedAt: Date(),
                modifiedAt: Date(),
                state: .thinking
            ), at: 0)
        }

        if activeSessionId == sessionId {
            connectToSession(sessionId)
            Task { await loadHistory(sessionId) }
        }
    }

    private func appendReplayedUserMessage(_ content: String, sessionId: String) {
        let trimmed = content.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }

        var messages = messagesBySession[sessionId, default: []]
        if messages.contains(where: {
            $0.role == .user &&
            $0.text.trimmingCharacters(in: .whitespacesAndNewlines) == trimmed
        }) {
            return
        }

        messages.append(Message(
            id: UUID().uuidString,
            sessionId: sessionId,
            role: .user,
            kind: .userText,
            text: content,
            createdAt: Date(),
            isStreaming: false,
            deliveryState: .confirmed,
            orderIndex: nextOrderIndex(sessionId: sessionId)
        ))
        messagesBySession[sessionId] = messages
    }

    private func updateMessageDeliveryState(
        sessionId: String,
        messageId: String,
        deliveryState: DeliveryState
    ) {
        guard var messages = messagesBySession[sessionId],
              let index = messages.firstIndex(where: { $0.id == messageId }) else {
            return
        }
        messages[index].deliveryState = deliveryState
        messagesBySession[sessionId] = messages
    }

    // MARK: - History

    func loadHistory(_ sessionId: String) async {
        guard let baseURL = baseURL, let token = h5Token else { return }

        var request = URLRequest(url: apiURL("api/sessions/\(sessionId)/messages", base: baseURL))
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else { return }

            struct MessagesResponse: Decodable {
                let messages: [Message]
            }
            let result = try jsonDecoder.decode(MessagesResponse.self, from: data)
            messagesBySession[sessionId] = result.messages
        } catch {
            print("[DesktopService] 加载历史失败: \(error)")
        }
    }

    // MARK: - Ping

    private func startPingTimer() {
        pingTimer?.invalidate()
        pingTimer = Timer.scheduledTimer(withTimeInterval: 30, repeats: true) { [weak self] _ in
            Task { @MainActor [weak self] in
                self?.sendPing()
            }
        }
    }

    private func sendPing() {
        guard let ws = globalWebSocket else { return }
        let clientMsg = ClientMessage.ping
        guard let data = clientMsg.jsonData,
              let string = String(data: data, encoding: .utf8) else { return }
        ws.send(.string(string)) { _ in }
    }

    // MARK: - URL Helpers

    private func apiURL(_ path: String, base: URL) -> URL {
        var components = URLComponents(url: base, resolvingAgainstBaseURL: false)!
        components.path = "/" + path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        components.query = nil
        components.fragment = nil
        return components.url!
    }

    private func webSocketURL(_ path: String, token: String, base: URL) throws -> URL {
        var components = URLComponents(url: base, resolvingAgainstBaseURL: false)!
        components.scheme = components.scheme == "https" ? "wss" : "ws"
        components.path = "/" + path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        components.queryItems = [URLQueryItem(name: "token", value: token)]
        guard let url = components.url else {
            throw DesktopServiceError.invalidURL
        }
        return url
    }

    // MARK: - Persistence

    private struct Credentials: Codable {
        let token: String
        let serverURL: String
    }

    private func saveCredentials(token: String, serverURL: URL) {
        let creds = Credentials(token: token, serverURL: serverURL.absoluteString)
        if let data = try? JSONEncoder().encode(creds) {
            KeychainHelper.save(key: "claudehaha_credentials", data: data)
        }
    }

    private func loadCredentials() -> (token: String, serverURL: URL)? {
        guard let data = KeychainHelper.load(key: "claudehaha_credentials") else { return nil }
        guard let creds = try? JSONDecoder().decode(Credentials.self, from: data) else { return nil }
        guard let url = URL(string: creds.serverURL) else { return nil }
        return (creds.token, url)
    }

    func clearCredentials() {
        KeychainHelper.delete(key: "claudehaha_credentials")
        h5Token = nil
        baseURL = nil
    }

    var hasSavedCredentials: Bool {
        loadCredentials() != nil
    }
}

// MARK: - Supporting Types

struct PairingCodeResponse: Codable {
    let pairingCode: String
    let createdAt: Double?
    let expiresAt: Double?
}

struct PairResponse: Codable {
    let ok: Bool
    let token: String
}

struct SessionsResponse: Decodable {
    let sessions: [Session]
    let total: Int
}

struct CreateSessionResponse: Codable {
    let sessionId: String
    let workDir: String?
}

struct RecentProjectsResponse: Decodable {
    let projects: [RecentProject]
}

private struct PendingOutboundMessage {
    let payload: String
    let localMessageId: String
}

struct RecentProject: Identifiable, Decodable, Hashable, Sendable {
    var id: String { realPath }
    let projectPath: String
    let realPath: String
    let projectName: String
    let isGit: Bool
    let repoName: String?
    let branch: String?
    let modifiedAt: Date?
    let sessionCount: Int

    private enum CodingKeys: String, CodingKey {
        case projectPath
        case realPath
        case projectName
        case isGit
        case repoName
        case branch
        case modifiedAt
        case sessionCount
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        projectPath = try container.decode(String.self, forKey: .projectPath)
        realPath = try container.decode(String.self, forKey: .realPath)
        projectName = try container.decode(String.self, forKey: .projectName)
        isGit = try container.decode(Bool.self, forKey: .isGit)
        repoName = try container.decodeIfPresent(String.self, forKey: .repoName)
        branch = try container.decodeIfPresent(String.self, forKey: .branch)
        modifiedAt = try container.decodeFlexibleDateIfPresent(forKey: .modifiedAt)
        sessionCount = try container.decode(Int.self, forKey: .sessionCount)
    }
}

struct NetworkInfo: Codable {
    let recommendedType: String?
    let lanUrl: String?
    let tunnelUrl: String?
    let serverPort: Int?
}

enum DesktopServiceError: LocalizedError {
    case noSavedCredentials
    case notConfigured
    case invalidURL
    case requestFailed(String)
    case connectionFailed(String)

    var errorDescription: String? {
        switch self {
        case .noSavedCredentials: return "没有已保存的连接凭证"
        case .notConfigured: return "服务未配置"
        case .invalidURL: return "无效的 URL"
        case .requestFailed(let msg): return msg
        case .connectionFailed(let msg): return "连接失败: \(msg)"
        }
    }
}
