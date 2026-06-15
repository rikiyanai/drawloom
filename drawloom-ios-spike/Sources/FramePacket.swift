import Foundation
import ARKit
import AVFoundation
import CoreGraphics
import CoreVideo
import simd

// Shape mirrors the MediaPipe packet from drawloom/src/lib/pose/face.ts as closely
// as ARKit allows so the two streams can be diff'd offline.
//
//   - faceTransform     : ARFaceAnchor.transform (model -> world, column-major 4x4)
//   - cameraTransform   : ARFrame.camera.transform (camera -> world)
//   - modelToCamera     : inverse(cameraTransform) * faceTransform — the analogue
//                         of MediaPipe's pose.matrix
//   - intrinsics        : ARFrame.camera.intrinsics (3x3 column-major)
//   - vertices          : 1220 ARFaceGeometry vertices in face-model space
//   - triangleIndices   : flat list of triangle vertex indices (the mesh topology)
//   - blendShapes       : ARFaceAnchor.blendShapes raw values, key = ARFaceAnchor
//                         blend-shape rawValue (e.g. "mouthSmileLeft")

struct FramePacket: Codable {
    struct Vec3: Codable { let x: Float; let y: Float; let z: Float }
    struct Mat: Codable { let m: [Float] }
    struct DepthStats: Codable {
        let w: Int
        let h: Int
        let x0: Int?
        let y0: Int?
        let x1: Int?
        let y1: Int?
        let minMeters: Float
        let maxMeters: Float
        let meanMeters: Float
        let sampleCount: Int
    }
    struct DepthSummary: Codable {
        let fullFrame: DepthStats
        let faceROI: DepthStats?
    }

    let schema: String
    let source: String
    let topology: String
    let timestampMs: Double
    let imageW: Int
    let imageH: Int
    let intrinsics: Mat
    let cameraTransform: Mat
    let faceTransform: Mat
    let modelToCamera: Mat
    let vertices: [Vec3]
    let triangleIndices: [UInt16]
    let blendShapes: [String: Float]
    let depth: DepthSummary?

    static func make(face: ARFaceAnchor, frame: ARFrame) -> FramePacket {
        let cam = frame.camera
        let modelToCamera = simd_mul(simd_inverse(cam.transform), face.transform)
        let resolution = cam.imageResolution
        let geom = face.geometry
        let blends = face.blendShapes.reduce(into: [String: Float]()) { acc, kv in
            acc[kv.key.rawValue] = kv.value.floatValue
        }
        return FramePacket(
            schema: "drawloom.spike.frame.v1",
            source: "arkit",
            topology: "arkit-face-geometry-1220",
            timestampMs: frame.timestamp * 1000,
            imageW: Int(resolution.width),
            imageH: Int(resolution.height),
            intrinsics: Mat(m: flatten3x3(cam.intrinsics)),
            cameraTransform: Mat(m: flatten4x4(cam.transform)),
            faceTransform: Mat(m: flatten4x4(face.transform)),
            modelToCamera: Mat(m: flatten4x4(modelToCamera)),
            vertices: geom.vertices.map { Vec3(x: $0.x, y: $0.y, z: $0.z) },
            triangleIndices: geom.triangleIndices,
            blendShapes: blends,
            depth: frame.capturedDepthData.flatMap { summarizeDepth($0, face: face, modelToCamera: modelToCamera, imageResolution: resolution, intrinsics: cam.intrinsics) }
        )
    }

    static func write(_ packet: FramePacket) throws -> URL {
        let enc = JSONEncoder()
        enc.outputFormatting = [.prettyPrinted, .sortedKeys]
        let data = try enc.encode(packet)
        let dir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        let ts = Int(Date().timeIntervalSince1970 * 1000)
        let url = dir.appendingPathComponent("packet-\(ts).json")
        try data.write(to: url, options: .atomic)
        return url
    }
}

private func flatten4x4(_ m: simd_float4x4) -> [Float] {
    [
        m.columns.0.x, m.columns.0.y, m.columns.0.z, m.columns.0.w,
        m.columns.1.x, m.columns.1.y, m.columns.1.z, m.columns.1.w,
        m.columns.2.x, m.columns.2.y, m.columns.2.z, m.columns.2.w,
        m.columns.3.x, m.columns.3.y, m.columns.3.z, m.columns.3.w,
    ]
}

