import SwiftUI

/// 聊天视图 — 消息列表 + 输入框
struct ChatView: View {
    @Environment(DesktopService.self) private var service
    let sessionId: String

    @State private var inputText = ""
    @State private var isInputFocused = false
    @FocusState private var focusState: Bool

    var body: some View {
        VStack(spacing: 0) {
            // 消息列表
            MessageListView(sessionId: sessionId)

            Divider()

            // 权限审批横幅
            if !pendingPermissions.isEmpty {
                PermissionBanner(sessionId: sessionId)
            }

            // 输入框
            ChatInputView(
                sessionId: sessionId,
                text: $inputText,
                isFocused: $focusState,
                isGenerating: sessionState.isRunning
            )
        }
        .navigationTitle(sessionTitle)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                sessionStateIndicator
            }
        }
        .task {
            service.connectToSession(sessionId)
        }
    }

    // MARK: - Computed

    private var session: Session? {
        service.sessions.first { $0.id == sessionId }
    }

    private var sessionTitle: String {
        session?.displayTitle ?? "对话"
    }

    private var sessionState: ChatState {
        session?.state ?? .idle
    }

    private var pendingPermissions: [PermissionRequest] {
        service.pendingPermissions.filter { $0.sessionId == sessionId }
    }

    private var sessionStateIndicator: some View {
        Group {
            if sessionState.isRunning {
                HStack(spacing: 4) {
                    ProgressView()
                        .scaleEffect(0.7)
                    Text(sessionState.displayName)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
        }
    }
}

// MARK: - Message List

struct MessageListView: View {
    @Environment(DesktopService.self) private var service
    let sessionId: String

    var body: some View {
        ScrollViewReader { proxy in
            List {
                ForEach(messages) { message in
                    MessageRowView(message: message)
                        .id(message.id)
                        .listRowSeparator(.hidden)
                        .listRowInsets(EdgeInsets(top: 4, leading: 16, bottom: 4, trailing: 16))
                }

                // 底部锚点
                Color.clear
                    .frame(height: 1)
                    .id("bottom")
            }
            .listStyle(.plain)
            .onChange(of: messages.count) { _, _ in
                withAnimation {
                    proxy.scrollTo("bottom", anchor: .bottom)
                }
            }
        }
    }

    private var messages: [Message] {
        service.messagesBySession[sessionId] ?? []
    }
}

// MARK: - Message Row

struct MessageRowView: View {
    let message: Message

    var body: some View {
        switch message.role {
        case .user:
            UserMessageBubble(message: message)
        case .assistant:
            AssistantMessageBubble(message: message)
        case .system:
            SystemMessageBubble(message: message)
        }
    }
}

// MARK: - User Message Bubble

struct UserMessageBubble: View {
    let message: Message

    var body: some View {
        HStack {
            Spacer(minLength: 60)
            VStack(alignment: .trailing, spacing: 4) {
                Text(message.text)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(Color.accentColor, in: RoundedRectangle(cornerRadius: 18))
                    .foregroundStyle(.white)
                    .font(.body)

                if message.deliveryState == .pending {
                    Text("发送中")
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }
            }
        }
    }
}

// MARK: - Assistant Message Bubble

struct AssistantMessageBubble: View {
    let message: Message

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            // 头像
            Circle()
                .fill(Color(.systemGray5))
                .frame(width: 28, height: 28)
                .overlay {
                    Image(systemName: "sparkles")
                        .font(.caption)
                        .foregroundStyle(Color.accentColor)
                }

            VStack(alignment: .leading, spacing: 4) {
                if message.kind == .thinking {
                    ThinkingBlockView(text: message.text, isStreaming: message.isStreaming)
                } else if message.kind == .toolUse {
                    ToolCallBlockView(message: message)
                } else {
                    // 普通文本
                    Text(message.text)
                        .font(.body)
                        .textSelection(.enabled)

                    if message.isStreaming {
                        Text("▌")
                            .font(.body)
                            .foregroundStyle(Color.accentColor)
                            .blink()
                    }
                }
            }

            Spacer(minLength: 60)
        }
    }
}

// MARK: - System Message Bubble

struct SystemMessageBubble: View {
    let message: Message

    var body: some View {
        if message.kind == .toolResult {
            ToolResultBlockView(message: message)
        } else {
            HStack {
                Spacer()
                Text(message.text)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(Color(.tertiarySystemFill), in: RoundedRectangle(cornerRadius: 8))
                Spacer()
            }
        }
    }
}

// MARK: - Thinking Block

struct ThinkingBlockView: View {
    let text: String
    var isStreaming: Bool = false

    @State private var isExpanded = false

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Button {
                withAnimation(.easeInOut(duration: 0.2)) {
                    isExpanded.toggle()
                }
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: isExpanded ? "chevron.down" : "chevron.right")
                        .font(.caption2)
                    Text("思考过程")
                        .font(.caption)
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
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .padding(.leading, 14)
                    .padding(.vertical, 4)
            }
        }
    }
}

// MARK: - Tool Call Block

struct ToolCallBlockView: View {
    let message: Message

    @State private var isExpanded = false

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Button {
                withAnimation { isExpanded.toggle() }
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: "wrench.and.screwdriver")
                        .font(.caption)
                        .foregroundStyle(.orange)
                    Text(message.toolName ?? "工具")
                        .font(.caption)
                        .fontWeight(.medium)
                    Spacer()
                    Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(Color.orange.opacity(0.1), in: RoundedRectangle(cornerRadius: 8))
            }
            .buttonStyle(.plain)

            if isExpanded, let input = message.toolInput {
                Text(input)
                    .font(.caption.monospaced())
                    .foregroundStyle(.secondary)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(Color(.tertiarySystemFill), in: RoundedRectangle(cornerRadius: 6))
                    .padding(.leading, 8)
            }
        }
    }
}

// MARK: - Tool Result Block

struct ToolResultBlockView: View {
    let message: Message

    @State private var isExpanded = false

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Button {
                withAnimation { isExpanded.toggle() }
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: "checkmark.circle")
                        .font(.caption)
                        .foregroundStyle(.green)
                    Text("执行结果")
                        .font(.caption)
                    Spacer()
                    Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(Color.green.opacity(0.1), in: RoundedRectangle(cornerRadius: 8))
            }
            .buttonStyle(.plain)

            if isExpanded, let output = message.toolOutput {
                ScrollView(.horizontal, showsIndicators: false) {
                    Text(output)
                        .font(.caption.monospaced())
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
