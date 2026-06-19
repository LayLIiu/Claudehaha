import Foundation

// MARK: - Session

/// 对应桌面端的 SessionListItem
struct Session: Identifiable, Codable, Hashable, Sendable {
    let id: String
    var title: String?
    var preview: String?
    var createdAt: Date?
    var updatedAt: Date?
    var workDir: String?
    var model: String?
    var state: ChatState

    var displayTitle: String {
        title ?? preview ?? "新对话"
    }

    var projectDisplayName: String? {
        guard let workDir = workDir, !workDir.isEmpty else { return nil }
        return URL(fileURLWithPath: workDir).lastPathComponent
    }
}

// MARK: - Chat State

/// 对应桌面端的 ChatState
enum ChatState: String, Codable, Hashable, Sendable, CaseIterable {
    case idle
    case thinking
    case streaming
    case toolExecuting = "tool_executing"
    case compacting
    case permissionPending = "permission_pending"
    case error

    var isRunning: Bool {
        switch self {
        case .idle, .error: return false
        default: return true
        }
    }

    var displayName: String {
        switch self {
        case .idle: return "空闲"
        case .thinking: return "思考中"
        case .streaming: return "输出中"
        case .toolExecuting: return "工具执行中"
        case .compacting: return "压缩上下文中"
        case .permissionPending: return "等待审批"
        case .error: return "错误"
        }
    }
}
