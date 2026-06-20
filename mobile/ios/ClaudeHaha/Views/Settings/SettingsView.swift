import SwiftUI

/// 设置视图
struct SettingsView: View {
    @Environment(DesktopService.self) private var service
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                // 连接信息
                Section("连接") {
                    HStack {
                        Label("状态", systemImage: "circle.fill")
                            .foregroundStyle(service.connectionState == .connected ? .green : .red)
                        Spacer()
                        Text(connectionStatusText)
                            .foregroundStyle(.secondary)
                    }

                    Button("断开连接", role: .destructive) {
                        service.disconnect()
                        service.clearCredentials()
                        dismiss()
                    }
                }

                // 关于
                Section("关于") {
                    HStack {
                        Text("版本")
                        Spacer()
                        Text("1.0.0")
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .navigationTitle("设置")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("完成") { dismiss() }
                }
            }
        }
    }

    private var connectionStatusText: String {
        switch service.connectionState {
        case .connected: return "已连接"
        case .connecting: return "连接中"
        case .disconnected: return "未连接"
        case .failed(let msg): return "错误: \(msg)"
        }
    }
}
