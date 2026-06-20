// FILE: CodexService.swift
// Purpose: 中央状态容器，桥接 Remodex 视图层与我们的 DesktopService
// 对内使用 DesktopService（WebSocket + REST），对外暴露 CodexService 接口供 Remodex 视图使用

import Foundation
import Observation
import UIKit
import UserNotifications

// MARK: - Supporting Types (视图层依赖)

struct CodexApprovalRequest: Identifiable, Sendable {
    let id: String
    let requestID: JSONValue
    let method: String
    let command: String?
    let reason: String?
    let threadId: String?
    let turnId: String?
    let params: JSONValue?
}

enum CodexConnectionRecoveryState: Equatable, Sendable {
    case idle
    case retrying(attempt: Int, message: String)
}

enum CodexConnectionPhase: Equatable, Sendable {
    case offline
    case connecting
    case loadingChats
    case syncing
    case connected
}

enum CodexTurnTerminalState: String, Codable, Equatable, Sendable {
    case completed
    case failed
    case stopped
}

enum CodexThreadRunBadgeState: Hashable, Sendable {
    case running
    case ready
    case failed
}

struct CodexRecentActivityLine {
    let line: String
    let timestamp: Date
}

enum CodexRunCompletionResult: String, Equatable, Sendable {
    case completed
    case failed
}

struct CodexBridgeUpdatePrompt: Identifiable, Equatable, Sendable {
    let id = UUID()
    let title: String
    let message: String
    let command: String?
}

struct CodexThreadCompletionBanner: Identifiable, Equatable, Sendable {
    let id = UUID()
    let threadId: String
    let title: String
}

struct CodexMissingNotificationThreadPrompt: Identifiable, Equatable, Sendable {
    let id = UUID()
    let threadId: String
}

struct CodexExternalThreadOpenRequest: Identifiable, Equatable, Sendable {
    let id = UUID()
    let threadId: String
}

struct CodexRunningThreadWatch: Equatable, Sendable {
    let threadId: String
    let expiresAt: Date
}

struct CodexThreadResumeRequestSignature: Equatable, Sendable {
    let projectPath: String?
    let modelIdentifier: String?
}

struct CodexThreadHistoryPaginationState: Codable, Equatable, Sendable {
    var olderCursor: JSONValue?
    var exhaustedOlderCursor: JSONValue?
    var hasAuthoritativeLocalHistoryStart: Bool
}

struct CodexSubagentIdentityEntry: Equatable, Sendable {
    var threadId: String?
    var agentId: String?
    var nickname: String?
    var role: String?
    var hasMetadata: Bool { threadId != nil || agentId != nil || nickname != nil || role != nil }
}

struct CodexThreadRuntimeOverride: Codable, Equatable, Sendable {
    var reasoningEffort: String?
    var serviceTierRawValue: String?
    var overridesReasoning: Bool
    var overridesServiceTier: Bool
    var serviceTier: CodexServiceTier? {
        guard let serviceTierRawValue else { return nil }
        return CodexServiceTier(rawValue: serviceTierRawValue)
    }
    var isEmpty: Bool { !overridesReasoning && !overridesServiceTier }
}

struct PendingSystemStreamingDeltas {
    let threadId: String
    let turnId: String?
    let itemId: String
    let kind: CodexMessageKind
    var deltas: [String]
}

struct TurnTimelineRenderSnapshot: Equatable {
    let threadID: String
    let messages: [CodexMessage]
    let messageIndexByID: [String: Int]
    let planMatchingMessages: [CodexMessage]
    let timelineChangeToken: Int
    let activeTurnID: String?
    let isThreadRunning: Bool
    let latestTurnTerminalState: CodexTurnTerminalState?
    let completedTurnIDs: Set<String>
    let stoppedTurnIDs: Set<String>
    let assistantRevertStatesByMessageID: [String: AssistantRevertPresentation]
    let repoRefreshSignal: String?
    let hasOlderHistory: Bool
    let hasRemoteOlderHistory: Bool
    let hasLocallyProjectedOlderHistory: Bool
    let usesPaginatedHistory: Bool
    let isLoadingOlderHistory: Bool
    let initialTurnsLoaded: Bool
    let olderHistoryLoadErrorMessage: String?

    static func empty(threadID: String) -> TurnTimelineRenderSnapshot {
        TurnTimelineRenderSnapshot(
            threadID: threadID,
            messages: [],
            messageIndexByID: [:],
            planMatchingMessages: [],
            timelineChangeToken: 0,
            activeTurnID: nil,
            isThreadRunning: false,
            latestTurnTerminalState: nil,
            completedTurnIDs: [],
            stoppedTurnIDs: [],
            assistantRevertStatesByMessageID: [:],
            repoRefreshSignal: nil,
            hasOlderHistory: false,
            hasRemoteOlderHistory: false,
            hasLocallyProjectedOlderHistory: false,
            usesPaginatedHistory: false,
            isLoadingOlderHistory: false,
            initialTurnsLoaded: false,
            olderHistoryLoadErrorMessage: nil
        )
    }
}

struct AssistantRevertStateCacheEntry {
    let messageRevision: Int
    let busyRepoRevision: Int
    let revertStateRevision: Int
    let workingDirectory: String?
    let statesByMessageID: [String: AssistantRevertPresentation]
}

@MainActor
@Observable
final class ThreadTimelineState {
    let threadID: String
    var messages: [CodexMessage]
    var messageRevision: Int
    var activeTurnID: String?
    var isThreadRunning: Bool
    var latestTurnTerminalState: CodexTurnTerminalState?
    var completedTurnIDs: Set<String>
    var stoppedTurnIDs: Set<String>
    var repoRefreshSignal: String?
    var hasOlderHistory: Bool
    var hasRemoteOlderHistory: Bool
    var hasLocallyProjectedOlderHistory: Bool
    var usesPaginatedHistory: Bool
    var isLoadingOlderHistory: Bool
    var initialTurnsLoaded: Bool
    var olderHistoryLoadErrorMessage: String?
    var renderSnapshot: TurnTimelineRenderSnapshot

    init(threadID: String) {
        self.threadID = threadID
        self.messages = []
        self.messageRevision = 0
        self.activeTurnID = nil
        self.isThreadRunning = false
        self.latestTurnTerminalState = nil
        self.completedTurnIDs = []
        self.stoppedTurnIDs = []
        self.repoRefreshSignal = nil
        self.hasOlderHistory = false
        self.hasRemoteOlderHistory = false
        self.hasLocallyProjectedOlderHistory = false
        self.usesPaginatedHistory = false
        self.isLoadingOlderHistory = false
        self.initialTurnsLoaded = false
        self.olderHistoryLoadErrorMessage = nil
        self.renderSnapshot = TurnTimelineRenderSnapshot.empty(threadID: threadID)
    }
}

// MARK: - Queue Types (这些在 TurnViewModel 等文件中有自己的定义)
// QueuedTurnDraft, TurnComposerLocalDraft, QueuePauseState 已在各自文件中定义
// 如缺失，由 MissingStubs 提供

@MainActor
@Observable
final class CodexService {

    typealias ThreadDisplayPhase = ClaudeHaha.ThreadDisplayPhase

    // MARK: - DesktopService 桥接
    private let desktop: DesktopService

