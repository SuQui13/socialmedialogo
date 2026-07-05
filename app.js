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
    logo: null,      // ImageBitmap
    logoUrl: null,
    position: 'br',
    sizePct: 18,
    opacityPct: 100,
    marginPct: 3,
    cropMode: 'smart',
    quality: 90,
    processing: false,
  };

  const $ = id => document.getElementById(id);

  // ---------- logo ----------
  const logoDrop = $('logo-drop');
  const logoInput = $('logo-input');

  logoDrop.addEventListener('click', () => { if (!state.logo) logoInput.click(); });
  logoInput.addEventListener('change', () => { if (logoInput.files[0]) setLogo(logoInput.files[0]); });
  bindDrop(logoDrop, files => { if (files[0]) setLogo(files[0]); });

  async function setLogo(file) {
    try {
      state.logo = await fileToBitmap(file);
    } catch {
      setStatus(`Could not read logo "${file.name}" — please use a PNG, JPEG or WebP.`, true);
      return;
    }
    if (state.logoUrl) URL.revokeObjectURL(state.logoUrl);
    state.logoUrl = URL.createObjectURL(file);
    $('logo-img-preview').src = state.logoUrl;
    $('logo-dz-inner').classList.add('hidden');
    $('logo-preview').classList.remove('hidden');
    refreshPreview();
    updateProcessBtn();
  }

  $('logo-remove').addEventListener('click', e => {
    e.stopPropagation();
    if (state.logo) state.logo.close();
    state.logo = null;
    if (state.logoUrl) URL.revokeObjectURL(state.logoUrl);
    state.logoUrl = null;
    logoInput.value = '';
    $('logo-dz-inner').classList.remove('hidden');
    $('logo-preview').classList.add('hidden');
    refreshPreview();
    updateProcessBtn();
  });

  // ---------- logo settings ----------
  document.querySelectorAll('#pos-grid button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelector('#pos-grid .active')?.classList.remove('active');
      btn.classList.add('active');
      state.position = btn.dataset.pos;
      refreshPreview();
    });
  });

  bindSlider('logo-size', 'size-val', v => { state.sizePct = v; });
  bindSlider('logo-opacity', 'opacity-val', v => { state.opacityPct = v; });
  bindSlider('logo-margin', 'margin-val', v => { state.marginPct = v; });
  bindSlider('jpeg-quality', 'quality-val', v => { state.quality = v; });

  $('crop-mode').addEventListener('change', e => {
    state.cropMode = e.target.value;
    refreshPreview();
  });

  function bindSlider(id, valId, apply) {
    const el = $(id);
    el.addEventListener('input', () => {
      apply(Number(el.value));
      $(valId).textContent = el.value + '%';
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

    if (state.logo) {
      const logoW = outW * (state.sizePct / 100);
      const logoH = logoW * (state.logo.height / state.logo.width);
      const margin = outW * (state.marginPct / 100);
      const [fx, fy] = POSITIONS[state.position];
      const x = margin + fx * (outW - logoW - 2 * margin);
      const y = margin + fy * (outH - logoH - 2 * margin);
      ctx.globalAlpha = state.opacityPct / 100;
      ctx.drawImage(state.logo, x, y, logoW, logoH);
      ctx.globalAlpha = 1;
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
    processBtn.disabled = state.processing ||
      state.photos.length === 0 || selectedRatios().length === 0;
  }

  processBtn.addEventListener('click', async () => {
    if (state.processing) return;
    state.processing = true;
    updateProcessBtn();
    $('progress-wrap').classList.remove('hidden');
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
      const a = document.createElement('a');
      a.href = URL.createObjectURL(archive);
      a.download = `social-media-photos-${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 60000);

      const okCount = total - failed.length * ratios.length;
      let msg = `Done! ${okCount} image${okCount === 1 ? '' : 's'} exported to the ZIP.`;
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

  updateCounter();
  updateProcessBtn();
})();
