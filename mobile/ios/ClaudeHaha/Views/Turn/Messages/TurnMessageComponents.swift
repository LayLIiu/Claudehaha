// FILE: TurnMessageComponents.swift
// Purpose: 简化版消息行渲染组件 — 使用我们的接口

import SwiftUI

// MARK: - Message Row

/// 渲染单条消息的视图
struct MessageRow: View, Equatable {
    let message: CodexMessage
    var isRetryAvailable: Bool = false
    var onRetryUserMessage: (String) -> Void = { _ in }
    var assistantBlockAccessoryState: AssistantBlockAccessoryState? = nil
    var planSessionSource: CodexPlanSessionSource? = nil
    var allowsAssistantPlanFallbackRecovery: Bool = false
    var assistantTurnCompleted: Bool = false
    var threadMessagesForPlanMatching: [CodexMessage] = []
    var currentWorkingDirectory: String? = nil
    var planMatchingFingerprint: Int = 0
    var showsStreamingAnimations: Bool = false
    var protectsPendingIndicatorAnchor: Bool = false
    var inlineCommitAndPushAction: (() -> Void)? = nil
    var inlineCommitAndPushPhase: InlineCommitAndPushPhase? = nil
    var assistantRevertAction: (CodexMessage) -> Void = { _ in }
    var subagentOpenAction: (CodexSubagentThreadPresentation) -> Void = { _ in }
    var onTapAssistantRevert: (CodexMessage) -> Void = { _ in }
    var onTapSubagent: (CodexSubagentThreadPresentation) -> Void = { _ in }

    static func == (lhs: MessageRow, rhs: MessageRow) -> Bool {
        lhs.message.id == rhs.message.id &&
        lhs.message.textRenderSignature == rhs.message.textRenderSignature &&
        lhs.message.deliveryState == rhs.message.deliveryState
    }

    var body: some View {
        switch message.role {
        case .user:
            UserMessageBubbleSimple(message: message)
        case .assistant:
            AssistantMessageBlock(message: message)
        case .system:
            SystemMessageBlock(message: message)
        }
    }
}

// MARK: - User Message

struct UserMessageBubbleSimple: View {
    let message: CodexMessage
    @State private var isExpanded = false

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 6) {
                Text("你")
                    .font(AppFont.caption())
                    .fontWeight(.semibold)
                    .foregroundStyle(.secondary)

                if message.deliveryState == .pending {
                    Text("发送中")
                        .font(AppFont.caption2())
                        .foregroundStyle(.tertiary)
                } else if message.deliveryState == .failed {
                    Text("发送失败")
                        .font(AppFont.caption2())
                        .foregroundStyle(.red)
                }
            }

            Text(message.text)
                .font(AppFont.body())
                .foregroundStyle(.primary)
                .textSelection(.enabled)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(12)
                .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 12))
        }
        .padding(.vertical, 6)
    }
}

// MARK: - Assistant Message

struct AssistantMessageBlock: View {
    let message: CodexMessage
    @State private var isThinkingExpanded = false
    @State private var isToolExpanded = false

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            switch message.kind {
            case .thinking:
                ThinkingBlockSimple(text: message.text, isStreaming: message.isStreaming, isExpanded: $isThinkingExpanded)
            case .toolActivity:
                ToolCallBlockSimple(message: message, isExpanded: $isToolExpanded)
            default:
                // 普通文本
                if message.text.isEmpty && message.isStreaming {
                    Text(" ")
                        .font(AppFont.body())
                } else {
                    Text(message.text)
                        .font(AppFont.body())
                        .lineSpacing(4)
                        .foregroundStyle(.primary)
                        .textSelection(.enabled)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }

                if message.isStreaming {
                    Text("▌")
                        .font(AppFont.body())
                        .foregroundStyle(Color.accentColor)
                        .blink()
                }
            }
        }
        .padding(.vertical, 8)
    }
}

// MARK: - System Message

struct SystemMessageBlock: View {
    let message: CodexMessage
    @State private var isResultExpanded = false

    var body: some View {
        if message.kind == .toolActivity {
            // 工具结果
            ToolResultBlockSimple(message: message, isExpanded: $isResultExpanded)
        } else {
            Text(message.text)
                .font(AppFont.caption())
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.vertical, 4)
        }
    }
}

// MARK: - Thinking Block

struct ThinkingBlockSimple: View {
    let text: String
    let isStreaming: Bool
    @Binding var isExpanded: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Button {
                withAnimation(.easeInOut(duration: 0.2)) {
                    isExpanded.toggle()
                }
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: isExpanded ? "chevron.down" : "chevron.right")
                        .font(AppFont.caption2())
                    Text("思考过程")
                        .font(AppFont.caption())
                        .foregroundStyle(.secondary)
                    if isStreaming {
                        ProgressView()
                            .scaleEffect(0.6)
                    }
                }
            }
            .buttonStyle(.plain)

            if isExpanded && !text.isEmpty {
                Text(text)
                    .font(AppFont.caption())
                    .foregroundStyle(.secondary)
                    .padding(.leading, 14)
                    .padding(.vertical, 4)
            }
        }
    }
}

// MARK: - Tool Call Block

struct ToolCallBlockSimple: View {
    let message: CodexMessage
    @Binding var isExpanded: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Button {
                withAnimation { isExpanded.toggle() }
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: "wrench.and.screwdriver")
                        .font(AppFont.caption())
                        .foregroundStyle(.orange)
                    Text(message.text.isEmpty ? "工具调用" : message.text)
                        .font(AppFont.caption())
                        .fontWeight(.medium)
                        .lineLimit(1)
                    Spacer()
                    Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                        .font(AppFont.caption2())
                        .foregroundStyle(.tertiary)
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(Color.orange.opacity(0.1), in: RoundedRectangle(cornerRadius: 8))
            }
            .buttonStyle(.plain)
        }
    }
}

// MARK: - Tool Result Block

struct ToolResultBlockSimple: View {
    let message: CodexMessage
    @Binding var isExpanded: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Button {
                withAnimation { isExpanded.toggle() }
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: "checkmark.circle")
                        .font(AppFont.caption())
                        .foregroundStyle(.green)
                    Text("执行结果")
                        .font(AppFont.caption())
                    Spacer()
                    Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                        .font(AppFont.caption2())
                        .foregroundStyle(.tertiary)
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(Color.green.opacity(0.1), in: RoundedRectangle(cornerRadius: 8))
            }
            .buttonStyle(.plain)

            if isExpanded && !message.text.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    Text(message.text)
                        .font(AppFont.mono(.caption))
                        .foregroundStyle(.secondary)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                }
                .padding(.leading, 8)
            }
        }
    }
}

// MARK: - Blink Modifier

struct Blink: ViewModifier {
    @State private var isVisible = true

    func body(content: Content) -> some View {
        content
            .opacity(isVisible ? 1 : 0)
            .animation(.easeInOut(duration: 0.5).repeatForever(autoreverses: true), value: isVisible)
            .onAppear { isVisible = false }
    }
}

extension View {
    func blink() -> some View {
        modifier(Blink())
    }
}
