import SwiftUI
import ARKit
import SceneKit

enum LessonStage: Int, CaseIterable {
    case sphere = 0
    case sphereDoveline = 1
    case loomis = 2
    case debugMesh = 3

    var label: String {
        switch self {
        case .sphere:         return "sphere"
        case .sphereDoveline: return "sphere + guides"
        case .loomis:         return "loomis"
        case .debugMesh:      return "debug"
        }
    }

    var next: LessonStage {
        LessonStage(rawValue: (rawValue + 1) % LessonStage.allCases.count) ?? .sphere
    }
}

final class ARFaceSession: NSObject, ObservableObject, ARSCNViewDelegate, ARSessionDelegate {
    @Published var status: String = "starting"
    @Published var frameCount: Int = 0
    @Published var lastExport: String = ""
    @Published var stage: LessonStage = .sphereDoveline

    weak var sceneView: ARSCNView?
    private var latestPacket: FramePacket?
    private var loomisOverlay: FittedLoomisOverlay?
    private weak var faceGeomNode: SCNNode?

    func start() {
        guard ARFaceTrackingConfiguration.isSupported else {
            DispatchQueue.main.async { self.status = "unsupported (no TrueDepth)" }
            return
        }
        let cfg = ARFaceTrackingConfiguration()
        cfg.maximumNumberOfTrackedFaces = 1
        cfg.isLightEstimationEnabled = false
        sceneView?.session.run(cfg, options: [.resetTracking, .removeExistingAnchors])
        DispatchQueue.main.async { self.status = "tracking" }
    }

    func renderer(_ renderer: SCNSceneRenderer, nodeFor anchor: ARAnchor) -> SCNNode? {
        guard let face = anchor as? ARFaceAnchor, let device = sceneView?.device,
              let geom = ARSCNFaceGeometry(device: device) else { return nil }
        geom.firstMaterial?.fillMode = .lines
        geom.firstMaterial?.diffuse.contents = UIColor.cyan
        geom.firstMaterial?.lightingModel = .constant

        let faceNode = SCNNode(geometry: geom)
        faceNode.isHidden = (stage != .debugMesh)
        faceGeomNode = faceNode

        let loomis = FittedLoomisOverlay(stage: stage)
        loomis.update(face: face)
        loomisOverlay = loomis

        let root = SCNNode()
        root.addChildNode(faceNode)
        root.addChildNode(loomis.root)
        return root
    }

    func renderer(_ renderer: SCNSceneRenderer, didUpdate node: SCNNode, for anchor: ARAnchor) {
        guard let face = anchor as? ARFaceAnchor,
              let geom = faceGeomNode?.geometry as? ARSCNFaceGeometry else { return }
        geom.update(from: face.geometry)
        loomisOverlay?.update(face: face)
    }

    func advanceStage() {
        let next = stage.next
        DispatchQueue.main.async { self.stage = next }
        loomisOverlay?.setStage(next)
        faceGeomNode?.isHidden = (next != .debugMesh)
    }

    func session(_ session: ARSession, didUpdate frame: ARFrame) {
        guard let face = frame.anchors.compactMap({ $0 as? ARFaceAnchor }).first else { return }
        latestPacket = FramePacket.make(face: face, frame: frame)
        DispatchQueue.main.async { self.frameCount &+= 1 }
    }

    func session(_ session: ARSession, didFailWithError error: Error) {
        DispatchQueue.main.async { self.status = "error: \(error.localizedDescription)" }
    }

    func exportLatestPacket() -> URL? {
        guard let packet = latestPacket else {
            DispatchQueue.main.async { self.lastExport = "no packet yet" }
            return nil
        }
        do {
            let url = try FramePacket.write(packet)
            DispatchQueue.main.async { self.lastExport = "wrote \(url.lastPathComponent)" }
            return url
        } catch {
            DispatchQueue.main.async { self.lastExport = "export failed: \(error.localizedDescription)" }
            return nil
        }
    }
}

final class FittedLoomisOverlay {
    let root = SCNNode()

    private let cranium = SCNNode()
    private let doveline = SCNNode()
    private let eyeline = SCNNode()
    private let sideDiscs = SCNNode()
    private let jawBlock = SCNNode()
    private var stage: LessonStage

    init(stage: LessonStage) {
        self.stage = stage
        root.name = "fittedLoomisRoot"
        cranium.name = "fl_cranium"
        doveline.name = "fl_doveline"
        eyeline.name = "fl_eyeline"
        sideDiscs.name = "fl_sideDiscs"
        jawBlock.name = "fl_jawBlock"
        root.addChildNode(cranium)
        root.addChildNode(doveline)
        root.addChildNode(eyeline)
        root.addChildNode(sideDiscs)
        root.addChildNode(jawBlock)
        applyStage()
    }

    func setStage(_ stage: LessonStage) {
        self.stage = stage
        applyStage()
    }

