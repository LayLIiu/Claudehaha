import Foundation

// MARK: - Message

/// 对应桌面端的 UIMessage，用于 iOS 端渲染
struct Message: Identifiable, Decodable, Hashable, Sendable {
    let id: String
    let sessionId: String
    var role: MessageRole
    var kind: MessageKind
    var text: String
    var createdAt: Date
    var isStreaming: Bool
    var deliveryState: DeliveryState
    var orderIndex: Int
    var turnId: String?
    var toolName: String?
    var toolInput: String?
    var toolOutput: String?
    var thinkingText: String?

    // 用于 SwiftUI diffing 优化
    var textRenderSignature: Int {
        var hasher = Hasher()
        hasher.combine(text)
        hasher.combine(isStreaming)
        hasher.combine(orderIndex)
        return hasher.finalize()
    }

    static func == (lhs: Message, rhs: Message) -> Bool {
        lhs.id == rhs.id &&
        lhs.textRenderSignature == rhs.textRenderSignature &&
        lhs.deliveryState == rhs.deliveryState &&
        lhs.kind == rhs.kind
    }

    func hash(into hasher: inout Hasher) {
        hasher.combine(id)
    }

    init(
        id: String,
        sessionId: String,
        role: MessageRole,
        kind: MessageKind,
        text: String,
        createdAt: Date,
        isStreaming: Bool,
        deliveryState: DeliveryState,
        orderIndex: Int,
        turnId: String? = nil,
        toolName: String? = nil,
        toolInput: String? = nil,
        toolOutput: String? = nil,
        thinkingText: String? = nil
    ) {
        self.id = id
        self.sessionId = sessionId
        self.role = role
        self.kind = kind
        self.text = text
        self.createdAt = createdAt
        self.isStreaming = isStreaming
        self.deliveryState = deliveryState
        self.orderIndex = orderIndex
        self.turnId = turnId
        self.toolName = toolName
        self.toolInput = toolInput
        self.toolOutput = toolOutput
        self.thinkingText = thinkingText
    }

    private enum CodingKeys: String, CodingKey {
        case id
        case sessionId
        case type
        case role
        case kind
        case content
        case text
        case timestamp
        case createdAt
        case isStreaming
        case deliveryState
        case orderIndex
        case turnId
        case toolName
        case toolInput
        case toolOutput
        case thinkingText
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decodeIfPresent(String.self, forKey: .id) ?? UUID().uuidString
        sessionId = try container.decodeIfPresent(String.self, forKey: .sessionId) ?? ""

        if let storedRole = try container.decodeIfPresent(MessageRole.self, forKey: .role) {
            role = storedRole
        } else {
            let type = try container.decodeIfPresent(String.self, forKey: .type) ?? "system"
            role = MessageRole(serverType: type)
        }

        if let storedKind = try container.decodeIfPresent(MessageKind.self, forKey: .kind) {
            kind = storedKind
        } else {
            let type = try container.decodeIfPresent(String.self, forKey: .type) ?? role.rawValue
            kind = MessageKind(serverType: type)
        }

        if let storedText = try container.decodeIfPresent(String.self, forKey: .text) {
            text = storedText
        } else if let content = try? container.decodeIfPresent(MessageJSONValue.self, forKey: .content) {
            text = content.plainText
        } else {
            text = ""
        }

        createdAt = try container.decodeFlexibleDateIfPresent(forKey: .createdAt)
            ?? container.decodeFlexibleDateIfPresent(forKey: .timestamp)
            ?? Date()
        isStreaming = try container.decodeIfPresent(Bool.self, forKey: .isStreaming) ?? false
        deliveryState = try container.decodeIfPresent(DeliveryState.self, forKey: .deliveryState) ?? .confirmed
        orderIndex = try container.decodeIfPresent(Int.self, forKey: .orderIndex) ?? 0
        turnId = try container.decodeIfPresent(String.self, forKey: .turnId)
        toolName = try container.decodeIfPresent(String.self, forKey: .toolName)
        toolInput = try container.decodeIfPresent(String.self, forKey: .toolInput)
        toolOutput = try container.decodeIfPresent(String.self, forKey: .toolOutput)
        thinkingText = try container.decodeIfPresent(String.self, forKey: .thinkingText)
    }
}

