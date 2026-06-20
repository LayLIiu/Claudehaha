import Foundation

// MARK: - ServerMessage (WebSocket 接收)

/// 对应桌面端 WebSocket 接收的所有 ServerMessage 类型
indirect enum ServerMessage: Decodable, Hashable, Sendable {
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
    case userMessageReplay(sessionId: String, content: String)
    case sessionTitleUpdated(sessionId: String, title: String)
    case permissionModeChanged(sessionId: String, mode: String)
    case sessionBroadcast(sessionId: String, event: ServerMessage)
    case sessionActivated(sessionId: String, title: String?)
    case sessionsUpdated(sessions: [SessionSummary])
    case pong
    case ignored(type: String)

    // Codable
    private enum CodingKeys: String, CodingKey { case type }
    private enum MessageType: String, Codable {
        case connected, content_start, content_delta, tool_use_complete, tool_result
        case thinking, message_complete, status, error, permission_request, user_message_replay
        case session_title_updated, permission_mode_changed, session_broadcast, session_activated
        case sessions_updated, pong
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: DynamicCodingKeys.self)
        let rawType = try container.decode(String.self, forKey: DynamicCodingKeys(stringValue: "type")!)
        guard let type = MessageType(rawValue: rawType) else {
            self = .ignored(type: rawType)
            return
        }

        switch type {
        case .connected:
            let sid = try container.decodeIfPresent(String.self, forKey: DynamicCodingKeys(stringValue: "sessionId")!) ?? ""
            self = .connected(sessionId: sid)
        case .content_start:
            let sid = try container.decodeIfPresent(String.self, forKey: DynamicCodingKeys(stringValue: "sessionId")!) ?? ""
            let itemId = try container.decodeIfPresent(String.self, forKey: DynamicCodingKeys(stringValue: "toolUseId")!)
            let role = try container.decodeIfPresent(String.self, forKey: DynamicCodingKeys(stringValue: "role")!)
                ?? container.decodeIfPresent(String.self, forKey: DynamicCodingKeys(stringValue: "blockType")!)
            self = .contentStart(sessionId: sid, itemId: itemId, role: role)
        case .content_delta:
            let sid = try container.decodeIfPresent(String.self, forKey: DynamicCodingKeys(stringValue: "sessionId")!) ?? ""
            let itemId = try container.decodeIfPresent(String.self, forKey: DynamicCodingKeys(stringValue: "toolUseId")!)
            let delta = try container.decodeIfPresent(String.self, forKey: DynamicCodingKeys(stringValue: "text")!)
                ?? container.decodeIfPresent(String.self, forKey: DynamicCodingKeys(stringValue: "toolInput")!)
                ?? ""
            self = .contentDelta(sessionId: sid, itemId: itemId, delta: delta)
        case .tool_use_complete:
            let sid = try container.decodeIfPresent(String.self, forKey: DynamicCodingKeys(stringValue: "sessionId")!) ?? ""
            let itemId = try container.decodeIfPresent(String.self, forKey: DynamicCodingKeys(stringValue: "toolUseId")!)
            let name = try container.decodeIfPresent(String.self, forKey: DynamicCodingKeys(stringValue: "toolName")!)
            let input = try container.decodeJSONStringIfPresent(forKey: DynamicCodingKeys(stringValue: "input")!)
            self = .toolUseComplete(sessionId: sid, itemId: itemId, name: name, input: input)
        case .tool_result:
            let sid = try container.decodeIfPresent(String.self, forKey: DynamicCodingKeys(stringValue: "sessionId")!) ?? ""
            let itemId = try container.decodeIfPresent(String.self, forKey: DynamicCodingKeys(stringValue: "toolUseId")!)
            let output = try container.decodeJSONStringIfPresent(forKey: DynamicCodingKeys(stringValue: "content")!)
            self = .toolResult(sessionId: sid, itemId: itemId, output: output)
        case .thinking:
            let sid = try container.decodeIfPresent(String.self, forKey: DynamicCodingKeys(stringValue: "sessionId")!) ?? ""
            let itemId = try container.decodeIfPresent(String.self, forKey: DynamicCodingKeys(stringValue: "toolUseId")!)
            let text = try container.decodeIfPresent(String.self, forKey: DynamicCodingKeys(stringValue: "text")!)
            self = .thinking(sessionId: sid, itemId: itemId, text: text)
        case .message_complete:
            let sid = try container.decodeIfPresent(String.self, forKey: DynamicCodingKeys(stringValue: "sessionId")!) ?? ""
            let itemId = try container.decodeIfPresent(String.self, forKey: DynamicCodingKeys(stringValue: "toolUseId")!)
            let usage = try container.decodeIfPresent(TokenUsage.self, forKey: DynamicCodingKeys(stringValue: "usage")!)
                ?? container.decodeIfPresent(TokenUsage.self, forKey: DynamicCodingKeys(stringValue: "tokenUsage")!)
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
            let input = try container.decodeJSONStringIfPresent(forKey: DynamicCodingKeys(stringValue: "input")!) ?? ""
            self = .permissionRequest(sessionId: sid, requestId: rid, toolName: toolName, input: input)
        case .user_message_replay:
            let sid = try container.decodeIfPresent(String.self, forKey: DynamicCodingKeys(stringValue: "sessionId")!) ?? ""
            let content = try container.decodeIfPresent(String.self, forKey: DynamicCodingKeys(stringValue: "content")!) ?? ""
            self = .userMessageReplay(sessionId: sid, content: content)
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
        case .session_activated:
            let sid = try container.decodeIfPresent(String.self, forKey: DynamicCodingKeys(stringValue: "sessionId")!) ?? ""
            let title = try container.decodeIfPresent(String.self, forKey: DynamicCodingKeys(stringValue: "title")!)
            self = .sessionActivated(sessionId: sid, title: title)
        case .sessions_updated:
            let sessions = try container.decodeIfPresent([SessionSummary].self, forKey: DynamicCodingKeys(stringValue: "sessions")!) ?? []
            self = .sessionsUpdated(sessions: sessions)
        case .pong:
            self = .pong
        }
    }

}

