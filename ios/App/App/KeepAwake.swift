// Keeps the screen on while a story is being read aloud, a game is open or a grown-up is
// recording, so the phone doesn't lock itself in the middle of a sentence. The page asks
// (native.js keepAwake); every new page starts with the screen free to lock again.

import Capacitor
import UIKit
import WebKit

@objc(KeepAwakePlugin)
public class KeepAwakePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "KeepAwakePlugin"
    public let jsName = "KeepAwake"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "set", returnType: CAPPluginReturnPromise),
    ]

    @objc func set(_ call: CAPPluginCall) {
        let on = call.getBool("on") ?? false
        DispatchQueue.main.async {
            UIApplication.shared.isIdleTimerDisabled = on
            call.resolve()
        }
    }

    override public func shouldOverrideLoad(_ navigationAction: WKNavigationAction) -> NSNumber? {
        if navigationAction.targetFrame?.isMainFrame ?? true {
            DispatchQueue.main.async { UIApplication.shared.isIdleTimerDisabled = false }
        }
        return nil
    }
}
