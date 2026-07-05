/*
 * Smart cropping: finds the best crop window of a given aspect ratio.
 *
 * Recognition pipeline:
 *  1. Face detection via the browser's FaceDetector API (Chrome/Edge). Detected
 *     faces are weighted heavily so people stay in frame.
 *  2. Saliency fallback that always runs: edge magnitude (Sobel), color
 *     saturation and skin-tone likelihood on a downscaled copy of the photo.
 *
 * Because the crop keeps the maximum possible area, it always spans the full
 * width or the full height of the photo, so only one axis needs searching.
 */
(function () {
  'use strict';

  const ANALYSIS_SIZE = 200; // longest side of the analysis canvas

  const faceDetector = ('FaceDetector' in window)
    ? new window.FaceDetector({ fastMode: true, maxDetectedFaces: 10 })
    : null;

  async function detectFaces(bitmap) {
    if (!faceDetector) return [];
    try {
      const faces = await faceDetector.detect(bitmap);
      return faces.map(f => f.boundingBox);
    } catch {
      return []; // unsupported source or platform quirk — saliency still applies
    }
  }

  /** Per-pixel saliency map of the downscaled image. */
  function saliencyMap(data, w, h) {
    const lum = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) {
      lum[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
    }

    const map = new Float32Array(w * h);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        // Sobel edge magnitude on luminance
        const gx = lum[i - w + 1] + 2 * lum[i + 1] + lum[i + w + 1]
                 - lum[i - w - 1] - 2 * lum[i - 1] - lum[i + w - 1];
        const gy = lum[i + w - 1] + 2 * lum[i + w] + lum[i + w + 1]
                 - lum[i - w - 1] - 2 * lum[i - w] - lum[i - w + 1];
        const edge = Math.sqrt(gx * gx + gy * gy) / 1442; // normalize to ~0..1

        const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
        const sat = mx === 0 ? 0 : (mx - mn) / mx;

        // crude skin-tone likelihood (helps when FaceDetector is unavailable)
        const skin = (r > 95 && g > 40 && b > 20 && r > g && r > b &&
                      (mx - mn) > 15 && Math.abs(r - g) > 15) ? 1 : 0;

        map[i] = edge * 1.0 + sat * 0.3 + skin * 0.8;
      }
    }
    return map;
  }

  /**
   * Compute the best crop of `ratio` (width/height) for a bitmap.
   * Returns {x, y, width, height} in source pixel coordinates.
   */
  async function smartCrop(bitmap, ratio, mode) {
    const sw = bitmap.width, sh = bitmap.height;

    // Maximum crop that fits the ratio
    let cw, ch;
    if (sw / sh > ratio) { ch = sh; cw = Math.round(sh * ratio); }
    else { cw = sw; ch = Math.round(sw / ratio); }

    const maxX = sw - cw, maxY = sh - ch;
    const centerCrop = { x: Math.round(maxX / 2), y: Math.round(maxY / 2), width: cw, height: ch };
    if (mode === 'center' || (maxX === 0 && maxY === 0)) return centerCrop;

    // --- analysis at reduced size ---
    const scale = ANALYSIS_SIZE / Math.max(sw, sh);
    const aw = Math.max(2, Math.round(sw * scale));
    const ah = Math.max(2, Math.round(sh * scale));
    const canvas = document.createElement('canvas');
    canvas.width = aw; canvas.height = ah;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(bitmap, 0, 0, aw, ah);
    const img = ctx.getImageData(0, 0, aw, ah);

    const map = saliencyMap(img.data, aw, ah);

    // stamp detected faces into the map with a strong weight
    const faces = await detectFaces(bitmap);
    for (const f of faces) {
      const fx0 = Math.max(0, Math.floor(f.x * scale));
      const fy0 = Math.max(0, Math.floor(f.y * scale));
      const fx1 = Math.min(aw, Math.ceil((f.x + f.width) * scale));
      const fy1 = Math.min(ah, Math.ceil((f.y + f.height) * scale));
      for (let y = fy0; y < fy1; y++) {
        for (let x = fx0; x < fx1; x++) map[y * aw + x] += 6;
      }
    }

    // --- 1-D search along the free axis using column/row sums ---
    const vertical = maxY > 0; // crop spans full width, slides vertically
    const n = vertical ? ah : aw;           // number of lines
    const lineSum = new Float32Array(n);
    for (let y = 0; y < ah; y++) {
      for (let x = 0; x < aw; x++) {
        lineSum[vertical ? y : x] += map[y * aw + x];
      }
    }

    const winSrc = vertical ? ch : cw;                      // window size in source px
    const win = Math.max(1, Math.min(n, Math.round(winSrc * scale)));
    const steps = n - win;
    if (steps <= 0) return centerCrop;

    // prefix sums for O(1) window scoring
    const prefix = new Float32Array(n + 1);
    for (let i = 0; i < n; i++) prefix[i + 1] = prefix[i] + lineSum[i];

    let bestOffset = 0, bestScore = -Infinity;
    for (let o = 0; o <= steps; o++) {
      const content = prefix[o + win] - prefix[o];
      // small bias toward the center so ties don't snap to an edge
      const centerBias = 1 - Math.abs(o - steps / 2) / (steps / 2 || 1);
      const score = content + centerBias * 0.02 * prefix[n];
      if (score > bestScore) { bestScore = score; bestOffset = o; }
    }

    const srcOffset = Math.round(bestOffset / scale);
    return vertical
      ? { x: 0, y: Math.min(maxY, srcOffset), width: cw, height: ch }
      : { x: Math.min(maxX, srcOffset), y: 0, width: cw, height: ch };
  }

  window.smartCrop = smartCrop;
})();
