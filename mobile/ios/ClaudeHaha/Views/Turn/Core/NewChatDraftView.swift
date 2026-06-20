// FILE: NewChatDraftView.swift
// Purpose: 简化版新建对话界面 — 选择项目、输入消息
// 移除了 VoiceInput、trustedPairPresentation、Git 操作等复杂依赖

import SwiftUI

struct NewChatDraftRoute: Hashable {
    let id: String
    let preferredProjectPath: String?
}

struct NewChatDraftView: View {
    @Environment(CodexService.self) private var codex

    let route: NewChatDraftRoute
    var onOpenThread: @MainActor @Sendable (CodexThread) -> Void

    @State private var selectedProjectPath: String?

    var body: some View {
        VStack(spacing: 0) {
            Spacer(minLength: 0)

            // 提示区域
            promptArea

            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(.systemBackground))
        .safeAreaInset(edge: .bottom, spacing: 0) {
            // 输入框
            TurnComposerView(threadId: route.id)
        }
        .navigationTitle("New thread")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            // 如果路由带了偏好项目路径，直接使用
            if selectedProjectPath == nil {
                selectedProjectPath = route.preferredProjectPath
            }
        }
    }

    // MARK: - 提示区域

    private var promptArea: some View {
        VStack(spacing: 12) {
            Image(systemName: "bubble.left.and.bubble.right")
                .font(.system(size: 40))
                .foregroundStyle(.secondary)

            Text("What should we work on?")
                .font(.title2)
                .foregroundStyle(.primary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 28)

            if let projectPath = selectedProjectPath {
                Text(projectPath)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .truncationMode(.middle)
                    .padding(.horizontal, 28)
            }
        }
        .padding()
    }
}
