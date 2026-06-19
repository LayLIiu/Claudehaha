import Foundation

// MARK: - Message

/// 对应桌面端的 UIMessage，用于 iOS 端渲染
struct Message: Identifiable, Codable, Hashable, Sendable {
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
}

// MARK: - Message Role

enum MessageRole: String, Codable, Hashable, Sendable, CaseIterable {
    case user
    case assistant
    case system
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
