// FILE: MissingStubs.swift
// Purpose: 编译占位类型，被 Remodex 视图层引用但无需完整实现
// 注意：不包含 Remodex Models/ 目录或 Views/ 目录中已定义的类型

import SwiftUI

// MARK: - Voice Module

@MainActor
final class VoiceInputCoordinator: ObservableObject {
    @Published var isRecording: Bool = false
    @Published var recoveryReason: String? = nil
    @Published var audioLevels: [CGFloat] = []
    @Published var recordingDuration: TimeInterval = 0
    @Published var buttonPresentation: TurnComposerVoiceButtonPresentation = TurnComposerVoiceButtonPresentation(systemImageName: "mic.fill", foregroundColor: .gray, backgroundColor: .clear, accessibilityLabel: "Voice", isDisabled: true, showsProgress: false, hasCircleBackground: true)
    @Published var isInputActive: Bool = false
    @Published var isShowingSetupSheet: Bool = false
    func startRecording() {}
    func stopRecording() {}
    func clearRecovery() { recoveryReason = nil }
    func handleButtonTap() {}
    func handleScenePhaseChange(_ phase: ScenePhase) {}
    func handleViewDisappear() {}
    func handleCaptureInvalidation() {}
    func startVoiceLoginOnMac() {}
}

struct SidebarLocalFolderBrowserSheet: View {
    var body: some View { EmptyView() }
}

struct GPTVoiceSetupSheet: View {
    var body: some View { EmptyView() }
}

// VoiceRecoveryPresentation 和 VoiceRecoveryAction 已在 TurnViewSupportViews.swift 中定义

// TurnComposerVoiceButtonPresentation 已在 TurnComposerVoiceButton.swift 中定义

struct TurnVoiceRecoveryPresentationBuilder {
    static func build(from error: Error) -> VoiceRecoveryPresentation? { nil }
}

struct VoiceRecordingCapsule: View {
    var body: some View { EmptyView() }
}

// MARK: - Subscription Module

@MainActor
@Observable
final class SubscriptionService {
    var freeSendsRemaining: Int? = nil
    var isSubscribed: Bool = false
    var canSend: Bool = true
    var hasAppAccess: Bool = true
    func consumeFreeSendAttemptIfNeeded() {}
}

// MARK: - Git / Worktree Module (非 Models/Views 中已有的)

enum GitActionsError: LocalizedError {
    case disconnected
    case invalidResponse
    case bridgeError(code: String?, message: String?)

    var errorDescription: String? {
        switch self {
        case .disconnected: return "Not connected to bridge."
        case .invalidResponse: return "Invalid response from bridge."
        case .bridgeError(_, let message): return message ?? "Git operation failed."
        }
    }
}

@MainActor
@Observable
final class WorktreeFlowCoordinator {
    func createWorktree() {}
    func deleteWorktree() {}
    func switchToWorktree() {}
    func handoffThreadToLocal(threadId: String, codex: CodexService) {}
    func handoffThreadToWorktree(threadId: String, worktreePath: String, codex: CodexService) {}
    var localForkProjectPath: String? { nil }
}

@MainActor
@Observable
final class GitActionsService {
    private let codex: CodexService
    private let workingDirectory: String?

    init(codex: CodexService, workingDirectory: String?) {
        self.codex = codex
        self.workingDirectory = workingDirectory
    }

