import Foundation

// MARK: - Session

/// 对应桌面端的 SessionListItem
struct Session: Identifiable, Decodable, Hashable, Sendable {
    let id: String
    var title: String?
    var preview: String?
    var createdAt: Date?
    var updatedAt: Date?
    var modifiedAt: Date?
    var workDir: String?
    var projectPath: String?
    var projectRoot: String?
    var model: String?
    var state: ChatState

    var displayTitle: String {
        title ?? preview ?? "新对话"
    }

    var projectDisplayName: String? {
        guard let path = projectGroupPath, !path.isEmpty else { return nil }
        return URL(fileURLWithPath: path).lastPathComponent
    }

    var projectGroupPath: String? {
        projectRoot?.nilIfEmpty ?? workDir?.nilIfEmpty ?? projectPath?.nilIfEmpty
    }

    var projectSubtitle: String? {
        projectGroupPath?.nilIfEmpty
    }

    init(
        id: String,
        title: String? = nil,
        preview: String? = nil,
        createdAt: Date? = nil,
        updatedAt: Date? = nil,
        modifiedAt: Date? = nil,
        workDir: String? = nil,
        projectPath: String? = nil,
        projectRoot: String? = nil,
        model: String? = nil,
        state: ChatState = .idle
    ) {
        self.id = id
        self.title = title
        self.preview = preview
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.modifiedAt = modifiedAt
        self.workDir = workDir
        self.projectPath = projectPath
        self.projectRoot = projectRoot
        self.model = model
        self.state = state
    }

    private enum CodingKeys: String, CodingKey {
        case id
        case sessionId
        case title
        case preview
        case createdAt
        case updatedAt
        case modifiedAt
        case workDir
        case projectPath
        case projectRoot
        case model
        case state
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decodeIfPresent(String.self, forKey: .id)
            ?? container.decode(String.self, forKey: .sessionId)
        title = try container.decodeIfPresent(String.self, forKey: .title)
        preview = try container.decodeIfPresent(String.self, forKey: .preview)
        createdAt = try container.decodeFlexibleDateIfPresent(forKey: .createdAt)
        updatedAt = try container.decodeFlexibleDateIfPresent(forKey: .updatedAt)
        modifiedAt = try container.decodeFlexibleDateIfPresent(forKey: .modifiedAt)
        workDir = try container.decodeIfPresent(String.self, forKey: .workDir)
        projectPath = try container.decodeIfPresent(String.self, forKey: .projectPath)
        projectRoot = try container.decodeIfPresent(String.self, forKey: .projectRoot)
        model = try container.decodeIfPresent(String.self, forKey: .model)
        state = try container.decodeIfPresent(ChatState.self, forKey: .state) ?? .idle
    }
}

private extension String {
    var nilIfEmpty: String? {
        isEmpty ? nil : self
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

extension KeyedDecodingContainer {
    func decodeFlexibleDateIfPresent(forKey key: Key) throws -> Date? {
        if let date = try? decodeIfPresent(Date.self, forKey: key) {
            return date
        }

        if let seconds = try? decodeIfPresent(Double.self, forKey: key) {
            return Date(timeIntervalSince1970: seconds > 10_000_000_000 ? seconds / 1000 : seconds)
        }

        guard let value = try? decodeIfPresent(String.self, forKey: key), !value.isEmpty else {
            return nil
        }

        if let date = ISO8601DateFormatter.withFractionalSeconds.date(from: value) {
            return date
        }
        return ISO8601DateFormatter.standard.date(from: value)
    }
}

extension ISO8601DateFormatter {
    static let standard: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()

    static let withFractionalSeconds: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()
}