    // MARK: - 公共状态（视图层直接访问）

    var threads: [CodexThread] = [] {
        didSet { rebuildThreadLookupCaches() }
    }
    var isConnected: Bool { desktop.connectionState == .connected }
    var isConnecting: Bool { desktop.connectionState == .connecting }
    var isInitialized = false
    var isLoadingThreads = false
    var isBootstrappingConnectionSync = false
    var currentOutput = ""
    var activeThreadId: String?
    var activeTurnId: String?
    var activeTurnIdByThread: [String: String] = [:]

    var runningThreadIDs: Set<String> = []
    var protectedRunningFallbackThreadIDs: Set<String> = []
    var readyThreadIDs: Set<String> = []
    var failedThreadIDs: Set<String> = []
    @ObservationIgnored var threadsPendingCompletionHaptic: Set<String> = []
    var latestTurnTerminalStateByThread: [String: CodexTurnTerminalState] = [:]
    var terminalStateByTurnID: [String: CodexTurnTerminalState] = [:]
    var pendingApprovals: [CodexApprovalRequest] = []
    var lastRawMessage: String?
    var lastErrorMessage: String?
    var keepMacAwakeWhileBridgeRuns = false
    var runtimeDebugLogEntries: [String] = []
    var connectionRecoveryState: CodexConnectionRecoveryState = .idle
    var queuedTurnDraftsByThread: [String: [QueuedTurnDraft]] = [:]
    var queuePauseStateByThread: [String: QueuePauseState] = [:]
    var composerDraftsByThreadID: [String: TurnComposerLocalDraft] = [:]
    var messagesByThread: [String: [CodexMessage]] = [:]
    var messageRevisionByThread: [String: Int] = [:]
    var syncRealtimeEnabled = true
    var availableModels: [CodexModelOption] = []
    var selectedModelId: String?
    var hasPersistedSelectedModelId = false
    var selectedGitWriterModelId: String?
    var selectedReasoningEffort: String?
    var selectedServiceTier: CodexServiceTier?
    var threadRuntimeOverridesByThreadID: [String: CodexThreadRuntimeOverride] = [:]
    var selectedAccessMode: CodexAccessMode = .onRequest
    var gptAccountSnapshot: CodexGPTAccountSnapshot = .init()
    var gptAccountErrorMessage: String?
    var isLoadingModels = false
    @ObservationIgnored var pendingRuntimeOptionRefresh = false
    @ObservationIgnored var runtimeOptionRefreshTask: Task<Void, Never>?
    @ObservationIgnored var runtimeOptionRefreshToken: UUID?
    var modelsErrorMessage: String?
    var notificationAuthorizationStatus: UNAuthorizationStatus = .notDetermined
    var pendingNotificationOpenThreadID: String?
    var externalThreadOpenRequest: CodexExternalThreadOpenRequest?
    var supportsStructuredSkillInput = true
    var supportsStructuredMentionInput = true
    var supportsTurnCollaborationMode = false
    var supportsServiceTier = true
    var supportsBridgeVoiceTranscription = true
    var supportsThreadFork = true
    var supportsTurnPagination = true
    var pendingComposerActionByThreadID: [String: CodexPendingThreadComposerAction] = [:]
    var subagentIdentityVersion: Int = 0

    // Relay session persistence（空实现）
    var relaySessionId: String?
    var relayUrl: String?
    var relayMacDeviceId: String?
    var relayMacIdentityPublicKey: String?
    var relayProtocolVersion: Int = 1
    var lastAppliedBridgeOutboundSeq = 0
    var bridgeInstalledVersion: String?
    var latestBridgePackageVersion: String?
    var shouldForceQRBootstrapOnNextHandshake = false
    var trustedReconnectFailureCount = 0
    var secureConnectionState: CodexSecureConnectionState = .notPaired
    var secureMacFingerprint: String?
    var bridgeUpdatePrompt: CodexBridgeUpdatePrompt?
    var hasPresentedServiceTierBridgeUpdatePrompt = false
    var hasPresentedThreadForkBridgeUpdatePrompt = false
    var hasPresentedMinimumBridgePackageUpdatePrompt = false
    var lastPresentedAvailableBridgePackageVersion: String?
    var threadCompletionBanner: CodexThreadCompletionBanner?
    var missingNotificationThreadPrompt: CodexMissingNotificationThreadPrompt?
    var contextWindowUsageByThread: [String: ContextWindowUsage] = [:]
    var rateLimitBuckets: [CodexRateLimitBucket] = []
    var hasResolvedRateLimitsSnapshot = false
    var isLoadingRateLimits = false
    var rateLimitsErrorMessage: String?
    var threadIdByTurnID: [String: String] = [:]
    var hydratedThreadIDs: Set<String> = []
    var loadingThreadIDs: Set<String> = []
    var olderThreadHistoryCursorByThreadID: [String: JSONValue] = [:]
    var exhaustedOlderThreadHistoryCursorByThreadID: [String: JSONValue] = [:]
    var loadingOlderThreadHistoryIDs: Set<String> = []
    var threadTimelineProjectionLimitByThreadID: [String: Int] = [:]
    var initialTurnsLoadedByThreadID: Set<String> = []
    var threadsWithAuthoritativeLocalHistoryStart: Set<String> = []
    var olderHistoryLoadErrorByThreadID: [String: String] = [:]
    @ObservationIgnored var subagentMetadataLoadingThreadIDs: Set<String> = []
    var resumedThreadIDs: Set<String> = []
    var isAppInForeground = true
    var isConstrainedNetwork = false
    var pinnedThreadIDs: [String] = []
    var planSessionSourceByThread: [String: CodexPlanSessionSource] = [:]
    var runningThreadWatchByID: [String: CodexRunningThreadWatch] = [:]
    var mirroredRunningCatchupThreadIDs: Set<String> = []
    var desktopMirroredRunningThreadIDs: Set<String> = []
    var desktopMirroredRunningStaleSnapshotCountsByThread: [String: Int] = [:]
    var desktopMirroredRunningLastActivityAtByThread: [String: Date] = [:]
    var lastMirroredRunningCatchupAtByThread: [String: Date] = [:]
    var shouldAutoReconnectOnForeground = false
    var commandExecutionDetailsByItemID: [String: CommandExecutionDetails] = [:]
    var terminalSnapshot: RemodexTerminalSnapshot = .idle
    var terminalSnapshotsById: [String: RemodexTerminalSnapshot] = [:]
    var terminalProfile: RemodexTerminalProfile = RemodexTerminalProfileStore.load()
    @ObservationIgnored let nativeSSHTerminal = RemodexNativeSSHTerminal()
    @ObservationIgnored var nativeSSHTerminalsById: [String: RemodexNativeSSHTerminal] = [:]
    var localNetworkAuthorizationStatus: LocalNetworkAuthorizationStatus = .unknown
    var gptAccountLoginSyncTask: Task<Void, Never>?
    var codexTransportMode: CodexRuntimeTransportMode = .unknown
    var bridgeHostPlatform: CodexBridgeHostPlatform = .unknown
    var bridgeHostCapabilities: CodexBridgeHostCapabilities = CodexBridgeHostCapabilities()
    var supportsDesktopAppHandoff: Bool { false }
    var supportsDisplayWake: Bool { false }
    var supportsKeepAwakeWhileBridgeRuns: Bool { false }
    var supportsBridgePackageUpdate: Bool { false }
    var hostComputerLabel: String { "Desktop" }
    var aiChangeSetsByID: [String: AIChangeSet] = [:]
    var aiChangeSetIDByTurnID: [String: String] = [:]
    var aiChangeSetIDByAssistantMessageID: [String: String] = [:]
    var repoRootByWorkingDirectory: [String: String] = [:]
    var knownRepoRoots: Set<String> = []
    var currentTrustedMacDeviceId: String?
    var lastTrustedMacDeviceId: String?
    var previousTrustedMacDeviceId: String?
    @ObservationIgnored var macScopedContextOverrideDeviceId: String?
    @ObservationIgnored var suspendAutomaticMacScopedPersistence = false
    @ObservationIgnored var isApplyingMacScopedState = false
    var secureSession: CodexSecureSession?
    var pendingHandshake: CodexPendingHandshake?
    var phoneIdentityState: CodexPhoneIdentityState = .uninitialized
    var trustedMacRegistry: CodexTrustedMacRegistry = CodexTrustedMacRegistry()
    var pendingSecureControlContinuations: [String: [CodexSecureControlWaiter]] = [:]
    var bufferedSecureControlMessages: [String: [String]] = [:]

