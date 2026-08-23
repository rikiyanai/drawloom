# Drawloom iOS ARKit Spike

Native iOS test app for comparing ARKit/TrueDepth face tracking with Drawloom's browser MediaPipe pipeline.

## Run

```sh
brew install xcodegen
cd drawloom-ios-spike
xcodegen generate
open DrawloomSpike.xcodeproj
```

Run it on a TrueDepth-capable iPhone or iPad. The simulator and devices without TrueDepth cannot use `ARFaceTrackingConfiguration`.

If Xcode Command Line Tools is selected instead of full Xcode, select Xcode first:

```sh
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
```

## Compare tracking data

1. In the iOS app, tap `Export JSON` and share the file.
2. In Drawloom web, detect a face and select `export MediaPipe JSON`.
3. Compare the two files:

```sh
node drawloom-ios-spike/scripts/compare-packets.mjs arkit.json mediapipe.json
```

The script compares pose matrices and mapped blendshapes. It compares vertex L2 only when the packet topologies match. ARKit's `arkit-face-geometry-1220` and MediaPipe's `mediapipe-face-landmarks-478` use different meshes.