    func status() async throws -> GitRepoSyncResult { throw GitActionsError.disconnected }
    func branchesWithStatus() async throws -> GitBranchesWithStatusResult { throw GitActionsError.disconnected }
    func createBranch(name: String) async throws -> GitCreateBranchResult { throw GitActionsError.disconnected }
    func checkout(branch: String) async throws -> GitCheckoutResult { throw GitActionsError.disconnected }
    func pull() async throws -> GitPullResult { throw GitActionsError.disconnected }
    func commit(message: String?) async throws -> GitCommitResult { throw GitActionsError.disconnected }
    func resetToRemote() async throws -> GitResetResult { throw GitActionsError.disconnected }
    func push() async throws -> GitPushResult { throw GitActionsError.disconnected }
    func createWorktree(name: String, baseBranch: String, changeTransfer: GitWorktreeChangeTransferMode = .move) async throws -> GitCreateWorktreeResult { throw GitActionsError.disconnected }
    func createManagedWorktree(baseBranch: String, changeTransfer: GitWorktreeChangeTransferMode = .move) async throws -> GitCreateManagedWorktreeResult { throw GitActionsError.disconnected }
    func runStackedAction(action: String, commitMessage: String? = nil, model: String? = nil, baseBranch: String? = nil, featureBranch: Bool = false, onProgress: ((TurnGitActionPhase, TurnGitActionPhaseStatus) -> Void)? = nil) async throws -> GitStackedActionResult { throw GitActionsError.disconnected }
    func generateCommitMessage(model: String?) async throws -> GitGeneratedCommitMessageResult { throw GitActionsError.disconnected }
    func initializeRepository() async throws -> GitInitResult { throw GitActionsError.disconnected }
    func diff() async throws -> GitRepoDiffResult { throw GitActionsError.disconnected }
    func performAction() {}
    func refreshStatus() {}
}

enum CodexThreadStartProjectBinding {
    static func normalizedProjectPath(_ rawValue: String?) -> String? {
        guard let rawValue, !rawValue.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return nil }
        return rawValue.trimmingCharacters(in: .whitespacesAndNewlines)
    }
}

// MARK: - Workspace

struct WorkspaceFileLinkResolver {
    static func resolve(from message: CodexMessage) -> String? { nil }
}

struct WorkspaceFilePreviewRequest: Identifiable, Equatable {
    let id: String
    let filePath: String
}

struct WorkspaceLinkedFilePreviewScreen: View {
    let request: WorkspaceFilePreviewRequest
    var body: some View { EmptyView() }
}

struct CodexPreAppendedTurnMessage: Identifiable, Equatable {
    let id: String
    let text: String
    let turnId: String?
    var messageID: String { id }
    var automaticTitleSeed: String? { nil }

    init(id: String, text: String, turnId: String?) {
        self.id = id
        self.text = text
        self.turnId = turnId
    }

    init(messageID: String, automaticTitleSeed: String?) {
        self.id = messageID
        self.text = ""
        self.turnId = nil
    }
}

// MARK: - Misc Views

struct AssistantMarkdownImagePreviewButton: View {
    var body: some View { EmptyView() }
}

// GlassAccessoryCard 已在 PlanAccessoryCard.swift 中定义（泛型版本）

// MARK: - Sidebar

// SubagentLabelParser 已在 SubagentViews.swift 中定义（含 styledText 静态方法）

struct TwoLineHamburgerIcon: View {
    var body: some View {
        Image(systemName: "line.3.horizontal")
            .font(.body)
    }
}

struct CodexProjectLocation: Identifiable, Equatable, Sendable {
    let id: String
    let name: String
    let path: String
    let parentPath: String?
    let isDirectory: Bool
    let isSymlink: Bool
    let entries: [CodexProjectLocation]
}

extension CodexProjectDirectoryEntry {
    var isSymlink: Bool { false }
    var parentPath: String? { nil }
    var entries: [CodexProjectDirectoryEntry] { [] }
}

// MARK: - Queue Types
// QueuePauseState 已在 TurnViewModel.swift 中定义

enum LocalNetworkAuthorizationStatus: Equatable, Sendable {
    case unknown
    case granted
    case denied
}

enum CodexThreadForkTarget: Equatable, Sendable {
    case currentProject
    case projectPath(String)
}

// MARK: - Missing Types

struct CodexTrustedPairPresentation: Equatable, Sendable {
    let deviceId: String
    let macName: String?
    let relayURL: String?
    var name: String { macName ?? "Mac" }
    var detail: String { relayURL ?? deviceId }
    var title: String { macName ?? "Mac" }
    var systemName: String? { macName }
}

enum CodexReviewTarget: Equatable, Sendable {
    case uncommittedChanges
    case baseBranch
}

