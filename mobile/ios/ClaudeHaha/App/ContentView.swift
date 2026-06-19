import SwiftUI

/// 根视图 — 管理应用导航和连接状态
struct ContentView: View {
    @Environment(DesktopService.self) private var service
    @State private var navigationPath = NavigationPath()
    @State private var selectedSessionId: String?
    @State private var showSettings = false
    @State private var hasAttemptedAutoConnect = false

    var body: some View {
        Group {
            switch service.connectionState {
            case .disconnected:
                // 没有保存的凭证 → 显示配对页
                if service.hasSavedCredentials {
                    ConnectingView()
                } else {
                    PairingView()
                }
            case .connecting, .pairing:
                ConnectingView()
            case .failed:
                // 连接失败，提供重试或重新输入地址
                ConnectingView()
            case .connected:
                mainAppView
            }
        }
        .animation(.easeInOut(duration: 0.3), value: service.connectionState)
        .task {
            // App 启动时自动用已保存的凭证连接
            guard !hasAttemptedAutoConnect else { return }
            hasAttemptedAutoConnect = true
            if service.hasSavedCredentials {
                Task {
                    try? await service.connectWithSavedCredentials()
                }
            }
        }
    }

    // MARK: - Main App

    @ViewBuilder
    private var mainAppView: some View {
        iphoneLayout
    }

    private var iphoneLayout: some View {
        NavigationStack(path: $navigationPath) {
            SidebarView(
                selectedSessionId: $selectedSessionId,
                onOpenSettings: { showSettings = true },
                onNewChat: { Task { await createNewSession() } }
            )
            .navigationDestination(for: SessionRoute.self) { route in
                switch route {
                case .chat(let sessionId):
                    ChatView(sessionId: sessionId)
                }
            }
        }
        .sheet(isPresented: $showSettings) {
            SettingsView()
        }
    }

    private var ipadLayout: some View {
        NavigationSplitView {
            SidebarView(
                selectedSessionId: $selectedSessionId,
                onOpenSettings: { showSettings = true },
                onNewChat: { Task { await createNewSession() } }
            )
        } detail: {
            if let sessionId = selectedSessionId {
                ChatView(sessionId: sessionId)
            } else {
                EmptySessionView()
            }
        }
        .sheet(isPresented: $showSettings) {
            SettingsView()
        }
    }

    // MARK: - Helpers

    private func createNewSession() async {
        do {
            let session = try await service.createSession()
            selectedSessionId = session.id
            service.connectToSession(session.id)
            navigationPath.append(SessionRoute.chat(sessionId: session.id))
        } catch {
            service.lastError = error.localizedDescription
        }
    }
}

// MARK: - Navigation Route

enum SessionRoute: Hashable {
    case chat(sessionId: String)
}

// MARK: - Connecting View

private struct ConnectingView: View {
    @Environment(DesktopService.self) private var service

    var body: some View {
        VStack(spacing: 20) {
            if case .failed = service.connectionState {
                Image(systemName: "wifi.exclamationmark")
                    .font(.system(size: 48))
                    .foregroundStyle(.red)

                Text("连接失败")
                    .font(.headline)

                if case .failed(let msg) = service.connectionState {
                    Text(msg)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                }

                VStack(spacing: 10) {
                    Button("重试连接") {
                        Task {
                            try? await service.connectWithSavedCredentials()
                        }
                    }
                    .buttonStyle(.borderedProminent)

                    Button("重新输入地址") {
                        service.clearCredentials()
                    }
                    .buttonStyle(.bordered)
                }
            } else {
                ProgressView()
                    .scaleEffect(1.5)
                    .tint(.accentColor)

                Text("正在连接桌面端...")
                    .font(.headline)

                if case .pairing = service.connectionState {
                    Text("正在探测端口并配对...")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .padding()
    }
}

// MARK: - Empty Session View

private struct EmptySessionView: View {
    var body: some View {
        ContentUnavailableView(
            "选择一个对话",
            systemImage: "bubble.left.and.bubble.right",
            description: Text("从侧边栏选择或创建新对话")
        )
    }
}
