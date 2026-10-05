// Cuts a project video down to its best moment, so the tile opens on the good part instead of a fade-in.
// swift trim.swift <in.mp4> <out.mp4> <start seconds> [end seconds]
import AVFoundation

let a = CommandLine.arguments
let asset = AVURLAsset(url: URL(fileURLWithPath: a[1]))
let total = CMTimeGetSeconds(asset.duration)
let start = Double(a[3])!, end = a.count > 4 ? Double(a[4])! : total
let out = URL(fileURLWithPath: a[2])
try? FileManager.default.removeItem(at: out)
let export = AVAssetExportSession(asset: asset, presetName: AVAssetExportPresetPassthrough)!
export.outputURL = out
export.outputFileType = .mp4
export.timeRange = CMTimeRange(start: CMTime(seconds: start, preferredTimescale: 600), end: CMTime(seconds: end, preferredTimescale: 600))
let done = DispatchSemaphore(value: 0)
export.exportAsynchronously { done.signal() }
done.wait()
if export.status != .completed { print("failed: \(export.error?.localizedDescription ?? "?")"); exit(1) }
print(String(format: "%@: %.1fs → %.1fs", out.lastPathComponent, total, end - start))