    // Internal wiring
    @ObservationIgnored var threadByID: [String: CodexThread] = [:]
    @ObservationIgnored var threadIndexByID: [String: Int] = [:]
    @ObservationIgnored var firstLiveThreadIDCache: String?
    @ObservationIgnored var subagentIdentityByThreadID: [String: CodexSubagentIdentityEntry] = [:]
    @ObservationIgnored var subagentIdentityByAgentID: [String: CodexSubagentIdentityEntry] = [:]
    @ObservationIgnored var threadTimelineStateByThread: [String: ThreadTimelineState] = [:]
    @ObservationIgnored var forkedFromThreadIDByThreadID: [String: String] = [:]
    @ObservationIgnored var renamedThreadNameByThreadID: [String: String] = [:]
    @ObservationIgnored var associatedManagedWorktreePathByThreadID: [String: String] = [:]
    @ObservationIgnored var authoritativeProjectPathByThreadID: [String: String] = [:]
    @ObservationIgnored var snapshotOnlyPinnedThreadIDs: Set<String> = []
    @ObservationIgnored var stoppedTurnIDsByThread: [String: Set<String>] = [:]
    @ObservationIgnored var messageIndexCacheByThread: [String: [String: Int]] = [:]
    @ObservationIgnored var latestAssistantOutputByThread: [String: String] = [:]
    @ObservationIgnored var latestAssistantMessageIDByThread: [String: String] = [:]
    @ObservationIgnored var latestRepoAffectingMessageSignalByThread: [String: String] = [:]
    @ObservationIgnored var assistantRevertStateCacheByThread: [String: AssistantRevertStateCacheEntry] = [:]
    @ObservationIgnored var assistantRevertStateRevision: Int = 0
    @ObservationIgnored var busyRepoRoots: Set<String> = []
    @ObservationIgnored var busyRepoRootsRevision: Int = 0
    @ObservationIgnored var pendingSystemDeltasByKey: [String: PendingSystemStreamingDeltas] = [:]
    @ObservationIgnored var systemDeltaFlushTasksByKey: [String: Task<Void, Never>] = [:]
    @ObservationIgnored var streamingAssistantFallbackMessageByTurnID: [String: String] = [:]
    @ObservationIgnored var streamingAssistantMessageByItemKey: [String: String] = [:]
    @ObservationIgnored var streamingSystemMessageByItemID: [String: String] = [:]
    @ObservationIgnored var assistantCompletionFingerprintByThread: [String: (text: String, timestamp: Date)] = [:]
    @ObservationIgnored var recentActivityLineByThread: [String: CodexRecentActivityLine] = [:]
    @ObservationIgnored var pinnedThreadSnapshotsByRootID: [String: [CodexThread]] = [:]
    @ObservationIgnored var requestTransportOverride: ((String, JSONValue?) async throws -> RPCMessage)?
    @ObservationIgnored var trustedSessionResolverOverride: (() async throws -> CodexTrustedSessionResolveResponse)?
    @ObservationIgnored var trustedSessionResolveTask: Task<CodexTrustedSessionResolveResponse, Error>?
    @ObservationIgnored var trustedSessionResolveTaskID: UUID?
    @ObservationIgnored var threadHistoryLoadTaskByThreadID: [String: Task<ThreadHistoryLoadOutcome, Error>] = [:]
    @ObservationIgnored var forcedHistoryLoadThreadIDs: Set<String> = []
    @ObservationIgnored var threadResumeTaskByThreadID: [String: Task<CodexThread?, Error>] = [:]
    @ObservationIgnored var threadResumeRequestSignatureByThreadID: [String: CodexThreadResumeRequestSignature] = [:]
    @ObservationIgnored var forcedResumeEscalationThreadIDs: Set<String> = []
    @ObservationIgnored var turnStateRefreshTaskByThreadID: [String: Task<Bool, Never>] = [:]
    @ObservationIgnored var runningThreadCatchupTaskByThreadID: [String: Task<RunningThreadCatchupOutcome, Never>] = [:]
    @ObservationIgnored var forcedRunningCatchupEscalationThreadIDs: Set<String> = []
    @ObservationIgnored var threadRefreshGenerationByThreadID: [String: UInt64] = [:]
    @ObservationIgnored var lastForcedRunningResumeAtByThread: [String: Date] = [:]
    @ObservationIgnored var threadsNeedingCanonicalHistoryReconcile: Set<String> = []
    @ObservationIgnored var threadsWithSatisfiedDeferredHistoryHydration: Set<String> = []
    @ObservationIgnored var canonicalHistoryReconcileTaskByThreadID: [String: Task<Void, Never>] = [:]
    @ObservationIgnored var canonicalHistoryReconcileRetryTaskByThreadID: [String: Task<Void, Never>] = [:]
    @ObservationIgnored var threadListFetchTaskByLimit: [Int: (id: UUID, task: Task<[CodexThread], Error>)] = [:]
    @ObservationIgnored var workspaceCheckpointCopyTaskByTurnID: [String: Task<Void, Never>] = [:]
    @ObservationIgnored var gitStackedActionProgressHandlers: [String: (TurnGitActionPhase, TurnGitActionPhaseStatus) -> Void] = [:]
    @ObservationIgnored var coalescedRevertRefreshTask: Task<Void, Never>?
    @ObservationIgnored var pendingAssistantDeltaByStreamID: [String: String] = [:]
    @ObservationIgnored var pendingAssistantDeltaContextByStreamID: [String: (threadId: String, turnId: String, itemId: String?, assistantPhase: String?)] = [:]
    @ObservationIgnored var pendingAssistantDeltaStreamOrder: [String] = []
    @ObservationIgnored var pendingAssistantDeltaFlushTask: Task<Void, Never>?
    @ObservationIgnored var deferHydratedMarkForNotMaterializedThreadIDs: Set<String> = []

