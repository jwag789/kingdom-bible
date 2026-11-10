// The bar of tabs along the bottom of the menus (Stories, Games, Kingdom, Stickers), drawn
// natively so it gets the system's Liquid Glass on iOS 26 and later (a blurred material before
// that), SF Symbols and a haptic tick. The web page stays in charge: home.js tells the bar which
// tabs to show, which one is selected and when to hide (stories, games and the Kingdom fill the
// screen), and hears back when one is tapped. The website keeps its own HTML bar.

import Capacitor
import SwiftUI
import UIKit
import WebKit

struct NativeTab: Identifiable, Equatable {
    let id: String
    let title: String
    let symbol: String
}

final class NativeTabsModel: ObservableObject {
    @Published var tabs: [NativeTab] = []
    @Published var selected: String = ""
    var onTap: (String) -> Void = { _ in }
}

private let ink = Color(red: 0x3b / 255, green: 0x2a / 255, blue: 0x1a / 255)
private let gold = Color(red: 0xa8 / 255, green: 0x65 / 255, blue: 0x2a / 255)

struct NativeTabBar: View {
    @ObservedObject var model: NativeTabsModel
    @Namespace private var highlight

    var body: some View {
        let row = HStack(spacing: 2) {
            ForEach(model.tabs) { tab in button(tab) }
        }
        .padding(5)

        if #available(iOS 26.0, *) {
            row.glassEffect(.regular.interactive(), in: .capsule)
        } else {
            row
                .background(.ultraThinMaterial, in: Capsule())
                .overlay(Capsule().strokeBorder(Color.white.opacity(0.6), lineWidth: 0.5))
                .shadow(color: Color(red: 0.35, green: 0.24, blue: 0.1).opacity(0.22), radius: 18, y: 8)
        }
    }

    private func button(_ tab: NativeTab) -> some View {
        let on = tab.id == model.selected
        return Button {
            UISelectionFeedbackGenerator().selectionChanged()
            model.onTap(tab.id)
        } label: {
            VStack(spacing: 2) {
                Image(systemName: tab.symbol)
                    .symbolVariant(on ? .fill : .none)
                    .font(.system(size: 19, weight: .semibold))
                    .frame(height: 24)
                Text(tab.title)
                    .font(.system(size: 11, weight: .semibold))
            }
            .foregroundStyle(on ? gold : ink.opacity(0.62))
            .frame(minWidth: 68)
            .padding(.vertical, 7)
            .padding(.horizontal, 6)
            .background {
                if on {
                    Capsule().fill(gold.opacity(0.16)).matchedGeometryEffect(id: "selected", in: highlight)
                }
            }
            .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(tab.title)
        .accessibilityAddTraits(on ? [.isSelected, .isButton] : .isButton)
    }
}

@objc(NativeTabsPlugin)
public class NativeTabsPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NativeTabsPlugin"
    public let jsName = "NativeTabs"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "configure", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "select", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "show", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "hide", returnType: CAPPluginReturnPromise),
    ]

    private let model = NativeTabsModel()
    private var host: UIHostingController<NativeTabBar>?

    override public func load() {
        model.onTap = { [weak self] id in self?.notifyListeners("tap", data: ["id": id]) }
        DispatchQueue.main.async { self.install() }
    }

    private func install() {
        guard host == nil, let parent = bridge?.viewController, let container = parent.view else { return }
        let host = UIHostingController(rootView: NativeTabBar(model: model))
        if #available(iOS 16.0, *) { host.sizingOptions = .intrinsicContentSize }
        host.view.backgroundColor = .clear
        host.view.translatesAutoresizingMaskIntoConstraints = false
        host.view.alpha = 0
        host.view.isUserInteractionEnabled = false
        parent.addChild(host)
        container.addSubview(host.view)
        host.didMove(toParent: parent)
        // Where the web page's bar sat: above the home indicator, or 12pt up on phones without one.
        let safe = host.view.bottomAnchor.constraint(equalTo: container.safeAreaLayoutGuide.bottomAnchor)
        safe.priority = .defaultHigh
        NSLayoutConstraint.activate([
            host.view.centerXAnchor.constraint(equalTo: container.centerXAnchor),
            host.view.bottomAnchor.constraint(lessThanOrEqualTo: container.safeAreaLayoutGuide.bottomAnchor),
            host.view.bottomAnchor.constraint(lessThanOrEqualTo: container.bottomAnchor, constant: -12),
            safe,
        ])
        self.host = host
    }

    private func setVisible(_ visible: Bool, animated: Bool = true) {
        guard let view = host?.view else { return }
        view.isUserInteractionEnabled = visible
        let apply = {
            view.alpha = visible ? 1 : 0
            view.transform = visible ? .identity : CGAffineTransform(translationX: 0, y: 24)
        }
        if animated {
            UIView.animate(withDuration: visible ? 0.35 : 0.2, delay: 0, usingSpringWithDamping: 0.85,
                           initialSpringVelocity: 0, options: [.beginFromCurrentState, .allowUserInteraction], animations: apply)
        } else {
            apply()
        }
    }

    // { tabs: [{ id, title, symbol }], selected }
    @objc func configure(_ call: CAPPluginCall) {
        let tabs = (call.getArray("tabs") as? [[String: Any]] ?? []).compactMap { t -> NativeTab? in
            guard let id = t["id"] as? String, let title = t["title"] as? String, let symbol = t["symbol"] as? String else { return nil }
            return NativeTab(id: id, title: title, symbol: symbol)
        }
        DispatchQueue.main.async {
            self.install()
            self.model.tabs = tabs
            if let selected = call.getString("selected") { self.model.selected = selected }
            call.resolve()
        }
    }

    @objc func select(_ call: CAPPluginCall) {
        let id = call.getString("id") ?? ""
        DispatchQueue.main.async {
            withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) { self.model.selected = id }
            call.resolve()
        }
    }

    @objc func show(_ call: CAPPluginCall) {
        DispatchQueue.main.async { self.setVisible(true); call.resolve() }
    }

    @objc func hide(_ call: CAPPluginCall) {
        DispatchQueue.main.async { self.setVisible(false); call.resolve() }
    }

    // Opening a story loads a new page: take the bar away at once rather than wait for the page.
    override public func shouldOverrideLoad(_ navigationAction: WKNavigationAction) -> NSNumber? {
        if navigationAction.targetFrame?.isMainFrame ?? true {
            DispatchQueue.main.async { self.setVisible(false, animated: false) }
        }
        return nil
    }
}
