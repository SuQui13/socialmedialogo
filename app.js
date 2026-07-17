const MAX_PHOTOS = 150;
const DEFAULT_VIDEO_PRESET_ID = "instagram-portrait";
const VIDEO_FPS = 30;
const VIDEO_BITRATE = 6_000_000;
const LOCAL_EXPORT_SERVER = "http://127.0.0.1:8765";

const VIDEO_FORMATS = {
  "instagram-portrait": { ratio: "4:5", filename: "4x5" },
  "story-reel": { ratio: "9:16", filename: "9x16" },
};

const frameSources = {
  "apcm-4x5": "frames/apcm-4x5.png",
  "apcm-story": "frames/apcm-story.png",
  "apcm-16x9": "frames/apcm-16x9.png",
};

const presets = [
  { id: "instagram-square", name: "Instagram Square", note: "Feed post", width: 1080, height: 1080 },
  { id: "instagram-portrait", name: "Instagram Portrait", note: "APCM 4:5 frame", width: 1080, height: 1350, frameId: "apcm-4x5" },
  { id: "story-reel", name: "Story / Reel", note: "APCM story frame", width: 1080, height: 1920, frameId: "apcm-story" },
  { id: "apcm-16x9", name: "Landscape 16:9", note: "Locked APCM frame", width: 1920, height: 1080, frameId: "apcm-16x9" },
  { id: "facebook-link", name: "Facebook Link", note: "Landscape share", width: 1200, height: 630 },
  { id: "linkedin-feed", name: "LinkedIn Feed", note: "Shared image", width: 1200, height: 627 },
  { id: "x-landscape", name: "X Landscape", note: "APCM landscape frame", width: 1600, height: 900, frameId: "apcm-16x9" },
  { id: "pinterest-pin", name: "Pinterest Pin", note: "Tall pin", width: 1000, height: 1500 },
  { id: "youtube-thumb", name: "YouTube Thumbnail", note: "APCM landscape frame", width: 1280, height: 720, frameId: "apcm-16x9" },
];

const state = {
  presetId: presets[0].id,
  fit: "cover",
  activeLayer: "photo",
  photos: [],
  activePhotoId: null,
  logo: null,
  frameEnabled: true,
  frames: {},
  frameStatus: "loading",
  logoPosition: { x: 0.86, y: 0.86 },
  logoSize: 0.18,
  logoOpacity: 1,
  logoRotation: 0,
  faceAware: true,
  faceDetector: null,
  faceEngine: "",
  faceSupport: "checking",
  scanInProgress: false,
  exporting: false,
  format: "png",
  background: "#ffffff",
  transparent: false,
  jpegQuality: 0.92,
  videoPresetId: DEFAULT_VIDEO_PRESET_ID,
  videoTransition: "fade",
  videoPhotoDuration: 2,
  videoTransitionDuration: 0.6,
  videoSupport: "checking",
  videoConfig: null,
  videoExporting: false,
  videoCancelRequested: false,
  videoMessage: "Checking MP4 support...",
  readyDownload: null,
  folderExportSupport: "checking",
  folderExportMessage: "Connecting to local folder...",
  lastFolderExport: null,
};

const els = {
  presetList: document.querySelector("#presetList"),
  canvas: document.querySelector("#previewCanvas"),
  photoInput: document.querySelector("#photoInput"),
  logoInput: document.querySelector("#logoInput"),
  photoName: document.querySelector("#photoName"),
  logoName: document.querySelector("#logoName"),
  frameEnabled: document.querySelector("#frameEnabled"),
  frameStatus: document.querySelector("#frameStatus"),
  photoList: document.querySelector("#photoList"),
  batchCount: document.querySelector("#batchCount"),
  faceSummary: document.querySelector("#faceSummary"),
  faceStatus: document.querySelector("#faceStatus"),
  faceAwareCrop: document.querySelector("#faceAwareCrop"),
  scanCurrent: document.querySelector("#scanCurrent"),
  scanBatch: document.querySelector("#scanBatch"),
  activePresetName: document.querySelector("#activePresetName"),
  activePresetSize: document.querySelector("#activePresetSize"),
  activePhotoMeta: document.querySelector("#activePhotoMeta"),
  statusText: document.querySelector("#statusText"),
  downloadCurrent: document.querySelector("#downloadCurrent"),
  downloadAll: document.querySelector("#downloadAll"),
  downloadBatchCurrent: document.querySelector("#downloadBatchCurrent"),
  downloadBatchAll: document.querySelector("#downloadBatchAll"),
  exportVideo: document.querySelector("#exportVideo"),
  videoExportSize: document.querySelector("#videoExportSize"),
  videoExportButtonText: document.querySelector("#videoExportButtonText"),
  videoFormatButtons: Array.from(document.querySelectorAll(".video-format-button")),
  cancelVideo: document.querySelector("#cancelVideo"),
  videoTransition: document.querySelector("#videoTransition"),
  videoPhotoDuration: document.querySelector("#videoPhotoDuration"),
  videoTransitionDuration: document.querySelector("#videoTransitionDuration"),
  videoProgress: document.querySelector("#videoProgress"),
  videoStatus: document.querySelector("#videoStatus"),
  saveReady: document.querySelector("#saveReady"),
  saveReadyName: document.querySelector("#saveReadyName"),
  exportFolderCurrent: document.querySelector("#exportFolderCurrent"),
  exportFolderAll: document.querySelector("#exportFolderAll"),
  openExportFolder: document.querySelector("#openExportFolder"),
  folderExportStatus: document.querySelector("#folderExportStatus"),
  photoZoom: document.querySelector("#photoZoom"),
  photoZoomValue: document.querySelector("#photoZoomValue"),
  photoX: document.querySelector("#photoX"),
  photoXValue: document.querySelector("#photoXValue"),
  photoY: document.querySelector("#photoY"),
  photoYValue: document.querySelector("#photoYValue"),
  logoSize: document.querySelector("#logoSize"),
  logoSizeValue: document.querySelector("#logoSizeValue"),
  logoOpacity: document.querySelector("#logoOpacity"),
  logoOpacityValue: document.querySelector("#logoOpacityValue"),
  logoRotation: document.querySelector("#logoRotation"),
  logoRotationValue: document.querySelector("#logoRotationValue"),
  centerPhoto: document.querySelector("#centerPhoto"),
  removeLogo: document.querySelector("#removeLogo"),
  formatSelect: document.querySelector("#formatSelect"),
  backgroundColor: document.querySelector("#backgroundColor"),
  transparentBg: document.querySelector("#transparentBg"),
  jpegQuality: document.querySelector("#jpegQuality"),
  jpegQualityValue: document.querySelector("#jpegQualityValue"),
  resetAll: document.querySelector("#resetAll"),
  anchorGrid: document.querySelector("#anchorGrid"),
};

let drag = null;
let photoIdSeed = 0;
let crcTable = null;
let videoConfigRequestId = 0;

function activePreset() {
  return presets.find((preset) => preset.id === state.presetId) || presets[0];
}

function activePhoto() {
  return state.photos.find((photo) => photo.id === state.activePhotoId) || state.photos[0] || null;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function delay(ms = 0) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shortName(name, max = 24) {
  if (!name) return "Untitled";
  return name.length > max ? `${name.slice(0, max - 3)}...` : name;
}

function plural(count, word) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function setStatus(message) {
  els.statusText.textContent = message;
}

function setFaceStatus(message) {
  els.faceStatus.textContent = message;
}

function setFrameStatus(message) {
  els.frameStatus.textContent = message;
}

function setVideoStatus(message) {
  state.videoMessage = message;
  els.videoStatus.textContent = message;
}

function setFolderExportStatus(message) {
  state.folderExportMessage = message;
  els.folderExportStatus.textContent = message;
}

function folderApiUrl(path) {
  const isLocalApp = location.protocol === "http:" && location.hostname === "127.0.0.1" && location.port === "8765";
  return `${isLocalApp ? "" : LOCAL_EXPORT_SERVER}${path}`;
}

async function folderRequest(path, options = {}) {
  const response = await fetch(folderApiUrl(path), { cache: "no-store", ...options });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "The local export folder is unavailable.");
  return payload;
}

