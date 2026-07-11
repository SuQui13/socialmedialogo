(function () {
  'use strict';

  const MAX_PHOTOS = 150;

  const RATIOS = {
    '4x5':  { ratio: 4 / 5,  width: 1080, height: 1350, label: '4:5 Feed',  checkbox: 'ratio-45'  },
    '16x9': { ratio: 16 / 9, width: 1920, height: 1080, label: '16:9 Landscape', checkbox: 'ratio-169' },
    '9x16': { ratio: 9 / 16, width: 1080, height: 1920, label: '9:16 Story', checkbox: 'ratio-916' },
  };

  const POSITIONS = {
    tl: [0, 0], tc: [0.5, 0], tr: [1, 0],
    ml: [0, 0.5], mc: [0.5, 0.5], mr: [1, 0.5],
    bl: [0, 1], bc: [0.5, 1], br: [1, 1],
  };

  const state = {
    photos: [],      // { file, thumbUrl }
    logo: null,      // ImageBitmap (plain corner logo)
    logoDataUrl: null,
    frames: {},      // ratioKey -> { bitmap, dataUrl } full-cover overlays
    lastZipUrl: null,
    lastZipBlob: null,
    position: 'br',
    sizePct: 18,
    opacityPct: 100,
    marginPct: 3,
    cropMode: 'smart',
    quality: 90,
    copyright: '',
    processing: false,
  };

  const $ = id => document.getElementById(id);

  // ---------- local persistence (browser storage; may be unavailable) ----------
  const store = {
    get(key, fallback) {
      try {
        const v = localStorage.getItem(key);
        return v === null ? fallback : JSON.parse(v);
      } catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); return true; }
      catch { return false; }
    },
  };

  const MAX_SAVED_LOGOS = 8;
  const MAX_SAVED_LOGO_BYTES = 1500000; // data-URL length guard for the storage quota
  let savedLogos = store.get('smlb.logos', []); // [{ name, dataUrl }]

  function persistLogos() {
    if (!store.set('smlb.logos', savedLogos)) {
      setStatus('Could not save the logo for next time (browser storage is full or blocked) — it still works for this session.', true);
    }
  }

  function renderSavedLogos() {
    const row = $('saved-logo-row');
    row.innerHTML = '';
    $('saved-logos').classList.toggle('hidden', savedLogos.length === 0);
    for (const entry of savedLogos) {
      const inUse = entry.dataUrl === state.logoDataUrl ||
        Object.values(state.frames).some(f => f.dataUrl === entry.dataUrl);
      const div = document.createElement('div');
      div.className = 'saved-logo' + (inUse ? ' active' : '');
      div.title = entry.name;
      const img = document.createElement('img');
      img.src = entry.dataUrl;
      img.alt = entry.name;
      const rm = document.createElement('button');
      rm.className = 'rm';
      rm.textContent = '✕';
      rm.title = 'Forget this logo';
      rm.addEventListener('click', e => {
        e.stopPropagation();
        savedLogos = savedLogos.filter(l => l !== entry);
        persistLogos();
        renderSavedLogos();
      });
      div.addEventListener('click', () => useSavedLogo(entry));
      div.append(img, rm);
      row.appendChild(div);
    }
  }

  function saveLogoToLibrary(name, dataUrl) {
    if (dataUrl.length > MAX_SAVED_LOGO_BYTES) {
      setStatus('This logo file is too large to remember for next time — it still works for this session.', false);
      return;
    }
    savedLogos = [{ name, dataUrl }, ...savedLogos.filter(l => l.dataUrl !== dataUrl)]
      .slice(0, MAX_SAVED_LOGOS);
    persistLogos();
    renderSavedLogos();
  }

  async function useSavedLogo(entry) {
    try {
      const blob = await (await fetch(entry.dataUrl)).blob();
      applyBrandImage(await createImageBitmap(blob), entry.dataUrl);
    } catch {
      setStatus('Could not load that saved logo — please upload it again.', true);
    }
  }

  function saveSettings() {
    store.set('smlb.settings', {
      position: state.position,
      sizePct: state.sizePct,
      opacityPct: state.opacityPct,
      marginPct: state.marginPct,
      cropMode: state.cropMode,
      quality: state.quality,
      copyright: state.copyright,
      ratios: selectedRatios(),
    });
  }

  function restoreSettings() {
    const s = store.get('smlb.settings', null);
    if (!s) return;
    state.position = s.position ?? state.position;
    state.sizePct = s.sizePct ?? state.sizePct;
    state.opacityPct = s.opacityPct ?? state.opacityPct;
    state.marginPct = s.marginPct ?? state.marginPct;
    state.cropMode = s.cropMode ?? state.cropMode;
    state.quality = s.quality ?? state.quality;
    state.copyright = s.copyright ?? state.copyright;

    document.querySelector('#pos-grid .active')?.classList.remove('active');
    document.querySelector(`#pos-grid [data-pos="${state.position}"]`)?.classList.add('active');
    const sliders = [
      ['logo-size', 'size-val', state.sizePct],
      ['logo-opacity', 'opacity-val', state.opacityPct],
      ['logo-margin', 'margin-val', state.marginPct],
      ['jpeg-quality', 'quality-val', state.quality],
    ];
    for (const [id, valId, v] of sliders) {
      $(id).value = v;
      $(valId).textContent = v + '%';
    }
    $('crop-mode').value = state.cropMode;
    $('copyright-text').value = state.copyright;
    if (Array.isArray(s.ratios)) {
      for (const key of Object.keys(RATIOS)) {
        $(RATIOS[key].checkbox).checked = s.ratios.includes(key);
      }
    }
  }

  // ---------- logo ----------
  const logoDrop = $('logo-drop');
  const logoInput = $('logo-input');

  logoDrop.addEventListener('click', () => logoInput.click());
  logoInput.addEventListener('change', () => {
    for (const f of logoInput.files) setLogo(f);
    logoInput.value = '';
  });
  bindDrop(logoDrop, files => { for (const f of files) setLogo(f); });

  /** A "frame" is an image shaped like one of the output ratios and reasonably
   *  large — it gets stretched over the whole photo instead of placed as a logo. */
  function classifyFrame(bitmap) {
    if (bitmap.width < 500 || bitmap.height < 500) return null;
    for (const key of Object.keys(RATIOS)) {
      const r = RATIOS[key].ratio;
      if (Math.abs(bitmap.width / bitmap.height - r) / r < 0.03) return key;
    }
    return null;
  }

  async function setLogo(file) {
    let bitmap;
    try {
      bitmap = await fileToBitmap(file);
    } catch {
      setStatus(`Could not read "${file.name}" — please use a PNG, JPEG or WebP.`, true);
      return;
    }
    const dataUrl = await new Promise((res, rej) => {
      const reader = new FileReader();
      reader.onload = () => res(reader.result);
      reader.onerror = rej;
      reader.readAsDataURL(file);
    });
    applyBrandImage(bitmap, dataUrl);
    saveLogoToLibrary(file.name, dataUrl);
  }

  function applyBrandImage(bitmap, dataUrl) {
    const frameKey = classifyFrame(bitmap);
    if (frameKey) {
      state.frames[frameKey]?.bitmap.close();
      state.frames[frameKey] = { bitmap, dataUrl };
      persistFrames();
      setStatus(`Recognized a ${frameKey.replace('x', ':')} frame — it will cover the whole ${frameKey.replace('x', ':')} photo.`);
    } else {
      if (state.logo) state.logo.close();
      state.logo = bitmap;
      state.logoDataUrl = dataUrl;
      store.set('smlb.lastLogo', dataUrl);
    }
    renderActiveLogos();
    renderSavedLogos();
    refreshPreview();
    updateProcessBtn();
  }

  function persistFrames() {
    const data = {};
    for (const key of Object.keys(state.frames)) data[key] = state.frames[key].dataUrl;
    if (!store.set('smlb.frames', data)) {
      setStatus('Could not save the frame for next time (browser storage is full or blocked) — it still works for this session.', true);
    }
  }

  function renderActiveLogos() {
    const box = $('logo-preview');
    box.innerHTML = '';
    const items = [];
    for (const key of Object.keys(RATIOS)) {
      if (!state.frames[key]) continue;
      items.push({
        label: `${key.replace('x', ':')} frame`,
        dataUrl: state.frames[key].dataUrl,
        remove: () => {
          state.frames[key].bitmap.close();
          delete state.frames[key];
          persistFrames();
        },
      });
    }
    if (state.logo) {
      items.push({
        label: 'Logo',
        dataUrl: state.logoDataUrl,
        remove: () => {
          state.logo.close();
          state.logo = null;
          state.logoDataUrl = null;
          store.set('smlb.lastLogo', null);
        },
      });
    }
    box.classList.toggle('hidden', items.length === 0);
    $('frame-hint').classList.toggle('hidden', !items.some(i => i.label.includes('frame')));
    for (const it of items) {
      const chip = document.createElement('div');
      chip.className = 'logo-chip';
      chip.addEventListener('click', e => e.stopPropagation());
      const img = document.createElement('img');
      img.src = it.dataUrl;
      img.alt = it.label;
      const label = document.createElement('p');
      label.textContent = it.label;
      const rm = document.createElement('button');
      rm.className = 'rm';
      rm.textContent = '✕';
      rm.title = 'Remove';
      rm.addEventListener('click', e => {
        e.stopPropagation();
        it.remove();
        renderActiveLogos();
        renderSavedLogos();
        refreshPreview();
        updateProcessBtn();
      });
      chip.append(img, label, rm);
      box.appendChild(chip);
    }
  }

  // ---------- logo settings ----------
  document.querySelectorAll('#pos-grid button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelector('#pos-grid .active')?.classList.remove('active');
      btn.classList.add('active');
      state.position = btn.dataset.pos;
      saveSettings();
      refreshPreview();
    });
  });

  bindSlider('logo-size', 'size-val', v => { state.sizePct = v; });
  bindSlider('logo-opacity', 'opacity-val', v => { state.opacityPct = v; });
  bindSlider('logo-margin', 'margin-val', v => { state.marginPct = v; });
  bindSlider('jpeg-quality', 'quality-val', v => { state.quality = v; });

  $('crop-mode').addEventListener('change', e => {
    state.cropMode = e.target.value;
    saveSettings();
    refreshPreview();
  });

  $('copyright-text').addEventListener('input', e => {
    state.copyright = e.target.value;
    saveSettings();
    refreshPreviewDebounced();
  });

  function bindSlider(id, valId, apply) {
    const el = $(id);
    el.addEventListener('input', () => {
      apply(Number(el.value));
      $(valId).textContent = el.value + '%';
      saveSettings();
      refreshPreviewDebounced();
    });
  }

  // ---------- photos ----------
  const photoDrop = $('photo-drop');
  const photoInput = $('photo-input');

  photoDrop.addEventListener('click', () => photoInput.click());
  photoInput.addEventListener('change', () => { addPhotos([...photoInput.files]); photoInput.value = ''; });
  bindDrop(photoDrop, addPhotos);

  function addPhotos(files) {
    const images = files.filter(f => /^image\/(jpeg|png|webp)$/.test(f.type));
    const unsupported = files.length - images.length;
    if (unsupported > 0) {
      setStatus(`${unsupported} file${unsupported === 1 ? ' was' : 's were'} not added — only JPEG, PNG and WebP work. iPhone HEIC photos need to be exported/converted to JPEG first.`, true);
    }
    const room = MAX_PHOTOS - state.photos.length;
    if (images.length > room) {
      setStatus(`Only ${room} more photo${room === 1 ? '' : 's'} fit (max ${MAX_PHOTOS}) — the rest were skipped.`, true);
    }
    for (const file of images.slice(0, Math.max(0, room))) {
      const photo = { file, thumbUrl: URL.createObjectURL(file) };
      state.photos.push(photo);
      addThumb(photo);
    }
    updateCounter();
    updateProcessBtn();
    if (state.photos.length > 0) refreshPreview();
  }

  function addThumb(photo) {
    const div = document.createElement('div');
    div.className = 'thumb';
    const img = document.createElement('img');
    img.src = photo.thumbUrl;
    img.alt = photo.file.name;
    img.title = photo.file.name;
    const rm = document.createElement('button');
    rm.className = 'rm';
    rm.textContent = '✕';
    rm.title = 'Remove';
    rm.addEventListener('click', () => {
      const i = state.photos.indexOf(photo);
      if (i !== -1) state.photos.splice(i, 1);
      URL.revokeObjectURL(photo.thumbUrl);
      div.remove();
      updateCounter();
      updateProcessBtn();
      refreshPreview();
    });
    div.append(img, rm);
    $('thumb-grid').appendChild(div);
  }

  $('clear-photos').addEventListener('click', () => {
    for (const p of state.photos) URL.revokeObjectURL(p.thumbUrl);
    state.photos.length = 0;
    $('thumb-grid').innerHTML = '';
    updateCounter();
    updateProcessBtn();
    refreshPreview();
  });

  function updateCounter() {
    $('photo-counter').textContent = `${state.photos.length} / ${MAX_PHOTOS}`;
    $('clear-photos').classList.toggle('hidden', state.photos.length === 0);
  }

  // ---------- ratios ----------
  for (const key of Object.keys(RATIOS)) {
    $(RATIOS[key].checkbox).addEventListener('change', () => {
      saveSettings();
      refreshPreview();
      updateProcessBtn();
    });
  }

  function selectedRatios() {
    return Object.keys(RATIOS).filter(k => $(RATIOS[k].checkbox).checked);
  }

  // ---------- rendering ----------
  async function renderOne(bitmap, ratioKey, targetScale) {
    const spec = RATIOS[ratioKey];
    const crop = await window.smartCrop(bitmap, spec.ratio, state.cropMode);

    const outW = Math.round(spec.width * (targetScale || 1));
    const outH = Math.round(spec.height * (targetScale || 1));
    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, crop.x, crop.y, crop.width, crop.height, 0, 0, outW, outH);

    const margin = outW * (state.marginPct / 100);
    const [fx, fy] = POSITIONS[state.position];

    if (state.frames[ratioKey]) {
      // full-cover frame: stretched over the whole photo, exactly as designed
      ctx.drawImage(state.frames[ratioKey].bitmap, 0, 0, outW, outH);
    } else if (state.logo) {
      const logoW = outW * (state.sizePct / 100);
      const logoH = logoW * (state.logo.height / state.logo.width);
      const x = margin + fx * (outW - logoW - 2 * margin);
      const y = margin + fy * (outH - logoH - 2 * margin);
      ctx.globalAlpha = state.opacityPct / 100;
      ctx.drawImage(state.logo, x, y, logoW, logoH);
      ctx.globalAlpha = 1;
    }

    const text = state.copyright.trim();
    if (text) {
      // opposite corner from the logo so they never collide; if the logo is
      // dead center (or absent), the text goes to the bottom edge instead
      let [tx, ty] = state.logo ? [1 - fx, 1 - fy] : [fx, fy];
      if (state.logo && fx === 0.5 && fy === 0.5) { tx = 0.5; ty = 1; }
      const fontSize = Math.max(14, Math.round(outW * 0.022));
      ctx.font = `600 ${fontSize}px -apple-system, "Segoe UI", Roboto, sans-serif`;
      ctx.textBaseline = 'middle';
      ctx.textAlign = tx === 0 ? 'left' : tx === 1 ? 'right' : 'center';
      const x = margin + tx * (outW - 2 * margin);
      const y = margin + fontSize / 2 + ty * (outH - fontSize - 2 * margin);
      ctx.shadowColor = 'rgba(0,0,0,0.55)';
      ctx.shadowBlur = fontSize * 0.25;
      ctx.globalAlpha = state.opacityPct / 100;
      ctx.fillStyle = '#ffffff';
      ctx.fillText(text, x, y);
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    }
    return canvas;
  }

  // ---------- preview ----------
  let previewTimer = null;
  function refreshPreviewDebounced() {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(refreshPreview, 150);
  }

  let previewToken = 0;
  async function refreshPreview() {
    const token = ++previewToken;
    const row = $('preview-row');
    if (state.photos.length === 0) {
      row.innerHTML = '<p class="hint">Add photos above — a live preview of the first photo appears here.</p>';
      return;
    }
    const ratios = selectedRatios();
    if (ratios.length === 0) {
      row.innerHTML = '<p class="hint">Select at least one output format above.</p>';
      return;
    }
    let bitmap;
    try {
      bitmap = await fileToBitmap(state.photos[0].file);
    } catch {
      row.innerHTML = '<p class="hint">Could not read the first photo for preview.</p>';
      return;
    }
    try {
      if (token !== previewToken) return;
      const items = [];
      for (const key of ratios) {
        const canvas = await renderOne(bitmap, key, 0.25); // small preview
        if (token !== previewToken) return;
        const wrap = document.createElement('div');
        wrap.className = 'preview-item';
        const label = document.createElement('p');
        label.textContent = RATIOS[key].label;
        wrap.append(canvas, label);
        items.push(wrap);
      }
      row.innerHTML = '';
      row.append(...items);
    } finally {
      bitmap.close();
    }
  }

  // ---------- processing ----------
  const processBtn = $('process-btn');

  function updateProcessBtn() {
    const noPhotos = state.photos.length === 0;
    const noRatios = selectedRatios().length === 0;
    processBtn.disabled = state.processing || noPhotos || noRatios;
    $('btn-hint').textContent =
      state.processing ? '' :
      noPhotos ? 'Add at least one photo in step 2 to enable the button.' :
      noRatios ? 'Tick at least one format in step 3 to enable the button.' : '';
  }

  processBtn.addEventListener('click', async () => {
    if (state.processing) return;
    state.processing = true;
    updateProcessBtn();
    $('progress-wrap').classList.remove('hidden');
    $('manual-download').classList.add('hidden');
    setStatus('');

    const ratios = selectedRatios();
    const zip = new window.ZipWriter();
    const total = state.photos.length * ratios.length;
    let done = 0;
    const failed = [];

    try {
      for (const photo of state.photos) {
        let bitmap;
        try {
          bitmap = await fileToBitmap(photo.file);
        } catch {
          failed.push(photo.file.name);
          done += ratios.length;
          setProgress(done, total);
          continue;
        }
        try {
          for (const key of ratios) {
            const canvas = await renderOne(bitmap, key, 1);
            const blob = await new Promise(res =>
              canvas.toBlob(res, 'image/jpeg', state.quality / 100));
            const base = photo.file.name.replace(/\.[^.]+$/, '').replace(/[\\/:*?"<>|]/g, '_');
            zip.add(`${key}/${base}_${key}.jpg`, new Uint8Array(await blob.arrayBuffer()));
            done++;
            setProgress(done, total);
            // yield to the UI thread so the page stays responsive
            await new Promise(r => setTimeout(r, 0));
          }
        } finally {
          bitmap.close();
        }
      }

      const archive = zip.finalize();
      const name = `social-media-photos-${new Date().toISOString().slice(0, 10)}.zip`;
      if (state.lastZipUrl) URL.revokeObjectURL(state.lastZipUrl);
      state.lastZipUrl = URL.createObjectURL(archive);
      state.lastZipBlob = archive;

      // backup button in case the automatic download is blocked by the browser
      const dl = $('manual-download');
      dl.href = state.lastZipUrl;
      dl.download = name;
      dl.textContent = `⬇ Save ZIP (${(archive.size / 1e6).toFixed(1)} MB)`;
      dl.classList.remove('hidden');

      const a = document.createElement('a');
      a.href = state.lastZipUrl;
      a.download = name;
      a.click();

      const okCount = total - failed.length * ratios.length;
      let msg = `Done! ${okCount} image${okCount === 1 ? '' : 's'} exported. If no download started, click the "Save ZIP" button.`;
      if (failed.length) msg += ` Skipped ${failed.length} unreadable photo(s): ${failed.join(', ')}`;
      setStatus(msg, failed.length > 0);
    } catch (err) {
      console.error(err);
      setStatus('Something went wrong while processing: ' + err.message, true);
    } finally {
      state.processing = false;
      updateProcessBtn();
      $('progress-wrap').classList.add('hidden');
    }
  });

  // When the browser supports it, the Save ZIP button opens a real
  // "Save as" dialog so the user can choose the folder; otherwise it
  // behaves as a normal download link.
  $('manual-download').addEventListener('click', async e => {
    if (!window.showSaveFilePicker || !state.lastZipBlob) return;
    e.preventDefault();
    const name = $('manual-download').download;
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: name,
        types: [{ description: 'ZIP archive', accept: { 'application/zip': ['.zip'] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(state.lastZipBlob);
      await writable.close();
      setStatus(`Saved ${name} to the folder you chose.`);
    } catch (err) {
      if (err.name === 'AbortError') return; // user closed the dialog
      const a = document.createElement('a');
      a.href = state.lastZipUrl;
      a.download = name;
      a.click();
    }
  });

  function setProgress(done, total) {
    const pct = total === 0 ? 0 : Math.round((done / total) * 100);
    $('progress-bar').style.width = pct + '%';
    $('progress-label').textContent = `${done} / ${total}`;
  }

  function setStatus(msg, isError) {
    const el = $('status-line');
    el.textContent = msg;
    el.style.color = isError ? 'var(--danger)' : 'var(--muted)';
  }

  // ---------- helpers ----------
  function fileToBitmap(file) {
    return createImageBitmap(file);
  }

  function bindDrop(zone, onFiles) {
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('dragover');
      onFiles([...e.dataTransfer.files]);
    });
  }

  // ---------- startup: restore saved settings, frames and last-used logo ----------
  restoreSettings();
  renderSavedLogos();
  (async () => {
    const savedFrames = store.get('smlb.frames', {});
    for (const key of Object.keys(RATIOS)) {
      if (!savedFrames[key]) continue;
      try {
        const blob = await (await fetch(savedFrames[key])).blob();
        state.frames[key] = { bitmap: await createImageBitmap(blob), dataUrl: savedFrames[key] };
      } catch { /* unreadable stored frame — skip it */ }
    }
    const lastLogo = store.get('smlb.lastLogo', null);
    if (lastLogo) {
      try {
        const blob = await (await fetch(lastLogo)).blob();
        state.logo = await createImageBitmap(blob);
        state.logoDataUrl = lastLogo;
      } catch { /* unreadable stored logo — skip it */ }
    }
    renderActiveLogos();
    renderSavedLogos();
    refreshPreview();
  })();
  updateCounter();
  updateProcessBtn();
})();
