// FILE: TurnComposerHostView.swift
// Purpose: 简化版 Composer Host — 适配 TurnView/NewChatDraftView 的调用接口，内部使用简化版 TurnComposerView

import SwiftUI

struct TurnComposerHostView: View {
    @Bindable var viewModel: TurnViewModel
    let codex: CodexService
    let thread: CodexThread
    let activeTurnID: String?
    let isThreadRunning: Bool
    let isEmptyThread: Bool
    let isWorktreeProject: Bool
    var activeFileChangeStatus: FileChangeStatusSnapshot? = nil
    let canForkLocally: Bool
    let isInputFocused: Binding<Bool>
    let orderedModelOptions: [CodexModelOption]
    let selectedModelTitle: String
    let reasoningDisplayOptions: [TurnComposerReasoningDisplayOption]
    let showsGitControls: Bool
    let isGitBranchSelectorEnabled: Bool
    let onSelectGitBranch: (String) -> Void
    let onCreateGitBranch: (String) -> Void
    let onRefreshGitBranches: () -> Void
    let onStartCodeReviewThread: (TurnComposerReviewTarget) -> Void
    let onStartForkThreadLocally: () -> Void
    let onOpenForkWorktree: () -> Void
    let onOpenWorktreeHandoff: () -> Void
    let onOpenFeedbackMail: () -> Void
    let onShowStatus: () -> Void
    let voiceButtonPresentation: TurnComposerVoiceButtonPresentation
    var isVoiceInputActive: Bool = false
    let isVoiceRecording: Bool
    let voiceAudioLevels: [CGFloat]
    let voiceRecordingDuration: TimeInterval
    let onTapVoice: () -> Void
    let onCancelVoiceRecording: () -> Void
    let onSend: () -> Void
    var showsSecondaryBar: Bool = true

    var body: some View {
        // 使用简化版 TurnComposerView
        TurnComposerView(threadId: thread.id)
    }
}