enum CodexSecureConnectionState: Equatable, Sendable {
    case notPaired
    case handshakeInProgress
    case liveSessionUnresolved
    case trustedMac
    case rePairRequired
    case updateRequired
    var statusLabel: String {
        switch self {
        case .notPaired: return ""
        case .handshakeInProgress: return "Handshake"
        case .liveSessionUnresolved: return "Unresolved"
        case .trustedMac: return "Trusted"
        case .rePairRequired: return "Re-pair required"
        case .updateRequired: return "Update required"
        }
    }
}

struct CodexPairingQRPayload: Codable, Equatable {
    let url: String
    let token: String
    let deviceId: String
    var relay: String { url }
    var sessionId: String { token }
    var macDeviceId: String { deviceId }
}

// MARK: - Terminal

enum TerminalRunningIndicatorLayout: Equatable {
    case inline
    case floating

    static func reservedRowHeight(isAccessibilitySize: Bool) -> CGFloat {
        isAccessibilitySize ? 36 : 28
    }
}

// MARK: - TurnTimeline types
// TurnAutoScrollMode 已在 TurnScrollStateTracker.swift 中定义

// TurnTimelineWarmThreadCache 已在 TurnTimelineScrollSupport.swift 中定义（enum 版本）
// ScrollBottomGeometry 已在 TurnTimelineScrollSupport.swift 中定义

// MARK: - Markdown / Mermaid Rendering (替代已删除的 Runestone 依赖)

enum MarkdownRenderProfile: Equatable, Sendable {
    case assistantProse
    case codeBlock
    case plainText
}

struct MarkdownTextView: View {
    let text: String
    var profile: MarkdownRenderProfile = .assistantProse
    var body: some View {
        Text(text)
            .font(AppFont.body())
            .textSelection(.enabled)
    }
}

struct StreamingAssistantMarkdownTextView: View {
    let text: String
    var profile: MarkdownRenderProfile = .assistantProse
    let isStreaming: Bool = false
    var body: some View {
        Text(text)
            .font(AppFont.body())
            .textSelection(.enabled)
    }
}

struct MermaidMarkdownContentView: View {
    let content: String
    var body: some View {
        Text(content)
            .font(AppFont.mono(.body))
            .padding(8)
            .background(Color(.tertiarySystemFill), in: RoundedRectangle(cornerRadius: 8))
    }
}

struct MermaidMarkdownContent: Identifiable, Equatable {
    let id: String
    let source: String
    let renderedHTML: String?
}

final class MermaidMarkdownContentCache {
    static let shared = MermaidMarkdownContentCache()
    func get(_ key: String) -> MermaidMarkdownContent? { nil }
    func set(_ key: String, value: MermaidMarkdownContent) {}
}

struct MarkdownParseCacheReset: Equatable {
    let token: Int
    static let initial = MarkdownParseCacheReset(token: 0)
}

// MARK: - Timeline Text Clipping

enum TimelineTextClippingPolicy: Equatable, Sendable {
    case none
    case clip
    case truncate
    case displayWindow(TimelineDisplayWindow)

    struct TimelineDisplayWindow: Equatable, Sendable {
        let byteLimit: Int
        let headByteCount: Int
        let tailByteCount: Int
    }

    var displayWindow: TimelineDisplayWindow? {
        if case .displayWindow(let w) = self { return w }
        return nil
    }
}

// MARK: - In-App Toast

struct InAppToastBannerView: View {
    let title: String
    let message: String?
    let action: InAppToastBannerAction?
    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.subheadline.bold())
                if let message { Text(message).font(.caption).foregroundStyle(.secondary) }
            }
            Spacer()
        }
        .padding(12)
        .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 12))
    }
}

struct InAppToastBannerAction {
    let title: String
    let action: () -> Void
}

// MARK: - Composer State Types

