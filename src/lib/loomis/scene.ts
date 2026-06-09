import * as THREE from "three";

// 3D Loomis construction renderer. Mirrors the architecture of
// src/lib/skull/scene.ts but with construction primitives instead of an
// anatomical mesh:
//
//   - cranium silhouette: a circle in camera-space (sphere outline is
//     always a circle regardless of orientation)
//   - median vertical great-circle: ring in YZ plane (rotates with head)
//   - brow + eye horizontal great-circles: rings in XZ plane at a chosen y
//   - two temporal side-plane disks: rings in YZ plane at x = ±r·cos(θ_cut)
//     (NOT at ±r — the cut plane sits INSIDE the sphere at distance
//     r·cos(θ_cut), with disk radius r·sin(θ_cut))
//   - jaw quad: 4 vertices, chin pushed forward in +Z
//   - neck: two parallel vertical line segments below the jaw
//
// Every line that should rotate with the head goes inside `pivot`; the
// silhouette stays outside since a sphere's projected outline is always a
// circle perpendicular to the view direction.

export type LoomisVisibility = {
  brow: boolean;
  eye: boolean;
  median: boolean;
  side: boolean;
  jaw: boolean;
  neck: boolean;
};

export type LoomisScene = {
  setRotation: (matrix: number[]) => void;
  setVisibility: (opts: LoomisVisibility) => void;
  setColor: (hex: number) => void;
  resize: (w: number, h: number) => void;
  dispose: () => void;
};

function createRing(
  radius: number,
  plane: "xy" | "xz" | "yz",
  offset: number,
  mat: THREE.LineBasicMaterial
): THREE.Line {
  const segments = 96;
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const c = Math.cos(a) * radius;
    const s = Math.sin(a) * radius;
    if (plane === "xy") pts.push(new THREE.Vector3(c, s, offset));
    else if (plane === "xz") pts.push(new THREE.Vector3(c, offset, s));
    else pts.push(new THREE.Vector3(offset, c, s));
  }
  const geom = new THREE.BufferGeometry().setFromPoints(pts);
  return new THREE.Line(geom, mat);
}

export function mountLoomisScene(canvas: HTMLCanvasElement): LoomisScene {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  // Same framing as the skull scene so a Loomis overlay and a skull overlay
  // composited at the same bbox size render at matching head scale.
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0, 4.2);

  const lineMat = new THREE.LineBasicMaterial({ color: 0x22d3ee });

  const r = 1.0;

  // 1. Cranium silhouette — camera-space circle that never rotates.
  const silhouette = createRing(r, "xy", 0, lineMat);
  scene.add(silhouette);

  // 2. Pivot for everything that rotates with the head pose.
  const pivot = new THREE.Group();
  scene.add(pivot);

  // 3. Median vertical great-circle (YZ plane at x = 0).
  const median = createRing(r, "yz", 0, lineMat);
  pivot.add(median);

  // 4. Brow horizontal great-circle. Brow sits ~30% above sphere equator;
  //    the great-circle's radius shrinks accordingly so it lies ON the sphere.
  const browY = 0.3 * r;
  const browR = Math.sqrt(r * r - browY * browY);
  const brow = createRing(browR, "xz", browY, lineMat);
  pivot.add(brow);

  // 5. Eye horizontal great-circle, slightly below the equator (eye line is
  //    typically at or just below sphere-center height in the Loomis canon).
  const eyeY = -0.05 * r;
  const eyeR = Math.sqrt(r * r - eyeY * eyeY);
  const eye = createRing(eyeR, "xz", eyeY, lineMat);
  pivot.add(eye);

  // 6. Two side-plane disks at the classical θ_cut = 45° (so disks sit at
  //    ±0.707r from center on the X-axis, with disk radius 0.707r).
  const thetaCut = Math.PI / 4;
  const diskX = r * Math.cos(thetaCut);
  const diskR = r * Math.sin(thetaCut);
  const leftDisk = createRing(diskR, "yz", -diskX, lineMat);
  const rightDisk = createRing(diskR, "yz", diskX, lineMat);
  pivot.add(leftDisk);
  pivot.add(rightDisk);

  // 7. Jaw quad. Top edge meets the bottom of the side disks; chin sits
  //    forward in +Z so the jaw silhouette reads as a 3D wedge rather than
  //    a flat trapezoid.
  const jawTopY = -diskR * 0.85;
  const jawTopX = diskX;
  const chinY = -1.45 * r;
  const chinX = 0.42 * r;
  const chinZ = 0.45 * r;
  const jawGeom = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-jawTopX, jawTopY, 0),
    new THREE.Vector3(-chinX, chinY, chinZ),
    new THREE.Vector3(chinX, chinY, chinZ),
    new THREE.Vector3(jawTopX, jawTopY, 0),
  ]);
  const jaw = new THREE.LineLoop(jawGeom, lineMat);
  pivot.add(jaw);

  // 8. Neck: two vertical lines descending from inset jaw-bottom corners.
  const neckW = chinX * 0.78;
  const neckTopY = chinY;
  const neckBotY = chinY - 0.9 * r;
  const neckGeom = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-neckW, neckTopY, chinZ),
    new THREE.Vector3(-neckW, neckBotY, chinZ),
    new THREE.Vector3(neckW, neckTopY, chinZ),
    new THREE.Vector3(neckW, neckBotY, chinZ),
  ]);
  const neck = new THREE.LineSegments(neckGeom, lineMat);
  pivot.add(neck);

  let disposed = false;
  function loop() {
    if (disposed) return;
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  }
  loop();

  return {
    setRotation(matrixArray: number[]) {
      if (matrixArray.length < 16) return;
      // Same convention as skull/scene.ts: MediaPipe gives a column-major
      // 4×4 model→camera transform; we extract rotation, convert to YXZ
      // Euler, and flip yaw + roll so the construction mirrors the user's
      // selfie-mirrored on-screen face.
      const m = new THREE.Matrix4().fromArray(matrixArray);
      const rot = new THREE.Matrix4().extractRotation(m);
      const q = new THREE.Quaternion().setFromRotationMatrix(rot);
      const e = new THREE.Euler().setFromQuaternion(q, "YXZ");
      e.y = -e.y;
      e.z = -e.z;
      pivot.quaternion.setFromEuler(e);
    },
    setVisibility(opts: LoomisVisibility) {
      median.visible = opts.median;
      brow.visible = opts.brow;
      eye.visible = opts.eye;
      leftDisk.visible = opts.side;
      rightDisk.visible = opts.side;
      jaw.visible = opts.jaw;
      neck.visible = opts.neck;
    },
    setColor(hex: number) {
      lineMat.color.setHex(hex);
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