    func update(face: ARFaceAnchor) {
        guard let fit = LoomisFit(vertices: face.geometry.vertices) else { return }
        cranium.geometry = Self.lineGeometry(points: Self.craniumArc(fit), color: UIColor.white.withAlphaComponent(0.92))
        doveline.geometry = Self.lineGeometry(points: Self.dovelineArc(fit), color: UIColor.white)
        eyeline.geometry = Self.lineGeometry(points: Self.eyeArc(fit), color: UIColor.white)
        sideDiscs.geometry = Self.lineGeometry(points: Self.sideDiskArcs(fit), color: UIColor.white.withAlphaComponent(0.55))
        jawBlock.geometry = Self.lineGeometry(points: Self.jawLines(fit), color: UIColor.white.withAlphaComponent(0.8))
    }

    private func applyStage() {
        cranium.isHidden = false
        doveline.isHidden = (stage == .sphere)
        eyeline.isHidden = (stage == .sphere)
        sideDiscs.isHidden = (stage.rawValue < LessonStage.loomis.rawValue)
        jawBlock.isHidden = (stage.rawValue < LessonStage.loomis.rawValue)
    }

    private struct LoomisFit {
        let center: SIMD3<Float>
        let radius: Float
        let faceMinX: Float
        let faceMaxX: Float
        let faceMinY: Float
        let faceMaxY: Float
        let faceMidZ: Float
        let eyeY: Float
        let chinY: Float
        let vertices: [vector_float3]

        init?(vertices: [vector_float3]) {
            guard !vertices.isEmpty else { return nil }
            var minX = Float.greatestFiniteMagnitude
            var maxX = -Float.greatestFiniteMagnitude
            var minY = Float.greatestFiniteMagnitude
            var maxY = -Float.greatestFiniteMagnitude
            var minZ = Float.greatestFiniteMagnitude
            var maxZ = -Float.greatestFiniteMagnitude

            for v in vertices {
                minX = Swift.min(minX, v.x)
                maxX = Swift.max(maxX, v.x)
                minY = Swift.min(minY, v.y)
                maxY = Swift.max(maxY, v.y)
                minZ = Swift.min(minZ, v.z)
                maxZ = Swift.max(maxZ, v.z)
            }

            let width = maxX - minX
            let height = maxY - minY
            guard width > 0.02, height > 0.03 else { return nil }

            let r = Swift.max(width * 0.56, height * 0.38)
            let midX = (minX + maxX) * 0.5
            let midZ = (minZ + maxZ) * 0.5
            // ARKit's face origin is near the face center. Loomis starts at the
            // cranium, so the ball has to be fitted up toward the forehead.
            let centerY = maxY - r * 0.28

            center = SIMD3<Float>(midX, centerY, midZ)
            radius = r
            faceMinX = minX
            faceMaxX = maxX
            faceMinY = minY
            faceMaxY = maxY
            faceMidZ = midZ
            eyeY = maxY - height * 0.42
            chinY = minY
            self.vertices = vertices
        }

        func forwardSurfacePoint(y: Float, xCenter: Float, xBand: Float, yBand: Float) -> SIMD3<Float>? {
            var best: vector_float3?
            var bestScore = -Float.greatestFiniteMagnitude

            for v in vertices {
                let dx = abs(v.x - xCenter)
                let dy = abs(v.y - y)
                guard dx <= xBand, dy <= yBand else { continue }
                let centerPenalty = (dx / Swift.max(xBand, 0.001)) * radius * 0.18
                let verticalPenalty = (dy / Swift.max(yBand, 0.001)) * radius * 0.06
                let score = v.z - centerPenalty - verticalPenalty
                if score > bestScore {
                    bestScore = score
                    best = v
                }
            }

            guard let p = best else { return nil }
            return SIMD3<Float>(p.x, p.y, p.z)
        }
    }

    private static func craniumArc(_ fit: LoomisFit) -> [SCNVector3] {
        arcXY(center: fit.center, rx: fit.radius, ry: fit.radius * 1.04, z: fit.faceMidZ, start: 12, end: 348, steps: 64)
    }

    private static func dovelineArc(_ fit: LoomisFit) -> [SCNVector3] {
        var pts: [SCNVector3] = []
        let startY = fit.center.y + fit.radius * 0.92
        let endY = fit.chinY - fit.radius * 0.08
        let xBand = fit.radius * 0.22
        let yBand = fit.radius * 0.075
        var previous: SIMD3<Float>?

        for i in 0...56 {
            let t = Float(i) / 56
            let y = startY + (endY - startY) * t
            let sphereT = 0.92 - 1.92 * t
            let sphereFront = sqrt(Swift.max(0, 1 - sphereT * sphereT)) * fit.radius
            let fallback = SIMD3<Float>(fit.center.x, y, fit.center.z + sphereFront * 0.22)
            let surface = fit.forwardSurfacePoint(y: y, xCenter: fit.center.x, xBand: xBand, yBand: yBand) ?? fallback
            let blended: SIMD3<Float>
            if let prev = previous {
                blended = SIMD3<Float>(
                    prev.x * 0.55 + surface.x * 0.45,
                    y,
                    prev.z * 0.45 + surface.z * 0.55 + fit.radius * 0.006
                )
            } else {
                blended = SIMD3<Float>(surface.x, y, surface.z + fit.radius * 0.006)
            }
            previous = blended
            pts.append(SCNVector3(blended.x, blended.y, blended.z))
        }
        return pts
    }

