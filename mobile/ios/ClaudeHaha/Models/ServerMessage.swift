import Foundation

// MARK: - ServerMessage (WebSocket 接收)

/// 对应桌面端 WebSocket 接收的所有 ServerMessage 类型
indirect enum ServerMessage: Codable, Hashable, Sendable {
    case connected(sessionId: String)
    case contentStart(sessionId: String, itemId: String?, role: String?)
    case contentDelta(sessionId: String, itemId: String?, delta: String)
    case toolUseComplete(sessionId: String, itemId: String?, name: String?, input: String?)
    case toolResult(sessionId: String, itemId: String?, output: String?)
    case thinking(sessionId: String, itemId: String?, text: String?)
    case messageComplete(sessionId: String, itemId: String?, tokenUsage: TokenUsage?)
    case status(sessionId: String, state: ChatState)
    case error(sessionId: String, message: String)
    case permissionRequest(sessionId: String, requestId: String, toolName: String, input: String)
    case sessionTitleUpdated(sessionId: String, title: String)
    case permissionModeChanged(sessionId: String, mode: String)
    case sessionBroadcast(sessionId: String, event: ServerMessage)
    case sessionsUpdated(sessions: [SessionSummary])
    case pong

    // Codable
    private enum CodingKeys: String, CodingKey { case type }
    private enum MessageType: String, Codable {
        case connected, content_start, content_delta, tool_use_complete, tool_result
        case thinking, message_complete, status, error, permission_request
        case session_title_updated, permission_mode_changed, session_broadcast
        case sessions_updated, pong
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: DynamicCodingKeys.self)
        let type = try container.decode(MessageType.self, forKey: DynamicCodingKeys(stringValue: "type")!)

        switch type {
        case .connected:
            let sid = try container.decodeIfPresent(String.self, forKey: DynamicCodingKeys(stringValue: "sessionId")!) ?? ""
            self = .connected(sessionId: sid)
        case .content_start:
            let sid = try container.decodeIfPresent(String.self, forKey: DynamicCodingKeys(stringValue: "sessionId")!) ?? ""
            let itemId = try container.decodeIfPresent(String.self, forKey: DynamicCodingKeys(stringValue: "itemId")!)
            let role = try container.decodeIfPresent(String.self, forKey: DynamicCodingKeys(stringValue: "role")!)
            self = .contentStart(sessionId: sid, itemId: itemId, role: role)
        case .content_delta:
            let sid = try container.decodeIfPresent(String.self, forKey: DynamicCodingKeys(stringValue: "sessionId")!) ?? ""
            let itemId = try container.decodeIfPresent(String.self, forKey: DynamicCodingKeys(stringValue: "itemId")!)
            let delta = try container.decodeIfPresent(String.self, forKey: DynamicCodingKeys(stringValue: "delta")!) ?? ""
            self = .contentDelta(sessionId: sid, itemId: itemId, delta: delta)
        case .tool_use_complete:
            let sid = try container.decodeIfPresent(String.self, forKey: DynamicCodingKeys(stringValue: "sessionId")!) ?? ""
            let itemId = try container.decodeIfPresent(String.self, forKey: DynamicCodingKeys(stringValue: "itemId")!)
            let name = try container.decodeIfPresent(String.self, forKey: DynamicCodingKeys(stringValue: "name")!)
            let input = try container.decodeIfPresent(String.self, forKey: DynamicCodingKeys(stringValue: "input")!)
            self = .toolUseComplete(sessionId: sid, itemId: itemId, name: name, input: input)
        case .tool_result:
            let sid = try container.decodeIfPresent(String.self, forKey: DynamicCodingKeys(stringValue: "sessionId")!) ?? ""
            let itemId = try container.decodeIfPresent(String.self, forKey: DynamicCodingKeys(stringValue: "itemId")!)
            let output = try container.decodeIfPresent(String.self, forKey: DynamicCodingKeys(stringValue: "output")!)
            self = .toolResult(sessionId: sid, itemId: itemId, output: output)
        case .thinking:
            let sid = try container.decodeIfPresent(String.self, forKey: DynamicCodingKeys(stringValue: "sessionId")!) ?? ""
            let itemId = try container.decodeIfPresent(String.self, forKey: DynamicCodingKeys(stringValue: "itemId")!)
            let text = try container.decodeIfPresent(String.self, forKey: DynamicCodingKeys(stringValue: "text")!)
            self = .thinking(sessionId: sid, itemId: itemId, text: text)
        case .message_complete:
            let sid = try container.decodeIfPresent(String.self, forKey: DynamicCodingKeys(stringValue: "sessionId")!) ?? ""
            let itemId = try container.decodeIfPresent(String.self, forKey: DynamicCodingKeys(stringValue: "itemId")!)
            let usage = try container.decodeIfPresent(TokenUsage.self, forKey: DynamicCodingKeys(stringValue: "tokenUsage")!)
            self = .messageComplete(sessionId: sid, itemId: itemId, tokenUsage: usage)
        case .status:
            let sid = try container.decodeIfPresent(String.self, forKey: DynamicCodingKeys(stringValue: "sessionId")!) ?? ""
            let state = try container.decode(ChatState.self, forKey: DynamicCodingKeys(stringValue: "state")!)
            self = .status(sessionId: sid, state: state)
        case .error:
            let sid = try container.decodeIfPresent(String.self, forKey: DynamicCodingKeys(stringValue: "sessionId")!) ?? ""
            let msg = try container.decodeIfPresent(String.self, forKey: DynamicCodingKeys(stringValue: "message")!) ?? ""
            self = .error(sessionId: sid, message: msg)
        case .permission_request:
            let sid = try container.decodeIfPresent(String.self, forKey: DynamicCodingKeys(stringValue: "sessionId")!) ?? ""
            let rid = try container.decodeIfPresent(String.self, forKey: DynamicCodingKeys(stringValue: "requestId")!) ?? ""
            let toolName = try container.decodeIfPresent(String.self, forKey: DynamicCodingKeys(stringValue: "toolName")!) ?? ""
            let input = try container.decodeIfPresent(String.self, forKey: DynamicCodingKeys(stringValue: "input")!) ?? ""
            self = .permissionRequest(sessionId: sid, requestId: rid, toolName: toolName, input: input)
        case .session_title_updated:
            let sid = try container.decodeIfPresent(String.self, forKey: DynamicCodingKeys(stringValue: "sessionId")!) ?? ""
            let title = try container.decodeIfPresent(String.self, forKey: DynamicCodingKeys(stringValue: "title")!) ?? ""
            self = .sessionTitleUpdated(sessionId: sid, title: title)
        case .permission_mode_changed:
            let sid = try container.decodeIfPresent(String.self, forKey: DynamicCodingKeys(stringValue: "sessionId")!) ?? ""
            let mode = try container.decodeIfPresent(String.self, forKey: DynamicCodingKeys(stringValue: "mode")!) ?? ""
            self = .permissionModeChanged(sessionId: sid, mode: mode)
        case .session_broadcast:
            let sid = try container.decodeIfPresent(String.self, forKey: DynamicCodingKeys(stringValue: "sessionId")!) ?? ""
            let event = try container.decode(ServerMessage.self, forKey: DynamicCodingKeys(stringValue: "event")!)
            self = .sessionBroadcast(sessionId: sid, event: event)
        case .sessions_updated:
            let sessions = try container.decodeIfPresent([SessionSummary].self, forKey: DynamicCodingKeys(stringValue: "sessions")!) ?? []
            self = .sessionsUpdated(sessions: sessions)
        case .pong:
            self = .pong
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: DynamicCodingKeys.self)
        switch self {
        case .connected(let sid):
            try container.encode(MessageType.connected.rawValue, forKey: DynamicCodingKeys(stringValue: "type")!)
            try container.encode(sid, forKey: DynamicCodingKeys(stringValue: "sessionId")!)
        case .pong:
            try container.encode(MessageType.pong.rawValue, forKey: DynamicCodingKeys(stringValue: "type")!)
        default:
            break // 其他编码按需实现
        }
    }
}

