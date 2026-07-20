# Social Photo Exporter

A small local browser app for uploading up to 150 photos, applying a logo, and exporting common social media image sizes.

## Open

Double-click `START-APP.cmd`. The app opens at `http://127.0.0.1:8765/` and enables reliable direct-to-folder batch exports.

The small launcher window closes after the app starts. This is normal; the private local service continues running in the background. Opening an exported folder can place File Explorer in front of the app, but the app remains open behind it.

For a standalone offline microapp, double-click `INSTALL-MICROAPP.cmd` once. It adds `Social Photo Exporter` to the Desktop. The shortcut starts the private local service and opens the app in its own Edge or Chrome window. No internet connection is required.

## Sizes

- Instagram Square: 1080 x 1080
- Instagram Portrait: 1080 x 1350
- Story / Reel: 1080 x 1920
- Facebook Link: 1200 x 630
- LinkedIn Feed: 1200 x 627
- X Landscape: 1600 x 900
- Pinterest Pin: 1000 x 1500
- YouTube Thumbnail: 1280 x 720

## Notes

Images are processed in the browser with canvas. Uploaded photos and logos stay on the computer.

Face-aware crop scans photos automatically after upload. It uses the browser's on-device face detector when available and includes a local tracking.js fallback for other browsers. Detected faces are kept inside a protected crop area; when a full-bleed crop cannot contain everyone, the app adds a softly blurred photo background instead of cutting a face. It detects face locations only and does not identify or name people.

Use `Save batch current size` or `Save batch all sizes` to write finished images directly into the app's `EXPORTS` folder. The app creates a new named folder for every batch and can open it when the export finishes.

ZIP exports save directly into a new folder under `EXPORTS` when the offline launcher is running. On a public web host, the same Save button falls back to a normal browser download.

The save button is always visible at the top of the `Export` panel. It shows what the app is waiting for, then changes to the exported filename when an image, ZIP, or MP4 is ready. Click it to open the system save dialog when supported or start a normal browser download.

Large ZIP downloads can take a few moments to finish copying. Wait until the browser's download indicator shows that the ZIP is complete before opening or extracting it.

The MP4 exporter creates a silent slideshow from the full photo batch in either 4:5 (1080 x 1350) or 9:16 (1080 x 1920). The 4:5 option uses the APCM portrait frame; the 9:16 option uses the APCM Story / Reel / TikTok frame. Both apply the same face-safe crop and transitions as the photo exporter. MP4 encoding runs locally in current Chrome and Edge browsers. The Save button writes the finished MP4 directly to a new folder under `EXPORTS`, avoiding unreliable browser downloads.

## APCM Frames

The included APCM transparent frame overlays are locked to these presets:

- Instagram Portrait: `frames/apcm-4x5.png`
- Story / Reel: `frames/apcm-story.png`
- Landscape 16:9, X Landscape, YouTube Thumbnail: `frames/apcm-16x9.png`

The photo is drawn first, then the APCM frame is drawn on top, so the logo and lines stay in the same place across the batch.

## Third-party code

The local face-detection fallback uses tracking.js 1.1.3 under its BSD license. Its license is included at `vendor/tracking/LICENSE.md`.

MP4 packaging uses mp4-muxer 5.2.1 under its MIT license. Its license is included at `vendor/mp4-muxer/LICENSE`.
