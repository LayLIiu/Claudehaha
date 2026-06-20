import SwiftUI

/// 根视图 — 使用 Remodex 前端 + 我们的 DesktopService 接口
struct ContentView: View {
    @Environment(CodexService.self) private var codex
    @Environment(DesktopService.self) private var desktop
    @State private var hasAttemptedAutoConnect = false

    var body: some View {
        Group {
            switch desktop.connectionState {
            case .disconnected:
                if desktop.hasSavedCredentials {
                    ConnectingView()
                } else {
                    PairingView()
                }
            case .connecting:
                ConnectingView()
            case .failed:
                ConnectingView()
            case .connected:
                RemodexMainView()
            }
        }
        .animation(.easeInOut(duration: 0.3), value: desktop.connectionState)
        .task {
            guard !hasAttemptedAutoConnect else { return }
            hasAttemptedAutoConnect = true
            if desktop.hasSavedCredentials {
                Task {
                    try? await desktop.connectWithSavedCredentials()
                    codex.syncFromDesktop()
                }
            }
        }
    }
}

// MARK: - Remodex 主视图

/// 使用 Remodex 的 SidebarView + TurnView 导航结构
struct RemodexMainView: View {
    @Environment(CodexService.self) private var codex
    @State private var selectedThreadId: String?
    @State private var columnVisibility: NavigationSplitViewVisibility = .all

    var body: some View {
        NavigationSplitView(columnVisibility: $columnVisibility) {
            // 侧边栏 — 使用 Remodex 的 SidebarView
            RemodexSidebarView(selectedThreadId: $selectedThreadId)
        } detail: {
            // 聊天详情 — 使用 Remodex 的 TurnView
            if let threadId = selectedThreadId,
               let thread = codex.thread(for: threadId) {
                TurnView(thread: thread, isWakingMacDisplayRecovery: false)
            } else {
                ContentUnavailableView(
                    "选择一个对话",
                    systemImage: "bubble.left.and.bubble.right",
                    description: Text("从侧边栏选择或创建新对话")
                )
            }
        }
    }
}

// MARK: - Remodex 侧边栏包装

/// 包装 Remodex 的 SidebarView，适配我们的导航结构
struct RemodexSidebarView: View {
    @Environment(CodexService.self) private var codex
    @Environment(DesktopService.self) private var desktop
    @Binding var selectedThreadId: String?
    @State private var searchText = ""

    var body: some View {
        List(selection: $selectedThreadId) {
            // 按项目分组显示
            ForEach(groupedThreads, id: \.projectKey) { group in
                Section {
                    ForEach(group.threads) { thread in
                        ThreadRowView(thread: thread, isSelected: selectedThreadId == thread.id)
                            .contentShape(Rectangle())
                            .onTapGesture {
                                selectThread(thread)
                            }
                    }
                } header: {
                    if !group.projectKey.isEmpty {
                        Text(group.projectKey)
                    }
                }
            }
        }
        .listStyle(.sidebar)
        .navigationTitle("ClaudeHaha")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    Task { await createNewThread() }
                } label: {
                    Image(systemName: "plus.circle.fill")
                }
            }
            ToolbarItem(placement: .bottomBar) {
                Button {
                    desktop.disconnect()
                    desktop.clearCredentials()
                } label: {
                    Label("断开连接", systemImage: "wifi.slash")
                }
            }
        }
        .searchable(text: $searchText, prompt: "搜索对话")
        .refreshable {
            await codex.listThreads()
        }
    }

    // MARK: - Computed

    private var filteredThreads: [CodexThread] {
        let threads = codex.threads
        if searchText.isEmpty { return threads }
        return threads.filter {
            $0.displayTitle.localizedCaseInsensitiveContains(searchText)
        }
    }

    private var groupedThreads: [ThreadGroup] {
        let dict = Dictionary(grouping: filteredThreads) { thread -> String in
            thread.projectDisplayName ?? "其他"
        }
        return dict.map { key, threads in
            ThreadGroup(projectKey: key, threads: threads.sorted { ($0.updatedAt ?? .distantPast) > ($1.updatedAt ?? .distantPast) })
        }.sorted { $0.projectKey < $1.projectKey }
    }

    // MARK: - Actions

    private func selectThread(_ thread: CodexThread) {
        selectedThreadId = thread.id
        Task {
            await codex.prepareThreadForDisplay(threadId: thread.id)
        }
    }

    private func createNewThread() async {
        if let thread = await codex.startThread() {
            selectedThreadId = thread.id
        }
    }
}

// MARK: - Thread Group

private struct ThreadGroup {
    let projectKey: String
    let threads: [CodexThread]
}

// MARK: - Thread Row

struct ThreadRowView: View {
    let thread: CodexThread
    let isSelected: Bool
    @Environment(CodexService.self) private var codex

    var body: some View {
        HStack(spacing: 10) {
            // 运行状态指示器
            Circle()
                .fill(codex.runningThreadIDs.contains(thread.id) ? Color.green : Color.gray.opacity(0.3))
                .frame(width: 8, height: 8)

            VStack(alignment: .leading, spacing: 3) {
                Text(thread.displayTitle)
                    .font(.body)
                    .lineLimit(1)
                    .foregroundStyle(isSelected ? .primary : .primary)

                if !thread.projectDisplayName.isEmpty {
                    let project = thread.projectDisplayName
                    Text(project)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }

            Spacer()

            if codex.runningThreadIDs.contains(thread.id) {
                ProgressView()
                    .scaleEffect(0.7)
            }
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Connecting View

private struct ConnectingView: View {
    @Environment(DesktopService.self) private var desktop

    var body: some View {
        VStack(spacing: 20) {
            if case .failed = desktop.connectionState {
                Image(systemName: "wifi.exclamationmark")
                    .font(.system(size: 48))
                    .foregroundStyle(.red)

                Text("连接失败")
                    .font(.headline)

                if case .failed(let msg) = desktop.connectionState {
                    Text(msg)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                }

                VStack(spacing: 10) {
                    Button("重试连接") {
                        Task {
                            try? await desktop.connectWithSavedCredentials()
                        }
                    }
                    .buttonStyle(.borderedProminent)

                    Button("重新输入地址") {
                        desktop.clearCredentials()
                    }
                    .buttonStyle(.bordered)
                }
            } else {
                ProgressView()
                    .scaleEffect(1.5)
                    .tint(.accentColor)

                Text("正在连接桌面端...")
                    .font(.headline)

                Text("请确认手机和桌面端在同一局域网")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
        .padding()
    }
}
