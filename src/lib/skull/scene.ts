import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

// Skull is loaded via the following priority:
//   1. /skull.glb in public/ (drop a CC-BY/CC0 mesh there and it auto-uses).
//   2. window.__DRAWLOOM_SKULL_URL if set (lets the host page point us at any
//      hosted GLB without code changes).
//   3. Procedural fallback built from three.js primitives.
//
// The procedural fallback stays recognizable as a skull (cranium sphere,
// recessed dark socket spheres, cone nasal aperture, maxilla/mandible boxes,
// cheekbone & jaw-angle masses). Lit with a key light from upper-front-left
// plus dim fill so the form reads as 3D and recessed features cast dark
// accents.

function createProceduralSkull(): THREE.Group {
  const group = new THREE.Group();
  const boneColor = 0xf5ecd9;
  const cavityColor = 0x0d0d0d;

  const boneMat = new THREE.MeshStandardMaterial({
    color: boneColor,
    roughness: 0.6,
    metalness: 0.05,
  });
  const cavityMat = new THREE.MeshBasicMaterial({ color: cavityColor });

  // Cranium — slightly elongated front-back
  const cranium = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 48), boneMat);
  cranium.scale.set(0.95, 1.0, 1.05);
  group.add(cranium);

  // Brow ridge — thin curved bar across the front
  const brow = new THREE.Mesh(
    new THREE.TorusGeometry(0.62, 0.05, 8, 24, Math.PI),
    boneMat
  );
  brow.rotation.x = -Math.PI / 2;
  brow.rotation.z = Math.PI;
  brow.position.set(0, 0.22, 0.78);
  group.add(brow);

  // Eye sockets — recessed dark cavities
  for (const x of [-0.32, 0.32]) {
    const socket = new THREE.Mesh(new THREE.SphereGeometry(0.24, 24, 24), cavityMat);
    socket.position.set(x, 0.02, 0.86);
    socket.scale.set(1, 0.95, 0.5);
    group.add(socket);
    // Orbital rim (thin bone outline around the socket)
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.025, 8, 24), boneMat);
    rim.position.set(x, 0.02, 0.92);
    rim.rotation.y = x < 0 ? -0.15 : 0.15;
    group.add(rim);
  }

  // Nasal aperture — triangular cavity
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.32, 3), cavityMat);
  nose.rotation.x = Math.PI;
  nose.position.set(0, -0.18, 0.96);
  group.add(nose);

  // Nasal bone bridge
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.32, 0.12), boneMat);
  bridge.position.set(0, -0.05, 1);
  group.add(bridge);

  // Maxilla (upper jaw) — wider block
  const maxilla = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.32, 0.5), boneMat);
  maxilla.position.set(0, -0.5, 0.7);
  group.add(maxilla);

  // Teeth row hint
  const teeth = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.06, 0.45),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 })
  );
  teeth.position.set(0, -0.66, 0.72);
  group.add(teeth);

  // Mandible (lower jaw) — narrower box with a chin point
  const mandible = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.5), boneMat);
  mandible.position.set(0, -0.82, 0.65);
  group.add(mandible);

  // Chin point
  const chin = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 16), boneMat);
  chin.position.set(0, -0.9, 0.85);
  chin.scale.set(1.4, 0.7, 0.7);
  group.add(chin);

  // Cheekbones — side spheres for the zygomatic prominence
  for (const x of [-0.62, 0.62]) {
    const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.2, 24, 24), boneMat);
    cheek.position.set(x, -0.18, 0.55);
    cheek.scale.set(1.1, 0.7, 0.6);
    group.add(cheek);
  }

  // Mandible angle (rear corner of the jaw) — small box per side
  for (const x of [-0.55, 0.55]) {
    const angle = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.45, 0.25), boneMat);
    angle.position.set(x, -0.6, 0.25);
    group.add(angle);
  }

  // Slight upward shift so the skull sits well in the frame
  group.position.y = 0.1;
  return group;
}

/**
 * Center + scale a loaded GLB so it occupies roughly the same view-volume the
 * procedural skull does (longest dimension ~= 2.0 units, centered on origin).
 */
