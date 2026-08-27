// eyeDetection.js
// MediaPipe FaceLandmarker gate for the anaemia screen.  (Point 4a)
//
// The screen samples colour from the centre of the frame. Before this, it
// trusted that whatever was in the centre was an inner eyelid — so it would
// happily "read" a fingertip, a wall, or a cheek. This module confirms a real
// face with an eye positioned over the sampling ring, which is the "make sure
// the person is actually giving the image of the eye" check.
//
// DESIGN: graceful degradation is the whole point.
//   * MediaPipe's wasm + model are fetched at runtime from a CDN. On a rural,
//     offline-first device that may fail — so every failure path resolves to
//     `available:false`, and the screen then behaves exactly as it did before
//     (centre-crop, lighting gate only). The gate can only ever ADD safety,
//     never block a user who cannot load the model.
//   * TODO for production: vendor the wasm + face_landmarker.task into the app
//     bundle / service worker so this works fully offline. The URLs below are
//     the pinned CDN copies used until then.
//
// NOTE: needs in-browser verification. The landmark indices below are the
// standard FaceMesh eye-corner points; if alignment feels too strict/loose,
// tune ALIGN_RADIUS rather than the indices.

let landmarkerPromise = null;
let unavailable = false;

const WASM_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

// FaceMesh eye-corner landmarks. Averaging the inner+outer corner of each eye
// gives a stable eye centre without needing the iris refinement model.
const RIGHT_EYE = [33, 133];   // outer, inner corner of the subject's right eye
const LEFT_EYE = [362, 263];   // inner, outer corner of the subject's left eye

// How close (normalised, 0..1 of the min frame dimension) an eye centre must be
// to the frame centre to count as "in the ring".
const ALIGN_RADIUS = 0.14;   // tightened: eye must be genuinely over the centre
                             // sampling ring, not just anywhere near the middle. If
                             // capture becomes too hard on your camera, nudge this up.

export function isEyeDetectionAvailable() {
  return !unavailable;
}

async function getLandmarker() {
  if (unavailable) throw new Error("eye detection unavailable");
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      // Dynamic import so a missing dependency or a blocked CDN cannot crash the
      // whole app at load time — it just disables the gate.
      const vision = await import("@mediapipe/tasks-vision");
      const { FaceLandmarker, FilesetResolver } = vision;
      const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
      return FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
        runningMode: "VIDEO",
        numFaces: 1,
      });
    })().catch((err) => {
      unavailable = true;
      landmarkerPromise = null;
      throw err;
    });
  }
  return landmarkerPromise;
}

/**
 * Warm up the model. Call once when the camera starts so the first real check
 * is fast. Resolves to true if the model is ready, false if unavailable.
 */
export async function warmUpEyeDetection() {
  try { await getLandmarker(); return true; } catch { return false; }
}

function eyeCentre(points, ids) {
  let x = 0, y = 0;
  for (const i of ids) { x += points[i].x; y += points[i].y; }
  return { x: x / ids.length, y: y / ids.length };
}

/**
 * Inspect one video frame.
 *
 * @returns {{available:boolean, faceFound:boolean, aligned:boolean,
 *            eye:{x:number,y:number}|null}}
 *   available=false → caller should not gate on this (model not loaded).
 *   faceFound=false → a face/eye was not seen this frame.
 *   aligned=true    → an eye sits within the sampling ring.
 */
export async function inspectFrame(video, tsMs) {
  let lm;
  try { lm = await getLandmarker(); }
  catch { return { available: false, faceFound: false, aligned: false, eye: null }; }

  let res;
  try { res = lm.detectForVideo(video, tsMs); }
  catch { return { available: true, faceFound: false, aligned: false, eye: null }; }

  const faces = res?.faceLandmarks;
  if (!faces || !faces.length) {
    return { available: true, faceFound: false, aligned: false, eye: null };
  }

  const pts = faces[0];
  const right = eyeCentre(pts, RIGHT_EYE);
  const left = eyeCentre(pts, LEFT_EYE);

  // Whichever eye is nearer the frame centre is the one the user is presenting.
  const dist = (p) => Math.hypot(p.x - 0.5, p.y - 0.5);
  const eye = dist(right) <= dist(left) ? right : left;

  return { available: true, faceFound: true, aligned: dist(eye) <= ALIGN_RADIUS, eye };
}
