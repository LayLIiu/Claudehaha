import Foundation
import Network

// MARK: - DesktopService

/// iOS 端核心服务 — 连接桌面端 WebSocket，管理会话和消息
/// 对标 CodexMobile 的 CodexService，但使用我们自己的协议
@MainActor
@Observable
final class DesktopService {
    // MARK: - Published State

    var sessions: [Session] = []
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
        case pairing
        case failed(String)
    }

    // MARK: - Private State

    private var globalWebSocket: URLSessionWebSocketTask?
    private var sessionWebSockets: [String: URLSessionWebSocketTask] = [:]
    private var baseURL: URL?
    private var h5Token: String?
    private var pingTimer: Timer?
    private let jsonDecoder: JSONDecoder = {
        let d = JSONDecoder()
        d.dateDecodingStrategy = .millisecondsSince1970
        return d
    }()

    // MARK: - Singleton

    static let shared = DesktopService()

    // MARK: - Connection

    /// 只输入 IP 即可连接 — 自动探测端口并完成配对
    func connectToServer(_ serverURL: URL) async throws {
        connectionState = .pairing

        do {
            // 1. 探测正确的端口（sidecar 端口是动态的）
            let resolvedURL = try await resolveServerURL(serverURL)
            baseURL = resolvedURL

            // 2. 自动生成配对码
            var codeRequest = URLRequest(url: resolvedURL.appendingPathComponent("api/mobile/pairing-code"))
            codeRequest.httpMethod = "POST"
            codeRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
            codeRequest.httpBody = Data("{}".utf8)

            let (codeData, codeResponse) = try await URLSession.shared.data(for: codeRequest)
            guard let codeHTTP = codeResponse as? HTTPURLResponse, codeHTTP.statusCode == 200 else {
                throw DesktopServiceError.connectionFailed("无法连接到桌面端，请确认地址正确且桌面端正在运行")
            }

            let codeResult = try JSONDecoder().decode(PairingCodeResponse.self, from: codeData)

            // 3. 自动用配对码换取 H5 Token
            var pairRequest = URLRequest(url: resolvedURL.appendingPathComponent("api/mobile/pair"))
            pairRequest.httpMethod = "POST"
            pairRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
            pairRequest.httpBody = try JSONEncoder().encode(["code": codeResult.pairingCode])

            let (pairData, pairResponse) = try await URLSession.shared.data(for: pairRequest)
            guard let pairHTTP = pairResponse as? HTTPURLResponse, pairHTTP.statusCode == 200 else {
                throw DesktopServiceError.connectionFailed("配对失败，请重试")
            }

            let pairResult = try JSONDecoder().decode(PairResponse.self, from: pairData)
            self.h5Token = pairResult.token

            // 4. 保存凭证
            saveCredentials(token: pairResult.token, serverURL: resolvedURL)

            // 5. 连接 WebSocket
            try await connect()
        } catch {
            connectionState = .failed(error.localizedDescription)
            throw error
        }
    }

    /// 探测桌面端服务器地址：先试默认端口，再并发扫描 sidecar 高端口
    private func resolveServerURL(_ inputURL: URL) async throws -> URL {
        // 如果用户已指定端口，直接用
        if inputURL.port != nil {
            return inputURL
        }

        let host = inputURL.host ?? inputURL.absoluteString

        // 第一步：先试默认端口 3456
        if let url = try? await probeServer(host: host, port: 3456) {
            return url
        }

        // 第二步：并发扫描 sidecar 高端口范围（每次 50 个一批）
        let portRanges = stride(from: 49000, through: 65535, by: 1)
        let batchSize = 50

        var remaining = Array(portRanges)
        while !remaining.isEmpty {
            let batch = remaining.prefix(batchSize)
            remaining = Array(remaining.dropFirst(batchSize))

            let foundURL: URL? = try await withThrowingTaskGroup(of: URL?.self) { group in
                for port in batch {
                    group.addTask { try? await self.probeServer(host: host, port: port) }
                }
                for try await result in group {
                    if let url = result {
                        group.cancelAll()
                        return url
                    }
                }
                return nil
            }

            if let foundURL { return foundURL }
        }

        throw DesktopServiceError.connectionFailed("找不到桌面端服务，请确认桌面端正在运行")
    }

    /// 探测指定端口是否是 ClaudeHaha 服务
    private func probeServer(host: String, port: Int) async throws -> URL? {
        guard let testURL = URL(string: "http://\(host):\(port)") else { return nil }
        var request = URLRequest(url: testURL.appendingPathComponent("health"))
        request.timeoutInterval = 1.5
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, http.statusCode == 200 else { return nil }
            if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               json["status"] as? String == "ok" {
                return testURL
            }
            return nil
        } catch {
            return nil
        }
    }

    /// 获取桌面端网络信息
    func fetchNetworkInfo(serverURL: URL) async throws -> NetworkInfo {
        let url = serverURL.appendingPathComponent("api/mobile/network-info")
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

        // 保存的 URL 可能端口已变（sidecar 重启后端口会变），需要重新探测
        let resolvedURL = try await resolveServerURL(url)
        self.baseURL = resolvedURL

        // 更新保存的 URL（新端口）
        saveCredentials(token: token, serverURL: resolvedURL)

        try await connect()
    }

    /// 建立 WebSocket 连接
    func connect() async throws {
        guard let baseURL = baseURL, let token = h5Token else {
            throw DesktopServiceError.notConfigured
        }

        connectionState = .connecting

        // 连接全局 WebSocket 通道
        let globalURL = baseURL
            .appendingPathComponent("ws/global")
            .appending(queryItems: [URLQueryItem(name: "token", value: token)])

        // 将 http/https 替换为 ws/wss
        var wsComponents = URLComponents(url: globalURL, resolvingAgainstBaseURL: false)!
        if wsComponents.scheme == "http" { wsComponents.scheme = "ws" }
        else if wsComponents.scheme == "https" { wsComponents.scheme = "wss" }

        guard let wsURL = wsComponents.url else {
            connectionState = .failed("无效的 WebSocket URL")
            throw DesktopServiceError.invalidURL
        }

        let request = URLRequest(url: wsURL)
        globalWebSocket = URLSession.shared.webSocketTask(with: request)
        globalWebSocket?.resume()

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

        pingTimer?.invalidate()
        pingTimer = nil

        connectionState = .disconnected
    }

    // MARK: - Session Management

    /// 刷新会话列表
    func refreshSessions() async {
        guard let baseURL = baseURL, let token = h5Token else { return }

        var request = URLRequest(url: baseURL.appendingPathComponent("api/sessions"))
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
                return
            }
            self.sessions = try jsonDecoder.decode([Session].self, from: data)
        } catch {
            lastError = "获取会话列表失败: \(error.localizedDescription)"
        }
    }

    /// 创建新会话
    func createSession(workDir: String? = nil) async throws -> Session {
        guard let baseURL = baseURL, let token = h5Token else {
            throw DesktopServiceError.notConfigured
        }

        var request = URLRequest(url: baseURL.appendingPathComponent("api/sessions"))
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        var body: [String: String] = [:]
        if let workDir { body["workDir"] = workDir }
        request.httpBody = try JSONEncoder().encode(body)

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            throw DesktopServiceError.requestFailed("创建会话失败")
        }

        let session = try jsonDecoder.decode(Session.self, from: data)
        sessions.insert(session, at: 0)
        return session
    }

    /// 删除会话
    func deleteSession(_ sessionId: String) async throws {
        guard let baseURL = baseURL, let token = h5Token else {
            throw DesktopServiceError.notConfigured
        }

        var request = URLRequest(url: baseURL.appendingPathComponent("api/sessions/\(sessionId)"))
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

        let sessionURL = baseURL
            .appendingPathComponent("ws/\(sessionId)")
            .appending(queryItems: [URLQueryItem(name: "token", value: token)])

        var wsComponents = URLComponents(url: sessionURL, resolvingAgainstBaseURL: false)!
        if wsComponents.scheme == "http" { wsComponents.scheme = "ws" }
        else if wsComponents.scheme == "https" { wsComponents.scheme = "wss" }

        guard let wsURL = wsComponents.url else { return }

        let request = URLRequest(url: wsURL)
        let ws = URLSession.shared.webSocketTask(with: request)
        sessionWebSockets[sessionId] = ws
        ws.resume()

        receiveSessionMessages(sessionId)

        // 加载历史消息
        Task { await loadHistory(sessionId) }
    }

    /// 发送消息
    func sendMessage(sessionId: String, content: String, attachments: [String] = []) {
        let ws = sessionWebSockets[sessionId] ?? globalWebSocket
        guard let ws else { return }

        let clientMsg = ClientMessage.userMessage(content: content, attachments: attachments)
        guard let data = clientMsg.jsonData,
              let string = String(data: data, encoding: .utf8) else { return }

        ws.send(.string(string)) { [weak self] error in
            if let error {
                Task { @MainActor in
                    self?.lastError = "发送失败: \(error.localizedDescription)"
                }
            }
        }

        // 本地先添加用户消息
        let userMsg = Message(
            id: UUID().uuidString,
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
                    if case .connecting = self.connectionState { return }
                    self.connectionState = .failed("连接断开: \(error.localizedDescription)")
                    // 自动重连
                    Task {
                        try? await Task.sleep(for: .seconds(3))
                        try? await self.connect()
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
            let req = PermissionRequest(
                id: requestId,
                sessionId: sessionId,
                toolName: toolName,
                input: input
            )
            pendingPermissions.append(req)
        case .error(_, let message):
            lastError = message
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
                let msg = Message(
                    id: itemId ?? UUID().uuidString,
                    sessionId: sessionId,
                    role: .assistant,
                    kind: .thinking,
                    text: text ?? "",
                    createdAt: Date(),
                    isStreaming: false,
                    deliveryState: .confirmed,
                    orderIndex: nextOrderIndex(sessionId: sessionId),
                    thinkingText: text
                )
                messagesBySession[sessionId, default: []].append(msg)

            case .messageComplete(_, _, _):
                flushStreamingText(sessionId: sessionId)

            case .status(_, let state):
                if let idx = sessions.firstIndex(where: { $0.id == sessionId }) {
                    sessions[idx].state = state
                }

            case .permissionRequest(_, let requestId, let toolName, let input):
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

            case .error(_, let message):
                lastError = message

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

    // MARK: - History

    func loadHistory(_ sessionId: String) async {
        guard let baseURL = baseURL, let token = h5Token else { return }

        var request = URLRequest(url: baseURL.appendingPathComponent("api/sessions/\(sessionId)/messages"))
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else { return }

            struct MessagesResponse: Codable {
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

struct NetworkInfo: Codable {
    let recommendedType: String?
    let lanUrl: String?
    let tunnelUrl: String?
    let serverPort: Int?
}

enum DesktopServiceError: LocalizedError {
    case pairingFailed(String)
    case noSavedCredentials
    case notConfigured
    case invalidURL
    case requestFailed(String)
    case connectionFailed(String)

    var errorDescription: String? {
        switch self {
        case .pairingFailed(let msg): return "配对失败: \(msg)"
        case .noSavedCredentials: return "没有已保存的连接凭证"
        case .notConfigured: return "服务未配置"
        case .invalidURL: return "无效的 URL"
        case .requestFailed(let msg): return msg
        case .connectionFailed(let msg): return "连接失败: \(msg)"
        }
    }
}
