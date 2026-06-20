// FILE: TurnComposerRuntimeActions.swift
// Purpose: Centralizes the composer runtime selection callbacks shared across nested views.
// Layer: View Helper
// Exports: TurnComposerRuntimeActions
// Depends on: CodexService, CodexServiceTier

import Foundation

struct TurnComposerRuntimeActions {
    let selectModel: @MainActor (String) -> Void
    let selectAutomaticReasoning: @MainActor () -> Void
    let selectReasoning: @MainActor (String) -> Void
    let selectServiceTier: @MainActor (CodexServiceTier?) -> Void

    @MainActor
    static func resolve(codex: CodexService) -> TurnComposerRuntimeActions {
        TurnComposerRuntimeActions(
            selectModel: codex.setSelectedModelId,
            selectAutomaticReasoning: { codex.setSelectedReasoningEffort(nil) },
            selectReasoning: { effort in codex.setSelectedReasoningEffort(effort) },
            selectServiceTier: codex.setSelectedServiceTier
        )
    }
}
