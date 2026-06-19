import SwiftUI

/// 连接视图 — 输入桌面端地址即可连接
struct PairingView: View {
    @Environment(DesktopService.self) private var service
    @State private var serverAddress = ""
    @State private var isConnecting = false
    @State private var errorMessage: String?
    @FocusState private var isAddressFocused: Bool

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 32) {
                    headerSection
                    connectFormSection
                    helpSection
                }
                .padding(.horizontal, 24)
                .padding(.vertical, 40)
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("连接桌面端")
        }
    }

    // MARK: - Header

    private var headerSection: some View {
        VStack(spacing: 16) {
            Image(systemName: "desktopcomputer")
                .font(.system(size: 64))
                .foregroundStyle(Color.accentColor)
                .symbolEffect(.pulse)

            Text("ClaudeHaha")
                .font(.largeTitle)
                .fontWeight(.bold)

            Text("输入桌面端地址，即可远程控制对话")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
    }

    // MARK: - Form

    private var connectFormSection: some View {
        VStack(spacing: 16) {
            VStack(alignment: .leading, spacing: 6) {
                Label("桌面端地址", systemImage: "network")
                    .font(.caption)
                    .foregroundStyle(.secondary)

                TextField("例如: 192.168.3.34", text: $serverAddress)
                    .textFieldStyle(.roundedBorder)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .keyboardType(.URL)
                    .font(.body.monospaced())
                    .focused($isAddressFocused)
            }

            // 错误信息
            if let error = errorMessage {
                HStack {
                    Image(systemName: "exclamationmark.triangle.fill")
                    Text(error)
                        .font(.caption)
                }
                .foregroundStyle(.red)
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(.red.opacity(0.1), in: RoundedRectangle(cornerRadius: 8))
            }

            // 连接按钮
            Button(action: performConnect) {
                HStack {
                    if isConnecting {
                        ProgressView()
                            .tint(.white)
                    }
                    Text(isConnecting ? "连接中..." : "连接")
                        .fontWeight(.semibold)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
            }
            .buttonStyle(.borderedProminent)
            .disabled(serverAddress.trimmingCharacters(in: .whitespaces).isEmpty || isConnecting)
        }
        .padding(20)
        .background(Color(.systemBackground), in: RoundedRectangle(cornerRadius: 16))
        .shadow(color: .black.opacity(0.05), radius: 8, y: 4)
    }

    // MARK: - Help

    private var helpSection: some View {
        VStack(spacing: 12) {
            Text("如何使用？")
                .font(.headline)

            VStack(alignment: .leading, spacing: 8) {
                stepRow(number: 1, text: "确保桌面端 ClaudeHaha 正在运行")
                stepRow(number: 2, text: "输入桌面端的局域网 IP 地址")
                stepRow(number: 3, text: "点击连接，即可在手机上控制对话")
            }
            .padding(.horizontal, 8)
        }
        .padding(20)
        .background(Color(.systemBackground), in: RoundedRectangle(cornerRadius: 16))
        .shadow(color: .black.opacity(0.05), radius: 8, y: 4)
    }

    private func stepRow(number: Int, text: String) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Text("\(number)")
                .font(.caption.bold())
                .foregroundStyle(.white)
                .frame(width: 24, height: 24)
                .background(Circle().fill(Color.accentColor))
            Text(text)
                .font(.subheadline)
        }
    }

    // MARK: - Actions

    private func performConnect() {
        isConnecting = true
        errorMessage = nil

        var address = serverAddress.trimmingCharacters(in: .whitespaces)
        if !address.contains("://") {
            address = "http://\(address)"
        }
        guard let serverURL = URL(string: address) else {
            errorMessage = "无效的地址"
            isConnecting = false
            return
        }

        Task {
            do {
                try await service.connectToServer(serverURL)
            } catch {
                errorMessage = error.localizedDescription
                isConnecting = false
            }
        }
    }
}
