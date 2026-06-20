import SwiftUI
import Network

/// 连接视图 — 输入桌面端地址即可连接
struct PairingView: View {
    @Environment(DesktopService.self) private var service
    @State private var serverAddress = ""
    @State private var isConnecting = false
    @State private var errorMessage: String?
    @State private var diagnosticInfo: String?
    @FocusState private var isAddressFocused: Bool

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 32) {
                    headerSection
                    connectFormSection
                    diagnosticSection
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

            Text("输入桌面端局域网地址和端口，即可远程控制对话")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
    }

    // MARK: - Form

    private var connectFormSection: some View {
        VStack(spacing: 16) {
            VStack(alignment: .leading, spacing: 6) {
                Label("桌面端地址和端口", systemImage: "network")
                    .font(.caption)
                    .foregroundStyle(.secondary)

                TextField("例如: 192.168.3.34:3456", text: $serverAddress)
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

    // MARK: - Diagnostic

    private var diagnosticSection: some View {
        Group {
            if let info = diagnosticInfo {
                VStack(alignment: .leading, spacing: 6) {
                    Label("诊断信息", systemImage: "stethoscope")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Text(info)
                        .font(.caption.monospaced())
                        .foregroundStyle(.secondary)
                        .textSelection(.enabled)
                }
                .padding(12)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color(.tertiarySystemFill), in: RoundedRectangle(cornerRadius: 8))
            }
        }
    }

    // MARK: - Help

    private var helpSection: some View {
        VStack(spacing: 12) {
            Text("如何使用？")
                .font(.headline)

            VStack(alignment: .leading, spacing: 8) {
                stepRow(number: 1, text: "确保桌面端 ClaudeHaha 正在运行")
                stepRow(number: 2, text: "确保手机和电脑在同一 Wi-Fi 网络")
                stepRow(number: 3, text: "如果弹出「允许访问本地网络」请点允许")
                stepRow(number: 4, text: "输入桌面端的局域网 IP 和端口，例如 192.168.3.34:3456")
                stepRow(number: 5, text: "点击连接，即可在手机上控制对话")
            }
            .padding(.horizontal, 8)

            if errorMessage != nil {
                Button("修复：检查本地网络权限") {
                    if let url = URL(string: UIApplication.openSettingsURLString) {
                        UIApplication.shared.open(url)
                    }
                }
                .font(.caption)
                .foregroundStyle(.blue)
            }
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
        diagnosticInfo = nil

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
                // 先做网络诊断
                await runDiagnostics(serverURL: serverURL)

                try await service.connectToServer(serverURL)
            } catch {
                errorMessage = error.localizedDescription
                isConnecting = false
            }
        }
    }

    // MARK: - Network Diagnostics

    private func runDiagnostics(serverURL: URL) async {
        var results: [String] = []

        // 1. 解析 URL
        guard let host = serverURL.host else {
            diagnosticInfo = "无法解析主机名"
            return
        }
        let port = serverURL.port ?? 3456
        results.append("目标: \(host):\(port)")

        // 2. DNS 解析
        let hostRef = CFHostCreateWithName(nil, host as CFString).takeRetainedValue()
        CFHostStartInfoResolution(hostRef, .addresses, nil)
        var resolved = false
        if let addresses = CFHostGetAddressing(hostRef, nil)?.takeUnretainedValue() as? [Data] {
            for addrData in addresses {
                let addr = addrData.withUnsafeBytes { ptr -> sockaddr_in in
                    ptr.baseAddress!.assumingMemoryBound(to: sockaddr_in.self).pointee
                }
                if addr.sin_family == sa_family_t(AF_INET) {
                    let ip = String(cString: inet_ntoa(addr.sin_addr))
                    results.append("DNS: \(host) → \(ip)")
                    resolved = true
                    break
                }
            }
        }
        if !resolved {
            results.append("DNS: ❌ 无法解析 \(host)")
        }

        // 3. TCP 连通性测试
        let tcpResult = await withCheckedContinuation { (cont: CheckedContinuation<String, Never>) in
            let conn = NWConnection(
                host: NWEndpoint.Host(host),
                port: NWEndpoint.Port(rawValue: UInt16(port))!,
                using: .tcp
            )
            conn.stateUpdateHandler = { state in
                switch state {
                case .ready:
                    cont.resume(returning: "TCP: ✅ \(host):\(port) 可达")
                    conn.cancel()
                case .failed(let error):
                    cont.resume(returning: "TCP: ❌ \(host):\(port) 不可达 - \(error.localizedDescription)")
                    conn.cancel()
                case .waiting(let error):
                    cont.resume(returning: "TCP: ⏳ 等待中 - \(error.localizedDescription)")
                    conn.cancel()
                default:
                    break
                }
            }
            conn.start(queue: .global())
            // 超时
            Task {
                try? await Task.sleep(nanoseconds: 5_000_000_000)
                cont.resume(returning: "TCP: ⏱ 超时 (5秒)")
                conn.cancel()
            }
        }
        results.append(tcpResult)

        // 4. HTTP 健康检查
        var testURL = serverURL
        if testURL.port == nil {
            var components = URLComponents(url: testURL, resolvingAgainstBaseURL: false)!
            components.port = 3456
            testURL = components.url ?? testURL
        }
        let healthURL = testURL.appendingPathComponent("health")
        do {
            let (_, response) = try await URLSession.shared.data(from: healthURL)
            if let httpResp = response as? HTTPURLResponse {
                results.append("HTTP: ✅ /health 返回 \(httpResp.statusCode)")
            }
        } catch {
            results.append("HTTP: ❌ /health 失败 - \(error.localizedDescription)")
        }

        diagnosticInfo = results.joined(separator: "\n")
    }
}