    let encoder = JSONEncoder()
    let decoder = JSONDecoder()
    let defaults = UserDefaults.standard

    // MARK: - Init

    init(desktop: DesktopService = .shared) {
        self.desktop = desktop
        rebuildThreadLookupCaches()
    }

    // MARK: - Connection Phase

    var connectionPhase: CodexConnectionPhase {
        if isConnecting { return .connecting }
        guard isConnected else { return .offline }
        if threads.isEmpty && (isBootstrappingConnectionSync || isLoadingThreads) { return .loadingChats }
        if isBootstrappingConnectionSync || isLoadingThreads { return .syncing }
        return .connected
    }

    var connectionPhaseDisplayLabel: String {
        switch connectionPhase {
        case .offline: return "离线"
        case .connecting: return "连接中"
        case .loadingChats: return "加载对话"
        case .syncing: return "同步中"
        case .connected: return "已连接"
        }
    }

    // MARK: - Relay Session（空实现）

    var hasSavedRelaySession: Bool { desktop.hasSavedCredentials }
    var hasReconnectCandidate: Bool { desktop.hasSavedCredentials }
    var hasTrustedMacReconnectCandidate: Bool { false }

    var normalizedRelaySessionId: String? { nil }
    var normalizedRelayURL: String? { nil }
    var normalizedRelayMacDeviceId: String? { nil }
    var normalizedRelayMacIdentityPublicKey: String? { nil }
    var normalizedCurrentTrustedMacDeviceId: String? { nil }
    var normalizedPreviousTrustedMacDeviceId: String? { nil }
    var preferredTrustedMacDeviceId: String? { nil }
    var preferredTrustedMacRecord: CodexTrustedMacRecord? { nil }
    var currentTrustedMacRecord: CodexTrustedMacRecord? { nil }
    var hasTrustedReconnectContext: Bool { false }
    var secureConnectionDisplayLabel: String? { nil }

    func trustedMacRecord(for deviceId: String?) -> CodexTrustedMacRecord? { nil }

    // MARK: - 连接（桥接 DesktopService）

    func connect(serverURL: URL? = nil, token: String? = nil, role: String? = nil, performInitialSync: Bool = true) async throws {
        if desktop.hasSavedCredentials {
            try await desktop.connectWithSavedCredentials()
        }
        syncFromDesktop()
    }

    func connect(to url: URL) async throws {
        try await desktop.connectToServer(url)
        syncFromDesktop()
    }

    func disconnect(preserveReconnectIntent: Bool = false) {
        desktop.disconnect()
        threads = []
        messagesByThread = [:]
        runningThreadIDs = []
        pendingApprovals = []
        isInitialized = false
    }

    func clearSavedRelaySession() {
        desktop.clearCredentials()
    }

    /// 从 DesktopService 同步状态到 CodexService
    func syncFromDesktop() {
        // 同步会话 -> 线程
        threads = desktop.sessions.map { session in
            CodexThread(
                id: session.id,
                title: session.displayTitle,
                name: nil,
                preview: session.preview,
                createdAt: session.createdAt ?? Date(),
                updatedAt: session.updatedAt ?? Date(),
                cwd: session.workDir,
                metadata: nil,
                forkedFromThreadId: nil,
                parentThreadId: nil,
                agentId: nil,
                agentNickname: nil,
                agentRole: nil,
                model: session.model,
                modelProvider: nil,
                syncState: .live
            )
        }

        // 同步消息
        for (sessionId, messages) in desktop.messagesBySession {
            messagesByThread[sessionId] = messages.map { msg in
                CodexMessage(
                    id: msg.id,
                    threadId: msg.sessionId,
                    role: CodexMessageRole(from: msg.role),
                    kind: CodexMessageKind(from: msg.kind),
                    text: msg.text,
                    fileMentions: nil,
                    skillMentions: nil,
                    pluginMentions: nil,
                    createdAt: msg.createdAt,
                    timeZoneIdentifier: nil,
                    turnId: msg.turnId,
                    itemId: nil,
                    isStreaming: msg.isStreaming,
                    deliveryState: CodexMessageDeliveryState(from: msg.deliveryState),
                    attachments: nil,
                    planState: nil,
                    planPresentation: nil,
                    proposedPlan: nil,
                    subagentAction: nil,
                    structuredUserInputRequest: nil,
                    orderIndex: msg.orderIndex
                )
            }
        }

        // 同步运行状态
        runningThreadIDs = Set(desktop.sessions.filter { $0.state.isRunning }.map(\.id))

        // 同步权限请求
        pendingApprovals = desktop.pendingPermissions.map { req in
            CodexApprovalRequest(
                id: req.id,
                requestID: .string(req.id),
                method: "requestApproval",
                command: req.toolName,
                reason: nil,
                threadId: req.sessionId,
                turnId: nil,
                params: req.input.isEmpty ? nil : .string(req.input)
            )
        }

        isInitialized = true
    }

    // MARK: - Thread/Turn 操作（桥接 DesktopService）

    func listThreads(limit: Int = 100) async -> [CodexThread] {
        await desktop.refreshSessions()
        syncFromDesktop()
        return threads
    }

    func startTurn(
        userInput: String,
        threadId: String,
        attachments: [CodexImageAttachment] = [],
        skillMentions: [CodexSkillMention] = [],
        mentionMentions: [CodexTurnMention] = [],
        fileMentions: [String] = [],
        shouldAppendUserMessage: Bool = true,
        preAppendedUserMessageID: String? = nil,
        automaticTitleSeedOverride: String? = nil,
        collaborationMode: CodexCollaborationModeKind? = nil
    ) async {
        desktop.sendMessage(sessionId: threadId, content: userInput)

        // 标记为运行中
        runningThreadIDs.insert(threadId)
        activeThreadId = threadId

        // 本地立即追加用户消息
        let userMsg = CodexMessage(
            id: UUID().uuidString,
            threadId: threadId,
            role: .user,
            kind: .chat,
            text: userInput,
            fileMentions: nil,
            skillMentions: nil,
            pluginMentions: nil,
            createdAt: Date(),
            timeZoneIdentifier: nil,
            turnId: nil,
            itemId: nil,
            isStreaming: false,
            deliveryState: .pending,
            attachments: nil,
            planState: nil,
            planPresentation: nil,
            proposedPlan: nil,
            subagentAction: nil,
            structuredUserInputRequest: nil,
            orderIndex: (messagesByThread[threadId]?.count ?? 0)
        )
        messagesByThread[threadId, default: []].append(userMsg)
    }

    func steerTurn(
        userInput: String,
        threadId: String,
        expectedTurnId: String? = nil,
        attachments: [CodexImageAttachment] = [],
        skillMentions: [CodexSkillMention] = [],
        mentionMentions: [CodexTurnMention] = [],
        fileMentions: [String] = [],
        shouldAppendUserMessage: Bool = true,
        preAppendedUserMessageID: String? = nil,
        collaborationMode: CodexCollaborationModeKind? = nil
    ) async {
        desktop.sendMessage(sessionId: threadId, content: userInput)
    }

    func interruptTurn(turnId: String?, threadId: String? = nil) async throws {
        guard let threadId else { return }
        desktop.stopGeneration(sessionId: threadId)
        runningThreadIDs.remove(threadId)
    }

