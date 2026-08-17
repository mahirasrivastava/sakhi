// ocr.js
// On-device prescription OCR.
//
// -------------------------------------------------------------------------
// WHICH MODEL
// -------------------------------------------------------------------------
// Engine:  Tesseract 5, compiled to WebAssembly, via tesseract.js 7.
// Model:   the `eng` LSTM recogniser — a line-level bidirectional LSTM, not a
//          per-character classifier. That distinction matters here: the legacy
//          Tesseract 3 engine segmented and classified single glyphs, which is
//          why it did so badly on the joined-up writing of a real prescription.
// Weights: `eng.traineddata`, "fast" build (integer-quantised, ~2 MB) rather
//          than the "best" float build (~12 MB). See the note on FAST below.
// OEM 1:   LSTM only. The combined LSTM+legacy mode runs both engines and is
//          roughly twice the work for no gain on printed labels.
//
// It runs entirely in this browser tab. The photograph — which carries a name,
// a doctor, a diagnosis, and often an address — never reaches our server. Only
// the extracted text is posted for analysis, and the user is told so before
// they choose a file.
//
// -------------------------------------------------------------------------
// WHY THE PREVIOUS VERSION WAS SLOW
// -------------------------------------------------------------------------
// It handed the raw `File` straight to `worker.recognize()`, and did it inside
// a worker that was created and terminated per scan. Three costs, in order of
// size:
//
//  1. RESOLUTION. A modern phone camera writes a 4000x3000 JPEG. Tesseract's
//     recogniser wants roughly 30 px of x-height and gains nothing above it, so
//     the engine was doing on the order of 15-20x more pixel work than the
//     result needed. Downscaling the long edge to 1800 px is the single biggest
//     win in this file.
//  2. MODEL DOWNLOAD. The default tessdata path serves the "best" float model.
//     The "fast" integer model is about a sixth of the bytes and is measurably
//     quicker to run, at a small accuracy cost that does not show up on the
//     printed drug names this feature actually matches on. On a 2G connection
//     that download was most of the wall-clock time before any OCR started.
//  3. WORKER CHURN. Creating a worker recompiles the WASM core and re-reads the
//     model. Scanning three prescriptions paid that three times. The worker is
//     now created once and kept until the page unmounts.
//
// Then the preprocessing itself: greyscale, a light contrast stretch, and
// Otsu thresholding to 1-bit. Tesseract binarises internally anyway (Otsu, the
// same algorithm) — doing it here on the downscaled image means the engine
// skips its own pass and, more usefully, we can stretch the contrast first,
// which its internal pass does not do. Phone photos of paper are low-contrast
// and unevenly lit, and that is exactly what a global threshold handles badly.

import { api } from "./api.js";

const FAST_TESSDATA = "https://tessdata.projectnaptha.com/4.0.0_fast";

/** Provenance of the ON-DEVICE engine. The cloud engine reports its own. */
export const OCR_ENGINE = {
  engine: "Tesseract 5 (WebAssembly)",
  runtime: "tesseract.js 7",
  model: "eng.traineddata — LSTM line recogniser, fast (integer) build",
  mode: "OEM 1 (LSTM only) · PSM 6 (uniform block of text)",
  where: "Runs in this browser tab. The image is never uploaded.",
};

// The long edge we scale down to. 1800 px keeps a 10 pt drug name printed on
// A5 at well over the ~30 px x-height the LSTM wants, with headroom for a photo
// taken at an angle.
const MAX_EDGE = 1800;

// Below this the image is upscaled instead: a tiny crop starves the recogniser,
// and bicubic upscaling is cheap next to the cost of a failed read.
const MIN_EDGE = 900;

let workerPromise = null;

/**
 * The shared worker.
 *
 * Kept as a module-level promise rather than component state so that navigating
 * away from the scan page and back does not pay for the WASM compile again.
 * `disposeOcr()` tears it down when the page really is done with it.
 */
function getWorker(onProgress) {
  if (workerPromise) return workerPromise;

  workerPromise = (async () => {
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("eng", 1, {
      langPath: FAST_TESSDATA,
      // The model is cached by the browser after the first scan, so this cost
      // is paid once per device rather than once per prescription.
      cacheMethod: "write",
      logger: (m) => {
        if (m.status === "recognizing text") onProgress?.("reading", m.progress);
        else if (m.status?.includes("loading") || m.status?.includes("initializ")) {
          onProgress?.("loading", m.progress);
        }
      },
    });

    await worker.setParameters({
      // A prescription is one block of text, not a magazine page. Telling the
      // engine that skips the layout analysis pass entirely.
      tessedit_pageseg_mode: "6",
      // We threshold ourselves, above — see the header note.
      thresholding_method: "0",
      // Drug names are Latin letters, digits, and the handful of marks that
      // appear in a dose ("500mg", "1-0-1", "T.D.S."). Constraining the
      // character set cuts the search the LSTM decoder has to do and stops it
      // hallucinating punctuation out of paper texture.
      tessedit_char_whitelist:
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,-/()+%: ",
      // We only ever read `data.text`. Not building the hOCR, TSV and box
      // outputs saves a surprising amount of time on a long page.
      hocr: false,
      tsv: false,
      box: false,
      unlv: false,
      osd: false,
    });

    return worker;
  })().catch((err) => {
    // A failed init must not poison every later attempt with the same rejected
    // promise — clear it so a retry can genuinely retry.
    workerPromise = null;
    throw err;
  });

  return workerPromise;
}

