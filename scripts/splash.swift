// Draws Kingdom Bible's launch image: cream paper, the icon art as a paper tile, the wordmark.
// swift splash.swift <icon.png> <fonts dir> <out.png>
import Foundation
import CoreGraphics
import CoreText
import ImageIO
import UniformTypeIdentifiers

let args = CommandLine.arguments
let iconURL = URL(fileURLWithPath: args[1]), fonts = URL(fileURLWithPath: args[2]), outURL = URL(fileURLWithPath: args[3])
let N = 2732
let cs = CGColorSpace(name: CGColorSpace.sRGB)!
let ctx = CGContext(data: nil, width: N, height: N, bitsPerComponent: 8, bytesPerRow: 0, space: cs,
                    bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
func rgb(_ hex: UInt32, _ a: CGFloat = 1) -> CGColor {
  CGColor(colorSpace: cs, components: [CGFloat((hex >> 16) & 255) / 255, CGFloat((hex >> 8) & 255) / 255, CGFloat(hex & 255) / 255, a])!
}
// CoreGraphics' origin is bottom-left; work top-down.
ctx.translateBy(x: 0, y: CGFloat(N)); ctx.scaleBy(x: 1, y: -1)

// Paper: the menus' radial gradient (#fffaf0 → #f8f0e1 → #f1e4cb), lit from the upper right.
let grad = CGGradient(colorsSpace: cs, colors: [rgb(0xfffaf0), rgb(0xf8f0e1), rgb(0xf1e4cb)] as CFArray, locations: [0, 0.45, 1])!
ctx.drawRadialGradient(grad, startCenter: CGPoint(x: 1640, y: 700), startRadius: 0,
                       endCenter: CGPoint(x: 1640, y: 700), endRadius: 2300, options: [.drawsAfterEndLocation])

func font(_ file: String, _ size: CGFloat) -> CTFont {
  let data = try! Data(contentsOf: fonts.appendingPathComponent(file)) as CFData
  let descs = CTFontManagerCreateFontDescriptorsFromData(data) as! [CTFontDescriptor]
  return CTFontCreateWithFontDescriptor(descs[0], size, nil)
}
func draw(_ text: String, _ f: CTFont, _ color: CGColor, centerY: CGFloat, kern: CGFloat = 0) {
  let attrs: [NSAttributedString.Key: Any] = [.init(kCTFontAttributeName as String): f,
    .init(kCTForegroundColorAttributeName as String): color, .init(kCTKernAttributeName as String): kern]
  let line = CTLineCreateWithAttributedString(NSAttributedString(string: text, attributes: attrs))
  let w = CTLineGetTypographicBounds(line, nil, nil, nil) - Double(kern)
  ctx.saveGState()
  ctx.textMatrix = CGAffineTransform(scaleX: 1, y: -1)        // undo the flip for glyphs
  let capH = CTFontGetCapHeight(f)
  ctx.textPosition = CGPoint(x: (CGFloat(N) - CGFloat(w)) / 2, y: centerY + capH / 2)
  CTLineDraw(line, ctx)
  ctx.restoreGState()
}

// The icon art as a rounded paper tile with a soft warm shadow.
let src = CGImageSourceCreateWithURL(iconURL as CFURL, nil)!
let icon = CGImageSourceCreateImageAtIndex(src, 0, nil)!
let tile: CGFloat = 640, tileY: CGFloat = 860
let rect = CGRect(x: (CGFloat(N) - tile) / 2, y: tileY, width: tile, height: tile)
let path = CGPath(roundedRect: rect, cornerWidth: tile * 0.225, cornerHeight: tile * 0.225, transform: nil)
ctx.saveGState()
ctx.setShadow(offset: CGSize(width: 0, height: 34), blur: 90, color: rgb(0x5a3c19, 0.32))
ctx.addPath(path); ctx.setFillColor(rgb(0xfffdf8)); ctx.fillPath()
ctx.restoreGState()
ctx.saveGState()
ctx.addPath(path); ctx.clip()
ctx.translateBy(x: rect.minX, y: rect.maxY); ctx.scaleBy(x: 1, y: -1)   // images draw bottom-up
ctx.draw(icon, in: CGRect(x: 0, y: 0, width: tile, height: tile))
ctx.restoreGState()
// A thin paper-white rim, like the story cards.
ctx.addPath(path); ctx.setStrokeColor(rgb(0xfffdf8)); ctx.setLineWidth(10); ctx.strokePath()

draw("Kingdom Bible", font("cormorant-garamond-latin-600-normal.woff2", 160), rgb(0x3b2a1a), centerY: tileY + tile + 175)
draw("BIBLE STORIES YOU CAN TOUCH", font("literata-latin-600-normal.woff2", 40), rgb(0xa8652a), centerY: tileY + tile + 300, kern: 11)

let dest = CGImageDestinationCreateWithURL(outURL as CFURL, UTType.png.identifier as CFString, 1, nil)!
CGImageDestinationAddImage(dest, ctx.makeImage()!, nil)
CGImageDestinationFinalize(dest)
print("wrote", outURL.path)
