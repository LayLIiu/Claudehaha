import SwiftUI

/// 侧边栏 — 会话列表
struct SidebarView: View {
    @Environment(DesktopService.self) private var service
    @Binding var selectedSessionId: String?
    var onOpenSettings: () -> Void
    var onNewChat: () -> Void

    @State private var searchText = ""
    @State private var showDeleteAlert = false
    @State private var sessionToDelete: Session?

    var body: some View {
        List(selection: $selectedSessionId) {
            // 运行中的会话
            let runningSessions = filteredSessions.filter { $0.state.isRunning }
            let idleSessions = filteredSessions.filter { !$0.state.isRunning }

            if !runningSessions.isEmpty {
                Section("运行中") {
                    ForEach(runningSessions) { session in
                        sessionRow(session)
                    }
                }
            }

            Section(idleSessions.isEmpty ? "" : "对话") {
                ForEach(idleSessions) { session in
                    sessionRow(session)
                }
            }
        }
        .listStyle(.sidebar)
        .searchable(text: $searchText, prompt: "搜索对话")
        .navigationTitle("ClaudeHaha")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button(action: onNewChat) {
                    Image(systemName: "plus.circle.fill")
                }
            }
            ToolbarItem(placement: .bottomBar) {
                Button(action: onOpenSettings) {
                    Label("设置", systemImage: "gearshape")
                }
            }
        }
        .refreshable {
            await service.refreshSessions()
        }
        .alert("删除对话", isPresented: $showDeleteAlert) {
            Button("取消", role: .cancel) {}
            Button("删除", role: .destructive) {
                if let session = sessionToDelete {
                    Task { try? await service.deleteSession(session.id) }
                }
            }
        } message: {
            Text("确定要删除这个对话吗？此操作无法撤销。")
        }
    }

    // MARK: - Session Row

    private func sessionRow(_ session: Session) -> some View {
        Button {
            selectedSessionId = session.id
            service.connectToSession(session.id)
        } label: {
            HStack(spacing: 12) {
                // 状态指示器
                Circle()
                    .fill(session.state.isRunning ? Color.green : Color.gray.opacity(0.3))
                    .frame(width: 8, height: 8)

                VStack(alignment: .leading, spacing: 3) {
                    Text(session.displayTitle)
                        .font(.body)
                        .lineLimit(1)

                    HStack(spacing: 6) {
                        if let project = session.projectDisplayName {
                            Text(project)
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(Color(.tertiarySystemFill), in: Capsule())
                        }

                        if session.state.isRunning {
                            Text(session.state.displayName)
                                .font(.caption2)
                                .foregroundStyle(.green)
                        }
                    }
                }

                Spacer()
            }
            .padding(.vertical, 2)
        }
        .contextMenu {
            Button(role: .destructive) {
                sessionToDelete = session
                showDeleteAlert = true
            } label: {
                Label("删除", systemImage: "trash")
            }
        }
    }

    // MARK: - Filtered Sessions

    private var filteredSessions: [Session] {
        if searchText.isEmpty {
            return service.sessions
        }
        return service.sessions.filter { session in
            session.displayTitle.localizedCaseInsensitiveContains(searchText) ||
            (session.projectDisplayName?.localizedCaseInsensitiveContains(searchText) ?? false)
        }
    }
}