struct TurnComposerAutocompleteState {
    var availableSlashCommands: [TurnComposerSlashCommand]
    var fileAutocompleteItems: [CodexFuzzyFileMatch]
    var isFileAutocompleteVisible: Bool
    var isFileAutocompleteLoading: Bool
    var fileAutocompleteQuery: String
    var skillAutocompleteItems: [CodexSkillMetadata]
    var isSkillAutocompleteVisible: Bool
    var isSkillAutocompleteLoading: Bool
    var skillAutocompleteQuery: String
    var skillAutocompleteTrigger: String
    var pluginAutocompleteItems: [CodexPluginMetadata]
    var isPluginAutocompleteVisible: Bool
    var isPluginAutocompleteLoading: Bool
    var pluginAutocompleteQuery: String
    var slashCommandPanelState: TurnComposerSlashCommandPanelState
    var hasComposerContentConflictingWithReview: Bool
    var isThreadRunning: Bool
    var showsGitBranchSelector: Bool
    var isLoadingGitBranchTargets: Bool
    var availableGitBranchTargets: [String]
    var selectedGitBaseBranch: String?
    var gitDefaultBranch: String?
}

struct TurnComposerAccessoryState {
    var queuedDrafts: [QueuedTurnDraft]
    var canSteerQueuedDrafts: Bool
    var canRestoreQueuedDrafts: Bool
    var steeringDraftID: String?
    var composerAttachments: [TurnComposerImageAttachment]
    var composerMentionedFiles: [TurnComposerMentionedFile]
    var composerMentionedSkills: [TurnComposerMentionedSkill]
    var composerMentionedPlugins: [TurnComposerMentionedPlugin]
    var composerReviewSelection: TurnComposerReviewSelection?
    var isSubagentsSelectionArmed: Bool
    var isPlanModeArmed: Bool
    var isVoiceRecording: Bool
    var voiceAudioLevels: [CGFloat]
    var voiceRecordingDuration: TimeInterval
    var showsComposerAttachments: Bool { !composerAttachments.isEmpty }
}

// TurnComposerSlashCommand 已在 TurnComposerCommandState.swift 中定义
// TurnComposerForkDestination 已在 TurnComposerCommandState.swift 中定义

struct TurnComposerState {
    var inputText: String
    var isSendDisabled: Bool
    var isSending: Bool
    var isPlanModeArmed: Bool
    var queuedCount: Int
    var isQueuePaused: Bool
    var activeTurnID: String?
    var isThreadRunning: Bool
    var isEmptyThread: Bool
    var hasWorkingDirectory: Bool
    var isWorktreeProject: Bool
    var selectedModelId: String?
    var availableModels: [CodexModelOption]
    var selectedReasoningEffort: String?
    var reasoningEfforts: [CodexReasoningEffortOption]
    var selectedAccessMode: CodexAccessMode
    var contextWindowUsage: ContextWindowUsage?
    var rateLimitBuckets: [CodexRateLimitBucket]
    var isLoadingRateLimits: Bool
    var rateLimitsErrorMessage: String?
    var shouldAutoRefreshUsageStatus: Bool
    var showsGitBranchSelector: Bool
    var isGitBranchSelectorEnabled: Bool
    var availableGitBranchTargets: [String]
    var selectedGitBranch: String?
    var steeringDraftID: String?
    var voiceButtonPresentation: TurnComposerVoiceButtonPresentation
}

// MARK: - Queued Drafts Panel

struct QueuedDraftsPanel: View {
    let drafts: [QueuedTurnDraft]
    let canSteerDrafts: Bool
    let canRestoreDrafts: Bool
    let steeringDraftID: String?
    let onRestore: (String) -> Void
    let onSteer: (String) -> Void
    let onRemove: (String) -> Void
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            ForEach(drafts) { draft in
                HStack {
                    Text(draft.text)
                        .font(AppFont.caption())
                        .lineLimit(2)
                    Spacer()
                    Button { onRemove(draft.id) } label: {
                        Image(systemName: "xmark.circle.fill")
                            .font(AppFont.caption())
                            .foregroundStyle(.secondary)
                    }
                }
                .padding(8)
                .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 8))
            }
        }
    }
}

// MARK: - Bridge Host Types

enum CodexBridgeHostPlatform: String, Sendable {
    case unknown
    case macOS
    var displayName: String {
        switch self {
        case .unknown: return "Unknown"
        case .macOS: return "macOS"
        }
    }
}

