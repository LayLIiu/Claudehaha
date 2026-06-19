import SwiftUI

@main
struct ClaudeHahaApp: App {
    @State private var service = DesktopService.shared

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(service)
        }
    }
}
