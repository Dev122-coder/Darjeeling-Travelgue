/**
 * Darjeeling Travelogue — Main UI & Controller
 * Premium Himalayan Travel Journal & Postcard Studio
 * 
 * Key Features:
 * - Robust multiple-photo handling (guarantees every selected image appears, including the last)
 * - True FileList synchronization via DataTransfer for photoInput.files
 * - Object URL lifecycle management to prevent memory leaks
 * - Parallel background image compression to WebP/JPEG for Gemma 4
 * - Responsive gallery displaying ALL uploaded photos in the generated result
 * - Smooth state transitions, clipboard copy, native Web Share, and souvenir postcard download
 */

document.addEventListener('DOMContentLoaded', () => {

  // --- UI Element Selectors ---
  const form = document.getElementById('travelogueForm');
  const travelNotes = document.getElementById('travelNotes');
  const charCount = document.getElementById('charCount');
  const photoInput = document.getElementById('photoInput');
  const dropZone = document.getElementById('dropZone');
  const previewContainer = document.getElementById('previewContainer');
  const previewGrid = document.getElementById('previewGrid');
  const previewCount = document.getElementById('previewCount');
  const clearAllPhotosBtn = document.getElementById('clearAllPhotosBtn');
  const generateBtn = document.getElementById('generateBtn');
  const loadingIndicator = document.getElementById('loadingIndicator');
  const loadingStatusText = document.getElementById('loadingStatusText');
  const errorAlert = document.getElementById('errorAlert');
  const errorMessage = document.getElementById('errorMessage');
  const dismissErrorBtn = document.getElementById('dismissErrorBtn');
  const resultSection = document.getElementById('resultSection');
  const resultPhotoGallery = document.getElementById('resultPhotoGallery');
  const galleryMetaBadge = document.getElementById('galleryMetaBadge');
  const resultTitle = document.getElementById('resultTitle');
  const resultTravelogue = document.getElementById('resultTravelogue');
  const resultCaption = document.getElementById('resultCaption');
  const resultHashtags = document.getElementById('resultHashtags');
  const dispatchDate = document.getElementById('dispatchDate');
  const copyStoryBtn = document.getElementById('copyStoryBtn');
  const shareStoryBtn = document.getElementById('shareStoryBtn');
  const downloadCardBtn = document.getElementById('downloadCardBtn');
  const createNewBtn = document.getElementById('createNewBtn');
  const aiStatusPill = document.getElementById('aiStatusPill');
  const aiStatusText = document.getElementById('aiStatusText');
  const offlineBanner = document.getElementById('offlineBanner');
  const pwaInstallBtn = document.getElementById('pwaInstallBtn');
  const toastNotification = document.getElementById('toastNotification');
  const toastMessage = document.getElementById('toastMessage');

  // --- Application State ---
  // Array of { id, file, name, size, previewUrl, base64, dataUrl, width, height }
  let selectedPhotos = [];
  let isGenerating = false;
  let currentCardData = null;
  let deferredPwaPrompt = null;

  // --- Curated Journey Presets ---
  const PRESETS = {
    batasia: {
      notes: "Batasia Loop at 6:30 AM sunrise. The Toy Train engine No. 788 B-Class coiled around the sharp spiral curve. The steam rose white into the crisp blue Himalayan air. In the distance, the five snow-capped summits of Kanchenjunga turned blazing gold in the first sun rays. Passengers leaned out of the open windows, waving at gardeners tending the red rhododendrons inside the war memorial loop.",
      imagePath: "/assets/batasia-loop.jpg",
      name: "batasia-loop.jpg"
    },
    ghum: {
      notes: "Rain and thick mountain mist rolled into Ghum station—the highest railway station in India at 2,258 meters. The train halted with a hiss of steam and iron brakes. Old brass station bell chimed. Smelled wet cedar wood and boiling cardamom tea from a platform stall. An elderly station master in a wool muffler checked the bronze semaphore lantern as passengers huddled together laughing in the fog.",
      imagePath: "/assets/ghum-station.jpg",
      name: "ghum-station.jpg"
    },
    teagarden: {
      notes: "Narrow tracks cutting straight through the green terraces of Happy Valley tea estate. Emerald tea bushes rolling down into the deep clouds. Women in colorful headscarves plucking two leaves and a bud, looking up to wave as the locomotive blew its brass whistle. Cold mountain breeze filled the wooden carriage with fresh dew and cedar.",
      imagePath: "/assets/tea-gardens.jpg",
      name: "tea-gardens.jpg"
    }
  };

  // --- Initialization ---
  init();

  function init() {
    bindEvents();
    checkHealthStatus();
    setupPwaPrompt();
    updateCharCounter();
  }

  // --- Event Bindings ---
  function bindEvents() {
    // Character Counter
    travelNotes.addEventListener('input', updateCharCounter);

    // Preset Buttons
    document.querySelectorAll('.preset-pill').forEach(btn => {
      btn.addEventListener('click', () => loadPreset(btn.dataset.preset));
    });

    // Dropzone Click & Keyboard Navigation
    dropZone.addEventListener('click', () => photoInput.click());
    dropZone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        photoInput.click();
      }
    });

    // Drag & Drop Handlers
    ['dragenter', 'dragover'].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.add('drag-over');
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('drag-over');
      });
    });

    dropZone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      if (dt && dt.files && dt.files.length > 0) {
        handleFiles(dt.files);
      }
    });

    // File Input Change
    photoInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFiles(e.target.files);
      }
    });

    // Clear All Photos Button
    clearAllPhotosBtn.addEventListener('click', clearAllPhotos);

    // Form Submit
    form.addEventListener('submit', handleFormSubmit);

    // Error Alert Dismissal
    dismissErrorBtn.addEventListener('click', hideError);

    // Result Card Actions
    copyStoryBtn.addEventListener('click', copyStoryToClipboard);
    shareStoryBtn.addEventListener('click', shareStory);
    downloadCardBtn.addEventListener('click', downloadMemoryCard);
    createNewBtn.addEventListener('click', resetForNewStory);

    // Network Connectivity Listeners
    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOfflineStatus);
  }

  // --- Character Counter ---
  function updateCharCounter() {
    const len = travelNotes.value.length;
    charCount.textContent = `${len.toLocaleString()} / 3,000 characters`;
    if (len > 2500) {
      charCount.classList.add('char-warn');
    } else {
      charCount.classList.remove('char-warn');
    }
  }

  // --- Preset Loader ---
  async function loadPreset(presetKey) {
    const preset = PRESETS[presetKey];
    if (!preset) return;

    travelNotes.value = preset.notes;
    updateCharCounter();
    hideError();

    try {
      showToast('Loading preset journey...');
      const response = await fetch(preset.imagePath);
      const blob = await response.blob();
      const file = new File([blob], preset.name, { type: 'image/jpeg' });
      await handleFiles([file], true);
      showToast(`Loaded ${presetKey.toUpperCase()} journey!`);
    } catch (err) {
      console.warn('Preset image load fallback:', err);
    }
  }

  // =========================================================================
  // MULTIPLE PHOTO HANDLING & PREVIEW BUG FIX
  // =========================================================================

  /**
   * Synchronizes photoInput.files using DataTransfer API so photos.files remains
   * accurate whenever photos are added or removed.
   */
  function syncFileInput() {
    if (!photoInput) return;
    try {
      if (typeof DataTransfer !== 'undefined') {
        const dt = new DataTransfer();
        selectedPhotos.forEach(p => {
          if (p.file instanceof File) {
            dt.items.add(p.file);
          }
        });
        photoInput.files = dt.files;
      }
    } catch (err) {
      console.warn('[FileInput Sync] DataTransfer not supported in this environment:', err);
    }
  }

  /**
   * Handles files from file input or drag-and-drop.
   * Guarantees that EVERY selected file (1, 2, 3, 5, etc.) appears in the preview,
   * including the last file. Avoids replacing or losing thumbnails.
   * 
   * @param {FileList|File[]} fileList 
   * @param {boolean} isPreset
   */
  async function handleFiles(fileList, isPreset = false) {
    if (!fileList || fileList.length === 0) return;
    hideError();

    // If preset or user selected a new batch via input dialog, replace previous selection
    clearExistingObjectUrls();
    selectedPhotos = [];

    const incomingFiles = Array.from(fileList);

    // Step 1: Register EVERY file in the list and assign an instant object URL
    for (let i = 0; i < incomingFiles.length; i++) {
      const file = incomingFiles[i];

      // Validate format and size
      const validation = ImageUtils.validateFile(file);
      if (!validation.valid) {
        showError(validation.error);
        continue;
      }

      // Generate object URL for instant, reliable, zero-latency preview
      const previewUrl = URL.createObjectURL(file);
      const photoId = `photo_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 6)}`;

      selectedPhotos.push({
        id: photoId,
        file: file,
        name: file.name,
        size: file.size,
        previewUrl: previewUrl,
        dataUrl: previewUrl, // Fallback preview dataUrl
        base64: null,        // Populated asynchronously below
        width: 0,
        height: 0
      });
    }

    // Synchronize photoInput.files
    syncFileInput();

    // Step 2: Render ALL preview cards immediately
    renderPhotoPreviews();

    // Step 3: Compress and resize images in background for Gemma 4
    selectedPhotos.forEach((photoObj) => {
      compressPhotoInBackground(photoObj);
    });
  }

  /**
   * Compresses photo in background using ImageUtils canvas scaler.
   * Converts to WebP/JPEG (max 1024px) for Gemma 4 inference.
   */
  async function compressPhotoInBackground(photoObj) {
    try {
      const processed = await ImageUtils.processImage(photoObj.file);
      photoObj.base64 = processed.base64;
      photoObj.dataUrl = processed.dataUrl;
      photoObj.width = processed.width;
      photoObj.height = processed.height;
    } catch (err) {
      console.warn(`[Image Compressor] Fallback for ${photoObj.name}:`, err);
      // Fallback: Read raw base64 via FileReader if canvas was unavailable
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        photoObj.dataUrl = result;
        photoObj.base64 = typeof result === 'string'
          ? result.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '')
          : '';
      };
      reader.readAsDataURL(photoObj.file);
    }
  }

  /**
   * Renders the preview grid.
   * Uses a DocumentFragment to safely append all cards without overwriting
   * previous thumbnails. Guaranteed to display all selected images including the last one.
   */
  function renderPhotoPreviews() {
    previewGrid.innerHTML = '';

    if (selectedPhotos.length === 0) {
      previewContainer.classList.add('hidden');
      previewCount.textContent = '0 photos selected';
      return;
    }

    previewContainer.classList.remove('hidden');
    const count = selectedPhotos.length;
    previewCount.textContent = `${count} ${count === 1 ? 'photo' : 'photos'} selected`;

    const fragment = document.createDocumentFragment();

    selectedPhotos.forEach((photo, idx) => {
      const card = document.createElement('div');
      card.className = 'preview-item';
      card.dataset.id = photo.id;

      // Image Thumbnail
      const img = document.createElement('img');
      img.src = photo.previewUrl;
      img.alt = `Journey photograph ${idx + 1} of ${count}`;
      img.className = 'preview-thumbnail';
      img.loading = 'lazy';

      // Badge: Displays Photo index and AI indicator
      const badge = document.createElement('span');
      badge.className = 'preview-badge';
      badge.textContent = `Photo ${idx + 1}`;

      // Remove Button
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'preview-remove-btn';
      removeBtn.setAttribute('aria-label', `Remove photo ${idx + 1}: ${photo.name}`);
      removeBtn.title = 'Remove this photo';
      removeBtn.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      `;

      removeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        removePhotoById(photo.id);
      });

      card.appendChild(img);
      card.appendChild(badge);
      card.appendChild(removeBtn);
      fragment.appendChild(card);
    });

    previewGrid.appendChild(fragment);
  }

  /**
   * Removes a single photo by its unique ID, revoking its object URL and syncing photoInput.files.
   */
  function removePhotoById(id) {
    const index = selectedPhotos.findIndex(p => p.id === id);
    if (index !== -1) {
      const removed = selectedPhotos[index];
      if (removed.previewUrl && removed.previewUrl.startsWith('blob:')) {
        try { URL.revokeObjectURL(removed.previewUrl); } catch (_) {}
      }
      selectedPhotos.splice(index, 1);
      syncFileInput();
      renderPhotoPreviews();
    }
  }

  /**
   * Clears all selected photos, revokes all object URLs, and clears photoInput.files.
   */
  function clearAllPhotos() {
    clearExistingObjectUrls();
    selectedPhotos = [];
    syncFileInput();
    renderPhotoPreviews();
    if (photoInput) photoInput.value = '';
  }

  /**
   * Revokes all active object URLs in selectedPhotos to prevent memory leaks.
   */
  function clearExistingObjectUrls() {
    selectedPhotos.forEach(p => {
      if (p.previewUrl && p.previewUrl.startsWith('blob:')) {
        try { URL.revokeObjectURL(p.previewUrl); } catch (_) {}
      }
    });
  }

  // =========================================================================
  // GENERATION FLOW
  // =========================================================================

  async function handleFormSubmit(e) {
    e.preventDefault();

    if (isGenerating) return;

    const notes = travelNotes.value.trim();
    if (!notes) {
      showError('Please write some notes about your journey first.');
      travelNotes.focus();
      return;
    }

    hideError();
    setGeneratingState(true);

    try {
      // Ensure all images have their compressed Base64 ready before dispatching
      const pendingCompressions = selectedPhotos.map(async (photo) => {
        if (!photo.base64) {
          try {
            const processed = await ImageUtils.processImage(photo.file);
            photo.base64 = processed.base64;
            photo.dataUrl = processed.dataUrl;
          } catch (_) {
            // Fallback to FileReader
            return new Promise((res) => {
              const reader = new FileReader();
              reader.onload = () => {
                const r = reader.result;
                photo.dataUrl = r;
                photo.base64 = typeof r === 'string' ? r.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '') : '';
                res();
              };
              reader.readAsDataURL(photo.file);
            });
          }
        }
      });

      await Promise.all(pendingCompressions);

      // Collect Base64 images for Gemma 4 (all uploaded photos, up to 5)
      const imagesPayload = selectedPhotos
        .slice(0, 5)
        .map(p => p.base64)
        .filter(b => b && b.length > 0);

      // Dispatch to decoupled AI Service (Gemma 4 via Ollama / Express)
      const result = await aiService.generateTravelogue(notes, imagesPayload);

      // Store card data for display and export
      currentCardData = {
        title: result.title,
        travelogue: result.travelogue,
        caption: result.caption,
        hashtags: result.hashtags,
        imageDataUrl: selectedPhotos.length > 0 ? selectedPhotos[0].dataUrl : null,
        allPhotos: [...selectedPhotos]
      };

      renderMemoryCard(currentCardData);

      // Reveal result section with smooth scroll
      resultSection.classList.remove('hidden');
      resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      showToast('✨ Your travelogue memory has been created!');

    } catch (err) {
      console.error('[Generation Error]', err);
      showError(err.message || 'Failed to generate travelogue. Please ensure Ollama is running.');
    } finally {
      setGeneratingState(false);
    }
  }

  // =========================================================================
  // MEMORY CARD RENDERING (SHOWS ALL UPLOADED PHOTOS IN GALLERY)
  // =========================================================================

  function renderMemoryCard(data) {
    // 1. Text fields populated using textContent for security (No raw HTML execution)
    resultTitle.textContent = data.title;
    resultTravelogue.textContent = data.travelogue;
    resultCaption.textContent = data.caption;

    // 2. Hashtags
    resultHashtags.innerHTML = '';
    if (Array.isArray(data.hashtags)) {
      data.hashtags.forEach(tag => {
        const pill = document.createElement('span');
        pill.className = 'hashtag-pill';
        pill.textContent = tag;
        resultHashtags.appendChild(pill);
      });
    }

    // 3. Dispatch Date
    const now = new Date();
    dispatchDate.textContent = now.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    // 4. Responsive Photo Gallery: Renders ALL uploaded images!
    setupResultPhotoGallery(data.allPhotos);
  }

  /**
   * Renders a tasteful, responsive gallery showing ALL uploaded photos.
   * - 1 image  -> Single hero layout
   * - 2 images -> 2-column side-by-side layout
   * - 3 images -> 3-image editorial layout (1 feature + 2 companion)
   * - 4+ images -> Balanced responsive photo grid
   */
  function setupResultPhotoGallery(photos) {
    if (!resultPhotoGallery) return;
    resultPhotoGallery.innerHTML = '';

    if (!photos || photos.length === 0) {
      resultPhotoGallery.className = 'result-photo-gallery gallery-layout-1';
      const item = document.createElement('div');
      item.className = 'gallery-item single-hero';
      item.innerHTML = `<img id="postcardHeroImg" src="/assets/batasia-loop.jpg" alt="Scenic Himalayan Railway route" class="gallery-img">`;
      resultPhotoGallery.appendChild(item);
      if (galleryMetaBadge) galleryMetaBadge.classList.add('hidden');
      return;
    }

    const count = photos.length;

    // Determine layout class
    if (count === 1) {
      resultPhotoGallery.className = 'result-photo-gallery gallery-layout-1';
    } else if (count === 2) {
      resultPhotoGallery.className = 'result-photo-gallery gallery-layout-2';
    } else if (count === 3) {
      resultPhotoGallery.className = 'result-photo-gallery gallery-layout-3';
    } else {
      resultPhotoGallery.className = 'result-photo-gallery gallery-layout-multi';
    }

    // Render every single photo into the gallery
    photos.forEach((photo, idx) => {
      const item = document.createElement('div');
      item.className = `gallery-item item-${idx + 1}`;

      const img = document.createElement('img');
      img.src = photo.dataUrl || photo.previewUrl;
      img.alt = `Darjeeling journey photograph ${idx + 1} of ${count}: ${photo.name || 'Himalayan journey'}`;
      img.className = 'gallery-img';
      img.loading = 'lazy';

      // Keep ID for primary photo for postcard export reference
      if (idx === 0) {
        img.id = 'postcardHeroImg';
      }

      const captionTag = document.createElement('span');
      captionTag.className = 'gallery-photo-tag';
      captionTag.textContent = `Photo ${idx + 1}`;

      item.appendChild(img);
      item.appendChild(captionTag);
      resultPhotoGallery.appendChild(item);
    });

    // Badge showing photo count
    if (galleryMetaBadge) {
      if (count > 1) {
        galleryMetaBadge.textContent = `${count} journey photographs`;
        galleryMetaBadge.classList.remove('hidden');
      } else {
        galleryMetaBadge.classList.add('hidden');
      }
    }
  }

  // =========================================================================
  // ACTIONS: COPY, SHARE, EXPORT
  // =========================================================================

  async function copyStoryToClipboard() {
    if (!currentCardData) return;

    const formattedStory = [
      `🚂 ${currentCardData.title.toUpperCase()}`,
      `Darjeeling Himalayan Railway Memory`,
      ``,
      currentCardData.travelogue,
      ``,
      `“${currentCardData.caption.replace(/["']/g, '')}”`,
      ``,
      currentCardData.hashtags.join(' ')
    ].join('\n');

    try {
      await navigator.clipboard.writeText(formattedStory);
      showToast('📋 Story copied to clipboard!');
    } catch (err) {
      showToast('Could not access clipboard.');
    }
  }

  async function shareStory() {
    if (!currentCardData) return;

    const shareText = `"${currentCardData.title}"\n\n${currentCardData.travelogue}\n\n“${currentCardData.caption}”\n\n${currentCardData.hashtags.join(' ')}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: currentCardData.title,
          text: shareText,
          url: window.location.href
        });
        showToast('📤 Shared successfully!');
      } catch (err) {
        if (err.name !== 'AbortError') {
          copyStoryToClipboard();
        }
      }
    } else {
      await copyStoryToClipboard();
      showToast('📤 Web Share not supported; story copied to clipboard!');
    }
  }

  async function downloadMemoryCard() {
    if (!currentCardData) return;

    try {
      showToast('🎨 Rendering high-res souvenir postcard...');
      downloadCardBtn.disabled = true;
      downloadCardBtn.textContent = 'Generating...';

      await PostcardExporter.exportToImage(currentCardData);
      showToast('💾 Souvenir postcard downloaded!');
    } catch (err) {
      console.error('[Export Error]', err);
      showError('Failed to generate postcard: ' + err.message);
    } finally {
      downloadCardBtn.disabled = false;
      downloadCardBtn.innerHTML = '<span>💾 Download Card</span>';
    }
  }

  function resetForNewStory() {
    travelNotes.value = '';
    updateCharCounter();
    clearAllPhotos();
    hideError();
    resultSection.classList.add('hidden');
    currentCardData = null;
    const inputSection = document.getElementById('create-memory');
    if (inputSection) {
      inputSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  // =========================================================================
  // UI HELPERS & STATUS
  // =========================================================================

  function setGeneratingState(generating) {
    isGenerating = generating;
    generateBtn.disabled = generating;

    if (generating) {
      loadingIndicator.classList.remove('hidden');
      generateBtn.classList.add('hidden');
      if (loadingStatusText) {
        loadingStatusText.textContent = 'Creating your travel memory...';
      }
    } else {
      loadingIndicator.classList.add('hidden');
      generateBtn.classList.remove('hidden');
    }
  }

  function showError(msg) {
    errorMessage.textContent = msg;
    errorAlert.classList.remove('hidden');
    errorAlert.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function hideError() {
    errorAlert.classList.add('hidden');
  }

  function showToast(msg) {
    toastMessage.textContent = msg;
    toastNotification.classList.remove('hidden');
    setTimeout(() => {
      toastNotification.classList.add('hidden');
    }, 3200);
  }

  async function checkHealthStatus() {
    try {
      const health = await aiService.checkHealth();
      if (health.status === 'ready') {
        aiStatusPill.className = 'status-pill status-ready';
        aiStatusText.textContent = '🟢 On-device AI ready';
        aiStatusPill.title = `Model: ${health.details?.model || 'Gemma 4'} is online`;
      } else if (health.status === 'loading') {
        aiStatusPill.className = 'status-pill status-loading';
        aiStatusText.textContent = '🟡 AI model loading...';
      } else {
        aiStatusPill.className = 'status-pill status-unavailable';
        aiStatusText.textContent = '🔴 AI model unavailable';
        aiStatusPill.title = 'Make sure Ollama is running: ollama serve';
      }
    } catch (_) {
      aiStatusPill.className = 'status-pill status-unavailable';
      aiStatusText.textContent = '🔴 AI model unavailable';
    }
  }

  function handleOnlineStatus() {
    offlineBanner.classList.add('hidden');
    checkHealthStatus();
    showToast('🟢 Connection restored');
  }

  function handleOfflineStatus() {
    offlineBanner.classList.remove('hidden');
    aiStatusPill.className = 'status-pill status-unavailable';
    aiStatusText.textContent = '🔴 Offline';
    showToast('📡 You are offline. Cached application shell remains available.');
  }

  function setupPwaPrompt() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPwaPrompt = e;
      pwaInstallBtn.classList.remove('hidden');
    });

    pwaInstallBtn.addEventListener('click', async () => {
      if (!deferredPwaPrompt) return;
      pwaInstallBtn.classList.add('hidden');
      deferredPwaPrompt.prompt();
      await deferredPwaPrompt.userChoice;
      deferredPwaPrompt = null;
    });

    window.addEventListener('appinstalled', () => {
      pwaInstallBtn.classList.add('hidden');
      showToast('🎉 Darjeeling Travelogue installed!');
    });
  }

});