struct CodexBridgeHostCapabilities: Codable, Equatable, Sendable {
    var desktopHandoff: Bool = false
    var displayWake: Bool = false
    var keepAwake: Bool = false
    var bridgeUpdate: Bool = false
    static let legacyMacOS = CodexBridgeHostCapabilities(desktopHandoff: true, displayWake: true, keepAwake: true, bridgeUpdate: false)
}

// MARK: - Workspace Image Preview Cache

final class WorkspaceImagePreviewCache {
    static let shared = WorkspaceImagePreviewCache()
    func get(_ key: String) -> URL? { nil }
    func set(_ key: String, value: URL) {}
    var cachedPreview: [String: URL] = [:]
    func cachedPreview(forPath path: String) -> CachedWorkspaceImagePreview? { nil }
}

struct WorkspaceImageMetadata: Equatable, Sendable {
    let size: Int
    let modifiedDate: Date
}

struct CachedWorkspaceImagePreview: Sendable {
    let metadata: WorkspaceImageMetadata
}

struct TurnComposerMentionChipSections: View {
    let state: TurnComposerState
    let onRemoveMentionedFile: (CodexFileMention) -> Void
    let onRemoveMentionedSkill: (CodexSkillMention) -> Void
    let onRemoveMentionedPlugin: (CodexPluginMention) -> Void
    let onRemoveComposerReviewSelection: () -> Void
    let onRemoveComposerSubagentsSelection: () -> Void
    let onRemoveComposerPlanModeSelection: () -> Void
    var body: some View { EmptyView() }
}

// MARK: - Skill Display Name

enum SkillDisplayNameFormatter {
    static func displayName(for rawName: String) -> String {
        let normalized = rawName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalized.isEmpty else { return rawName }
        let parts = normalized
            .split(omittingEmptySubsequences: true, whereSeparator: { $0 == "-" || $0 == "_" })
            .map { part in
                let token = String(part)
                return token.prefix(1).uppercased() + token.dropFirst().lowercased()
            }
        guard !parts.isEmpty else { return normalized }
        return parts.joined(separator: " ")
    }
    static func format(_ skill: CodexSkillMetadata) -> String {
        displayName(for: skill.id)
    }
}

// MARK: - User Attachment Views
// UserAttachmentStrip 已在 UserAttachmentViews.swift 中定义

// MARK: - Skill Reference Replacement Style

/// 技能引用替换样式，供 SkillReferenceFormatter 使用
enum SkillReferenceReplacementStyle {
    case mentionToken
    case displayName
}

// MARK: - File Change Render State

/// 文件变更渲染状态，供 MessageRowRenderModel 使用
// TurnFileChangeSummary 不符合 Equatable，无法自动合成
struct FileChangeRenderState {
    let summary: TurnFileChangeSummary?
    let actionEntries: [TurnFileChangeSummaryEntry]
    let bodyText: String
    let detailBodyText: String
}

// MARK: - Message Row Render Model

// FileChangeRenderState 和 CommandExecutionStatusModel 不符合 Equatable，无法自动合成
struct MessageRowRenderModel {
    let messageID: String
    let displayText: String
    let actionText: String?
    // 思考块相关成员
    var thinkingText: String? = nil
    var thinkingContent: ThinkingDisclosureContent? = nil
    var thinkingActivityPreview: String? = nil
    // 文件变更相关成员
    var fileChangeState: FileChangeRenderState? = nil
    // 命令执行相关成员
    var commandStatus: CommandExecutionStatusModel? = nil
}

final class MessageRowRenderModelCache {
    static let shared = MessageRowRenderModelCache()
    private var cache: [String: MessageRowRenderModel] = [:]
    func get(_ key: String) -> MessageRowRenderModel? { cache[key] }
    func set(_ key: String, value: MessageRowRenderModel) { cache[key] = value }
}

// MARK: - Timeline Selectable Action Text

private let timelineActionTextTrimByteLimit = 64_000

func timelineSelectableActionText(_ text: String) -> String? {
    guard !text.isEmpty else { return nil }
    guard text.utf8.count <= timelineActionTextTrimByteLimit else {
        return text
    }
    let trimmedText = text.trimmingCharacters(in: .whitespacesAndNewlines)
    return trimmedText.isEmpty ? nil : trimmedText
}

