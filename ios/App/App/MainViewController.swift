import Capacitor
import UIKit

// The app's one screen: Capacitor's web view, plus the plugins that live in this app rather than
// in an npm package (the native tab bar, keeping the screen awake).
class MainViewController: CAPBridgeViewController {
    private var observers: [NSObjectProtocol] = []

    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(NativeTabsPlugin())
        bridge?.registerPluginInstance(KeepAwakePlugin())

        // Capacitor tells the page "pause"/"resume" when the app goes to the background and back.
        // Half open (the app switcher, Control Center, a call coming in) it says nothing, and the
        // story would keep talking; away.js hears these and goes quiet.
        let center = NotificationCenter.default
        observers.append(center.addObserver(forName: UIScene.willDeactivateNotification, object: nil, queue: .main) { [weak self] _ in
            self?.bridge?.triggerDocumentJSEvent(eventName: "kb-inactive")
        })
        observers.append(center.addObserver(forName: UIScene.didActivateNotification, object: nil, queue: .main) { [weak self] _ in
            self?.bridge?.triggerDocumentJSEvent(eventName: "kb-active")
        })
    }

    deinit {
        observers.forEach(NotificationCenter.default.removeObserver)
    }
}