/** Frees the WASM core and the model. Call when the scan page unmounts. */
export async function disposeOcr() {
  const pending = workerPromise;
  workerPromise = null;
  if (!pending) return;
  try {
    const worker = await pending;
    await worker.terminate();
  } catch {
    // Already gone, or never finished starting. Either way there is nothing
    // left to free.
  }
}

/** Decodes a File into a bitmap, preferring the off-main-thread path. */
async function toBitmap(file) {
  if (typeof createImageBitmap === "function") {
    // createImageBitmap decodes off the main thread, so the progress bar keeps
    // animating while a 12 MP JPEG is being unpacked.
    return createImageBitmap(file);
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error("The image could not be decoded."));
      img.src = url;
    });
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Otsu's method: the threshold that minimises within-class variance.
 *
 * A fixed threshold fails on exactly the photographs this app gets — paper in
 * shade, paper under a bare bulb, paper half in sunlight. Otsu picks the split
 * from the image's own histogram, so all three land in the right place.
 */
function otsuThreshold(histogram, total) {
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * histogram[i];

  let sumBackground = 0;
  let weightBackground = 0;
  let best = 0;
  let bestVariance = -1;

  for (let t = 0; t < 256; t++) {
    weightBackground += histogram[t];
    if (weightBackground === 0) continue;
    const weightForeground = total - weightBackground;
    if (weightForeground === 0) break;

    sumBackground += t * histogram[t];
    const meanBackground = sumBackground / weightBackground;
    const meanForeground = (sum - sumBackground) / weightForeground;
    const variance =
      weightBackground * weightForeground * (meanBackground - meanForeground) ** 2;

    if (variance > bestVariance) {
      bestVariance = variance;
      best = t;
    }
  }
  return best;
}

/**
 * Downscale → greyscale → contrast stretch → Otsu binarise.
 *
 * @returns {Promise<{blob: Blob, width: number, height: number, scale: number}>}
 */
export async function preprocess(file) {
  const bitmap = await toBitmap(file);
  const srcW = bitmap.width;
  const srcH = bitmap.height;
  const longEdge = Math.max(srcW, srcH);

  let scale = 1;
  if (longEdge > MAX_EDGE) scale = MAX_EDGE / longEdge;
  else if (longEdge < MIN_EDGE) scale = MIN_EDGE / longEdge;

  const width = Math.max(1, Math.round(srcW * scale));
  const height = Math.max(1, Math.round(srcH * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  // Downsampling a photograph without smoothing produces aliased strokes that
  // the recogniser reads as broken letters.
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const image = ctx.getImageData(0, 0, width, height);
  const data = image.data;
  const pixels = width * height;

  // Pass 1 — luminance, and the histogram both later passes need.
  const grey = new Uint8ClampedArray(pixels);
  const histogram = new Uint32Array(256);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const v = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) | 0;
    grey[p] = v;
    histogram[v]++;
  }

  // Pass 2 — percentile contrast stretch. Clipping at the 2nd and 98th
  // percentiles rather than the true min and max means one dark speck or one
  // blown highlight cannot flatten the whole page, which is what a naive
  // min/max stretch does to a photo with a shadow in the corner.
  const lowCut = pixels * 0.02;
  const highCut = pixels * 0.98;
  let acc = 0;
  let low = 0;
  let high = 255;
  for (let v = 0; v < 256; v++) {
    acc += histogram[v];
    if (acc >= lowCut) { low = v; break; }
  }
  acc = 0;
  for (let v = 0; v < 256; v++) {
    acc += histogram[v];
    if (acc >= highCut) { high = v; break; }
  }
  const span = Math.max(1, high - low);

  const stretched = new Uint8ClampedArray(pixels);
  const stretchedHistogram = new Uint32Array(256);
  for (let p = 0; p < pixels; p++) {
    const v = Math.max(0, Math.min(255, ((grey[p] - low) * 255) / span)) | 0;
    stretched[p] = v;
    stretchedHistogram[v]++;
  }

  // Pass 3 — binarise on the stretched histogram.
  const threshold = otsuThreshold(stretchedHistogram, pixels);
  for (let p = 0, i = 0; p < pixels; p++, i += 4) {
    const v = stretched[p] > threshold ? 255 : 0;
    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
    data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);

  // PNG, not JPEG: the image is now two-valued, and JPEG's ringing around a
  // hard black/white edge is precisely the artefact that turns an "l" into a "|".
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  return { blob, width, height, scale };
}

