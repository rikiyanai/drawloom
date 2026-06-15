# drawloom

> Upload a portrait → AI detects head angle → overlay form-first drawing exercises.

The inverse of [viva-reference-angle](https://github.com/watusiii/viva-reference-angle): instead of picking a head pose to find a matching photo, drawloom analyzes the photo you give it and lays construction/value/anatomy guides over the top so you can study the underlying form.

Everything runs in the browser — no backend, no upload, your image never leaves your machine.

![Drawloom pre-alpha demo](demo.gif)

## Overlay roster (v1)

| Overlay | Category | Status |
|---|---|---|
| Loomis head (sphere + cut-plane) | Construction | |
| Skeleton + jaw + eye-sockets | Anatomy | stub (skeleton; muscles TODO) |
| Proportion compare vs Loomis canon | Proportion | 
| Horizon + plumb lines + thirds grid | Geometry |
| Notan (2-value / 3-value reduction) | Value | 
| Edge map / squint blur / silhouette | Shape | 

Each overlay is a self-contained module under `src/lib/overlays/`. Add a new one by exporting an `Overlay` from a file in that folder and registering it in `registry.ts`.

## Stack

- Next.js 16 (app router) + React 19 + TypeScript
- Tailwind v4
- `@mediapipe/tasks-vision` Face Landmarker (browser WASM, GPU delegate)
- Pose math ported from the Python `extract_poses.py` pipeline in the source repo
- Zustand for state

## Run

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Roadmap

- **v1.1** — Three.js-rendered 3D Loomis head (replace the 2D ellipse approximation)
- **v1.2** — Asaro plane head overlay
- **v1.3** — Full muscle layer (Z-Anatomy SVG, Delaunay-warped to landmarks)
- **v1.4** — Body pose (MediaPipe Pose Landmarker) for figure work
- **v1.5** — Webcam mode for live mirror studies
- **v2** — Export overlaid image, study session timer, side-by-side reference angles

## License

MIT
