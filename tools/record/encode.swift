// Turns a folder of recorded frames (from record.mjs) into a small, silent, loopable H.264 MP4.
// swift encode.swift <frames folder> <out.mp4> [width]
// Or, for a still photo, a slow push-in (Ken Burns): swift encode.swift --still <photo.jpg> <out.mp4> [width] [seconds]
import AVFoundation
import AppKit

let args = CommandLine.arguments
let still = args.count > 1 && args[1] == "--still"
let input = still ? args[2] : args[1]
let output = still ? args[3] : args[2]
let maxWidth = Int((still ? args.dropFirst(4).first : args.dropFirst(3).first) ?? "960") ?? 960
let stillSeconds = Double(still ? (args.dropFirst(5).first ?? "8") : "0") ?? 8

func cgImage(_ path: String) -> CGImage {
    let img = NSImage(contentsOfFile: path)!
    var rect = CGRect(origin: .zero, size: img.size)
    return img.cgImage(forProposedRect: &rect, context: nil, hints: nil)!
}

// frames and their times (seconds)
var frames: [(String, Double)] = []
if still {
    let fps = 30.0
    for i in 0..<Int(stillSeconds * fps) { frames.append((input, Double(i) / fps)) }
} else {
    let times = try! JSONSerialization.jsonObject(with: Data(contentsOf: URL(fileURLWithPath: input + "/times.json"))) as! [Double]
    for (i, t) in times.enumerated() { frames.append((String(format: "%@/%05d.jpg", input, i + 1), (t - times[0]) / 1000)) }
}

let first = cgImage(frames[0].0)
let scale = min(1, Double(maxWidth) / Double(first.width))
let w = Int(Double(first.width) * scale) & ~1, h = Int(Double(first.height) * scale) & ~1

try? FileManager.default.removeItem(atPath: output)
let writer = try! AVAssetWriter(outputURL: URL(fileURLWithPath: output), fileType: .mp4)
let input_ = AVAssetWriterInput(mediaType: .video, outputSettings: [
    AVVideoCodecKey: AVVideoCodecType.h264, AVVideoWidthKey: w, AVVideoHeightKey: h,
    AVVideoCompressionPropertiesKey: [AVVideoAverageBitRateKey: w * h * 3, AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel]
])
input_.expectsMediaDataInRealTime = false
let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input_, sourcePixelBufferAttributes: [
    kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32ARGB, kCVPixelBufferWidthKey as String: w, kCVPixelBufferHeightKey as String: h
])
writer.add(input_)
writer.startWriting()
writer.startSession(atSourceTime: .zero)

// frames captured almost on top of each other (a millisecond apart) make the H.264 encoder fail,
// so any frame less than 1/120 s after the last one kept is skipped; nobody can see the difference
var lastKept = -1.0
for (n, (path, t)) in frames.enumerated() {
    if lastKept >= 0 && t - lastKept < 1.0 / 120 { continue }
    lastKept = t
    while !input_.isReadyForMoreMediaData { usleep(2000) }
    var pb: CVPixelBuffer?
    CVPixelBufferPoolCreatePixelBuffer(nil, adaptor.pixelBufferPool!, &pb)
    CVPixelBufferLockBaseAddress(pb!, [])
    let ctx = CGContext(data: CVPixelBufferGetBaseAddress(pb!), width: w, height: h, bitsPerComponent: 8,
                        bytesPerRow: CVPixelBufferGetBytesPerRow(pb!), space: CGColorSpaceCreateDeviceRGB(),
                        bitmapInfo: CGImageAlphaInfo.noneSkipFirst.rawValue)!
    ctx.interpolationQuality = .high
    let img = still ? first : cgImage(path)
    if still {
        // ease from 100% to 112%, drifting slightly up
        let p = Double(n) / Double(frames.count - 1), e = p * p * (3 - 2 * p)
        let z = 1 + 0.12 * e
        let dw = Double(w) * z, dh = Double(h) * z
        ctx.draw(img, in: CGRect(x: (Double(w) - dw) / 2, y: (Double(h) - dh) / 2 - Double(h) * 0.03 * e, width: dw, height: dh))
    } else {
        ctx.draw(img, in: CGRect(x: 0, y: 0, width: w, height: h))
    }
    CVPixelBufferUnlockBaseAddress(pb!, [])
    adaptor.append(pb!, withPresentationTime: CMTime(seconds: t, preferredTimescale: 600))
}
input_.markAsFinished()
let done = DispatchSemaphore(value: 0)
writer.finishWriting { done.signal() }
done.wait()
let size = (try? FileManager.default.attributesOfItem(atPath: output)[.size] as? Int) ?? 0
print("\(output): \(w)x\(h), \(frames.count) frames, \(String(format: "%.1f", frames.last!.1))s, \(size / 1024) KB")
