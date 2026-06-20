// FILE: CodexWorktreeIcon.swift
// Purpose: Shared fork + worktree icons so branching affordances stay visually aligned across the app.
// Layer: View Component
// Exports: CodexForkIcon, CodexWorktreeIcon, CodexWorktreeMenuLabelRow
// Depends on: SwiftUI, AppFont

import SwiftUI
import UIKit

struct CodexForkIcon: View {
    var pointSize: CGFloat = 13

    var body: some View {
        // `remodex.fork` is a virtual key in RemodexIcon mapped to
        // central-fork-code; routing through RemodexIcon keeps Dynamic Type
        // scaling and the square anchor logic in one place.
        RemodexIcon.image(systemName: "remodex.fork", size: pointSize)
    }
}

struct CodexWorktreeIcon: View {
    var pointSize: CGFloat = 13
    var weight: Font.Weight = .regular

    var body: some View {
        // Native SF Symbol: keeps the worktree icon aligned with the system
        // appearance the rest of the OS uses for branch/worktree affordances.
        // Rotated 90° so the trunk reads horizontally (handoff direction).
        RemodexIcon.image(
            systemName: "arrow.triangle.branch",
            size: pointSize,
            weight: weight
        )
        .rotationEffect(.degrees(90))
    }

    static func menuImage(pointSize: CGFloat = 13, weight: UIImage.SymbolWeight = .regular) -> UIImage {
        let configuration = UIImage.SymbolConfiguration(pointSize: pointSize, weight: weight)
        guard let symbol = UIImage(systemName: "arrow.triangle.branch", withConfiguration: configuration)?
            .withRenderingMode(.alwaysTemplate) else {
            return UIImage()
        }
        return symbol.rotated(byDegrees: 90) ?? symbol
    }

    // Matches the UIKit menu glyph metric used by `RemodexIcon.menuUIImage`.
    static func toolbarMenuUIImage() -> UIImage {
        let pointSize = UIFontMetrics.default.scaledValue(for: 20)
        return menuImage(pointSize: pointSize, weight: .regular)
    }
}

struct CodexWorktreeMenuLabelRow: View {
    let title: String
    var pointSize: CGFloat = 13
    var weight: UIImage.SymbolWeight = .regular

    var body: some View {
        HStack(spacing: 10) {
            Image(uiImage: CodexWorktreeIcon.menuImage(pointSize: pointSize, weight: weight))
                .renderingMode(.template)
                .resizable()
                .scaledToFit()
                .frame(width: pointSize, height: pointSize)
            Text(title)
        }
    }
}

private extension UIImage {
    // Bitmap-level rotation so the rotated glyph is baked into the UIImage we
    // hand off to UIKit menus (UIAction.image / Image(uiImage:)). Applying a
    // SwiftUI `.rotationEffect` after the fact wouldn't survive the trip
    // through UIKit menu rendering.
    func rotated(byDegrees degrees: CGFloat) -> UIImage? {
        let radians = degrees * .pi / 180
        let rotatedSize = CGRect(origin: .zero, size: size)
            .applying(CGAffineTransform(rotationAngle: radians))
            .integral
            .size
        let renderer = UIGraphicsImageRenderer(size: rotatedSize)
        let rendered = renderer.image { context in
            let cgContext = context.cgContext
            cgContext.translateBy(x: rotatedSize.width / 2, y: rotatedSize.height / 2)
            cgContext.rotate(by: radians)
            draw(in: CGRect(
                x: -size.width / 2,
                y: -size.height / 2,
                width: size.width,
                height: size.height
            ))
        }
        return rendered.withRenderingMode(renderingMode)
    }
}
