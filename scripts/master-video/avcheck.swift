import AVFoundation
import AppKit
let url = URL(fileURLWithPath: CommandLine.arguments[1])
let asset = AVURLAsset(url: url)
let gen = AVAssetImageGenerator(asset: asset)
gen.requestedTimeToleranceBefore = .zero
gen.requestedTimeToleranceAfter = .zero
let dur = CMTimeGetSeconds(asset.duration)
print("duration", dur, "playable", asset.isPlayable, "tracks", asset.tracks(withMediaType: .video).count)
for f in [0.02, 0.1, 0.25, 0.5, 0.75, 0.95] {
    let t = CMTime(seconds: dur * f, preferredTimescale: 600)
    do {
        let img = try gen.copyCGImage(at: t, actualTime: nil)
        let rep = NSBitmapImageRep(cgImage: img)
        var sum = 0.0; var dark = 0; var n = 0
        for y in stride(from: 0, to: rep.pixelsHigh, by: 40) { for x in stride(from: 0, to: rep.pixelsWide, by: 40) {
            let c = rep.colorAt(x: x, y: y)!.usingColorSpace(.sRGB)!
            let v = (c.redComponent + c.greenComponent + c.blueComponent) / 3
            sum += v; n += 1; if v < 0.6 { dark += 1 } } }
        print(String(format: "%.2f mean %.3f dark %d/%d", f, sum / Double(n), dark, n))
    } catch { print(f, "error", error) }
}