    func startThread(preferredProjectPath: String? = nil, runtimeOverride: CodexThreadRuntimeOverride? = nil) async -> CodexThread? {
        do {
            let session = try await desktop.createSession(workDir: preferredProjectPath)
            syncFromDesktop()
            return threads.first { $0.id == session.id }
        } catch {
            lastErrorMessage = error.localizedDescription
            return nil
        }
    }

    func prepareThreadForDisplay(threadId: String) async -> Bool {
        activeThreadId = threadId
        desktop.connectToSession(threadId)
        await desktop.loadHistory(threadId)
        syncFromDesktop()
        return true
    }

    func deleteThreadLocally(_ threadId: String) {
        threads.removeAll { $0.id == threadId }
        messagesByThread.removeValue(forKey: threadId)
        if activeThreadId == threadId { activeThreadId = nil }
    }

    func archiveThread(_ threadId: String) {
        threads.removeAll { $0.id == threadId }
    }

    func unarchiveThread(_ threadId: String) {}

    func archiveThreadGroup(threadIDs: [String]) {
        threads.removeAll { threadIDs.contains($0.id) }
    }

    func deleteLocalThreadGroup(threadIDs: [String]) {
        threads.removeAll { threadIDs.contains($0.id) }
        for tid in threadIDs { messagesByThread.removeValue(forKey: tid) }
    }

    func renameThread(_ threadId: String, name: String) {
        if let idx = threads.firstIndex(where: { $0.id == threadId }) {
            threads[idx].name = name
        }
    }

    // MARK: - 消息

    func messages(for threadId: String) -> [CodexMessage] {
        // 先尝试同步最新数据
        if let msgs = desktop.messagesBySession[threadId], !msgs.isEmpty {
            let codexMsgs = msgs.map { msg in
                CodexMessage(
                    id: msg.id,
                    threadId: msg.sessionId,
                    role: CodexMessageRole(from: msg.role),
                    kind: CodexMessageKind(from: msg.kind),
                    text: msg.text,
                    fileMentions: nil,
                    skillMentions: nil,
                    pluginMentions: nil,
                    createdAt: msg.createdAt,
                    timeZoneIdentifier: nil,
                    turnId: msg.turnId,
                    itemId: nil,
                    isStreaming: msg.isStreaming,
                    deliveryState: CodexMessageDeliveryState(from: msg.deliveryState),
                    attachments: nil,
                    planState: nil,
                    planPresentation: nil,
                    proposedPlan: nil,
                    subagentAction: nil,
                    structuredUserInputRequest: nil,
                    orderIndex: msg.orderIndex
                )
            }
            messagesByThread[threadId] = codexMsgs
        }
        return messagesByThread[threadId] ?? []
    }

    func activeTurnID(for threadId: String) -> String? {
        activeTurnIdByThread[threadId]
    }

    func threadDisplayPhase(threadId: String) -> ThreadDisplayPhase {
        let msgs = messages(for: threadId)
        if msgs.isEmpty { return .empty }
        return .ready
    }

    func timelineState(for threadId: String) -> ThreadTimelineState {
        if let existing = threadTimelineStateByThread[threadId] {
            return existing
        }
        let state = ThreadTimelineState(threadID: threadId)
        threadTimelineStateByThread[threadId] = state
        return state
    }

    func appendUserMessage(threadId: String, text: String, turnId: String? = nil, attachments: [CodexImageAttachment] = [], fileMentions: [String] = [], skillMentions: [String] = [], pluginMentions: [String] = []) -> String {
        let msgId = UUID().uuidString
        let msg = CodexMessage(
            id: msgId,
            threadId: threadId,
            role: .user,
            kind: .chat,
            text: text,
            fileMentions: nil,
            skillMentions: nil,
            pluginMentions: nil,
            createdAt: Date(),
            timeZoneIdentifier: nil,
            turnId: turnId,
            itemId: nil,
            isStreaming: false,
            deliveryState: .pending,
            attachments: attachments,
            planState: nil,
            planPresentation: nil,
            proposedPlan: nil,
            subagentAction: nil,
            structuredUserInputRequest: nil,
            orderIndex: (messagesByThread[threadId]?.count ?? 0)
        )
        messagesByThread[threadId, default: []].append(msg)
        return msgId
    }

    func appendSystemMessage(threadId: String, text: String, turnId: String? = nil, itemId: String? = nil, kind: CodexMessageKind = .toolActivity, isStreaming: Bool = false) {
        let msg = CodexMessage(
            id: itemId ?? UUID().uuidString,
            threadId: threadId,
            role: .system,
            kind: kind,
            text: text,
            fileMentions: nil,
            skillMentions: nil,
            pluginMentions: nil,
            createdAt: Date(),
            timeZoneIdentifier: nil,
            turnId: turnId,
            itemId: itemId,
            isStreaming: isStreaming,
            deliveryState: .confirmed,
            attachments: nil,
            planState: nil,
            planPresentation: nil,
            proposedPlan: nil,
            subagentAction: nil,
            structuredUserInputRequest: nil,
            orderIndex: (messagesByThread[threadId]?.count ?? 0)
        )
        messagesByThread[threadId, default: []].append(msg)
    }

    // MARK: - 审批

    func approvePendingRequest(_ request: CodexApprovalRequest) async {
        if let threadId = request.threadId {
            desktop.respondToPermission(sessionId: threadId, requestId: request.id, approved: true)
        }
        pendingApprovals.removeAll { $0.id == request.id }
    }

    func declinePendingRequest(_ request: CodexApprovalRequest) async {
        if let threadId = request.threadId {
            desktop.respondToPermission(sessionId: threadId, requestId: request.id, approved: false)
        }
        pendingApprovals.removeAll { $0.id == request.id }
    }

    func approvePendingRequest(forThread threadId: String) async {
        let approvals = pendingApprovals.filter { $0.threadId == threadId }
        for approval in approvals {
            desktop.respondToPermission(sessionId: threadId, requestId: approval.id, approved: true)
        }
        pendingApprovals.removeAll { $0.threadId == threadId }
    }

    func declinePendingRequest(forThread threadId: String) async {
        let approvals = pendingApprovals.filter { $0.threadId == threadId }
        for approval in approvals {
            desktop.respondToPermission(sessionId: threadId, requestId: approval.id, approved: false)
        }
        pendingApprovals.removeAll { $0.threadId == threadId }
    }

    func respondToPermission(sessionId: String, requestId: String, approved: Bool) async {
        desktop.respondToPermission(sessionId: sessionId, requestId: requestId, approved: approved)
        pendingApprovals.removeAll { $0.id == requestId }
    }

    func respondToStructuredUserInput(requestID: JSONValue? = nil, answersByQuestionID: [String: [String]] = [:]) {}

    // MARK: - Pin

    func pinThread(_ threadId: String) {
        if !pinnedThreadIDs.contains(threadId) {
            pinnedThreadIDs.append(threadId)
        }
    }

    func unpinThread(_ threadId: String) {
        pinnedThreadIDs.removeAll { $0 == threadId }
    }

    func isThreadPinned(_ threadId: String) -> Bool {
        pinnedThreadIDs.contains(threadId)
    }

    // MARK: - 运行状态

