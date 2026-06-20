// FILE: TurnView.swift
// Purpose: 简化版 TurnView — 显示消息列表 + 输入框，使用 CodexService 桥接
// Layer: View
// Exports: TurnView
// Depends on: CodexService, TurnComposerView, MessageRow, ChatEmptyStatePlaceholder

import SwiftUI

struct TurnView: View {
    let thread: CodexThread
    let isWakingMacDisplayRecovery: Bool

    @Environment(CodexService.self) private var codex

    // MARK: - 状态派生

    private var messages: [CodexMessage] {
        codex.messages(for: thread.id)
    }

    private var displayPhase: CodexService.ThreadDisplayPhase {
        codex.threadDisplayPhase(threadId: thread.id)
    }

    // MARK: - Body

    var body: some View {
        VStack(spacing: 0) {
            // 消息列表区域
            messageListArea

            Divider()

            // 输入框
            TurnComposerView(threadId: thread.id)
        }
        .navigationTitle(thread.displayTitle)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .principal) {
                TurnChatToolbarTitleLabel(
                    title: thread.displayTitle,
                    subtitle: connectionStatusSubtitle
                )
            }
        }
        .task {
            // 首次出现时确保线程数据已准备好
            await codex.prepareThreadForDisplay(threadId: thread.id)
        }
    }

    // MARK: - 消息列表

    @ViewBuilder
    private var messageListArea: some View {
        switch displayPhase {
        case .loading:
            ChatEmptyStatePlaceholder(
                title: Text("Loading chat..."),
                subtitle: "Fetching the latest messages for this conversation."
            )

        case .empty:
            ChatEmptyStatePlaceholder(
                title: ChatEmptyStateTitleBuilder.makeTitle(for: emptyStateFolderName),
                subtitle: "Chats are End-to-end encrypted"
            )

        case .ready:
            ScrollViewReader { proxy in
                List {
                    ForEach(messages) { message in
                        MessageRow(message: message)
                            .id(message.id)
                    }
                }
                .listStyle(.plain)
                .onChange(of: messages.last?.id) { _, newID in
                    if let newID {
                        withAnimation {
                            proxy.scrollTo(newID, anchor: .bottom)
                        }
                    }
                }
            }
        }
    }

    // MARK: - 辅助

    private var connectionStatusSubtitle: String? {
        if codex.isConnecting {
            return "Connecting..."
        }
        if !codex.isConnected {
            return "Offline"
        }
        return nil
    }

    private var emptyStateFolderName: String? {
        guard let cwd = thread.gitWorkingDirectory,
              !cwd.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            return nil
        }
        let display = cwd.pathDisplayName
        return display.isEmpty ? nil : display
    }
}

// MARK: - Preview

#Preview {
    NavigationStack {
        TurnView(
            thread: CodexThread(id: "thread_preview", title: "Preview"),
            isWakingMacDisplayRecovery: false
        )
        .environment(CodexService())
    }
}
