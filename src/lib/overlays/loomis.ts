import type { Overlay } from "./types";
import {
  TOP_OF_FOREHEAD,
  CHIN,
  LEFT_EAR,
  RIGHT_EAR,
  LEFT_PUPIL,
  RIGHT_PUPIL,
  NOSE_TIP,
} from "../pose/landmarks";

// Loomis head construction.
//
// Classical Loomis: a sphere for the cranium, with side-plane cuts where the
// temples are flattened, and a jaw block extending downward from the brow
// line to the chin. Rotated by the detected yaw / pitch / roll.
//
// We anchor every dimension to actual landmarks (ear-to-ear distance for the
// sphere, forehead-to-chin for vertical extent, brow line for the great-circle)
// rather than the rough bbox so the construction lines stay glued to the face
// at any angle.
export const loomisOverlay: Overlay = {
  id: "loomis",
  name: "Loomis head",
  category: "construction",
  description: "Cranium sphere + side-plane cut + brow great-circle + jaw block, rotated by the detected head angle.",
  requiresFace: true,
  params: [
    { key: "opacity", label: "Opacity", type: "slider", min: 0, max: 1, step: 0.05, default: 0.85 },
    { key: "lineWidth", label: "Line width", type: "slider", min: 1, max: 5, step: 0.5, default: 2 },
    { key: "showJaw", label: "Jaw block", type: "toggle", default: true },
    { key: "showBrow", label: "Brow great-circle", type: "toggle", default: true },
    { key: "showSideCut", label: "Side-plane cut", type: "toggle", default: true },
    { key: "showCenterline", label: "Centerline", type: "toggle", default: true },
  ],
  render({ ctx, pose, params }) {
    if (!pose) return;
    const lms = pose.landmarks;
    const top = lms[TOP_OF_FOREHEAD];
    const chin = lms[CHIN];
    const leftEar = lms[LEFT_EAR];
    const rightEar = lms[RIGHT_EAR];
    const leftPupil = lms[LEFT_PUPIL];
    const rightPupil = lms[RIGHT_PUPIL];
    const noseTip = lms[NOSE_TIP];
    if (!top || !chin || !leftEar || !rightEar) return;

    const opacity = (params.opacity as number) ?? 0.85;
    const lineWidth = (params.lineWidth as number) ?? 2;
    const showJaw = (params.showJaw as boolean) ?? true;
    const showBrow = (params.showBrow as boolean) ?? true;
    const showSideCut = (params.showSideCut as boolean) ?? true;
    const showCenter = (params.showCenterline as boolean) ?? true;

    // Sphere center = midpoint between the ears (sits at the cranium centroid).
    const sphereCx = (leftEar.x + rightEar.x) / 2;
    const sphereCy = (leftEar.y + rightEar.y) / 2;

    // Radius from forehead-top to ear-midpoint (vertical) — gives a sphere that
    // actually wraps the cranium without overflowing into the jaw.
    const verticalRadius = Math.hypot(top.x - sphereCx, top.y - sphereCy);
    const earToEar = Math.hypot(rightEar.x - leftEar.x, rightEar.y - leftEar.y);
    const radius = Math.max(verticalRadius, earToEar / 2);

    const { yaw, pitch, roll } = pose.angles;
    const yawRad = (yaw * Math.PI) / 180;
    const pitchRad = (pitch * Math.PI) / 180;
    const rollRad = (roll * Math.PI) / 180;

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.strokeStyle = "#22d3ee";
    ctx.lineWidth = lineWidth;
    ctx.lineJoin = "round";

    ctx.translate(sphereCx, sphereCy);
    ctx.rotate(rollRad);

    // Sphere outline
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.stroke();

    // Side-plane cut — the flat oval where Loomis flattens the temple.
    // The cut offsets horizontally with yaw (showing more on the visible side).
    if (showSideCut) {
      const cutOffset = radius * Math.sin(yawRad) * 0.75;
      const cutMinor = radius * 0.22;
      const cutMajor = radius * Math.max(0.55, Math.cos(yawRad)) * 0.95;
      ctx.beginPath();
      ctx.ellipse(cutOffset, 0, cutMinor, cutMajor, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Brow great-circle — horizontal ellipse through the brow line, tilted by pitch.
    if (showBrow) {
      // Place at pupil height (offset from sphere center)
      let browY = 0;
      if (leftPupil && rightPupil) {
        const browMidY = (leftPupil.y + rightPupil.y) / 2;
        // Translate browMidY into local (post-translate, post-rotate) coordinates.
        // Roll is small enough that y-only approximation is acceptable here.
        browY = browMidY - sphereCy;
      } else {
        browY = -radius * Math.sin(pitchRad) * 0.35;
      }
      ctx.beginPath();
      ctx.ellipse(
        0,
        browY,
        radius * Math.max(0.4, Math.cos(yawRad)),
        radius * 0.18,
        0,
        0,
        Math.PI * 2
      );
      ctx.stroke();
    }

    // Centerline — vertical line through the face center, offset by yaw.
    if (showCenter) {
      const ctrX = radius * Math.sin(yawRad) * 0.95;
      ctx.beginPath();
      ctx.moveTo(ctrX, -radius);
      // Extend down past the sphere to roughly chin level
      ctx.lineTo(ctrX, (chin.y - sphereCy));
      ctx.stroke();
    }

    ctx.restore();

    // Jaw block — drawn in image space (not the rotated frame) using the
    // actual chin + mouth landmarks. Loomis shows the jaw as a triangular
    // wedge from the brow line down to the chin.
    if (showJaw && noseTip) {
      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.strokeStyle = "#22d3ee";
      ctx.lineWidth = lineWidth;

      const browY = leftPupil && rightPupil
        ? (leftPupil.y + rightPupil.y) / 2 - earToEar * 0.05
        : sphereCy;
      const jawHalfWidth = earToEar * 0.42;
      const jawTopL = { x: chin.x - jawHalfWidth, y: browY };
      const jawTopR = { x: chin.x + jawHalfWidth, y: browY };

      ctx.beginPath();
      ctx.moveTo(jawTopL.x, jawTopL.y);
      ctx.quadraticCurveTo(chin.x - jawHalfWidth * 0.5, chin.y - earToEar * 0.05, chin.x, chin.y);
      ctx.quadraticCurveTo(chin.x + jawHalfWidth * 0.5, chin.y - earToEar * 0.05, jawTopR.x, jawTopR.y);
      ctx.stroke();
      ctx.restore();
    }
  },
};
