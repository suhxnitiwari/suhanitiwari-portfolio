// Re-encodes a video smaller for the web: H.264 at a target bitrate, at most maxWidth wide, index at the front, no audio.
// usage: swift shrink.swift in.mp4 out.mp4 [kbps=650] [maxWidth=1000]
import AVFoundation
let a = CommandLine.arguments
let input = URL(fileURLWithPath: a[1]), output = URL(fileURLWithPath: a[2])
let kbps = a.count > 3 ? Int(a[3])! : 650, maxW = a.count > 4 ? Double(a[4])! : 1000
let asset = AVURLAsset(url: input)
let track = asset.tracks(withMediaType: .video)[0]
let size = track.naturalSize.applying(track.preferredTransform)
var w = abs(size.width), h = abs(size.height)
if w > maxW { h = (h * maxW / w).rounded(); w = maxW }
let W = Int(w) & ~1, H = Int(h) & ~1
let reader = try! AVAssetReader(asset: asset)
let out = AVAssetReaderTrackOutput(track: track, outputSettings: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA])
reader.add(out)
try? FileManager.default.removeItem(at: output)
let writer = try! AVAssetWriter(outputURL: output, fileType: .mp4)
writer.shouldOptimizeForNetworkUse = true
let fps = max(1, track.nominalFrameRate)
let input2 = AVAssetWriterInput(mediaType: .video, outputSettings: [
    AVVideoCodecKey: AVVideoCodecType.h264, AVVideoWidthKey: W, AVVideoHeightKey: H,
    AVVideoScalingModeKey: AVVideoScalingModeResizeAspectFill,
    AVVideoCompressionPropertiesKey: [AVVideoAverageBitRateKey: kbps * 1000, AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel,
                                      AVVideoMaxKeyFrameIntervalKey: Int(fps * 2), AVVideoAllowFrameReorderingKey: true]])
input2.transform = track.preferredTransform
input2.expectsMediaDataInRealTime = false
writer.add(input2)
reader.startReading(); writer.startWriting(); writer.startSession(atSourceTime: .zero)
let q = DispatchQueue(label: "w"), done = DispatchSemaphore(value: 0)
input2.requestMediaDataWhenReady(on: q) {
    while input2.isReadyForMoreMediaData {
        if let s = out.copyNextSampleBuffer() { input2.append(s) } else { input2.markAsFinished(); writer.finishWriting { done.signal() }; return }
    }
}
done.wait()
let kb = ((try? FileManager.default.attributesOfItem(atPath: output.path)[.size] as? Int) ?? 0) / 1024
print("\(output.lastPathComponent): \(W)x\(H), \(kb) KB")