    func threadHasActiveOrRunningTurn(_ threadId: String) -> Bool {
        runningThreadIDs.contains(threadId)
    }

    func threadRunBadgeState(for threadId: String) -> CodexThreadRunBadgeState? {
        if runningThreadIDs.contains(threadId) { return .running }
        if readyThreadIDs.contains(threadId) { return .ready }
        if failedThreadIDs.contains(threadId) { return .failed }
        return nil
    }

    func markThreadAsRunning(_ threadId: String) {
        runningThreadIDs.insert(threadId)
        readyThreadIDs.remove(threadId)
        failedThreadIDs.remove(threadId)
    }

    func clearRunningState(_ threadId: String) {
        runningThreadIDs.remove(threadId)
    }

    func clearAllRunningState() {
        runningThreadIDs.removeAll()
    }

    // MARK: - 模型选择

    func setSelectedModelId(_ modelId: String?) {
        selectedModelId = modelId
    }

    func setSelectedReasoningEffort(_ effort: String?) {
        selectedReasoningEffort = effort
    }

    func setSelectedServiceTier(_ tier: CodexServiceTier?) {
        selectedServiceTier = tier
    }

    func setSelectedAccessMode(_ mode: CodexAccessMode) {
        selectedAccessMode = mode
    }

    func selectedModelOption() -> CodexModelOption? {
        availableModels.first { $0.id == selectedModelId }
    }

    func selectedReasoningEffortForSelectedModel() -> String? {
        nil
    }

    func supportedReasoningEffortsForSelectedModel() -> [CodexReasoningEffortOption] {
        []
    }

    func selectedModelSupportsServiceTier(_ tier: CodexServiceTier) -> Bool {
        false
    }

    func effectiveServiceTier() -> CodexServiceTier? { nil }
    func gitWriterModelIdentifier() -> String? { nil }
    func isRuntimeSelectionLoadingForComposer() -> Bool { false }
    func visibleSelectedModelIDForComposer() -> String? { selectedModelId }

    // MARK: - 上下文窗口

    func refreshUsageStatus(threadId: String) async {}
    func shouldAutoRefreshUsageStatus(threadId: String) -> Bool { false }

    // MARK: - Compact

    func compactThread(_ threadId: String) async {}

    // MARK: - Plan Mode

    func cancelStructuredPlanSession(requestID: JSONValue, turnId: String?, threadId: String) async throws {}
    func implementProposedPlan(threadId: String, proposedPlan: CodexProposedPlan? = nil) async {}
    func submitInferredPlanQuestionnaireResponse(threadId: String, questions: [CodexStructuredUserInputQuestion]? = nil, answersByQuestionID: [String: [String]]? = nil) async {}
    func allowsInferredPlanQuestionnaireFallback(for threadId: String) -> Bool { true }
    func cancelTrustedSessionResolve() {}
    func appendHiddenPushResetMarkers(threadId: String, workingDirectory: String?, branch: String, remote: String?) {}
    func refreshInFlightTurnState(threadId: String) async -> Bool { false }
    func resolveInFlightTurnID(threadId: String) async throws -> String? { nil }

    // MARK: - 文件搜索

    func fuzzyFileSearch(query: String, roots: [String]? = nil, cancellationToken: String? = nil) async -> [CodexFuzzyFileMatch] {
        []
    }

    func listSkills(cwds: [String]? = nil, forceReload: Bool = false) async -> [CodexSkillMetadata] {
        []
    }

    func listPlugins(cwds: [String]? = nil, forceReload: Bool = false) async -> [CodexPluginMetadata] {
        []
    }

    func fetchProjectQuickLocations() async -> [CodexProjectQuickLocation] {
        []
    }

    func fetchProjectlessChatRoots() async -> [String] {
        []
    }

    func listProjectDirectory(path: String) async -> [CodexProjectDirectoryEntry] {
        []
    }

    func searchProjectDirectories(rootPath: String, query: String) async -> [CodexProjectDirectoryEntry] {
        []
    }

    func createProjectDirectory(name: String, parentPath: String) async throws {}

    // MARK: - Composer Drafts

    func composerDraft(for threadId: String) -> TurnComposerLocalDraft? {
        composerDraftsByThreadID[threadId]
    }

    func setComposerDraft(_ draft: TurnComposerLocalDraft?, for threadId: String) {
        if let draft {
            composerDraftsByThreadID[threadId] = draft
        } else {
            composerDraftsByThreadID.removeValue(forKey: threadId)
        }
    }

    func persistComposerDrafts() {}

    // MARK: - Review

    func startReview(threadId: String, turnId: String? = nil, target: CodexReviewTarget?, baseBranch: String? = nil) async {}

    // MARK: - Thread Fork

    func startLocalFork(threadId: String, target: CodexThreadForkTarget) async -> CodexThread? { nil }

    // MARK: - Voice

    func resolveVoiceRecoveryReason(_ reason: Any) -> String? { nil }

    // MARK: - Mac Context

    func setCurrentTrustedMacDeviceId(_ deviceId: String?) {}
    func setPreviousTrustedMacDeviceId(_ deviceId: String?) {}
    func clearPreviousTrustedMacDeviceId() {}
    func clearInMemoryMacScopedState() {}
    func rememberRelayPairing(_ url: String) {}
    func rememberRelayPairing(_ payload: CodexPairingQRPayload) {}
    func normalizedMacDeviceId(_ deviceId: String?) -> String? { nil }
    func loadMacScopedDefaultsState(for macDeviceId: String?) {}
    func restoreTrustedPairPresentationState() {}
    func pruneOfflineTrustedMacRecords(matching trustedMac: CodexTrustedMacRecord) -> Int { 0 }
    func resolveTrustedMacSession(deviceId: String) async throws -> CodexTrustedSessionResolveResponse {
        CodexTrustedSessionResolveResponse()
    }
    func interruptAllRunningTurnsBeforeMacSwitch() async throws {}

    // MARK: - Error Helpers

    func isBenignBackgroundDisconnect(_ error: Error) -> Bool { false }
    func isRecoverableTransientConnectionError(_ error: Error) -> Bool { false }
    func isRetryableSavedSessionConnectError(_ error: Error) -> Bool { false }
    func userFacingConnectFailureMessage(_ error: Error) -> String { error.localizedDescription }
    func userFacingTurnErrorMessage(from state: CodexTurnTerminalState?) -> String? { nil }
    func userFacingTurnErrorMessage(from error: Error) -> String? { error.localizedDescription }
    func userFacingTurnErrorMessageForFooter(from state: CodexTurnTerminalState?) -> String? { nil }
    func userFacingTurnErrorMessageForFooter(from error: Error) -> String? { error.localizedDescription }
    func recoveryStatusMessage(for error: Error) -> String {
        error.localizedDescription
    }

    // MARK: - Debug


    func clearRuntimeDebugLog() { runtimeDebugLogEntries.removeAll() }
    func idKey(from value: JSONValue) -> String { "" }

    // MARK: - Message Operations

    func startThreadIfReady(preferredProjectPath: String? = nil, rootlessChatPromptHint: String? = nil) async throws -> CodexThread {
        throw NSError(domain: "CodexService", code: -1, userInfo: [NSLocalizedDescriptionKey: "Not implemented"])
    }