async function setupFolderExport() {
  state.folderExportSupport = "checking";
  setFolderExportStatus("Connecting to local folder...");
  syncControls();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1800);
  try {
    await folderRequest("/api/status", { signal: controller.signal });
    state.folderExportSupport = "ready";
    setFolderExportStatus("Direct folder export ready.");
    return true;
  } catch {
    state.folderExportSupport = "unavailable";
    setFolderExportStatus("Double-click START-APP.cmd to enable folder export.");
    return false;
  } finally {
    clearTimeout(timeout);
    syncControls();
  }
}

function fileLabel(file) {
  if (!file) return "Choose image";
  return shortName(file.name, 22);
}

function currentFrame(preset = activePreset()) {
  if (!state.frameEnabled || !preset.frameId) return null;
  return state.frames[preset.frameId] || null;
}

function loadFrame(id, src) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve({ id, image, loaded: true });
    image.onerror = () => resolve({ id, image: null, loaded: false });
    image.src = src;
  });
}

async function loadFrameAssets() {
  const entries = Object.entries(frameSources);
  const loaded = await Promise.all(entries.map(([id, src]) => loadFrame(id, src)));
  state.frames = {};
  loaded.forEach((frame) => {
    if (frame.loaded) state.frames[frame.id] = frame.image;
  });

  const count = Object.keys(state.frames).length;
  state.frameStatus = count === entries.length ? "ready" : "partial";
  setFrameStatus(count ? `${count}/${entries.length} APCM frames ready.` : "APCM frames could not be loaded.");
  syncControls();
  renderPreview();
}

function clearPhotos() {
  state.photos.forEach((photo) => {
    releasePhotoImage(photo, true);
    URL.revokeObjectURL(photo.url);
  });
  state.photos = [];
  state.activePhotoId = null;
  els.photoInput.value = "";
}

function createPhotoThumbnail(image) {
  const size = 96;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d", { alpha: false });
  context.fillStyle = "#f2eee5";
  context.fillRect(0, 0, size, size);
  const placement = fitRect(image.naturalWidth || image.width, image.naturalHeight || image.height, size, size, "cover");
  context.drawImage(image, (size - placement.width) / 2, (size - placement.height) / 2, placement.width, placement.height);
  const thumbnail = canvas.toDataURL("image/jpeg", 0.76);
  canvas.width = 0;
  canvas.height = 0;
  return thumbnail;
}

function releasePhotoImage(photo, force = false) {
  if (!photo?.image || (!force && photo.id === state.activePhotoId)) return;
  photo.image.onload = null;
  photo.image.onerror = null;
  photo.image.removeAttribute("src");
  photo.image = null;
}

function ensurePhotoImage(photo) {
  if (photo.image?.complete && photo.image.naturalWidth) return Promise.resolve(photo.image);
  if (photo.imagePromise) return photo.imagePromise;

  photo.imagePromise = new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      photo.image = image;
      photo.imagePromise = null;
      resolve(image);
    };
    image.onerror = () => {
      photo.imagePromise = null;
      reject(new Error(`Could not reopen ${photo.name}`));
    };
    image.src = photo.url;
  });

  return photo.imagePromise;
}

function photoDefaults(file, image, url, index) {
  return {
    id: `photo-${++photoIdSeed}`,
    file,
    image,
    url,
    name: file.name,
    index,
    sourceWidth: image.naturalWidth || image.width,
    sourceHeight: image.naturalHeight || image.height,
    thumbnail: createPhotoThumbnail(image),
    imagePromise: null,
    zoom: 1,
    offset: { x: 0, y: 0 },
    faces: null,
    faceStatus: "waiting",
    faceError: "",
  };
}

