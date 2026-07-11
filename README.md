# 📸 Social Media Logo Batcher

A small web app that prepares your photos for social media:

- **Upload up to 150 photos** at once (drag & drop or file picker)
- **Add your logo** — choose position, size, opacity and margin
- **Or use frame overlays** — upload a transparent PNG shaped like 4:5, 16:9 or 9:16 and the app recognizes it as a full frame, stretching it over every photo so your logo lands in exactly the same designed spot
- **Saved in your browser** — logos, frames and settings are remembered for your next visit
- **Export in social media ratios**: 4:5 (feed, 1080×1350), 16:9 (landscape, 1920×1080) and 9:16 (story/reel, 1080×1920)
- **Smart cropping** — the app detects faces and the main subject of each photo so the crop keeps them in frame (with a simple center-crop option too)
- **One ZIP download** with all processed images, organized in a folder per ratio

Everything runs **locally in your browser** — your photos and logo are never uploaded to any server.

## How to use it

1. Open the app (see below for options).
2. **Step 1** — drop in your logo (a PNG with a transparent background looks best) and pick where it should sit on the photo.
3. **Step 2** — drop in your photos (up to 150).
4. **Step 3** — tick the formats you want: 4:5, 16:9 and/or 9:16.
5. **Step 4** — check the live preview, then click **Process & download ZIP**.
6. Unzip the downloaded file — you'll find folders `4x5/`, `16x9/` and `9x16/` with the ready-to-post images.

## How to open the app

**Option A — GitHub Pages (recommended, one-time setup):**

1. On GitHub, open this repository and go to **Settings → Pages**.
2. Under "Build and deployment", set **Source** to "Deploy from a branch", pick the **main** branch and the **/ (root)** folder, then click **Save**.
3. After a minute your app is live at `https://<your-username>.github.io/socialmedialogo/` — bookmark it and use it from any device.

**Option B — open locally:**

Download the repository (green **Code** button → *Download ZIP*), unzip it, and double-click `index.html`. It opens in your browser and works fully offline.

## Notes

- Face detection uses the browser's built-in `FaceDetector` (Chrome and Edge). In other browsers the app automatically falls back to subject detection based on image analysis — smart cropping still works.
- Photos are processed one at a time so even a 150-photo batch won't freeze your browser. A progress bar shows the status.
- Output files are JPEG; you can adjust the quality in Step 3.

## Files

| File | Purpose |
|---|---|
| `index.html` | The app page |
| `styles.css` | Styling |
| `app.js` | Upload, settings, preview, batch processing and ZIP download |
| `smartcrop.js` | Face/subject detection and crop selection |
| `zip.js` | Minimal dependency-free ZIP writer |