// Walks the TrueDepth depth map and returns compact stats. The full-frame
// summary proves depth is arriving; the projected face ROI is the alignment
// check used by the ARKit-vs-MediaPipe spike.
private func summarizeDepth(
    _ depthData: AVDepthData,
    face: ARFaceAnchor,
    modelToCamera: simd_float4x4,
    imageResolution: CGSize,
    intrinsics: simd_float3x3
) -> FramePacket.DepthSummary? {
    let normalized = depthData.converting(toDepthDataType: kCVPixelFormatType_DepthFloat32)
    let pixelBuffer = normalized.depthDataMap
    CVPixelBufferLockBaseAddress(pixelBuffer, .readOnly)
    defer { CVPixelBufferUnlockBaseAddress(pixelBuffer, .readOnly) }
    let w = CVPixelBufferGetWidth(pixelBuffer)
    let h = CVPixelBufferGetHeight(pixelBuffer)
    guard let base = CVPixelBufferGetBaseAddress(pixelBuffer) else { return nil }
    let rowStride = CVPixelBufferGetBytesPerRow(pixelBuffer) / MemoryLayout<Float>.size
    let buf = base.assumingMemoryBound(to: Float.self)

    guard let full = summarizeDepthRect(buf: buf, rowStride: rowStride, w: w, h: h, rect: nil, step: 4) else {
        return nil
    }
    let roi = projectedFaceRect(
        face: face,
        modelToCamera: modelToCamera,
        imageResolution: imageResolution,
        depthW: w,
        depthH: h,
        intrinsics: intrinsics
    ).flatMap { summarizeDepthRect(buf: buf, rowStride: rowStride, w: w, h: h, rect: $0, step: 2) }
    return FramePacket.DepthSummary(fullFrame: full, faceROI: roi)
}

private func summarizeDepthRect(
    buf: UnsafePointer<Float>,
    rowStride: Int,
    w: Int,
    h: Int,
    rect: (x0: Int, y0: Int, x1: Int, y1: Int)?,
    step: Int
) -> FramePacket.DepthStats? {
    let x0 = max(0, rect?.x0 ?? 0)
    let y0 = max(0, rect?.y0 ?? 0)
    let x1 = min(w, rect?.x1 ?? w)
    let y1 = min(h, rect?.y1 ?? h)
    guard x1 > x0, y1 > y0 else { return nil }

    var minV = Float.greatestFiniteMagnitude
    var maxV: Float = 0
    var sum: Double = 0
    var count = 0
    for y in Swift.stride(from: y0, to: y1, by: step) {
        let row = y * rowStride
        for x in Swift.stride(from: x0, to: x1, by: step) {
            let v = buf[row + x]
            if v.isFinite && v > 0 {
                if v < minV { minV = v }
                if v > maxV { maxV = v }
                sum += Double(v)
                count += 1
            }
        }
    }
    guard count > 0 else { return nil }
    return FramePacket.DepthStats(
        w: w,
        h: h,
        x0: rect == nil ? nil : x0,
        y0: rect == nil ? nil : y0,
        x1: rect == nil ? nil : x1,
        y1: rect == nil ? nil : y1,
        minMeters: minV,
        maxMeters: maxV,
        meanMeters: Float(sum / Double(count)),
        sampleCount: count
    )
}

private func projectedFaceRect(
    face: ARFaceAnchor,
    modelToCamera: simd_float4x4,
    imageResolution: CGSize,
    depthW: Int,
    depthH: Int,
    intrinsics: simd_float3x3
) -> (x0: Int, y0: Int, x1: Int, y1: Int)? {
    let scaleX = Float(depthW) / Float(imageResolution.width)
    let scaleY = Float(depthH) / Float(imageResolution.height)
    let fx = intrinsics.columns.0.x * scaleX
    let fy = intrinsics.columns.1.y * scaleY
    let cx = intrinsics.columns.2.x * scaleX
    let cy = intrinsics.columns.2.y * scaleY

    var minX = Float.greatestFiniteMagnitude
    var minY = Float.greatestFiniteMagnitude
    var maxX = -Float.greatestFiniteMagnitude
    var maxY = -Float.greatestFiniteMagnitude

    for v in face.geometry.vertices {
        let p = simd_mul(modelToCamera, SIMD4<Float>(v.x, v.y, v.z, 1))
        let z = p.z < 0 ? -p.z : p.z
        guard z > 0.001 else { continue }
        let x = fx * (p.x / z) + cx
        let y = fy * (p.y / z) + cy
        if x.isFinite && y.isFinite {
            if x < minX { minX = x }
            if y < minY { minY = y }
            if x > maxX { maxX = x }
            if y > maxY { maxY = y }
        }
    }

    guard minX.isFinite, minY.isFinite, maxX.isFinite, maxY.isFinite else { return nil }
    let padX = (maxX - minX) * 0.12
    let padY = (maxY - minY) * 0.12
    return (
        x0: Int(floor(minX - padX)),
        y0: Int(floor(minY - padY)),
        x1: Int(ceil(maxX + padX)),
        y1: Int(ceil(maxY + padY))
    )
}

private func flatten3x3(_ m: simd_float3x3) -> [Float] {
    [
        m.columns.0.x, m.columns.0.y, m.columns.0.z,
        m.columns.1.x, m.columns.1.y, m.columns.1.z,
        m.columns.2.x, m.columns.2.y, m.columns.2.z,
    ]
}