    func movePreAppendedOutgoingUserMessage(_ preAppended: CodexPreAppendedTurnMessage?, from sourceThreadId: String, to targetThreadId: String) -> CodexPreAppendedTurnMessage? {
        nil
    }

    func removeUserMessage(threadId: String, messageId: String) {
        messagesByThread[threadId]?.removeAll { $0.id == messageId }
    }

    func removeLatestFailedUserMessage(threadId: String, matchingText: String? = nil, matchingAttachments: [CodexImageAttachment] = []) {
        if let idx = messagesByThread[threadId]?.lastIndex(where: { $0.role == .user && $0.deliveryState == .failed }) {
            messagesByThread[threadId]?.remove(at: idx)
        }
    }

    func movePreAppendOutgoingUserMessage(threadId: String, from index: Int, to targetIndex: Int) -> CodexMessage? {
        guard var msgs = messagesByThread[threadId],
              index < msgs.count, targetIndex < msgs.count else { return nil }
        let msg = msgs.remove(at: index)
        msgs.insert(msg, at: targetIndex)
        messagesByThread[threadId] = msgs
        return msg
    }

    func preAppendOutgoingUserMessage(
        userInput: String,
        threadId: String,
        attachments: [CodexImageAttachment]? = nil,
        skillMentions: [CodexSkillMention]? = nil,
        mentionMentions: [CodexTurnMention]? = nil,
        fileMentions: [String]? = nil
    ) -> CodexPreAppendedTurnMessage? {
        let msgId = UUID().uuidString
        let msg = CodexMessage(
            id: msgId,
            threadId: threadId,
            role: .user,
            kind: .chat,
            text: userInput,
            fileMentions: fileMentions?.map { CodexTurnMention(name: $0, path: $0) },
            skillMentions: skillMentions,
            createdAt: Date(),
            isStreaming: false,
            deliveryState: .pending,
            orderIndex: (messagesByThread[threadId]?.count ?? 0)
        )
        messagesByThread[threadId, default: []].append(msg)
        return CodexPreAppendedTurnMessage(id: msgId, text: userInput, turnId: nil)
    }

    // MARK: - Subagent

    func loadSubagentThreadMetadataIfNeeded(threadIds: [String]) async {}
    func registerSubagentThreads(action: CodexSubagentAction, parentThreadId: String) {}

    func resolvedSubagentDisplayLabel(threadId: String, agentId: String?) -> String? { nil }
    func upsertSubagentIdentity(threadId: String, agentId: String?, nickname: String?, role: String?) {}

    /// 解析子代理呈现信息（SubagentViews 中调用）
    func resolvedSubagentPresentation(
        _ presentation: CodexSubagentThreadPresentation,
        parentThreadId: String
    ) -> CodexSubagentThreadPresentation {
        presentation
    }

    // MARK: - Workspace

    func loadLocalState(for threadId: String?) {}
    func saveLocalState(for threadId: String?) {}

    // MARK: - Missing Stubs (Remodex View Layer References)

    var currentPlanSessionSource: CodexPlanSessionSource { .compatibilityFallback }
    func currentPlanSessionSource(for threadId: String) -> CodexPlanSessionSource { .compatibilityFallback }
    var canWakePreferredMacDisplay: Bool { false }
    func consumePendingComposerAction(for threadId: String) -> CodexPendingThreadComposerAction? { nil }
    func associatedManagedWorktreePath(for threadId: String?) -> String? { nil }
    func readyChangeSet(for changeSetID: String) -> AIChangeSet? { nil }
    func assistantRevertPresentation(for messageID: String) -> AssistantRevertPresentation? { nil }
    func previewRevert(changeSetID: String) async throws -> AIChangeSet? { nil }
    func applyRevert(changeSetID: String) async throws {}
    func refreshContextWindowUsage(threadId: String) async {}
    nonisolated static func userMessagesMatchForHistory(_ a: CodexMessage, _ b: CodexMessage) -> Bool { a.id == b.id }
    nonisolated static func shouldPreferIncomingUserPresentationText(existing: CodexMessage, incoming: CodexMessage) -> Bool { false }
    func awaitRuntimeInitializedIfNeeded() async throws {}
    func threadDisplayPhase(threadId: String, hasVisibleMessages: Bool, isThreadRunning: Bool) -> ThreadDisplayPhase {
        if hasVisibleMessages { return .ready }
        if isThreadRunning { return .loading }
        return .empty
    }
    func markThreadAsViewed(_ threadId: String) {}

    // MARK: - Sync

    func startSyncLoop() {
        Task {
            while true {
                try? await Task.sleep(for: .seconds(10))
                guard isConnected else { return }
                await desktop.refreshSessions()
                syncFromDesktop()
            }
        }
    }

    // MARK: - Thread Lookup

    func thread(for threadId: String) -> CodexThread? {
        threadByID[threadId]
    }

    func threadIndex(for threadId: String) -> Int? {
        threadIndexByID[threadId]
    }

    func firstLiveThreadID() -> String? {
        threads.first?.id
    }

    func upsertThread(_ thread: CodexThread, treatAsServerState: Bool = true) {
        if let idx = threadIndexByID[thread.id] {
            threads[idx] = thread
        } else {
            threads.append(thread)
        }
        rebuildThreadLookupCaches()
    }

    private func rebuildThreadLookupCaches() {
        threadByID = Dictionary(uniqueKeysWithValues: threads.map { ($0.id, $0) })
        threadIndexByID = Dictionary(uniqueKeysWithValues: threads.enumerated().map { ($1.id, $0) })
    }

    private func refreshPinnedThreadSnapshots() {}

    // MARK: - Deinit

    deinit {
        // Cleanup handled by DesktopService
    }
}

// MARK: - Mapping Extensions

extension CodexMessageRole {
    init(from role: MessageRole) {
        switch role {
        case .user: self = .user
        case .assistant: self = .assistant
        case .system: self = .system
        }
    }
}

extension CodexMessageKind {
    init(from kind: MessageKind) {
        switch kind {
        case .userText: self = .chat
        case .assistantText: self = .chat
        case .toolUse: self = .toolActivity
        case .toolResult: self = .toolActivity
        case .thinking: self = .thinking
        case .compactSummary: self = .chat
        case .permissionRequest: self = .chat
        case .error: self = .chat
        case .system: self = .chat
        }
    }
}

extension CodexMessageDeliveryState {
    init(from state: DeliveryState) {
        switch state {
        case .pending: self = .pending
        case .confirmed: self = .confirmed
        case .failed: self = .failed
        }
    }
}

// MARK: - Convenience Init for CodexMessage