/**
 * Reads a prescription image on this device.
 *
 * Kept as the fallback path. It is private and works offline, and it is not
 * good enough at handwriting to be the primary — see `readPrescription`.
 */
export async function readOnDevice(file, onProgress) {
  const startedAt = performance.now();

  onProgress?.("preparing", 0);
  const prepared = await preprocess(file);
  onProgress?.("preparing", 1);

  const worker = await getWorker(onProgress);
  const { data } = await worker.recognize(prepared.blob);

  return {
    text: data.text || "",
    medicines: [],
    confidence: typeof data.confidence === "number" ? data.confidence / 100 : null,
    ms: Math.round(performance.now() - startedAt),
    prepared: { width: prepared.width, height: prepared.height, scale: prepared.scale },
    engine: OCR_ENGINE,
    onDevice: true,
  };
}

// ---------------------------------------------------------------------------
// Cloud path
// ---------------------------------------------------------------------------

/**
 * Prepares the image for upload.
 *
 * Deliberately NOT the binarised output of `preprocess()`. That pipeline exists
 * to help Tesseract, and everything it does actively hurts a vision model:
 * throwing away colour discards the ink/letterhead distinction, and hard
 * thresholding destroys the faint strokes of a pen — exactly the pixels the VLM
 * is better than Tesseract at interpreting. So the cloud path keeps the
 * greyscale-free, unthresholded image and only downscales it, which is here to
 * cut upload time on a rural connection rather than to aid recognition.
 */
async function prepareForUpload(file) {
  const bitmap = await toBitmap(file);
  const longEdge = Math.max(bitmap.width, bitmap.height);
  // Higher than the Tesseract path's 1800: a VLM does benefit from the extra
  // detail when resolving a cramped hand, and 2200 still keeps a photo under
  // roughly half a megabyte at this quality.
  const scale = longEdge > 2200 ? 2200 / longEdge : 1;

  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
  const base64 = await blobToBase64(blob);
  return { base64, mimeType: "image/jpeg", width, height, bytes: blob.size };
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    // Strip the data: prefix here rather than server-side — the server should
    // not have to guess what shape the client sent.
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = () => reject(new Error("The image could not be read."));
    reader.readAsDataURL(blob);
  });
}

/** Asks the server which engine is live. Cached — it cannot change mid-session. */
let statusPromise = null;
export function ocrStatus() {
  if (!statusPromise) {
    statusPromise = api.ocrStatus().catch(() => ({
      // If the status call itself fails the server is unreachable, so the
      // on-device engine is the only one that can work anyway.
      configured: false, provider: "tesseract", ...OCR_ENGINE, fallback: OCR_ENGINE,
    }));
  }
  return statusPromise;
}

/**
 * Reads a prescription, cloud-first with an on-device fallback.
 *
 * @param {File} file
 * @param {(phase, progress) => void} [onProgress]
 * @param {{ forceOnDevice?: boolean }} [options]
 */
export async function readPrescription(file, onProgress, options = {}) {
  const status = await ocrStatus();

  if (options.forceOnDevice || !status.configured) {
    return readOnDevice(file, onProgress);
  }

  const startedAt = performance.now();
  try {
    onProgress?.("preparing", 0);
    const prepared = await prepareForUpload(file);
    onProgress?.("preparing", 1);
    onProgress?.("uploading", 0);

    const result = await api.prescriptionOcr({
      imageBase64: prepared.base64,
      mimeType: prepared.mimeType,
    });

    onProgress?.("uploading", 1);

    return {
      text: result.text || "",
      medicines: result.medicines || [],
      handwritten: result.handwritten,
      quality: result.quality,
      notes: result.notes,
      confidence: result.confidence ?? null,
      ms: Math.round(performance.now() - startedAt),
      prepared: { width: prepared.width, height: prepared.height, bytes: prepared.bytes },
      engine: {
        engine: status.engine,
        model: result.model || status.model,
        mode: status.mode,
        where: status.where,
      },
      onDevice: false,
    };
  } catch (err) {
    // The cloud path failing must never mean the person cannot read their
    // prescription at all — fall through to the engine that needs no network.
    // The caller is told which path ran so the UI can say so honestly.
    onProgress?.("preparing", 0);
    const fallback = await readOnDevice(file, onProgress);
    return { ...fallback, degradedFrom: err.body?.error || err.message || "Cloud reading failed" };
  }
}