// MARK: - Supporting Types

struct TokenUsage: Decodable, Hashable, Sendable {
    let inputTokens: Int?
    let outputTokens: Int?
    let cacheReadTokens: Int?
    let cacheWriteTokens: Int?

    private enum CodingKeys: String, CodingKey {
        case inputTokens = "input_tokens"
        case outputTokens = "output_tokens"
        case cacheReadTokens = "cache_read_tokens"
        case cacheWriteTokens = "cache_creation_tokens"
    }
}

struct SessionSummary: Decodable, Hashable, Sendable {
    let sessionId: String
    let title: String?
    let state: ChatState?
    let updatedAt: Date?

    private enum CodingKeys: String, CodingKey {
        case sessionId
        case title
        case state
        case updatedAt
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        sessionId = try container.decode(String.self, forKey: .sessionId)
        title = try container.decodeIfPresent(String.self, forKey: .title)
        state = try container.decodeIfPresent(ChatState.self, forKey: .state)
        updatedAt = try container.decodeFlexibleDateIfPresent(forKey: .updatedAt)
    }
}

// MARK: - ClientMessage (WebSocket 发送)

/// 对应桌面端的 ClientMessage 类型
enum ClientMessage {
    case userMessage(content: String)
    case permissionResponse(requestId: String, approved: Bool)
    case stopGeneration
    case setPermissionMode(mode: String)
    case ping

    var jsonData: Data? {
        switch self {
        case .userMessage(let content):
            let dict: [String: Any] = [
                "type": "user_message",
                "content": content
            ]
            return try? JSONSerialization.data(withJSONObject: dict)
        case .permissionResponse(let requestId, let approved):
            let dict: [String: Any] = [
                "type": "permission_response",
                "requestId": requestId,
                "allowed": approved
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

private extension KeyedDecodingContainer where Key == DynamicCodingKeys {
    func decodeJSONStringIfPresent(forKey key: Key) throws -> String? {
        if let value = try decodeIfPresent(String.self, forKey: key) {
            return value
        }
        if let value = try decodeIfPresent(AnyJSON.self, forKey: key) {
            return value.displayText
        }
        return nil
    }
}

private enum AnyJSON: Decodable {
    case string(String)
    case number(Double)
    case bool(Bool)
    case array([AnyJSON])
    case object([String: AnyJSON])
    case null

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() {
            self = .null
        } else if let value = try? container.decode(String.self) {
            self = .string(value)
        } else if let value = try? container.decode(Double.self) {
            self = .number(value)
        } else if let value = try? container.decode(Bool.self) {
            self = .bool(value)
        } else if let value = try? container.decode([AnyJSON].self) {
            self = .array(value)
        } else {
            self = .object(try container.decode([String: AnyJSON].self))
        }
    }

    var displayText: String {
        switch self {
        case .string(let value):
            return value
        case .number(let value):
            return String(value)
        case .bool(let value):
            return value ? "true" : "false"
        case .array(let values):
            return values.map(\.displayText).joined(separator: "\n")
        case .object:
            return String(describing: self)
        case .null:
            return ""
        }
    }
}
