import SwiftUI

@main
struct ClaudeHahaApp: App {
    @State private var desktop = DesktopService.shared
    @State private var codex = CodexService()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(desktop)
                .environment(codex)
        }
    }
}