function loadImageFile(file, index) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    const url = URL.createObjectURL(file);

    image.onload = () => resolve(photoDefaults(file, image, url, index));
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Could not open ${file.name}`));
    };
    image.src = url;
  });
}

async function loadPhotoBatch(fileList) {
  const imageFiles = Array.from(fileList || []).filter((file) => file.type.startsWith("image/"));
  if (!imageFiles.length) return;

  const limited = imageFiles.slice(0, MAX_PHOTOS);
  const skipped = imageFiles.length - limited.length;

  clearPhotos();
  syncControls();
  renderPreview();

  for (let index = 0; index < limited.length; index += 1) {
    setStatus(`Loading ${index + 1}/${limited.length}...`);
    try {
      const photo = await loadImageFile(limited[index], index);
      state.photos.push(photo);
      if (!state.activePhotoId) state.activePhotoId = photo.id;
      else releasePhotoImage(photo);
      renderPhotoList();
      syncControls();
      renderPreview();
    } catch (error) {
      setStatus(error.message);
    }
    await delay();
  }

  const loaded = state.photos.length;
  const tail = skipped > 0 ? ` ${skipped} skipped.` : "";
  setStatus(`${plural(loaded, "photo")} loaded.${tail}`);
  syncControls();
  renderPreview();

  if (loaded && canDetectFaces() && state.faceAware) {
    await scanBatchPhotos({ automatic: true });
  }
}

function loadLogo(file) {
  if (!file) return;

  const image = new Image();
  const url = URL.createObjectURL(file);

  image.onload = () => {
    if (state.logo?.url) URL.revokeObjectURL(state.logo.url);
    state.logo = { image, url, name: file.name };
    state.activeLayer = "logo";
    els.logoName.textContent = fileLabel(file);
    setStatus("Logo loaded.");
    syncControls();
    renderPreview();
  };

  image.onerror = () => {
    URL.revokeObjectURL(url);
    setStatus("That logo could not be opened.");
  };

  image.src = url;
}

function buildPresets() {
  els.presetList.innerHTML = "";
  presets.forEach((preset) => {
    const button = document.createElement("button");
    button.className = "preset-button";
    button.type = "button";
    button.dataset.preset = preset.id;
    button.innerHTML = `
      <strong>${preset.name}</strong>
      <span>${preset.width}x${preset.height}</span>
      <small>${preset.note}</small>
    `;
    button.addEventListener("click", () => {
      state.presetId = preset.id;
      syncControls();
      renderPreview();
    });
    els.presetList.append(button);
  });
}

function renderPhotoList() {
  els.photoList.innerHTML = "";

  if (!state.photos.length) {
    const empty = document.createElement("div");
    empty.className = "mini-status";
    empty.textContent = "No photos selected.";
    els.photoList.append(empty);
    return;
  }

  const fragment = document.createDocumentFragment();

  state.photos.forEach((photo, index) => {
    const button = document.createElement("button");
    button.className = "photo-item";
    button.classList.toggle("active", photo.id === state.activePhotoId);
    button.type = "button";

    const thumb = document.createElement("span");
    thumb.className = "photo-thumb";
    const img = document.createElement("img");
    img.src = photo.thumbnail;
    img.alt = "";
    img.loading = "lazy";
    img.decoding = "async";
    thumb.append(img);

    const main = document.createElement("span");
    main.className = "photo-main";
    const title = document.createElement("strong");
    title.textContent = `${String(index + 1).padStart(3, "0")} ${shortName(photo.name, 22)}`;
    const meta = document.createElement("small");
    meta.textContent = `${photo.sourceWidth}x${photo.sourceHeight}`;
    main.append(title, meta);

    const pill = document.createElement("span");
    pill.className = `face-pill ${photo.faceStatus}`;
    pill.textContent = faceLabel(photo);

    button.append(thumb, main, pill);
    button.addEventListener("click", async () => {
      const previous = activePhoto();
      state.activePhotoId = photo.id;
      renderPhotoList();
      syncControls();
      try {
        await ensurePhotoImage(photo);
        if (state.activePhotoId !== photo.id) {
          releasePhotoImage(photo);
          return;
        }
        releasePhotoImage(previous);
        renderPreview();
      } catch (error) {
        setStatus(error.message || "That photo could not be reopened.");
      }
    });
    fragment.append(button);
  });

  els.photoList.append(fragment);
}

function faceLabel(photo) {
  if (photo.faceStatus === "scanning") return "Scanning";
  if (photo.faceStatus === "detected") return plural(photo.faces.length, "face");
  if (photo.faceStatus === "none") return "No faces";
  if (photo.faceStatus === "error") return "Error";
  if (photo.faceStatus === "unsupported") return "Off";
  return "Waiting";
}

function faceSummaryText() {
  if (!state.photos.length) return "Face scan waiting";
  const detected = state.photos.filter((photo) => photo.faces?.length).length;
  const scanned = state.photos.filter((photo) =>
    ["detected", "none", "error", "unsupported"].includes(photo.faceStatus)
  ).length;
  return `${detected} with faces, ${scanned}/${state.photos.length} scanned`;
}

function canDetectFaces() {
  return state.faceSupport === "ready" && Boolean(state.faceDetector);
}

function syncControls() {
  const preset = activePreset();
  const selectedVideoPreset = videoPreset();
  const selectedVideoFormat = videoFormat();
  const photo = activePhoto();
  const hasPhoto = Boolean(photo);
  const hasBatch = state.photos.length > 0;
  const busy = state.exporting || state.scanInProgress;
  const videoReady = state.videoSupport === "ready" && Boolean(state.videoConfig);
  const folderReady = state.folderExportSupport === "ready";

  els.activePresetName.textContent = preset.name;
  els.activePresetSize.textContent = `${preset.width} x ${preset.height}`;
  els.activePhotoMeta.textContent = photo ? shortName(photo.name, 56) : "No photo selected";
  els.frameEnabled.checked = state.frameEnabled;
  els.frameEnabled.disabled = state.frameStatus === "loading" || state.exporting;
  els.photoInput.disabled = busy;
  els.logoInput.disabled = state.exporting;

  if (state.frameStatus === "loading") {
    setFrameStatus("Loading frames...");
  } else if (!state.frameEnabled) {
    setFrameStatus("APCM frame is off.");
  } else if (preset.frameId && currentFrame(preset)) {
    setFrameStatus("APCM frame locked for this size.");
  } else if (preset.frameId) {
    setFrameStatus("Frame file missing for this size.");
  } else {
    setFrameStatus("No APCM frame for this size.");
  }

  els.photoName.textContent = hasBatch ? `${state.photos.length}/${MAX_PHOTOS} selected` : "Choose up to 150";
  els.batchCount.textContent = plural(state.photos.length, "photo");
  els.faceSummary.textContent = faceSummaryText();

  els.downloadCurrent.disabled = !hasPhoto || busy;
  els.downloadAll.disabled = !hasPhoto || busy;
  els.downloadBatchCurrent.disabled = !hasBatch || busy;
  els.downloadBatchAll.disabled = !hasBatch || busy;
  els.exportFolderCurrent.disabled = !hasBatch || busy || !folderReady;
  els.exportFolderAll.disabled = !hasBatch || busy || !folderReady;
  els.openExportFolder.hidden = !state.lastFolderExport;
  els.openExportFolder.disabled = busy;
  els.folderExportStatus.textContent = state.folderExportMessage;
  els.exportVideo.disabled = !hasBatch || busy || !videoReady || state.frameStatus === "loading";
  if (!state.readyDownload) {
    els.saveReady.disabled = true;
    if (state.exporting) {
      els.saveReadyName.textContent = "Preparing file...";
    } else if (state.scanInProgress) {
      els.saveReadyName.textContent = "Waiting for face scan...";
    } else if (!hasPhoto) {
      els.saveReadyName.textContent = "Upload photos first";
    } else {
      els.saveReadyName.textContent = "Choose an export option";
    }
  }
  els.cancelVideo.hidden = !state.videoExporting;
  els.cancelVideo.disabled = !state.videoExporting;
  els.videoProgress.hidden = !state.videoExporting;
  els.videoStatus.textContent = state.videoMessage;
  els.videoExportSize.textContent = `${selectedVideoFormat.ratio} / ${selectedVideoPreset.width}x${selectedVideoPreset.height}`;
  els.videoExportButtonText.textContent = `Export ${selectedVideoFormat.ratio} MP4`;
  els.videoTransition.value = state.videoTransition;
  els.videoPhotoDuration.value = String(state.videoPhotoDuration);
  els.videoTransitionDuration.value = String(state.videoTransitionDuration);
  [els.videoTransition, els.videoPhotoDuration, els.videoTransitionDuration, ...els.videoFormatButtons].forEach((control) => {
    control.disabled = busy;
  });
  els.videoFormatButtons.forEach((button) => {
    const active = button.dataset.videoPreset === state.videoPresetId;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  els.scanCurrent.disabled = !hasPhoto || !canDetectFaces() || busy;
  els.scanBatch.disabled = !hasBatch || !canDetectFaces() || busy;
  els.faceAwareCrop.disabled = !canDetectFaces() && !state.photos.some((item) => item.faces?.length);

  document.querySelectorAll(".preset-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.preset === state.presetId);
  });

  document.querySelectorAll(".segment").forEach((button) => {
    button.classList.toggle("active", button.dataset.fit === state.fit);
  });

  document.querySelectorAll(".layer-toggle button").forEach((button) => {
    button.classList.toggle("active", button.dataset.layer === state.activeLayer);
  });

  const zoom = photo?.zoom ?? 1;
  const offset = photo?.offset ?? { x: 0, y: 0 };
  els.photoZoom.value = Math.round(zoom * 100);
  els.photoZoomValue.textContent = `${Math.round(zoom * 100)}%`;
  els.photoX.value = Math.round(offset.x * 100);
  els.photoXValue.textContent = `${Math.round(offset.x * 100)}`;
  els.photoY.value = Math.round(offset.y * 100);
  els.photoYValue.textContent = `${Math.round(offset.y * 100)}`;

  [els.photoZoom, els.photoX, els.photoY, els.centerPhoto].forEach((control) => {
    control.disabled = !hasPhoto || state.exporting;
  });

  els.logoSize.value = Math.round(state.logoSize * 100);
  els.logoSizeValue.textContent = `${Math.round(state.logoSize * 100)}%`;
  els.logoOpacity.value = Math.round(state.logoOpacity * 100);
  els.logoOpacityValue.textContent = `${Math.round(state.logoOpacity * 100)}%`;
  els.logoRotation.value = state.logoRotation;
  els.logoRotationValue.textContent = `${state.logoRotation} deg`;

  els.faceAwareCrop.checked = state.faceAware;
  els.formatSelect.value = state.format;
  els.backgroundColor.value = state.background;
  els.transparentBg.checked = state.transparent;
  els.jpegQuality.value = Math.round(state.jpegQuality * 100);
  els.jpegQualityValue.textContent = `${Math.round(state.jpegQuality * 100)}%`;
  document.querySelector(".quality-field").classList.toggle("hidden", state.format !== "jpeg");
  els.transparentBg.disabled = state.format !== "png";

  syncAnchorButtons();
  renderPhotoList();
}

function syncAnchorButtons() {
  const nearest = nearestAnchor(state.logoPosition.x, state.logoPosition.y);
  els.anchorGrid.querySelectorAll("button").forEach((button) => {
    button.classList.toggle("active", button.dataset.anchor === nearest);
  });
}

function renderPreview() {
  drawComposition(els.canvas, activePreset(), { preview: true, photo: activePhoto() });
}

function drawComposition(canvas, preset, options = {}) {
  const photo = options.photo ?? activePhoto();
  canvas.width = preset.width;
  canvas.height = preset.height;
  const localCtx = canvas.getContext("2d", { alpha: true });
  localCtx.clearRect(0, 0, preset.width, preset.height);

  const shouldFill = options.forceOpaque || state.format === "jpeg" || !state.transparent || (options.preview && !photo);
  if (shouldFill) {
    localCtx.fillStyle = options.preview && !photo ? "#f2eee5" : state.background;
    localCtx.fillRect(0, 0, preset.width, preset.height);
  }

  if (photo) {
    const placement = drawPhoto(localCtx, preset, photo);
    if (options.preview && state.faceAware && photo.faces?.length) {
      drawFaceGuides(localCtx, photo, placement);
    }
  } else if (options.preview) {
    drawEmptyState(localCtx, preset);
  }

  if (state.logo) {
    drawLogo(localCtx, preset);
  }

  drawFrame(localCtx, preset);
}

function drawEmptyState(localCtx, preset) {
  const { width, height } = preset;
  localCtx.save();
  localCtx.fillStyle = "#e8e2d6";
  const inset = Math.min(width, height) * 0.12;
  localCtx.fillRect(inset, inset, width - inset * 2, height - inset * 2);

  localCtx.strokeStyle = "#c7beaf";
  localCtx.lineWidth = Math.max(4, Math.min(width, height) * 0.006);
  localCtx.strokeRect(inset, inset, width - inset * 2, height - inset * 2);

  localCtx.fillStyle = "#6c6d70";
  localCtx.font = `700 ${Math.round(Math.min(width, height) * 0.052)}px system-ui, sans-serif`;
  localCtx.textAlign = "center";
  localCtx.textBaseline = "middle";
  localCtx.fillText("Add photos", width / 2, height / 2);
  localCtx.restore();
}

function drawPhoto(localCtx, preset, photo) {
  const placement = photoPlacement(photo, preset);
  if (placement.needsBackdrop) drawPhotoBackdrop(localCtx, preset, photo);
  localCtx.drawImage(photo.image, placement.x, placement.y, placement.width, placement.height);
  return placement;
}

function drawPhotoBackdrop(localCtx, preset, photo) {
  const image = photo.image;
  const base = fitRect(image.width, image.height, preset.width, preset.height, "cover");
  const overscan = 1.08;
  const width = base.width * overscan;
  const height = base.height * overscan;

  localCtx.save();
  localCtx.filter = `blur(${Math.max(12, Math.round(Math.min(preset.width, preset.height) * 0.025))}px)`;
  localCtx.drawImage(image, (preset.width - width) / 2, (preset.height - height) / 2, width, height);
  localCtx.filter = "none";
  localCtx.fillStyle = "rgba(0, 0, 0, 0.1)";
  localCtx.fillRect(0, 0, preset.width, preset.height);
  localCtx.restore();
}

function photoPlacement(photo, preset) {
  const image = photo.image;
  const base = fitRect(image.width, image.height, preset.width, preset.height, state.fit);
  const drawWidth = base.width * photo.zoom;
  const drawHeight = base.height * photo.zoom;

  if (state.faceAware && photo.faces?.length) {
    return faceSafePlacement(photo, preset, drawWidth);
  }

  let offsetX = photo.offset.x;
  let offsetY = photo.offset.y;

  if (state.fit === "cover") {
    offsetX = clampOffsetForFill(offsetX, drawWidth, preset.width);
    offsetY = clampOffsetForFill(offsetY, drawHeight, preset.height);
  } else {
    offsetX = clamp(offsetX, -0.6, 0.6);
    offsetY = clamp(offsetY, -0.6, 0.6);
  }

  return {
    x: (preset.width - drawWidth) / 2 + offsetX * preset.width,
    y: (preset.height - drawHeight) / 2 + offsetY * preset.height,
    width: drawWidth,
    height: drawHeight,
    offsetX,
    offsetY,
    needsBackdrop: false,
  };
}

function clampOffsetForFill(offset, drawSize, targetSize) {
  const max = Math.max(0, (drawSize - targetSize) / (2 * targetSize));
  return clamp(offset, -max, max);
}

function faceSafeBounds(preset) {
  const side = preset.width * 0.055;
  const top = preset.height * 0.055;
  const bottom = preset.height * (preset.frameId ? 0.14 : 0.07);

  return {
    left: side,
    top,
    right: preset.width - side,
    bottom: preset.height - bottom,
  };
}

function chooseSafeAxis(desired, faceStart, faceEnd, safeStart, safeEnd, fillStart, fillEnd) {
  const faceMin = safeStart - faceStart;
  const faceMax = safeEnd - faceEnd;
  const intersectionMin = Math.max(faceMin, Math.min(fillStart, fillEnd));
  const intersectionMax = Math.min(faceMax, Math.max(fillStart, fillEnd));

  if (intersectionMin <= intersectionMax) {
    return clamp(desired, intersectionMin, intersectionMax);
  }

  return clamp(desired, faceMin, faceMax);
}

function faceSafePlacement(photo, preset, requestedWidth) {
  const group = faceGroup(photo);
  const image = photo.image;
  const safe = faceSafeBounds(preset);
  const safeWidth = safe.right - safe.left;
  const safeHeight = safe.bottom - safe.top;
  const requestedScale = requestedWidth / image.width;
  const faceScaleLimit = Math.min(safeWidth / group.width, safeHeight / group.height);
  const scale = Math.min(requestedScale, faceScaleLimit);
  const width = image.width * scale;
  const height = image.height * scale;
  const desiredX = (preset.width - width) / 2 + photo.offset.x * preset.width;
  const desiredY = (preset.height - height) / 2 + photo.offset.y * preset.height;

  const x = chooseSafeAxis(
    desiredX,
    group.x * scale,
    (group.x + group.width) * scale,
    safe.left,
    safe.right,
    preset.width - width,
    0
  );
  const y = chooseSafeAxis(
    desiredY,
    group.y * scale,
    (group.y + group.height) * scale,
    safe.top,
    safe.bottom,
    preset.height - height,
    0
  );
  const epsilon = 0.5;

  return {
    x,
    y,
    width,
    height,
    offsetX: (x - (preset.width - width) / 2) / preset.width,
    offsetY: (y - (preset.height - height) / 2) / preset.height,
    needsBackdrop:
      x > epsilon ||
      y > epsilon ||
      x + width < preset.width - epsilon ||
      y + height < preset.height - epsilon,
  };
}

function drawFaceGuides(localCtx, photo, placement) {
  localCtx.save();
  localCtx.strokeStyle = "rgba(23, 109, 115, 0.88)";
  localCtx.fillStyle = "rgba(23, 109, 115, 0.12)";
  localCtx.lineWidth = Math.max(3, Math.min(placement.width, placement.height) * 0.004);

  photo.faces.forEach((face) => {
    const x = placement.x + (face.x / photo.image.width) * placement.width;
    const y = placement.y + (face.y / photo.image.height) * placement.height;
    const width = (face.width / photo.image.width) * placement.width;
    const height = (face.height / photo.image.height) * placement.height;
    localCtx.fillRect(x, y, width, height);
    localCtx.strokeRect(x, y, width, height);
  });
  localCtx.restore();
}

function fitRect(sourceWidth, sourceHeight, targetWidth, targetHeight, mode) {
  const sourceRatio = sourceWidth / sourceHeight;
  const targetRatio = targetWidth / targetHeight;
  const useWidth = mode === "cover" ? sourceRatio < targetRatio : sourceRatio > targetRatio;
  const width = useWidth ? targetWidth : targetHeight * sourceRatio;
  const height = useWidth ? targetWidth / sourceRatio : targetHeight;
  return { width, height };
}

function faceGroup(photo) {
  if (!photo.faces?.length) return null;

  const minX = Math.min(...photo.faces.map((face) => face.x));
  const minY = Math.min(...photo.faces.map((face) => face.y));
  const maxX = Math.max(...photo.faces.map((face) => face.x + face.width));
  const maxY = Math.max(...photo.faces.map((face) => face.y + face.height));
  const padX = (maxX - minX) * 0.18;
  const padY = (maxY - minY) * 0.28;

  const left = clamp(minX - padX, 0, photo.image.width);
  const top = clamp(minY - padY, 0, photo.image.height);
  const right = clamp(maxX + padX, 0, photo.image.width);
  const bottom = clamp(maxY + padY, 0, photo.image.height);

  return { x: left, y: top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) };
}

function logoMetrics(preset) {
  if (!state.logo) return null;
  const image = state.logo.image;
  const width = preset.width * state.logoSize;
  const height = width * (image.height / image.width);
  return {
    x: state.logoPosition.x * preset.width,
    y: state.logoPosition.y * preset.height,
    width,
    height,
  };
}

function drawLogo(localCtx, preset) {
  const metrics = logoMetrics(preset);
  if (!metrics) return;

  localCtx.save();
  localCtx.globalAlpha = state.logoOpacity;
  localCtx.translate(metrics.x, metrics.y);
  localCtx.rotate((state.logoRotation * Math.PI) / 180);
  localCtx.drawImage(
    state.logo.image,
    -metrics.width / 2,
    -metrics.height / 2,
    metrics.width,
    metrics.height
  );
  localCtx.restore();
}

function drawFrame(localCtx, preset) {
  const frame = currentFrame(preset);
  if (!frame) return;
  localCtx.drawImage(frame, 0, 0, preset.width, preset.height);
}

function pointFromEvent(event) {
  const rect = els.canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) / rect.width,
    y: (event.clientY - rect.top) / rect.height,
  };
}

function hitLogo(point) {
  const preset = activePreset();
  const metrics = logoMetrics(preset);
  if (!metrics) return false;

  const centerX = metrics.x / preset.width;
  const centerY = metrics.y / preset.height;
  const halfW = metrics.width / preset.width / 2;
  const halfH = metrics.height / preset.height / 2;
  const padding = 0.03;

  return (
    point.x >= centerX - halfW - padding &&
    point.x <= centerX + halfW + padding &&
    point.y >= centerY - halfH - padding &&
    point.y <= centerY + halfH + padding
  );
}

function beginDrag(event) {
  const photo = activePhoto();
  if (!photo && !state.logo) return;
  const point = pointFromEvent(event);
  const layer = state.logo && (state.activeLayer === "logo" || hitLogo(point)) ? "logo" : "photo";

  state.activeLayer = layer;
  drag = { layer, last: point };
  els.canvas.setPointerCapture(event.pointerId);
  syncControls();
}

function updateDrag(event) {
  if (!drag) return;
  const photo = activePhoto();
  const point = pointFromEvent(event);
  const dx = point.x - drag.last.x;
  const dy = point.y - drag.last.y;

  if (drag.layer === "logo") {
    state.logoPosition.x = clamp(state.logoPosition.x + dx, -0.2, 1.2);
    state.logoPosition.y = clamp(state.logoPosition.y + dy, -0.2, 1.2);
  } else if (photo) {
    photo.offset.x = clamp(photo.offset.x + dx, -0.6, 0.6);
    photo.offset.y = clamp(photo.offset.y + dy, -0.6, 0.6);
  }

  drag.last = point;
  syncControls();
  renderPreview();
}

function endDrag() {
  drag = null;
}

function nearestAnchor(x, y) {
  const columns = x < 0.34 ? "l" : x > 0.66 ? "r" : "c";
  const rows = y < 0.34 ? "t" : y > 0.66 ? "b" : "c";
  return `${rows}${columns}`;
}

function setAnchor(anchor) {
  const margin = Math.max(0.08, state.logoSize / 2 + 0.04);
  const xMap = { l: margin, c: 0.5, r: 1 - margin };
  const yMap = { t: margin, c: 0.5, b: 1 - margin };
  state.logoPosition.x = xMap[anchor[1]];
  state.logoPosition.y = yMap[anchor[0]];
  state.activeLayer = "logo";
  syncControls();
  renderPreview();
}

function createTrackingFaceDetector() {
  const tracker = new tracking.ObjectTracker("face");
  tracker.setInitialScale(1.5);
  tracker.setScaleFactor(1.25);
  tracker.setStepSize(2);
  tracker.setEdgesDensity(0.18);

  return {
    async detect(image) {
      const maxDimension = 720;
      const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
      const width = Math.max(1, Math.round(image.width * scale));
      const height = Math.max(1, Math.round(image.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      context.drawImage(image, 0, 0, width, height);
      const pixels = context.getImageData(0, 0, width, height).data;
      let results = [];
      const onTrack = (event) => {
        results = event.data;
      };

      tracker.on("track", onTrack);
      tracker.track(pixels, width, height);
      tracker.removeListener("track", onTrack);

      return results.map((face) => ({
        x: face.x / scale,
        y: face.y / scale,
        width: face.width / scale,
        height: face.height / scale,
      }));
    },
  };
}

function setupFaceDetector() {
  try {
    if ("FaceDetector" in window) {
      state.faceDetector = new FaceDetector({ fastMode: true, maxDetectedFaces: 50 });
      state.faceEngine = "browser";
    } else if (window.tracking?.ObjectTracker && window.tracking?.ViolaJones?.classifiers?.face) {
      state.faceDetector = createTrackingFaceDetector();
      state.faceEngine = "local";
    } else {
      throw new Error("No face detector loaded.");
    }

    state.faceSupport = "ready";
    setFaceStatus(state.faceEngine === "browser" ? "Face protection ready." : "Local face protection ready.");
  } catch (error) {
    state.faceSupport = "unsupported";
    state.faceAware = false;
    setFaceStatus("Face scan is unavailable in this browser.");
  }
  syncControls();
}

function videoFormat() {
  return VIDEO_FORMATS[state.videoPresetId] || VIDEO_FORMATS[DEFAULT_VIDEO_PRESET_ID];
}

function videoPreset() {
  return presets.find((preset) => preset.id === state.videoPresetId)
    || presets.find((preset) => preset.id === DEFAULT_VIDEO_PRESET_ID);
}

async function setupVideoEncoder() {
  const requestId = ++videoConfigRequestId;
  const preset = videoPreset();
  const format = videoFormat();
  state.videoSupport = "checking";
  state.videoConfig = null;
  setVideoStatus(`Checking ${format.ratio} MP4 support...`);
  syncControls();

  if (!preset || !("VideoEncoder" in window) || !("VideoFrame" in window) || !window.Mp4Muxer) {
    if (requestId !== videoConfigRequestId) return;
    state.videoSupport = "unsupported";
    state.videoConfig = null;
    setVideoStatus("MP4 export needs a current Chrome or Edge browser.");
    syncControls();
    return;
  }

  const baseConfig = {
    width: preset.width,
    height: preset.height,
    bitrate: VIDEO_BITRATE,
    framerate: VIDEO_FPS,
    avc: { format: "avc" },
  };
  const codecs = ["avc1.640028", "avc1.4d4028", "avc1.42e028"];

  for (const codec of codecs) {
    try {
      const config = { ...baseConfig, codec };
      const support = await VideoEncoder.isConfigSupported(config);
      if (requestId !== videoConfigRequestId) return;
      if (support.supported) {
        state.videoSupport = "ready";
        state.videoConfig = config;
        setVideoStatus(`${format.ratio} MP4 export ready.`);
        syncControls();
        return;
      }
    } catch (error) {
      // Try the next H.264 profile.
    }
  }

  if (requestId !== videoConfigRequestId) return;
  state.videoSupport = "unsupported";
  state.videoConfig = null;
  setVideoStatus("H.264 MP4 encoding is unavailable on this device.");
  syncControls();
}

function normalizeFace(face) {
  const box = face.boundingBox || face;
  return {
    x: Number(box.x ?? box.left ?? 0),
    y: Number(box.y ?? box.top ?? 0),
    width: Number(box.width ?? 0),
    height: Number(box.height ?? 0),
  };
}

async function scanPhotoFaces(photo) {
  if (!canDetectFaces()) {
    photo.faceStatus = "unsupported";
    photo.faces = [];
    return 0;
  }

  photo.faceStatus = "scanning";
  renderPhotoList();
  syncControls();
  await delay();

  try {
    const image = await ensurePhotoImage(photo);
    const faces = await state.faceDetector.detect(image);
    photo.faces = faces.map(normalizeFace).filter((face) => face.width > 0 && face.height > 0);
    photo.faceStatus = photo.faces.length ? "detected" : "none";
    photo.faceError = "";
    return photo.faces.length;
  } catch (error) {
    photo.faces = [];
    photo.faceStatus = "error";
    photo.faceError = error.message || "Face scan failed.";
    return 0;
  } finally {
    releasePhotoImage(photo);
    renderPhotoList();
    syncControls();
    renderPreview();
  }
}

async function scanCurrentPhoto() {
  const photo = activePhoto();
  if (!photo) return;

  state.scanInProgress = true;
  setStatus(`Scanning ${shortName(photo.name, 30)}...`);
  syncControls();
  const count = await scanPhotoFaces(photo);
  state.scanInProgress = false;
  setStatus(count ? `${plural(count, "face")} found.` : "No faces found.");
  syncControls();
}

async function scanBatchPhotos(options = {}) {
  if (!state.photos.length || !canDetectFaces()) return;

  state.scanInProgress = true;
  syncControls();

  let faceTotal = 0;
  for (let index = 0; index < state.photos.length; index += 1) {
    const photo = state.photos[index];
    setStatus(`Scanning faces ${index + 1}/${state.photos.length}...`);
    faceTotal += await scanPhotoFaces(photo);
    await delay();
  }

  state.scanInProgress = false;
  const prefix = options.automatic ? "Automatic face protection complete." : "Face scan complete.";
  setStatus(`${prefix} ${plural(faceTotal, "face")} found across ${plural(state.photos.length, "photo")}.`);
  syncControls();
  renderPreview();
}

function slug(value) {
  const cleaned = value
    .toLowerCase()
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return cleaned || "social-photo";
}

function outputType() {
  const isJpeg = state.format === "jpeg";
  return {
    mime: isJpeg ? "image/jpeg" : "image/png",
    extension: isJpeg ? "jpg" : "png",
  };
}

function outputFilename(photo, preset) {
  const { extension } = outputType();
  const number = String(photo.index + 1).padStart(3, "0");
  return `${number}-${slug(photo.name)}-${slug(preset.name)}-${preset.width}x${preset.height}.${extension}`;
}

function clearReadyDownload() {
  if (state.readyDownload?.url) URL.revokeObjectURL(state.readyDownload.url);
  state.readyDownload = null;
  els.saveReady.disabled = true;
  els.saveReadyName.textContent = state.photos.length ? "Choose an export option" : "Upload photos first";
}

function directDownload(ready) {
  if (!ready.url) ready.url = URL.createObjectURL(ready.blob);
  const link = document.createElement("a");
  link.href = ready.url;
  link.download = ready.filename;
  document.body.append(link);
  link.click();
  link.remove();
}

async function saveReadyVideoToFolder(ready) {
  if (state.folderExportSupport !== "ready" && !(await setupFolderExport())) return false;

  const session = await folderRequest("/api/exports?label=video&expected=1", { method: "POST" });
  await folderRequest(
    `/api/exports/${session.id}/file?name=${encodeURIComponent(ready.filename)}`,
    {
      method: "POST",
      headers: { "Content-Type": ready.blob.type || "video/mp4" },
      body: ready.blob,
    }
  );
  const completed = await folderRequest(`/api/exports/${session.id}/finish`, { method: "POST" });
  state.lastFolderExport = { ...completed, id: session.id };
  const message = `Saved video to ${completed.folderName}. Click Open exported folder.`;
  setFolderExportStatus(message);
  setStatus(message);
  return true;
}

async function saveReadyDownload() {
  const ready = state.readyDownload;
  if (!ready) return;

  els.saveReady.disabled = true;
  const extensionIndex = ready.filename.lastIndexOf(".");
  const extension = extensionIndex >= 0 ? ready.filename.slice(extensionIndex) : "";

  try {
    if (/\.mp4$/i.test(ready.filename) && await saveReadyVideoToFolder(ready)) return;

    if (typeof window.showSaveFilePicker === "function") {
      try {
        const options = { suggestedName: ready.filename };
        if (extension) {
          options.types = [{
            description: "Exported file",
            accept: { [ready.blob.type || "application/octet-stream"]: [extension] },
          }];
        }
        const handle = await window.showSaveFilePicker(options);
        const writable = await handle.createWritable();
        await writable.write(ready.blob);
        await writable.close();
        setStatus(`Saved ${shortName(ready.filename, 44)}.`);
        return;
      } catch (error) {
        if (error.name === "AbortError") {
          setStatus("Save cancelled. The file is still ready.");
          return;
        }
      }
    }

    directDownload(ready);
    if (/\.zip$/i.test(ready.filename)) {
      setStatus(`Downloading ZIP (${formatBytes(ready.blob.size)}). Wait until the browser download is complete before opening it.`);
    } else {
      setStatus("Download started. Check your Downloads folder.");
    }
  } catch (error) {
    setStatus(error.message || "The browser could not save this file.");
  } finally {
    els.saveReady.disabled = false;
  }
}

function downloadBlob(blob, filename) {
  clearReadyDownload();
  state.readyDownload = { blob, filename, url: null };
  els.saveReadyName.textContent = `Save ${shortName(filename, 38)}`;
  els.saveReady.disabled = false;
  return Promise.resolve();
}

function canvasToBlob(canvas, mime, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Export failed."));
    }, mime, quality);
  });
}

async function renderPhotoBlob(photo, preset) {
  const canvas = document.createElement("canvas");
  try {
    await ensurePhotoImage(photo);
    const { mime } = outputType();
    drawComposition(canvas, preset, { photo });
    return await canvasToBlob(canvas, mime, state.jpegQuality);
  } finally {
    canvas.width = 0;
    canvas.height = 0;
    releasePhotoImage(photo);
  }
}

function videoTotalSeconds(photoCount = state.photos.length) {
  if (!photoCount) return 0;
  return photoCount * state.videoPhotoDuration + Math.max(0, photoCount - 1) * state.videoTransitionDuration;
}

function videoFilename() {
  const date = new Date().toISOString().slice(0, 10);
  return `apcm-${videoFormat().filename}-${state.photos.length}-photos-${date}.mp4`;
}

async function createVideoSlide(photo, preset) {
  const canvas = document.createElement("canvas");
  try {
    await ensurePhotoImage(photo);
    drawComposition(canvas, preset, { photo, forceOpaque: true });
    return canvas;
  } finally {
    releasePhotoImage(photo);
  }
}

async function getVideoSlide(cache, index, preset) {
  if (!cache.has(index)) {
    cache.set(index, await createVideoSlide(state.photos[index], preset));
  }
  return cache.get(index);
}

function trimVideoSlideCache(cache, keepIndexes) {
  const keep = new Set(keepIndexes);
  for (const index of cache.keys()) {
    if (!keep.has(index)) {
      const slide = cache.get(index);
      slide.width = 0;
      slide.height = 0;
      cache.delete(index);
    }
  }
}

function drawScaledVideoSlide(context, slide, scale, alpha) {
  const width = slide.width * scale;
  const height = slide.height * scale;
  context.globalAlpha = alpha;
  context.drawImage(slide, (slide.width - width) / 2, (slide.height - height) / 2, width, height);
}

async function drawVideoTimeline(context, canvas, time, cache, preset) {
  const count = state.photos.length;
  const cycle = state.videoPhotoDuration + state.videoTransitionDuration;
  const currentIndex = Math.min(count - 1, Math.floor(time / cycle));
  const localTime = time - currentIndex * cycle;
  const transitioning = currentIndex < count - 1 && localTime >= state.videoPhotoDuration;
  const rawProgress = transitioning
    ? (localTime - state.videoPhotoDuration) / state.videoTransitionDuration
    : 0;
  const progress = clamp(rawProgress, 0, 1);
  const eased = progress * progress * (3 - 2 * progress);
  const current = await getVideoSlide(cache, currentIndex, preset);
  const nextIndex = transitioning ? currentIndex + 1 : currentIndex;
  const next = transitioning ? await getVideoSlide(cache, nextIndex, preset) : null;

  context.setTransform(1, 0, 0, 1, 0, 0);
  context.globalAlpha = 1;
  context.clearRect(0, 0, canvas.width, canvas.height);

  if (!next) {
    context.drawImage(current, 0, 0);
  } else if (state.videoTransition === "slide") {
    context.drawImage(current, -canvas.width * eased, 0);
    context.drawImage(next, canvas.width * (1 - eased), 0);
  } else if (state.videoTransition === "zoom") {
    drawScaledVideoSlide(context, current, 1 + eased * 0.06, 1);
    drawScaledVideoSlide(context, next, 1.06 - eased * 0.06, eased);
  } else {
    context.drawImage(current, 0, 0);
    context.globalAlpha = eased;
    context.drawImage(next, 0, 0);
  }

  context.globalAlpha = 1;
  trimVideoSlideCache(cache, [currentIndex, nextIndex]);
  return { currentIndex, transitioning };
}

async function waitForVideoEncoder(encoder) {
  while (encoder.encodeQueueSize > 6) {
    await new Promise((resolve) => encoder.addEventListener("dequeue", resolve, { once: true }));
  }
}

function cancelledVideoError() {
  const error = new Error("Video export cancelled.");
  error.name = "AbortError";
  return error;
}

async function encodeMp4() {
  const preset = videoPreset();
  const totalSeconds = videoTotalSeconds();
  const totalFrames = Math.max(1, Math.ceil(totalSeconds * VIDEO_FPS));
  const frameDuration = Math.round(1_000_000 / VIDEO_FPS);
  const target = new Mp4Muxer.ArrayBufferTarget();
  const muxer = new Mp4Muxer.Muxer({
    target,
    video: { codec: "avc", width: preset.width, height: preset.height, frameRate: VIDEO_FPS },
    fastStart: { expectedVideoChunks: totalFrames },
  });
  let encoderError = null;
  const encoder = new VideoEncoder({
    output: (chunk, metadata) => muxer.addVideoChunk(chunk, metadata),
    error: (error) => {
      encoderError = error;
    },
  });
  const canvas = document.createElement("canvas");
  canvas.width = preset.width;
  canvas.height = preset.height;
  const context = canvas.getContext("2d", { alpha: false });
  const cache = new Map();

  encoder.configure(state.videoConfig);

  try {
    for (let frameIndex = 0; frameIndex < totalFrames; frameIndex += 1) {
      if (state.videoCancelRequested) throw cancelledVideoError();
      if (encoderError) throw encoderError;

      const time = frameIndex / VIDEO_FPS;
      const timeline = await drawVideoTimeline(context, canvas, time, cache, preset);
      const frame = new VideoFrame(canvas, {
        timestamp: Math.round((frameIndex * 1_000_000) / VIDEO_FPS),
        duration: frameDuration,
      });
      encoder.encode(frame, { keyFrame: frameIndex % (VIDEO_FPS * 2) === 0 });
      frame.close();
      await waitForVideoEncoder(encoder);

      if (frameIndex % 10 === 0 || frameIndex === totalFrames - 1) {
        const percent = Math.round(((frameIndex + 1) / totalFrames) * 100);
        const photoNumber = Math.min(
          state.photos.length,
          timeline.currentIndex + (timeline.transitioning ? 2 : 1)
        );
        els.videoProgress.value = percent;
        setVideoStatus(`Rendering ${percent}% - photo ${photoNumber}/${state.photos.length}`);
        await delay();
      }
    }

    setVideoStatus("Finalizing MP4...");
    await encoder.flush();
    if (encoderError) throw encoderError;
    encoder.close();
    muxer.finalize();
    return new Blob([target.buffer], { type: "video/mp4" });
  } catch (error) {
    if (encoder.state !== "closed") encoder.close();
    throw error;
  } finally {
    trimVideoSlideCache(cache, []);
    canvas.width = 0;
    canvas.height = 0;
  }
}

async function exportVideo() {
  const format = videoFormat();
  if (!state.photos.length) {
    setVideoStatus("Add photos before exporting a video.");
    return;
  }
  if (state.videoSupport !== "ready" || !state.videoConfig) {
    setVideoStatus("MP4 export is unavailable in this browser.");
    return;
  }

  clearReadyDownload();
  state.exporting = true;
  state.videoExporting = true;
  state.videoCancelRequested = false;
  els.videoProgress.value = 0;
  setStatus(`Building ${format.ratio} MP4...`);
  setVideoStatus("Rendering 0%...");
  syncControls();

  try {
    const blob = await encodeMp4();
    if (state.videoCancelRequested) throw cancelledVideoError();
    setVideoStatus("Preparing MP4 file...");
    await downloadBlob(blob, videoFilename());
    setVideoStatus(`${format.ratio} MP4 ready - ${plural(state.photos.length, "photo")}. Click Save file.`);
    setStatus(`${format.ratio} MP4 ready - click the Save file button.`);
  } catch (error) {
    if (error.name === "AbortError") {
      setVideoStatus("Video export cancelled.");
      setStatus("Video export cancelled.");
    } else {
      setVideoStatus(error.message || "MP4 export failed.");
      setStatus(error.message || "MP4 export failed.");
    }
  } finally {
    state.videoExporting = false;
    state.videoCancelRequested = false;
    state.exporting = false;
    els.videoProgress.value = 0;
    syncControls();
  }
}

async function exportSinglePreset() {
  const photo = activePhoto();
  if (!photo) {
    setStatus("Add photos before exporting.");
    return;
  }

  clearReadyDownload();
  state.exporting = true;
  syncControls();
  try {
    const preset = activePreset();
    setStatus(`Exporting ${shortName(photo.name, 30)}...`);
    const blob = await renderPhotoBlob(photo, preset);
    await downloadBlob(blob, outputFilename(photo, preset));
    setStatus("File ready - click the Save file button.");
  } catch (error) {
    setStatus(error.message || "Export failed.");
  } finally {
    state.exporting = false;
    syncControls();
  }
}

function selectedAllSizeJobs() {
  const photo = activePhoto();
  return photo ? presets.map((preset) => ({ photo, preset })) : [];
}

function batchCurrentSizeJobs() {
  const preset = activePreset();
  return state.photos.map((photo) => ({ photo, preset }));
}

function batchAllSizeJobs() {
  return state.photos.flatMap((photo) => presets.map((preset) => ({ photo, preset })));
}

function zipName(label) {
  const date = new Date().toISOString().slice(0, 10);
  return `social-exports-${label}-${date}.zip`;
}

async function exportJobsToFolder(jobs, label) {
  if (!jobs.length) {
    setStatus("Add photos before exporting.");
    return;
  }

  if (state.folderExportSupport !== "ready" && !(await setupFolderExport())) {
    setStatus("Direct folder export is offline. Double-click START-APP.cmd.");
    return;
  }

  clearReadyDownload();
  state.exporting = true;
  state.lastFolderExport = null;
  setFolderExportStatus(`Preparing ${plural(jobs.length, "file")}...`);
  syncControls();

  try {
    const session = await folderRequest(
      `/api/exports?label=${encodeURIComponent(label)}&expected=${jobs.length}`,
      { method: "POST" }
    );

    for (let index = 0; index < jobs.length; index += 1) {
      const job = jobs[index];
      const progress = `${index + 1}/${jobs.length}`;
      setStatus(`Saving to folder ${progress}...`);
      setFolderExportStatus(`Saving ${progress}...`);
      const blob = await renderPhotoBlob(job.photo, job.preset);
      const filename = outputFilename(job.photo, job.preset);
      await folderRequest(
        `/api/exports/${session.id}/file?name=${encodeURIComponent(filename)}`,
        {
          method: "POST",
          headers: { "Content-Type": blob.type || "application/octet-stream" },
          body: blob,
        }
      );
      if (index % 3 === 0) await delay();
    }

    const completed = await folderRequest(`/api/exports/${session.id}/finish`, { method: "POST" });
    state.lastFolderExport = { id: session.id, ...completed };
    const message = `Saved ${plural(completed.written, "file")} to ${completed.folderName}.`;
    setFolderExportStatus(message);
    setStatus(`${message} Click Open exported folder.`);
  } catch (error) {
    const message = error.message || "Direct folder export failed.";
    setFolderExportStatus(message);
    setStatus(message);
  } finally {
    state.exporting = false;
    syncControls();
  }
}

async function openLastExportFolder() {
  if (!state.lastFolderExport) return;

  els.openExportFolder.disabled = true;
  try {
    await folderRequest(`/api/exports/${state.lastFolderExport.id}/open`, { method: "POST" });
    setStatus("Exported folder opened.");
  } catch (error) {
    setStatus(error.message || "The exported folder could not be opened.");
  } finally {
    els.openExportFolder.disabled = false;
  }
}

async function exportZip(jobs, filename) {
  if (!jobs.length) {
    setStatus("Add photos before exporting.");
    return;
  }

  clearReadyDownload();
  state.exporting = true;
  syncControls();

  try {
    const entries = [];
    for (let index = 0; index < jobs.length; index += 1) {
      const job = jobs[index];
      setStatus(`Exporting ${index + 1}/${jobs.length}...`);
      const blob = await renderPhotoBlob(job.photo, job.preset);
      entries.push({
        name: outputFilename(job.photo, job.preset),
        bytes: new Uint8Array(await blob.arrayBuffer()),
      });
      if (index % 4 === 0) await delay();
    }

    setStatus("Building ZIP...");
    const zip = createZipBlob(entries);
    await downloadBlob(zip, filename);
    setStatus(`ZIP ready: ${plural(entries.length, "file")}, ${formatBytes(zip.size)}. Click Save, then wait for the download to finish.`);
  } catch (error) {
    setStatus(error.message || "ZIP export failed.");
  } finally {
    state.exporting = false;
    syncControls();
  }
}

function createCrcTable() {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
}

function crc32(bytes) {
  if (!crcTable) crcTable = createCrcTable();
  let crc = 0xffffffff;
  for (let index = 0; index < bytes.length; index += 1) {
    crc = crcTable[(crc ^ bytes[index]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zipDateParts(date = new Date()) {
  const time =
    (date.getHours() << 11) |
    (date.getMinutes() << 5) |
    Math.floor(date.getSeconds() / 2);
  const dosDate =
    ((date.getFullYear() - 1980) << 9) |
    ((date.getMonth() + 1) << 5) |
    date.getDate();
  return { time, dosDate };
}

function createZipBlob(entries) {
  const encoder = new TextEncoder();
  const chunks = [];
  const central = [];
  const { time, dosDate } = zipDateParts();
  let offset = 0;

  entries.forEach((entry) => {
    const nameBytes = encoder.encode(entry.name);
    const data = entry.bytes;
    const crc = crc32(data);
    const local = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(local.buffer);

    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, time, true);
    localView.setUint16(12, dosDate, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, data.length, true);
    localView.setUint32(22, data.length, true);
    localView.setUint16(26, nameBytes.length, true);
    localView.setUint16(28, 0, true);
    local.set(nameBytes, 30);

    chunks.push(local, data);
    central.push({ nameBytes, crc, size: data.length, offset });
    offset += local.length + data.length;
  });

  const centralStart = offset;
  central.forEach((entry) => {
    const header = new Uint8Array(46 + entry.nameBytes.length);
    const view = new DataView(header.buffer);

    view.setUint32(0, 0x02014b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 20, true);
    view.setUint16(8, 0, true);
    view.setUint16(10, 0, true);
    view.setUint16(12, time, true);
    view.setUint16(14, dosDate, true);
    view.setUint32(16, entry.crc, true);
    view.setUint32(20, entry.size, true);
    view.setUint32(24, entry.size, true);
    view.setUint16(28, entry.nameBytes.length, true);
    view.setUint16(30, 0, true);
    view.setUint16(32, 0, true);
    view.setUint16(34, 0, true);
    view.setUint16(36, 0, true);
    view.setUint32(38, 0, true);
    view.setUint32(42, entry.offset, true);
    header.set(entry.nameBytes, 46);

    chunks.push(header);
    offset += header.length;
  });

  const centralSize = offset - centralStart;
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, centralStart, true);
  endView.setUint16(20, 0, true);
  chunks.push(end);

  return new Blob(chunks, { type: "application/zip" });
}

function resetAll() {
  clearPhotos();
  clearReadyDownload();
  if (state.logo?.url) URL.revokeObjectURL(state.logo.url);

  Object.assign(state, {
    presetId: presets[0].id,
    fit: "cover",
    activeLayer: "photo",
    logo: null,
    frameEnabled: true,
    logoPosition: { x: 0.86, y: 0.86 },
    logoSize: 0.18,
    logoOpacity: 1,
    logoRotation: 0,
    faceAware: canDetectFaces(),
    scanInProgress: false,
    exporting: false,
    format: "png",
    background: "#ffffff",
    transparent: false,
    jpegQuality: 0.92,
    videoPresetId: DEFAULT_VIDEO_PRESET_ID,
    videoTransition: "fade",
    videoPhotoDuration: 2,
    videoTransitionDuration: 0.6,
    videoExporting: false,
    videoCancelRequested: false,
  });

  els.logoInput.value = "";
  els.logoName.textContent = "Choose image";
  setStatus("Add photos to begin.");
  syncControls();
  renderPreview();
  setupVideoEncoder();
}

function bindEvents() {
  els.photoInput.addEventListener("change", (event) => loadPhotoBatch(event.target.files));
  els.logoInput.addEventListener("change", (event) => loadLogo(event.target.files[0]));

  els.frameEnabled.addEventListener("change", () => {
    state.frameEnabled = els.frameEnabled.checked;
    syncControls();
    renderPreview();
  });

  document.querySelectorAll(".segment").forEach((button) => {
    button.addEventListener("click", () => {
      state.fit = button.dataset.fit;
      syncControls();
      renderPreview();
    });
  });

  document.querySelectorAll(".layer-toggle button").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeLayer = button.dataset.layer;
      syncControls();
    });
  });

  els.faceAwareCrop.addEventListener("change", () => {
    state.faceAware = els.faceAwareCrop.checked;
    renderPreview();
    syncControls();
  });

  els.scanCurrent.addEventListener("click", scanCurrentPhoto);
  els.scanBatch.addEventListener("click", scanBatchPhotos);

  els.photoZoom.addEventListener("input", () => {
    const photo = activePhoto();
    if (!photo) return;
    photo.zoom = Number(els.photoZoom.value) / 100;
    syncControls();
    renderPreview();
  });

  els.photoX.addEventListener("input", () => {
    const photo = activePhoto();
    if (!photo) return;
    photo.offset.x = Number(els.photoX.value) / 100;
    syncControls();
    renderPreview();
  });

  els.photoY.addEventListener("input", () => {
    const photo = activePhoto();
    if (!photo) return;
    photo.offset.y = Number(els.photoY.value) / 100;
    syncControls();
    renderPreview();
  });

  els.centerPhoto.addEventListener("click", () => {
    const photo = activePhoto();
    if (!photo) return;
    photo.offset = { x: 0, y: 0 };
    syncControls();
    renderPreview();
  });

  els.logoSize.addEventListener("input", () => {
    state.logoSize = Number(els.logoSize.value) / 100;
    syncControls();
    renderPreview();
  });

  els.logoOpacity.addEventListener("input", () => {
    state.logoOpacity = Number(els.logoOpacity.value) / 100;
    syncControls();
    renderPreview();
  });

  els.logoRotation.addEventListener("input", () => {
    state.logoRotation = Number(els.logoRotation.value);
    syncControls();
    renderPreview();
  });

  els.removeLogo.addEventListener("click", () => {
    if (state.logo?.url) URL.revokeObjectURL(state.logo.url);
    state.logo = null;
    els.logoInput.value = "";
    els.logoName.textContent = "Choose image";
    state.activeLayer = "photo";
    setStatus("Logo cleared.");
    syncControls();
    renderPreview();
  });

  els.anchorGrid.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (button) setAnchor(button.dataset.anchor);
  });

  els.formatSelect.addEventListener("change", () => {
    state.format = els.formatSelect.value;
    if (state.format === "jpeg") state.transparent = false;
    syncControls();
    renderPreview();
  });

  els.backgroundColor.addEventListener("input", () => {
    state.background = els.backgroundColor.value;
    renderPreview();
  });

  els.transparentBg.addEventListener("change", () => {
    state.transparent = els.transparentBg.checked;
    syncControls();
    renderPreview();
  });

  els.jpegQuality.addEventListener("input", () => {
    state.jpegQuality = Number(els.jpegQuality.value) / 100;
    syncControls();
  });

  els.videoFormatButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const presetId = button.dataset.videoPreset;
      if (!VIDEO_FORMATS[presetId] || presetId === state.videoPresetId || state.exporting) return;
      state.videoPresetId = presetId;
      clearReadyDownload();
      setStatus(`${videoFormat().ratio} video selected.`);
      setupVideoEncoder();
    });
  });

  els.videoTransition.addEventListener("change", () => {
    state.videoTransition = els.videoTransition.value;
    syncControls();
  });

  els.videoPhotoDuration.addEventListener("change", () => {
    state.videoPhotoDuration = Number(els.videoPhotoDuration.value);
    syncControls();
  });

  els.videoTransitionDuration.addEventListener("change", () => {
    state.videoTransitionDuration = Number(els.videoTransitionDuration.value);
    syncControls();
  });

  els.downloadCurrent.addEventListener("click", exportSinglePreset);
  els.exportFolderCurrent.addEventListener("click", () => exportJobsToFolder(batchCurrentSizeJobs(), "current-size"));
  els.exportFolderAll.addEventListener("click", () => exportJobsToFolder(batchAllSizeJobs(), "all-sizes"));
  els.openExportFolder.addEventListener("click", openLastExportFolder);
  els.downloadAll.addEventListener("click", () => exportZip(selectedAllSizeJobs(), zipName("selected-all-sizes")));
  els.downloadBatchCurrent.addEventListener("click", () => exportZip(batchCurrentSizeJobs(), zipName("batch-current-size")));
  els.downloadBatchAll.addEventListener("click", () => exportZip(batchAllSizeJobs(), zipName("batch-all-sizes")));
  els.exportVideo.addEventListener("click", exportVideo);
  els.cancelVideo.addEventListener("click", () => {
    state.videoCancelRequested = true;
    els.cancelVideo.disabled = true;
    setVideoStatus("Cancelling video...");
  });
  els.saveReady.addEventListener("click", saveReadyDownload);
  els.resetAll.addEventListener("click", resetAll);

  els.canvas.addEventListener("pointerdown", beginDrag);
  els.canvas.addEventListener("pointermove", updateDrag);
  els.canvas.addEventListener("pointerup", endDrag);
  els.canvas.addEventListener("pointercancel", endDrag);
  els.canvas.addEventListener("lostpointercapture", endDrag);

  window.addEventListener("beforeunload", (event) => {
    if (!state.exporting) return;
    event.preventDefault();
    event.returnValue = "";
  });
}

buildPresets();
bindEvents();
renderPhotoList();
syncControls();
renderPreview();
setupFaceDetector();
setupVideoEncoder();
loadFrameAssets();
setupFolderExport();
