// FILE: TurnComposerView.swift
// Purpose: 简化版聊天输入框 — 使用我们的 DesktopService 接口

import SwiftUI

/// 聊天输入框
struct TurnComposerView: View {
    @Environment(CodexService.self) private var codex
    let threadId: String
    @State private var inputText = ""
    @FocusState private var isFocused: Bool

    var body: some View {
        HStack(alignment: .bottom, spacing: 10) {
            // 文本输入
            TextField("输入消息...", text: $inputText, axis: .vertical)
                .lineLimit(1...6)
                .textFieldStyle(.plain)
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(Color(.tertiarySystemFill), in: RoundedRectangle(cornerRadius: 20))
                .focused($isFocused)
                .onSubmit {
                    if !isThreadRunning { sendMessage() }
                }

            // 发送/停止按钮
            if isThreadRunning {
                Button {
                    Task { try? await codex.interruptTurn(turnId: codex.activeTurnId ?? "", threadId: threadId) }
                } label: {
                    Image(systemName: "stop.circle.fill")
                        .font(.title2)
                        .foregroundStyle(.red)
                }
            } else {
                Button {
                    sendMessage()
                } label: {
                    Image(systemName: "arrow.up.circle.fill")
                        .font(.title2)
                        .foregroundStyle(inputText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? Color.gray : Color.accentColor)
                }
                .disabled(inputText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(Color(.systemBackground))
    }

    private var isThreadRunning: Bool {
        codex.runningThreadIDs.contains(threadId)
    }

    private func sendMessage() {
        let content = inputText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !content.isEmpty else { return }

        Task {
            await codex.startTurn(userInput: content, threadId: threadId)
        }
        inputText = ""
    }
}