// MARK: - Composer Input Change Handler

struct TurnComposerInputChangeHandler {
    let handleFileAutocomplete: (String) -> Void
    let handleSkillAutocomplete: (String) -> Void
    let handlePluginAutocomplete: (String) -> Void
    let handleSlashCommandAutocomplete: (String) -> Void
}

// CodexPendingCodeReviewTarget 已在 CodexService.swift 中定义
// TurnComposerReasoningDisplayOption 已在 TurnComposerMetaMapper.swift 中定义

// MARK: - Trusted Session Resolve Error

enum CodexTrustedSessionResolveError: Error, Equatable {
    case unsupportedRelay
    case macOffline(String)
    case rePairRequired(String)
    case noTrustedMac
    case invalidResponse(String)
    case network(String)
}

// MARK: - Terminal Running Indicator

struct TerminalRunningIndicator: View {
    var body: some View {
        HStack(spacing: 3) {
            Circle().frame(width: 4, height: 4).foregroundStyle(.green)
            Circle().frame(width: 4, height: 4).foregroundStyle(.yellow)
            Circle().frame(width: 4, height: 4).foregroundStyle(.red)
        }
    }
}

// MARK: - Turn Mention Chip Style

struct TurnMentionChipStyle: Equatable {
    let symbolName: String
    let tintColor: Color

    static let file = TurnMentionChipStyle(symbolName: "chevron.left.forwardslash.chevron.right", tintColor: .blue)
    static let skill = TurnMentionChipStyle(symbolName: "star", tintColor: .indigo)
    static let plugin = TurnMentionChipStyle(symbolName: "circle.grid.2x2", tintColor: .blue)
    static let review = TurnMentionChipStyle(symbolName: "checklist", tintColor: .teal)
    static let subagents = TurnMentionChipStyle(symbolName: "point.3.connected.trianglepath.dotted", tintColor: .teal)
    static let planMode = TurnMentionChipStyle(symbolName: "list.bullet", tintColor: .purple)
}

// MARK: - Turn Mention Chip Ref

struct TurnMentionChipRef: Identifiable, Equatable {
    enum Kind: Equatable {
        case file
        case skill
        case plugin
        case slashCommand(TurnComposerSlashCommand)
        case review(TurnComposerReviewTarget)
        case subagents
        case planMode
        case action(TurnMentionChipStyle)
    }
    let kind: Kind
    let label: String
    let identity: String
    var id: String { identity }
    var displayLabel: String { label }

    static func file(_ path: String, label: String? = nil) -> TurnMentionChipRef {
        TurnMentionChipRef(kind: .file, label: label ?? path, identity: path)
    }
    static func skill(_ name: String) -> TurnMentionChipRef {
        TurnMentionChipRef(kind: .skill, label: name, identity: name)
    }
    static func plugin(_ name: String, label: String? = nil) -> TurnMentionChipRef {
        TurnMentionChipRef(kind: .plugin, label: label ?? name, identity: name)
    }
}

struct UserMentionChipStrip: View {
    let chips: [TurnMentionChipRef]
    var body: some View { EmptyView() }
}

// CodexTurnTerminalState 已在 CodexService.swift 中定义
// HapticFeedback 已在 HapticFeedback.swift 中定义

// MARK: - Additional Missing Types

struct DesktopHandoffService {
    static func isAvailable() -> Bool { false }
}

struct AssistantReplayDeduper {
    static func deduped(messages: [CodexMessage], in threadId: String) -> [CodexMessage] { messages }
    static func isReplayMessage(in messages: [CodexMessage], threadId: String, turnId: String?, text: String?, excludingMessageID: String) -> Bool { false }
}

struct StreamingAssistantPlaceholderSlot: View {
    var body: some View { EmptyView() }
}

struct TurnGitActionToastOverlay: View {
    let gitActionProgress: TurnGitActionProgress?
    var body: some View { EmptyView() }
}

extension TurnVoiceRecoveryPresentationBuilder {
    static func presentation(for error: Error) -> VoiceRecoveryPresentation? { nil }
}
