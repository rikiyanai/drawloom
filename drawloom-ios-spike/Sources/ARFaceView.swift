import SwiftUI
import ARKit
import SceneKit

final class ARFaceSession: NSObject, ObservableObject, ARSCNViewDelegate, ARSessionDelegate {
    @Published var status: String = "starting"
    @Published var frameCount: Int = 0
    @Published var lastExport: String = ""

    weak var sceneView: ARSCNView?
    private var latestPacket: FramePacket?

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
        guard anchor is ARFaceAnchor, let device = sceneView?.device,
              let geom = ARSCNFaceGeometry(device: device) else { return nil }
        geom.firstMaterial?.fillMode = .lines
        geom.firstMaterial?.diffuse.contents = UIColor.cyan
        geom.firstMaterial?.lightingModel = .constant
        let node = SCNNode(geometry: geom)
        node.addChildNode(LoomisBall.make())
        return node
    }

    func renderer(_ renderer: SCNSceneRenderer, didUpdate node: SCNNode, for anchor: ARAnchor) {
        guard let face = anchor as? ARFaceAnchor,
              let geom = node.geometry as? ARSCNFaceGeometry else { return }
        geom.update(from: face.geometry)
    }

    func session(_ session: ARSession, didUpdate frame: ARFrame) {
        guard let face = frame.anchors.compactMap({ $0 as? ARFaceAnchor }).first else { return }
        let packet = FramePacket.make(face: face, frame: frame)
        latestPacket = packet
        DispatchQueue.main.async {
            self.frameCount &+= 1
        }
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

// A minimal Loomis ball — wireframe sphere + brow/median equators + ear discs —
// pinned at the face anchor origin (which ARKit defines at the head centroid,
// +X subject-left, +Y up, +Z out of the face). The point is to verify visually
// that ARKit's pose locks to the cranium as the head moves; numerical accuracy
// is judged offline via compare-packets.mjs.
enum LoomisBall {
    static let radius: CGFloat = 0.075       // ~7.5 cm — typical cranium radius
    static let diskOffset: CGFloat = 0.053   // 0.707 * radius — matches loomis/scene.ts
    static let diskRadius: CGFloat = 0.053   // 0.707 * radius

    static func make() -> SCNNode {
        let root = SCNNode()

        let sphere = SCNSphere(radius: radius)
        sphere.segmentCount = 24
        sphere.firstMaterial = wireMaterial(UIColor.magenta)
        root.addChildNode(SCNNode(geometry: sphere))

        // Brow equator: ring in the XZ plane
        let brow = SCNTorus(ringRadius: radius, pipeRadius: 0.0015)
        brow.firstMaterial = solidMaterial(UIColor.systemPink)
        root.addChildNode(SCNNode(geometry: brow))

        // Median equator: ring in the YZ plane (rotated 90° around Z)
        let median = SCNTorus(ringRadius: radius, pipeRadius: 0.0015)
        median.firstMaterial = solidMaterial(UIColor.systemPink)
        let medianNode = SCNNode(geometry: median)
        medianNode.eulerAngles = SCNVector3(0, 0, .pi / 2)
        root.addChildNode(medianNode)

        // Ear discs: flat circles on ±X side flats
        for sign: Float in [-1, 1] {
            let disc = SCNTorus(ringRadius: diskRadius, pipeRadius: 0.0015)
            disc.firstMaterial = solidMaterial(UIColor.systemTeal)
            let n = SCNNode(geometry: disc)
            n.position = SCNVector3(sign * Float(diskOffset), 0, 0)
            n.eulerAngles = SCNVector3(0, 0, .pi / 2)
            root.addChildNode(n)
        }

        return root
    }

    private static func wireMaterial(_ color: UIColor) -> SCNMaterial {
        let m = SCNMaterial()
        m.fillMode = .lines
        m.diffuse.contents = color
        m.lightingModel = .constant
        m.isDoubleSided = true
        m.writesToDepthBuffer = false
        return m
    }

    private static func solidMaterial(_ color: UIColor) -> SCNMaterial {
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