    private static func eyeArc(_ fit: LoomisFit) -> [SCNVector3] {
        var pts: [SCNVector3] = []
        let y = fit.eyeY
        for i in 0...48 {
            let t = Float(i) / 48
            let x = fit.center.x + fit.radius * (-0.94 + 1.88 * t)
            let normalized = (x - fit.center.x) / fit.radius
            let front = sqrt(Swift.max(0, 1 - normalized * normalized)) * fit.radius * 0.18
            let surface = fit.forwardSurfacePoint(y: y, xCenter: x, xBand: fit.radius * 0.16, yBand: fit.radius * 0.08)
            let z = surface.map { $0.z + fit.radius * 0.004 } ?? (fit.center.z + front)
            pts.append(SCNVector3(x, y, z))
        }
        return pts
    }

    private static func sideDiskArcs(_ fit: LoomisFit) -> [SCNVector3] {
        var pts: [SCNVector3] = []
        let offset = fit.radius * 0.72
        let r = fit.radius * 0.62
        for sign: Float in [-1, 1] {
            let x = fit.center.x + sign * offset
            let disc = arcYZ(x: x, centerY: fit.center.y, centerZ: fit.center.z, radius: r, start: -78, end: 258, steps: 44)
            pts.append(contentsOf: disc)
            pts.append(SCNVector3(Float.nan, Float.nan, Float.nan))
        }
        return pts
    }

    private static func jawLines(_ fit: LoomisFit) -> [SCNVector3] {
        let jawTopY = fit.center.y - fit.radius * 0.78
        let chinY = fit.chinY - fit.radius * 0.03
        let halfTop = fit.radius * 0.62
        let halfChin = fit.radius * 0.34
        let z = fit.center.z + fit.radius * 0.08
        return [
            SCNVector3(fit.center.x - halfTop, jawTopY, z),
            SCNVector3(fit.center.x - halfChin, chinY, z),
            SCNVector3(fit.center.x - halfChin, chinY, z),
            SCNVector3(fit.center.x + halfChin, chinY, z),
            SCNVector3(fit.center.x + halfChin, chinY, z),
            SCNVector3(fit.center.x + halfTop, jawTopY, z),
        ]
    }

    private static func arcXY(center: SIMD3<Float>, rx: Float, ry: Float, z: Float, start: Float, end: Float, steps: Int) -> [SCNVector3] {
        var pts: [SCNVector3] = []
        for i in 0...steps {
            let deg = start + (end - start) * Float(i) / Float(steps)
            let a = deg * Float.pi / 180
            pts.append(SCNVector3(center.x + cos(a) * rx, center.y + sin(a) * ry, z))
        }
        return pts
    }

    private static func arcYZ(x: Float, centerY: Float, centerZ: Float, radius: Float, start: Float, end: Float, steps: Int) -> [SCNVector3] {
        var pts: [SCNVector3] = []
        for i in 0...steps {
            let deg = start + (end - start) * Float(i) / Float(steps)
            let a = deg * Float.pi / 180
            pts.append(SCNVector3(x, centerY + sin(a) * radius, centerZ + cos(a) * radius))
        }
        return pts
    }

    private static func lineGeometry(points: [SCNVector3], color: UIColor) -> SCNGeometry? {
        var vertices: [SCNVector3] = []
        var indices: [Int32] = []
        var previous: Int32?

        for p in points {
            if p.x.isNaN || p.y.isNaN || p.z.isNaN {
                previous = nil
                continue
            }
            let current = Int32(vertices.count)
            vertices.append(p)
            if let prev = previous {
                indices.append(prev)
                indices.append(current)
            }
            previous = current
        }

        guard !vertices.isEmpty, !indices.isEmpty else { return nil }
        let source = SCNGeometrySource(vertices: vertices)
        let data = Data(bytes: indices, count: indices.count * MemoryLayout<Int32>.size)
        let element = SCNGeometryElement(data: data, primitiveType: .line, primitiveCount: indices.count / 2, bytesPerIndex: MemoryLayout<Int32>.size)
        let geo = SCNGeometry(sources: [source], elements: [element])
        geo.firstMaterial = lineMaterial(color)
        return geo
    }

    private static func lineMaterial(_ color: UIColor) -> SCNMaterial {
        let m = SCNMaterial()
        m.diffuse.contents = color
        m.lightingModel = .constant
        m.isDoubleSided = true
        m.writesToDepthBuffer = false
        return m
    }
}

struct ARFaceView: UIViewRepresentable {
    let session: ARFaceSession

    func makeUIView(context: Context) -> ARSCNView {
        let view = ARSCNView(frame: .zero)
        view.delegate = session
        view.session.delegate = session
        view.automaticallyUpdatesLighting = true
        session.sceneView = view
        session.start()
        return view
    }

    func updateUIView(_ uiView: ARSCNView, context: Context) {}
}