function normalizeSkullMesh(obj: THREE.Object3D): THREE.Group {
  const group = new THREE.Group();
  group.add(obj);
  const box = new THREE.Box3().setFromObject(obj);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  const longest = Math.max(size.x, size.y, size.z) || 1;
  const scale = 2.0 / longest;
  obj.position.sub(center).multiplyScalar(scale);
  obj.scale.setScalar(scale);
  return group;
}

async function loadSkullGLB(url: string): Promise<THREE.Group | null> {
  // Cheap probe before bringing in the GLTFLoader — avoids noisy 404s in the
  // console if the user hasn't dropped a skull.glb in public/.
  try {
    const probe = await fetch(url, { method: "HEAD", cache: "no-store" });
    if (!probe.ok) return null;
  } catch {
    return null;
  }
  const loader = new GLTFLoader();
  return new Promise((resolve) => {
    loader.load(
      url,
      (gltf) => {
        try {
          resolve(normalizeSkullMesh(gltf.scene));
        } catch (e) {
          console.warn("[skull] failed to normalize loaded GLB", e);
          resolve(null);
        }
      },
      undefined,
      (err) => {
        console.warn("[skull] GLTFLoader rejected", url, err);
        resolve(null);
      }
    );
  });
}

export type SkullScene = {
  setRotation: (matrix: number[]) => void;
  resize: (w: number, h: number) => void;
  dispose: () => void;
};

export function mountSkullScene(canvas: HTMLCanvasElement): SkullScene {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0, 4.2);

  // Key light + fill + rim
  scene.add(new THREE.AmbientLight(0x404040, 0.5));
  const key = new THREE.DirectionalLight(0xfff0e0, 1.4);
  key.position.set(-2, 2.5, 3);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x88a0c0, 0.5);
  fill.position.set(2, -1, 2);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff, 0.4);
  rim.position.set(0, 1, -3);
  scene.add(rim);

  // Pivot group so we can apply the MediaPipe matrix directly to it without
  // disturbing the skull's local offset. Start with the procedural skull and
  // hot-swap if a GLB asset becomes available.
  const pivot = new THREE.Group();
  let current: THREE.Group = createProceduralSkull();
  pivot.add(current);
  scene.add(pivot);

  let disposed = false;

  // Try the GLB sources in priority order. If none load, the procedural skull
  // stays in place — no user-visible failure.
  (async () => {
    const candidates = [
      "/skull.glb",
      ...(typeof window !== "undefined" && (window as unknown as { __DRAWLOOM_SKULL_URL?: string }).__DRAWLOOM_SKULL_URL
        ? [(window as unknown as { __DRAWLOOM_SKULL_URL?: string }).__DRAWLOOM_SKULL_URL as string]
        : []),
    ];
    for (const url of candidates) {
      const loaded = await loadSkullGLB(url);
      if (disposed) return;
      if (loaded) {
        pivot.remove(current);
        current.traverse((node) => {
          if (node instanceof THREE.Mesh) {
            node.geometry?.dispose();
            const mat = node.material;
            if (Array.isArray(mat)) mat.forEach((m) => m.dispose?.());
            else mat?.dispose?.();
          }
        });
        current = loaded;
        pivot.add(current);
        return;
      }
    }
  })().catch((e) => console.warn("[skull] GLB swap pipeline error", e));

  function render() {
    if (disposed) return;
    renderer.render(scene, camera);
    requestAnimationFrame(render);
  }
  render();

  return {
    setRotation(matrixArray: number[]) {
      if (matrixArray.length < 16) return;
      // MediaPipe gives us a column-major 4x4 model→camera transform.
      // We only want the rotation component, mirrored across X so the skull
      // mirrors the user's head in the selfie view.
      const m = new THREE.Matrix4().fromArray(matrixArray);
      const rot = new THREE.Matrix4().extractRotation(m);
      const q = new THREE.Quaternion().setFromRotationMatrix(rot);
      // Selfie-mirror: flip yaw (Y) and roll (Z) so the skull turns the same
      // way the on-screen face does.
      const e = new THREE.Euler().setFromQuaternion(q, "YXZ");
      e.y = -e.y;
      e.z = -e.z;
      pivot.quaternion.setFromEuler(e);
    },
    resize(w: number, h: number) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    },
    dispose() {
      disposed = true;
      renderer.dispose();
    },
  };
}