// MARK: - Supporting Types

struct TokenUsage: Codable, Hashable, Sendable {
    let inputTokens: Int?
    let outputTokens: Int?
    let cacheReadTokens: Int?
    let cacheWriteTokens: Int?
}

struct SessionSummary: Codable, Hashable, Sendable {
    let sessionId: String
    let title: String?
    let state: ChatState?
    let updatedAt: Date?
}

// MARK: - ClientMessage (WebSocket 发送)

/// 对应桌面端的 ClientMessage 类型
enum ClientMessage {
    case userMessage(content: String, attachments: [String])
    case permissionResponse(requestId: String, approved: Bool)
    case stopGeneration
    case setPermissionMode(mode: String)
    case ping

    var jsonData: Data? {
        let encoder = JSONEncoder()
        switch self {
        case .userMessage(let content, let attachments):
            let dict: [String: Any] = [
                "type": "user_message",
                "content": content,
                "attachments": attachments
            ]
            return try? JSONSerialization.data(withJSONObject: dict)
        case .permissionResponse(let requestId, let approved):
            let dict: [String: Any] = [
                "type": "permission_response",
                "requestId": requestId,
                "approved": approved
            ]
            return try? JSONSerialization.data(withJSONObject: dict)
        case .stopGeneration:
            let dict: [String: Any] = ["type": "stop_generation"]
            return try? JSONSerialization.data(withJSONObject: dict)
        case .setPermissionMode(let mode):
            let dict: [String: Any] = ["type": "set_permission_mode", "mode": mode]
            return try? JSONSerialization.data(withJSONObject: dict)
        case .ping:
            let dict: [String: Any] = ["type": "ping"]
            return try? JSONSerialization.data(withJSONObject: dict)
        }
    }
}

// MARK: - Dynamic Coding Keys

private struct DynamicCodingKeys: CodingKey {
    var stringValue: String
    var intValue: Int?
    init?(stringValue: String) { self.stringValue = stringValue }
    init?(intValue: Int) { self.stringValue = "\(intValue)"; self.intValue = intValue }
}
