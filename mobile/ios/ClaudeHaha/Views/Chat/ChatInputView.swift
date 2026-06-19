import SwiftUI

/// 聊天输入框
struct ChatInputView: View {
    @Environment(DesktopService.self) private var service
    let sessionId: String
    @Binding var text: String
    @FocusState.Binding var isFocused: Bool
    let isGenerating: Bool

    @State private var inputHeight: CGFloat = 36

    var body: some View {
        HStack(alignment: .bottom, spacing: 10) {
            // 文本输入
            TextField("输入消息...", text: $text, axis: .vertical)
                .lineLimit(1...6)
                .textFieldStyle(.plain)
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(Color(.tertiarySystemFill), in: RoundedRectangle(cornerRadius: 20))
                .focused($isFocused)
                .onSubmit {
                    if !isGenerating { sendMessage() }
                }

            // 发送/停止按钮
            if isGenerating {
                Button {
                    service.stopGeneration(sessionId: sessionId)
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
                        .foregroundStyle(text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? Color.gray : Color.accentColor)
                }
                .disabled(text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(Color(.systemBackground))
    }

    private func sendMessage() {
        let content = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !content.isEmpty else { return }

        service.sendMessage(sessionId: sessionId, content: content)
        text = ""
    }
}

// MARK: - Permission Banner

struct PermissionBanner: View {
    @Environment(DesktopService.self) private var service
    let sessionId: String

    private var pendingPermissions: [PermissionRequest] {
        service.pendingPermissions.filter { $0.sessionId == sessionId }
    }

    var body: some View {
        if let request = pendingPermissions.first {
            VStack(spacing: 8) {
                HStack {
                    Image(systemName: "exclamationmark.shield")
                        .foregroundStyle(.orange)
                    Text("权限请求: \(request.toolName)")
                        .font(.subheadline.bold())
                    Spacer()
                }

                if !request.input.isEmpty {
                    Text(request.input)
                        .font(.caption.monospaced())
                        .foregroundStyle(.secondary)
                        .lineLimit(3)
                }

                HStack(spacing: 12) {
                    Button("拒绝") {
                        service.respondToPermission(
                            sessionId: sessionId,
                            requestId: request.id,
                            approved: false
                        )
                    }
                    .buttonStyle(.bordered)
                    .foregroundStyle(.red)

                    Button("允许") {
                        service.respondToPermission(
                            sessionId: sessionId,
                            requestId: request.id,
                            approved: true
                        )
                    }
                    .buttonStyle(.borderedProminent)
                }
            }
            .padding(12)
            .background(Color.orange.opacity(0.1), in: RoundedRectangle(cornerRadius: 12))
            .padding(.horizontal)
            .transition(.move(edge: .bottom).combined(with: .opacity))
        }
    }
}