// MARK: - Message Role

enum MessageRole: String, Codable, Hashable, Sendable, CaseIterable {
    case user
    case assistant
    case system

    init(serverType: String) {
        switch serverType {
        case "user":
            self = .user
        case "assistant":
            self = .assistant
        default:
            self = .system
        }
    }
}

// MARK: - Message Kind

enum MessageKind: String, Codable, Hashable, Sendable, CaseIterable {
    case userText = "user_text"
    case assistantText = "assistant_text"
    case toolUse = "tool_use"
    case toolResult = "tool_result"
    case thinking
    case compactSummary = "compact_summary"
    case permissionRequest = "permission_request"
    case error
    case system

    var isSystemRow: Bool {
        switch self {
        case .toolUse, .toolResult, .thinking, .compactSummary, .system:
            return true
        default:
            return false
        }
    }

    init(serverType: String) {
        switch serverType {
        case "user":
            self = .userText
        case "assistant":
            self = .assistantText
        case "tool_use":
            self = .toolUse
        case "tool_result":
            self = .toolResult
        case "system":
            self = .system
        default:
            self = .system
        }
    }
}

// MARK: - Delivery State

enum DeliveryState: String, Codable, Hashable, Sendable {
    case pending
    case confirmed
    case failed
}

// MARK: - Permission Request

/// 对应桌面端的权限请求
struct PermissionRequest: Identifiable, Codable, Hashable, Sendable {
    let id: String
    let sessionId: String
    let toolName: String
    let input: String
    var response: PermissionResponse?

    enum PermissionResponse: String, Codable, Hashable, Sendable {
        case allow
        case deny
    }
}

private enum MessageJSONValue: Decodable {
    case string(String)
    case number(Double)
    case bool(Bool)
    case array([MessageJSONValue])
    case object([String: MessageJSONValue])
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
        } else if let value = try? container.decode([MessageJSONValue].self) {
            self = .array(value)
        } else {
            self = .object(try container.decode([String: MessageJSONValue].self))
        }
    }

    var plainText: String {
        switch self {
        case .string(let value):
            return value
        case .number(let value):
            return String(value)
        case .bool(let value):
            return value ? "true" : "false"
        case .array(let values):
            return values.map(\.plainText).filter { !$0.isEmpty }.joined(separator: "\n")
        case .object(let object):
            if case .string(let text)? = object["text"] {
                return text
            }
            if case .string(let content)? = object["content"] {
                return content
            }
            if let data = try? JSONEncoder().encode(object.mapValues(\.encodableValue)),
               let string = String(data: data, encoding: .utf8) {
                return string
            }
            return ""
        case .null:
            return ""
        }
    }

    private var encodableValue: AnyEncodable {
        switch self {
        case .string(let value):
            return AnyEncodable(value)
        case .number(let value):
            return AnyEncodable(value)
        case .bool(let value):
            return AnyEncodable(value)
        case .array(let values):
            return AnyEncodable(values.map(\.encodableValue))
        case .object(let object):
            return AnyEncodable(object.mapValues(\.encodableValue))
        case .null:
            return AnyEncodable(nil as String?)
        }
    }
}

private struct AnyEncodable: Encodable {
    let value: Any?

    init(_ value: Any?) {
        self.value = value
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch value {
        case let value as String:
            try container.encode(value)
        case let value as Double:
            try container.encode(value)
        case let value as Bool:
            try container.encode(value)
        case let value as [AnyEncodable]:
            try container.encode(value)
        case let value as [String: AnyEncodable]:
            try container.encode(value)
        default:
            try container.encodeNil()
        }
    }
}
