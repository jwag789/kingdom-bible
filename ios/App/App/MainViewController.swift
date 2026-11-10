import Capacitor
import UIKit

// The app's one screen: Capacitor's web view, plus the plugins that live in this app rather than
// in an npm package (the native tab bar).
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(NativeTabsPlugin())
    }
}