extension CodexMessage {
    init(
        id: String,
        threadId: String,
        role: CodexMessageRole,
        kind: CodexMessageKind,
        text: String,
        fileMentions: [CodexFileMention]? = nil,
        skillMentions: [CodexSkillMention]? = nil,
        pluginMentions: [CodexPluginMetadata]? = nil,
        createdAt: Date,
        timeZoneIdentifier: String? = nil,
        turnId: String? = nil,
        itemId: String? = nil,
        isStreaming: Bool,
        deliveryState: CodexMessageDeliveryState,
        attachments: [CodexImageAttachment]? = nil,
        planState: CodexPlanState? = nil,
        planPresentation: CodexPlanPresentation? = nil,
        proposedPlan: CodexProposedPlan? = nil,
        subagentAction: CodexSubagentAction? = nil,
        structuredUserInputRequest: CodexStructuredUserInputRequest? = nil,
        orderIndex: Int
    ) {
        self.id = id
        self.threadId = threadId
        self.role = role
        self.kind = kind
        self.assistantPhase = nil
        self.text = text
        self.textRenderSignature = CodexMessageTextRenderSignature(text: text)
        self.fileMentions = fileMentions?.map { $0.path } ?? []
        self.skillMentions = skillMentions?.map { $0.id } ?? []
        self.pluginMentions = pluginMentions?.map { $0.id } ?? []
        self.createdAt = createdAt
        self.timeZoneIdentifier = timeZoneIdentifier
        self.turnId = turnId
        self.itemId = itemId
        self.isStreaming = isStreaming
        self.deliveryState = deliveryState
        self.attachments = attachments ?? []
        self.planState = planState
        self.planPresentation = planPresentation
        self.proposedPlan = proposedPlan
        self.subagentAction = subagentAction
        self.structuredUserInputRequest = structuredUserInputRequest
        self.orderIndex = orderIndex
    }
}

// MARK: - History Load Outcome

enum ThreadHistoryLoadOutcome: Sendable {
    case loaded
    case alreadyLoaded
    case failed(Error)
}

enum RunningThreadCatchupOutcome: Sendable {
    case caughtUp
    case failed
}

// MARK: - Missing Types (Stubs)

// These types are referenced by views but have complex dependencies we don't need.
// They are declared with minimal implementations.

struct CodexGPTAccountSnapshot: Equatable, Sendable {
    var status: String?
    var authMethod: String?
    var email: String?
    var planType: String?
    var hostPlatform: CodexBridgeHostPlatform?
    var hostCapabilities: CodexBridgeHostCapabilities?
    init() {}
}

// 以下类型已在 Remodex Models/ 目录中定义，此处不再重复：
// CodexRuntimeTransportMode, CodexBridgeHostPlatform, CodexBridgeHostCapabilities,
// CodexSecureConnectionState, CodexPlanSessionSource, CodexCollaborationModeKind,
// TurnGitActionPhase, TurnGitActionPhaseStatus, AssistantRevertPresentation,
// AIChangeSet, AIChangeSetPersistence, LocalNetworkAuthorizationStatus,
// InlineCommitAndPushPhase, TurnGitSyncAlert 等

// MARK: - 仅在 CodexService.swift 中需要的辅助类型

struct CodexNotificationCenterDelegateProxy: Sendable {}
protocol CodexUserNotificationCentering: Sendable {}
extension UNUserNotificationCenter: CodexUserNotificationCentering {}
protocol CodexRemoteNotificationRegistering: Sendable {}
struct CodexApplicationRemoteNotificationRegistrar: CodexRemoteNotificationRegistering {}

struct CodexPhoneIdentityState: Equatable, Sendable {
    static let uninitialized = CodexPhoneIdentityState()
}

struct CodexTrustedMacRegistry: Equatable, Sendable {
    var records: [String: CodexTrustedMacRecord] = [:]
    static let empty = CodexTrustedMacRegistry()
}

struct CodexTrustedMacRecord: Equatable, Sendable {
    var macIdentityPublicKey: String
    var relayURL: String?
    var macDeviceId: String = ""
    var lastResolvedAt: Date? = nil
    var lastUsedAt: Date? = nil
    var lastPairedAt: Date? = nil
}

struct CodexSecureSession: Sendable {}
struct CodexPendingHandshake: Sendable {}
struct CodexSecureControlWaiter {
    let id: UUID
    let continuation: CheckedContinuation<String, Error>
}

struct CodexTrustedSessionResolveResponse: Sendable {
    var sessionId: String = ""
    var macDeviceId: String = ""
    var macIdentityPublicKey: String = ""
}

let codexSecureProtocolVersion = 1

func codexPhoneIdentityStateFromSecureStore() -> CodexPhoneIdentityState { .uninitialized }
func codexTrustedMacRegistryFromSecureStore() -> CodexTrustedMacRegistry { .empty }
func codexSecureFingerprint(for publicKey: String) -> String? { nil }
func codexGPTAccountInitialSnapshot() -> CodexGPTAccountSnapshot { .init() }
func persistGPTAccountSnapshot(_ snapshot: CodexGPTAccountSnapshot) {}

enum CodexPendingThreadComposerAction: Equatable, Sendable {
    case codeReview(target: CodexPendingCodeReviewTarget)
}

enum CodexPendingCodeReviewTarget: Equatable, Sendable {
    case uncommittedChanges
    case baseBranch
}

struct CodexProjectQuickLocation: Identifiable, Sendable {
    let id: String
    let path: String
    let label: String
}

struct CodexProjectDirectoryEntry: Identifiable, Sendable {
    let id: String
    let name: String
    let path: String
    let isDirectory: Bool
}

struct RemodexTerminalSnapshot: Equatable, Sendable {
    static let idle = RemodexTerminalSnapshot()
}

struct RemodexTerminalProfile: Codable, Equatable, Sendable {
    static func load() -> RemodexTerminalProfile { RemodexTerminalProfile() }
}

struct RemodexTerminalProfileStore {
    static func load() -> RemodexTerminalProfile { .init() }
}

class RemodexNativeSSHTerminal: @unchecked Sendable {}

struct CodexSecureKeys {
    static let relaySessionId = "codex.relaySessionId"
    static let relayUrl = "codex.relayUrl"
    static let relayMacDeviceId = "codex.relayMacDeviceId"
    static let relayMacIdentityPublicKey = "codex.relayMacIdentityPublicKey"
    static let relayProtocolVersion = "codex.relayProtocolVersion"
    static let relayLastAppliedBridgeOutboundSeq = "codex.relayLastAppliedBridgeOutboundSeq"
    static let currentTrustedMacDeviceId = "codex.currentTrustedMacDeviceId"
    static let lastTrustedMacDeviceId = "codex.lastTrustedMacDeviceId"
    static let pushDeviceToken = "codex.pushDeviceToken"
}

struct SecureStore {
    static func readString(for key: String) -> String? { nil }
    static func writeString(_ value: String, for key: String) {}
    static func deleteValue(for key: String) {}
}

func macScopedDefaultsKey(_ key: String) -> String { key }
func migrateCurrentTrustedMacDeviceIdIfNeeded() {}
func migrateLegacyMacScopedDefaultsIfNeeded() {}
func loadCurrentMacScopedDefaultsState() {}
func loadCurrentMacScopedLocalState() {}
func rebuildSubagentIdentityDirectory() {}

private extension String {
    var codexNilIfEmpty: String? { isEmpty ? nil : self }
}

// MARK: - Type Aliases (Remodex Models 使用不同名称)

typealias CodexSkillMention = CodexTurnSkillMention
typealias CodexFileMention = CodexTurnMention
typealias CodexPluginMention = CodexPluginMetadata

// MARK: - Thread Display Phase

enum ThreadDisplayPhase: Equatable {
    case loading
    case empty
    case ready
}
