# Drawloom iOS ARKit Spike

Native iOS proof for comparing ARKit/TrueDepth face tracking against the browser MediaPipe pipeline.

## Run

```sh
brew install xcodegen
cd drawloom-ios-spike
xcodegen generate
open DrawloomSpike.xcodeproj
```

Run on a TrueDepth-capable iPhone or iPad. The simulator and non-TrueDepth devices cannot run `ARFaceTrackingConfiguration`.

This machine currently also needs full Xcode selected, not only Command Line Tools:

```sh
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
```

## Packet Workflow

1. In the iOS app, tap `Export JSON` and share the packet out of the app.
2. In drawloom web, detect a face and click `export MediaPipe JSON` in the header.
3. Compare packets:

```sh
node drawloom-ios-spike/scripts/compare-packets.mjs arkit.json mediapipe.json
```

The script compares pose matrices and mapped blendshapes. It only compares vertex L2 when packet topologies match; ARKit's `arkit-face-geometry-1220` and MediaPipe's `mediapipe-face-landmarks-478` are different meshes.
