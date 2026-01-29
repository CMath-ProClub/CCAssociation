(function () {
  'use strict';

  const SELECTOR = '[data-config-text], [data-config-field], [data-inline-copy-key], [data-config-attr], [data-inline-media-key]';
  const COPY_STORAGE_KEY = 'ccaInlineCopyOverrides';
  const FONT_STORAGE_KEY = 'ccaInlineFontOverrides';
  const MEDIA_STORAGE_KEY = 'ccaInlineMediaOverrides';
  const LAYOUT_STORAGE_KEY = 'ccaInlineLayoutOverrides';
  const BLOCK_SKIP_TAGS = new Set(['HTML', 'BODY', 'SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'HEAD', 'META', 'LINK', 'TITLE']);
  const BLOCK_SKIP_SELECTOR = '.inline-block-overlay, .inline-control-bar, .inline-admin-pill, .inline-admin-toast, .inline-text-toolbar';
  const INLINE_UNLOCK_STORAGE_KEY = 'ccaInlineFlowbiteUnlocked';
  const INLINE_UNLOCK_QUERY_PARAM = 'ccaInline';
  const INLINE_UNLOCK_SHORTCUT_KEY = 'e';
  const body = document.body;

  if (!body) {
    return;
  }

  let editorEnabled = false;
  let cachedConfig = null;
  let activeTarget = null;
  let activePath = '';
  let activeType = 'config';
  let activeAttr = '';
  let modalEl;
  let modalTextarea;
  let modalTextField;
  let modalPathLabel;
  let modalFontFamilyInput;
  let modalFontSizeInput;
  let modalFontControls;
  let modalMediaControls;
  let modalMediaUrlInput;
  let modalMediaPreviewWrapper;
  let modalMediaPreview;
  let toggleButton;
  let toastEl;
  let toastTimeoutId = null;
  let helpOverlay;
  let statusPill;
  let layoutOverrides = {};
  let fontOverrides = {};
  let blockOverlay;
  let blockLabelEl;
  let blockDragState = null;
  let activeBlockTarget = null;
  let activeBlockKey = '';
  let blockSelectionAttached = false;
  let blockHintShown = false;
  let inlineUnlocked = false;
  let unlockPromptActive = false;
  let unlockShortcutAttached = false;

  const clampNumber = (value, min, max) => Math.min(Math.max(value, min), max);

  const parsePxValue = (value) => {
    if (typeof value === 'number') {
      return Number.isNaN(value) ? 0 : value;
    }
    if (typeof value !== 'string') {
      return 0;
    }
    const numeric = parseFloat(value);
    return Number.isNaN(numeric) ? 0 : numeric;
  };

  const parseFontStretch = (value) => {
    if (typeof value === 'number') {
      return value;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.endsWith('%')) {
        const numeric = parseFloat(trimmed);
        if (!Number.isNaN(numeric)) {
          return numeric / 100;
        }
      }
      const numeric = parseFloat(trimmed);
      if (!Number.isNaN(numeric)) {
        return numeric;
      }
    }
    return 1;
  };

  const ensureBaseTypographyMetrics = (node) => {
    if (!node || node.dataset.inlineBaseFontSize) {
      return;
    }
    const computed = window.getComputedStyle(node);
    node.dataset.inlineBaseFontSize = parsePxValue(computed.fontSize || '16px');
    node.dataset.inlineBaseFontStretch = parseFontStretch(computed.fontStretch || '100%');
  };

  const unpackFontOverride = (entry) => {
    if (!entry) {
      return { size: '', family: '' };
    }
    if (typeof entry === 'string') {
      return { size: entry, family: '' };
    }
    if (typeof entry === 'object') {
      return {
        size: typeof entry.size === 'string' ? entry.size : '',
        family: typeof entry.family === 'string' ? entry.family : ''
      };
    }
    return { size: '', family: '' };
  };

  const supportsFontControls = (type) => type === 'config' || type === 'copy';

  const normalizeFontSizeInput = (value) => {
    if (typeof value !== 'string') {
      return '';
    }
    const trimmed = value.trim();
    if (!trimmed) {
      return '';
    }
    if (/^\d+(\.\d+)?$/.test(trimmed)) {
      const numeric = clampNumber(parseFloat(trimmed), 6, 320);
      return Number.isNaN(numeric) ? '' : `${numeric}px`;
    }
    return trimmed;
  };

  const applyFontStyleToTarget = (target, entry) => {
    if (!target) {
      return;
    }
    const payload = unpackFontOverride(entry);
    if (payload.family) {
      target.style.fontFamily = payload.family;
    } else {
      target.style.removeProperty('font-family');
    }
    if (payload.size) {
      target.style.fontSize = payload.size;
      target.dataset.inlineBlockFont = payload.size;
    } else if (target.dataset.inlineBlockFont) {
      target.style.removeProperty('font-size');
      delete target.dataset.inlineBlockFont;
    }
  };

  const updateFontOverrideForActive = () => {
    if (!supportsFontControls(activeType) || !activePath || !modalFontFamilyInput || !modalFontSizeInput) {
      return false;
    }
    const familyValue = modalFontFamilyInput.value ? modalFontFamilyInput.value.trim() : '';
    const sizeValue = normalizeFontSizeInput(modalFontSizeInput.value || '');
    modalFontFamilyInput.value = familyValue;
    modalFontSizeInput.value = sizeValue;
    const nextPayload = {};
    if (familyValue) {
      nextPayload.family = familyValue;
    }
    if (sizeValue) {
      nextPayload.size = sizeValue;
    }
    const hasNext = Object.keys(nextPayload).length > 0;
    const existing = unpackFontOverride(fontOverrides[activePath]);
    const hadExisting = Boolean(existing.size || existing.family);
    const unchanged = hasNext && existing.size === nextPayload.size && existing.family === nextPayload.family;
    if ((hasNext && unchanged) || (!hasNext && !hadExisting)) {
      return false;
    }
    const nextOverrides = { ...fontOverrides };
    if (hasNext) {
      nextOverrides[activePath] = nextPayload;
    } else {
      delete nextOverrides[activePath];
    }
    fontOverrides = nextOverrides;
    saveFontOverrides(nextOverrides);
    applyFontStyleToTarget(activeTarget, hasNext ? nextPayload : null);
    return true;
  };

  const isIndexToken = (value) => /^(\d+)$/.test(value);

  const getValue = (source, path) => {
    if (!source || !path) {
      return undefined;
    }
    return path.split('.').reduce((acc, key) => {
      if (acc === undefined || acc === null) {
        return undefined;
      }
      if (isIndexToken(key)) {
        if (!Array.isArray(acc)) {
          return undefined;
        }
        return acc[Number(key)];
      }
      if (!Object.prototype.hasOwnProperty.call(acc, key)) {
        return undefined;
      }
      return acc[key];
    }, source);
  };

  const setValue = (source, path, value) => {
    if (!source || !path) {
      return;
    }
    const parts = path.split('.');
    let cursor = source;

    for (let index = 0; index < parts.length; index += 1) {
      const token = parts[index];
      const isLast = index === parts.length - 1;
      const nextToken = parts[index + 1];
      const nextIsIndex = typeof nextToken === 'string' && isIndexToken(nextToken);

      if (isIndexToken(token)) {
        if (!Array.isArray(cursor)) {
          return;
        }
        const idx = Number(token);
        if (isLast) {
          cursor[idx] = value;
          return;
        }
        if (!cursor[idx] || typeof cursor[idx] !== 'object') {
          cursor[idx] = nextIsIndex ? [] : {};
        }
        cursor = cursor[idx];
      } else {
        if (isLast) {
          cursor[token] = value;
          return;
        }
        if (!cursor[token] || typeof cursor[token] !== 'object') {
          cursor[token] = nextIsIndex ? [] : {};
        }
        cursor = cursor[token];
      }
    }

    const cloneEntryValue = (value) => {
      if (Array.isArray(value)) {
        return value.map((item) => cloneEntryValue(item));
      }
      if (value && typeof value === 'object') {
        return Object.keys(value).reduce((acc, key) => {
          acc[key] = cloneEntryValue(value[key]);
          return acc;
        }, {});
      }
      return value;
    };

    const selectCollectionTemplate = (collectionPath) => {
      if (!collectionPath) {
        return '';
      }
      if (collectionPath === 'home.steps') {
        return { label: 'Step', body: '' };
      }
      if (
        collectionPath === 'home.heroButtons' ||
        collectionPath === 'home.getInvolvedButtons' ||
        collectionPath === 'branding.headerButtons' ||
        collectionPath === 'event.heroButtons' ||
        collectionPath === 'contact.heroButtons' ||
        collectionPath === 'faq.heroButtons' ||
        collectionPath === 'galleryPage.heroButtons'
      ) {
        return { label: 'Button', href: 'index.html', style: 'primary' };
      }
      if (collectionPath === 'event.timeline') {
        return { title: '', time: '', description: '' };
      }
      if (collectionPath === 'event.preview') {
        return { title: '', details: '' };
      }
      if (
        collectionPath === 'gallery' ||
        collectionPath === 'galleryPage.naborDays' ||
        collectionPath === 'galleryPage.winter' ||
        collectionPath === 'galleryPage.music'
      ) {
        return { src: '', alt: '', caption: '' };
      }
      if (collectionPath === 'eventListings') {
        return { title: '', timing: '', summary: '', details: '' };
      }
      if (collectionPath === 'faq.community' || collectionPath === 'faq.festival') {
        return { question: '', answer: '' };
      }
      return '';
    };

    const insertEntryAtPath = (source, collectionPath, template) => {
      if (!source || !collectionPath) {
        return '';
      }
      let list = getValue(source, collectionPath);
      if (!Array.isArray(list)) {
        setValue(source, collectionPath, []);
        list = getValue(source, collectionPath);
      }
      list.push(template);
      return `${collectionPath}.${list.length - 1}`;
    };

    const deleteEntryAtPath = (source, entryPath) => {
      if (!source || !entryPath) {
        return false;
      }
      const segments = entryPath.split('.');
      const index = Number(segments.pop());
      const collectionPath = segments.join('.');
      const list = getValue(source, collectionPath);
      if (!Array.isArray(list) || Number.isNaN(index) || index < 0 || index >= list.length) {
        return false;
      }
      list.splice(index, 1);
      return true;
    };
  };

  const computeElementPath = (element) => {
    if (!element) {
      return '';
    }
    const segments = [];
    let current = element;
    while (current && current !== document.body) {
      if (!current.parentElement) {
        break;
      }
      const tag = current.tagName.toLowerCase();
      const siblings = Array.from(current.parentElement.children).filter((child) => child.tagName === current.tagName);
      const index = siblings.indexOf(current) + 1;
      segments.unshift(`${tag}:nth-of-type(${index})`);
      current = current.parentElement;
    }
    return segments.length ? `body>${segments.join('>')}` : 'body';
  };

  const ensureConfig = () => {
    if (cachedConfig) {
      return cachedConfig;
    }
    if (window.CCAConfig && typeof window.CCAConfig.loadConfig === 'function') {
      cachedConfig = window.CCAConfig.loadConfig();
      return cachedConfig;
    }
    cachedConfig = {};
    return cachedConfig;
  };

  const persistConfig = (nextConfig) => {
    if (!window.CCAConfig || typeof window.CCAConfig.saveConfig !== 'function') {
      return;
    }
    window.CCAConfig.saveConfig(nextConfig);
    cachedConfig = nextConfig;
    window.dispatchEvent(new CustomEvent('cca-config-updated', { detail: { config: nextConfig } }));
  };

  const loadCopyOverrides = () => {
    try {
      const raw = localStorage.getItem(COPY_STORAGE_KEY);
      if (!raw) {
        return {};
      }
      return JSON.parse(raw);
    } catch (error) {
      console.warn('Flowbite inline editor: unable to read copy overrides.', error);
      return {};
    }
  };

  const saveCopyOverrides = (overrides) => {
    try {
      localStorage.setItem(COPY_STORAGE_KEY, JSON.stringify(overrides));
      window.dispatchEvent(new CustomEvent('cca-inline-copy-updated', { detail: { overrides } }));
    } catch (error) {
      console.warn('Flowbite inline editor: unable to persist copy overrides.', error);
    }
  };

  const loadFontOverrides = () => {
    try {
      const raw = localStorage.getItem(FONT_STORAGE_KEY);
      if (!raw) {
        return {};
      }
      return JSON.parse(raw);
    } catch (error) {
      console.warn('Flowbite inline editor: unable to read font overrides.', error);
      return {};
    }
  };

  const saveFontOverrides = (overrides) => {
    try {
      localStorage.setItem(FONT_STORAGE_KEY, JSON.stringify(overrides));
      fontOverrides = overrides;
      window.dispatchEvent(new CustomEvent('cca-inline-font-updated', { detail: { overrides } }));
    } catch (error) {
      console.warn('Flowbite inline editor: unable to persist font overrides.', error);
    }
  };

  const loadMediaOverrides = () => {
    try {
      const raw = localStorage.getItem(MEDIA_STORAGE_KEY);
      if (!raw) {
        return {};
      }
      return JSON.parse(raw);
    } catch (error) {
      console.warn('Flowbite inline editor: unable to read media overrides.', error);
      return {};
    }
  };

  const saveMediaOverrides = (overrides) => {
    try {
      localStorage.setItem(MEDIA_STORAGE_KEY, JSON.stringify(overrides));
      window.dispatchEvent(new CustomEvent('cca-inline-media-updated', { detail: { overrides } }));
    } catch (error) {
      console.warn('Flowbite inline editor: unable to persist media overrides.', error);
    }
  };

  const injectInlineEditorStyles = () => {
    if (document.getElementById('flowbite-inline-editor-styles')) {
      return;
    }
    const style = document.createElement('style');
    style.id = 'flowbite-inline-editor-styles';
    style.textContent = `
  [data-inline-block-active="true"] { outline: 2px dashed rgba(46,125,84,0.9); outline-offset: 4px; }
  .inline-block-customized { position: relative; transform-origin: top left; transform: translate(var(--cca-inline-offset-x, 0px), var(--cca-inline-offset-y, 0px)) scale(var(--cca-inline-scale-x, 1), var(--cca-inline-scale-y, 1)); width: var(--cca-inline-width, auto); min-height: var(--cca-inline-height, auto); }
.inline-block-overlay { position: absolute; border: 1px dashed rgba(15,23,42,0.6); border-radius: 0.75rem; pointer-events: none; z-index: 3600; }
.inline-block-handle { pointer-events: auto; }
.inline-block-handle.move { position: absolute; top: -42px; left: 50%; transform: translateX(-50%); background: #0f172a; color: #fff; border: none; border-radius: 999px; padding: 0.35rem 0.9rem; font-size: 0.8rem; letter-spacing: 0.04em; cursor: grab; }
.inline-block-handle.resize { position: absolute; bottom: -6px; right: -6px; width: 18px; height: 18px; border-right: 3px solid rgba(15,23,42,0.7); border-bottom: 3px solid rgba(15,23,42,0.7); cursor: nwse-resize; }
.inline-block-toolbar { position: absolute; top: -52px; right: 0; display: inline-flex; gap: 0.4rem; align-items: center; background: rgba(255,255,255,0.95); border-radius: 999px; padding: 0.35rem 0.8rem; box-shadow: 0 12px 30px rgba(15,23,42,0.25); pointer-events: auto; }
.inline-block-toolbar button { border: none; background: rgba(209,49,40,0.95); color: #fff; border-radius: 999px; padding: 0.3rem 0.8rem; font-size: 0.75rem; cursor: pointer; }
.inline-block-label { font-size: 0.7rem; font-weight: 600; color: #0f172a; }
.inline-block-hint { font-size: 0.65rem; color: #475569; }
.inline-status-pill { position: fixed; bottom: 1.5rem; left: 1.5rem; z-index: 3600; display: inline-flex; align-items: center; gap: 0.6rem; padding: 0.65rem 0.9rem; background: rgba(15,23,42,0.9); color: #fff; border-radius: 999px; box-shadow: 0 18px 40px rgba(15,23,42,0.35); font-size: 0.85rem; font-weight: 600; letter-spacing: 0.01em; }
.inline-status-pill.hidden { display: none; }
.inline-status-pill .dot { width: 10px; height: 10px; border-radius: 999px; background: #facc15; box-shadow: 0 0 0 6px rgba(250,204,21,0.15); }
.inline-status-pill.on .dot { background: #22c55e; box-shadow: 0 0 0 6px rgba(34,197,94,0.15); }
.inline-status-pill.locked .dot { background: #f97316; box-shadow: 0 0 0 6px rgba(249,115,22,0.15); }
.inline-status-pill .hint { font-size: 0.75rem; font-weight: 500; opacity: 0.75; }
.inline-help-overlay { position: fixed; inset: 0; z-index: 3600; display: none; align-items: center; justify-content: center; background: rgba(15,23,42,0.55); }
.inline-help-overlay.visible { display: flex; }
.inline-help-card { width: min(520px, 92vw); border-radius: 24px; background: #0f172a; color: #e2e8f0; box-shadow: 0 30px 80px rgba(15,23,42,0.55); padding: 24px; border: 1px solid rgba(255,255,255,0.06); }
.inline-help-card h3 { margin: 0 0 8px; font-size: 1.2rem; font-weight: 700; color: #fff; }
.inline-help-card p { margin: 0 0 14px; color: #cbd5e1; font-size: 0.95rem; }
.inline-help-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; margin: 0 0 16px; }
.inline-help-item { padding: 12px; border-radius: 14px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.06); }
.inline-help-item h4 { margin: 0 0 6px; font-size: 0.95rem; color: #fff; }
.inline-help-item p { margin: 0; font-size: 0.9rem; color: #cbd5e1; }
.inline-help-kbd { display: inline-flex; align-items: center; justify-content: center; min-width: 1.8rem; padding: 0.15rem 0.45rem; margin-right: 0.35rem; border-radius: 8px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); font-weight: 700; color: #fff; box-shadow: inset 0 -2px 0 rgba(0,0,0,0.15); }
.inline-help-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 6px; }
.inline-help-button { padding: 0.6rem 1rem; border-radius: 999px; border: 1px solid rgba(255,255,255,0.15); background: rgba(255,255,255,0.08); color: #fff; font-weight: 600; cursor: pointer; transition: background 0.2s ease, border-color 0.2s ease; }
.inline-help-button:hover { background: rgba(255,255,255,0.12); border-color: rgba(255,255,255,0.3); }
`;
    document.head.appendChild(style);
  };

  const sanitizeLayoutOverrides = (data) => {
    if (!data || typeof data !== 'object') {
      return {};
    }
    let mutated = false;
    Object.keys(data).forEach((key) => {
      const entry = data[key];
      if (!entry || typeof entry !== 'object') {
        return;
      }
      if (Object.prototype.hasOwnProperty.call(entry, 'font')) {
        delete entry.font;
        mutated = true;
      }
    });
    if (mutated) {
      try {
        localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(data));
      } catch (error) {
        console.warn('Flowbite inline editor: unable to rewrite layout overrides.', error);
      }
    }
    return data;
  };

  const loadLayoutOverrides = () => {
    try {
      const raw = localStorage.getItem(LAYOUT_STORAGE_KEY);
      if (!raw) {
        return {};
      }
      const parsed = JSON.parse(raw);
      return sanitizeLayoutOverrides(parsed);
    } catch (error) {
      console.warn('Flowbite inline editor: unable to read layout overrides.', error);
      return {};
    }
  };

  const saveLayoutOverrides = (overrides) => {
    try {
      localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(overrides));
      window.dispatchEvent(new CustomEvent('cca-inline-layout-updated', { detail: { overrides } }));
    } catch (error) {
      console.warn('Flowbite inline editor: unable to persist layout overrides.', error);
    }
  };

  const applyLayoutStyle = (node, style) => {
    if (!node) {
      return;
    }
    ensureBaseTypographyMetrics(node);
    const baseFontSize = parsePxValue(node.dataset.inlineBaseFontSize || 16);

    const hasX = typeof style?.x === 'number' && !Number.isNaN(style.x);
    const hasY = typeof style?.y === 'number' && !Number.isNaN(style.y);
    const hasWidth = typeof style?.width === 'number' && style.width > 0;
    const hasHeight = typeof style?.height === 'number' && style.height > 0;

    if (hasX) {
      node.style.setProperty('--cca-inline-offset-x', `${style.x}px`);
    } else {
      node.style.removeProperty('--cca-inline-offset-x');
    }

    if (hasY) {
      node.style.setProperty('--cca-inline-offset-y', `${style.y}px`);
    } else {
      node.style.removeProperty('--cca-inline-offset-y');
    }

    if (hasWidth) {
      node.style.setProperty('--cca-inline-width', `${style.width}px`);
    } else {
      node.style.removeProperty('--cca-inline-width');
    }

    if (hasHeight) {
      node.style.setProperty('--cca-inline-height', `${style.height}px`);
    } else {
      node.style.removeProperty('--cca-inline-height');
    }

    let fontSizeValue = null;
    if (typeof style?.fontSize === 'number' && !Number.isNaN(style.fontSize)) {
      fontSizeValue = style.fontSize;
    } else if (typeof style?.font === 'number' && !Number.isNaN(style.font)) {
      fontSizeValue = style.font;
    } else if (typeof style?.stretch === 'number' && !Number.isNaN(style.stretch)) {
      fontSizeValue = clampNumber(baseFontSize * style.stretch, 6, 320);
    }

    if (fontSizeValue !== null) {
      node.style.fontSize = `${fontSizeValue}px`;
      node.dataset.inlineBlockFont = fontSizeValue;
    } else if (node.dataset.inlineBlockFont) {
      node.style.removeProperty('font-size');
      delete node.dataset.inlineBlockFont;
    }

    let fontStretchValue = null;
    if (typeof style?.fontStretch === 'number' && !Number.isNaN(style.fontStretch)) {
      fontStretchValue = style.fontStretch;
    }

    if (fontStretchValue !== null) {
      const clamped = clampNumber(fontStretchValue, 0.5, 3.5);
      node.style.fontStretch = `${Math.round(clamped * 100)}%`;
      node.dataset.inlineBlockStretch = clamped;
    } else if (node.dataset.inlineBlockStretch) {
      node.style.removeProperty('font-stretch');
      delete node.dataset.inlineBlockStretch;
    }

    let scaleXValue = null;
    if (typeof style?.scaleX === 'number' && !Number.isNaN(style.scaleX)) {
      scaleXValue = clampNumber(style.scaleX, 0.2, 4);
    }

    if (scaleXValue !== null) {
      node.style.setProperty('--cca-inline-scale-x', scaleXValue);
      node.dataset.inlineBlockScaleX = scaleXValue;
    } else if (node.dataset.inlineBlockScaleX) {
      node.style.removeProperty('--cca-inline-scale-x');
      delete node.dataset.inlineBlockScaleX;
    }

    let scaleYValue = null;
    if (typeof style?.scaleY === 'number' && !Number.isNaN(style.scaleY)) {
      scaleYValue = clampNumber(style.scaleY, 0.2, 4);
    }

    if (scaleYValue !== null) {
      node.style.setProperty('--cca-inline-scale-y', scaleYValue);
      node.dataset.inlineBlockScaleY = scaleYValue;
    } else if (node.dataset.inlineBlockScaleY) {
      node.style.removeProperty('--cca-inline-scale-y');
      delete node.dataset.inlineBlockScaleY;
    }

    if (hasX || hasY || hasWidth || hasHeight || fontSizeValue !== null || fontStretchValue !== null || scaleXValue !== null || scaleYValue !== null) {
      node.classList.add('inline-block-customized');
    } else {
      node.classList.remove('inline-block-customized');
    }
  };

  const describeBlockTarget = (node) => {
    if (!node) {
      return '';
    }
    const tag = node.tagName ? node.tagName.toLowerCase() : 'div';
    const id = node.id ? `#${node.id}` : '';
    const classes = node.classList && node.classList.length ? `.${Array.from(node.classList).slice(0, 2).join('.')}` : '';
    return `${tag}${id}${classes}`;
  };

  const getBlockKey = (node) => {
    if (!node) {
      return '';
    }
    if (!node.dataset.inlineBlockKey || node.dataset.inlineBlockKey.length === 0) {
      node.dataset.inlineBlockKey = computeElementPath(node);
    }
    return node.dataset.inlineBlockKey;
  };

  const positionBlockOverlay = () => {
    if (!blockOverlay || blockOverlay.hidden || !activeBlockTarget) {
      return;
    }
    const rect = activeBlockTarget.getBoundingClientRect();
    blockOverlay.style.width = `${rect.width}px`;
    blockOverlay.style.height = `${rect.height}px`;
    blockOverlay.style.left = `${window.scrollX + rect.left}px`;
    blockOverlay.style.top = `${window.scrollY + rect.top}px`;
  };

  const ensureBlockOverlay = () => {
    if (blockOverlay) {
      return blockOverlay;
    }
    const overlay = document.createElement('div');
    overlay.dataset.flowbiteInlineUi = 'true';
    overlay.className = 'inline-block-overlay';
    overlay.hidden = true;

    const moveHandle = document.createElement('button');
    moveHandle.type = 'button';
    moveHandle.dataset.flowbiteInlineUi = 'true';
    moveHandle.className = 'inline-block-handle move';
    moveHandle.textContent = 'Move';
    moveHandle.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      startBlockMove(event);
    });
    overlay.appendChild(moveHandle);

    const resizeHandle = document.createElement('span');
    resizeHandle.dataset.flowbiteInlineUi = 'true';
    resizeHandle.className = 'inline-block-handle resize';
    resizeHandle.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      startBlockResize(event);
    });
    overlay.appendChild(resizeHandle);

    const toolbar = document.createElement('div');
    toolbar.dataset.flowbiteInlineUi = 'true';
    toolbar.className = 'inline-block-toolbar';

    const label = document.createElement('span');
    label.className = 'inline-block-label';
    toolbar.appendChild(label);

    const hint = document.createElement('span');
    hint.className = 'inline-block-hint';
    hint.textContent = 'Alt+Click another block to switch';
    toolbar.appendChild(hint);

    const resetButton = document.createElement('button');
    resetButton.type = 'button';
    resetButton.textContent = 'Reset';
    resetButton.addEventListener('click', (event) => {
      event.preventDefault();
      resetActiveBlockLayout();
    });
    toolbar.appendChild(resetButton);

    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.textContent = 'Close';
    closeButton.addEventListener('click', (event) => {
      event.preventDefault();
      clearBlockSelection();
    });
    toolbar.appendChild(closeButton);

    overlay.appendChild(toolbar);
    document.body.appendChild(overlay);
    blockOverlay = overlay;
    blockLabelEl = label;
    return overlay;
  };

  const updateBlockLabel = () => {
    if (!blockLabelEl || !activeBlockTarget) {
      return;
    }
    blockLabelEl.textContent = `Editing ${describeBlockTarget(activeBlockTarget)}`;
  };

  const clearBlockSelection = () => {
    if (activeBlockTarget) {
      delete activeBlockTarget.dataset.inlineBlockActive;
    }
    activeBlockTarget = null;
    activeBlockKey = '';
    if (blockOverlay) {
      blockOverlay.hidden = true;
    }
  };

  const highlightBlockTarget = (node) => {
    if (!node) {
      return;
    }
    if (activeBlockTarget && activeBlockTarget !== node) {
      delete activeBlockTarget.dataset.inlineBlockActive;
    }
    activeBlockTarget = node;
    activeBlockKey = getBlockKey(node);
    node.dataset.inlineBlockActive = 'true';
    const overlay = ensureBlockOverlay();
    overlay.hidden = false;
    updateBlockLabel();
    applyLayoutStyle(node, layoutOverrides[activeBlockKey]);
    positionBlockOverlay();
  };

  const resolveBlockSelectionTarget = (origin) => {
    if (!origin || origin === document.body) {
      return null;
    }
    if (origin.closest('[data-flowbite-inline-ui="true"]')) {
      return null;
    }
    let node = origin;
    while (node && node !== document.body) {
      if (BLOCK_SKIP_TAGS.has(node.tagName)) {
        node = node.parentElement;
        continue;
      }
      if (node.matches(BLOCK_SKIP_SELECTOR)) {
        node = node.parentElement;
        continue;
      }
      return node;
    }
    return null;
  };

  const commitBlockOverrides = (nextStyle) => {
    if (!activeBlockKey) {
      return;
    }
    const existing = { ...(layoutOverrides[activeBlockKey] || {}) };
    const merged = { ...existing };
    ['x', 'y', 'width', 'height'].forEach((prop) => {
      if (typeof nextStyle?.[prop] === 'number' && !Number.isNaN(nextStyle[prop])) {
        const rounded = Math.round(nextStyle[prop]);
        if (prop === 'width' || prop === 'height') {
          merged[prop] = Math.max(prop === 'width' ? 80 : 60, rounded);
        } else {
          merged[prop] = rounded;
        }
      }
    });
    if (typeof nextStyle?.fontSize === 'number' && !Number.isNaN(nextStyle.fontSize)) {
      merged.fontSize = clampNumber(nextStyle.fontSize, 6, 320);
    }
    if (typeof nextStyle?.fontStretch === 'number' && !Number.isNaN(nextStyle.fontStretch)) {
      merged.fontStretch = clampNumber(nextStyle.fontStretch, 0.5, 3.5);
    }
    if (typeof nextStyle?.scaleX === 'number' && !Number.isNaN(nextStyle.scaleX)) {
      merged.scaleX = clampNumber(nextStyle.scaleX, 0.2, 4);
    }
    if (typeof nextStyle?.scaleY === 'number' && !Number.isNaN(nextStyle.scaleY)) {
      merged.scaleY = clampNumber(nextStyle.scaleY, 0.2, 4);
    }
    const cleaned = {};
    ['x', 'y', 'width', 'height'].forEach((prop) => {
      if (typeof merged[prop] === 'number' && !Number.isNaN(merged[prop])) {
        cleaned[prop] = merged[prop];
      }
    });
    if (typeof merged.fontSize === 'number' && !Number.isNaN(merged.fontSize)) {
      cleaned.fontSize = merged.fontSize;
    }
    if (typeof merged.fontStretch === 'number' && !Number.isNaN(merged.fontStretch)) {
      cleaned.fontStretch = merged.fontStretch;
    }
    if (typeof merged.scaleX === 'number' && !Number.isNaN(merged.scaleX)) {
      cleaned.scaleX = merged.scaleX;
    }
    if (typeof merged.scaleY === 'number' && !Number.isNaN(merged.scaleY)) {
      cleaned.scaleY = merged.scaleY;
    }
    if (Object.keys(cleaned).length === 0) {
      delete layoutOverrides[activeBlockKey];
    } else {
      layoutOverrides[activeBlockKey] = cleaned;
    }
    saveLayoutOverrides(layoutOverrides);
    if (activeBlockTarget) {
      applyLayoutStyle(activeBlockTarget, layoutOverrides[activeBlockKey]);
    }
    showToast('Layout updated', 'success');
  };

  const resetActiveBlockLayout = () => {
    if (!activeBlockKey) {
      return;
    }
    delete layoutOverrides[activeBlockKey];
    saveLayoutOverrides(layoutOverrides);
    if (activeBlockTarget) {
      applyLayoutStyle(activeBlockTarget, undefined);
    }
    showToast('Layout reset', 'info');
    positionBlockOverlay();
  };

  const handleBlockPointerMove = (event) => {
    if (!blockDragState || !activeBlockTarget) {
      return;
    }
    event.preventDefault();
    const deltaX = event.clientX - blockDragState.startX;
    const deltaY = event.clientY - blockDragState.startY;
    if (blockDragState.mode === 'move') {
      const preview = { ...(layoutOverrides[activeBlockKey] || {}) };
      preview.x = blockDragState.originX + deltaX;
      preview.y = blockDragState.originY + deltaY;
      blockDragState.preview = preview;
      applyLayoutStyle(activeBlockTarget, preview);
    } else if (blockDragState.mode === 'resize') {
      const preview = { ...(layoutOverrides[activeBlockKey] || {}) };
      const targetWidth = Math.max(60, blockDragState.originWidth + deltaX);
      const targetHeight = Math.max(40, blockDragState.originHeight + deltaY);
      const baseWidth = blockDragState.baseWidth || targetWidth || 1;
      const baseHeight = blockDragState.baseHeight || targetHeight || 1;
      const ratioX = baseWidth > 0 ? clampNumber(targetWidth / baseWidth, 0.2, 4) : 1;
      const ratioY = baseHeight > 0 ? clampNumber(targetHeight / baseHeight, 0.2, 4) : 1;
      preview.scaleX = ratioX;
      preview.scaleY = ratioY;
      blockDragState.preview = preview;
      applyLayoutStyle(activeBlockTarget, preview);
    }
    positionBlockOverlay();
  };

  const endBlockInteraction = () => {
    document.removeEventListener('pointermove', handleBlockPointerMove);
    document.removeEventListener('pointerup', endBlockInteraction);
    if (blockDragState && blockDragState.preview) {
      commitBlockOverrides(blockDragState.preview);
    }
    blockDragState = null;
    positionBlockOverlay();
  };

  const startBlockMove = (event) => {
    if (!activeBlockTarget) {
      return;
    }
    const existing = layoutOverrides[activeBlockKey] || {};
    blockDragState = {
      mode: 'move',
      startX: event.clientX,
      startY: event.clientY,
      originX: existing.x || 0,
      originY: existing.y || 0,
      preview: null
    };
    document.addEventListener('pointermove', handleBlockPointerMove);
    document.addEventListener('pointerup', endBlockInteraction);
  };

  const startBlockResize = (event) => {
    if (!activeBlockTarget) {
      return;
    }
    const rect = activeBlockTarget.getBoundingClientRect();
    const measuredWidth = rect.width || activeBlockTarget.offsetWidth || 1;
    const measuredHeight = rect.height || activeBlockTarget.offsetHeight || 1;
    blockDragState = {
      mode: 'resize',
      startX: event.clientX,
      startY: event.clientY,
      originWidth: measuredWidth,
      originHeight: measuredHeight,
      preview: null,
      baseWidth: measuredWidth || 1,
      baseHeight: measuredHeight || 1
    };
    document.addEventListener('pointermove', handleBlockPointerMove);
    document.addEventListener('pointerup', endBlockInteraction);
  };

  const handleBlockSelect = (event) => {
    if (!editorEnabled || !event.altKey) {
      return;
    }
    if (event.target.closest('[data-flowbite-inline-ui="true"]')) {
      return;
    }
    const candidate = resolveBlockSelectionTarget(event.target);
    if (!candidate) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    highlightBlockTarget(candidate);
    if (!blockHintShown) {
      showToast('Drag handles to move or resize. Alt+Click another block to switch.', 'info');
      blockHintShown = true;
    }
  };

  const enableBlockSelection = () => {
    if (blockSelectionAttached) {
      return;
    }
    document.addEventListener('click', handleBlockSelect, true);
    window.addEventListener('scroll', positionBlockOverlay, true);
    window.addEventListener('resize', positionBlockOverlay);
    blockSelectionAttached = true;
  };

  const disableBlockSelection = () => {
    if (!blockSelectionAttached) {
      return;
    }
    document.removeEventListener('click', handleBlockSelect, true);
    window.removeEventListener('scroll', positionBlockOverlay, true);
    window.removeEventListener('resize', positionBlockOverlay);
    blockSelectionAttached = false;
    blockHintShown = false;
    clearBlockSelection();
  };

  const updateToggleContent = () => {
    if (!toggleButton) {
      return;
    }
    const label = editorEnabled ? 'Flowbite editor on' : 'Flowbite editor';
    toggleButton.innerHTML = `
      <span class="inline-flex items-center gap-2">
        <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        <span>${label}</span>
      </span>
    `;
    toggleButton.setAttribute('aria-pressed', editorEnabled ? 'true' : 'false');
  };

  const applyEditableDecor = () => {
    const nodes = document.querySelectorAll(SELECTOR);
    nodes.forEach((node) => {
      if (editorEnabled) {
        node.classList.add('ring-2', 'ring-cadott-green/60', 'ring-offset-2', 'cursor-pointer');
        if (!node.hasAttribute('tabindex')) {
          node.dataset.flowbiteInlineTab = 'added';
          node.tabIndex = 0;
        }
      } else {
        node.classList.remove('ring-2', 'ring-cadott-green/60', 'ring-offset-2', 'cursor-pointer');
        if (node.dataset.flowbiteInlineTab === 'added') {
          node.removeAttribute('tabindex');
          delete node.dataset.flowbiteInlineTab;
        }
      }
    });
  };

  const showToast = (message, variant = 'info') => {
    if (!toastEl) {
      return;
    }
    toastEl.textContent = message;
    toastEl.classList.remove('hidden');
    toastEl.classList.remove('bg-cadott-green', 'bg-cadott-ink');
    toastEl.classList.add(variant === 'success' ? 'bg-cadott-green' : 'bg-cadott-ink');
    window.clearTimeout(toastTimeoutId);
    toastTimeoutId = window.setTimeout(() => {
      toastEl.classList.add('hidden');
    }, 2400);
  };

  const handleAddCollectionEntry = (collectionPath) => {
    if (!collectionPath) {
      return;
    }
    const config = ensureConfig();
    const template = cloneEntryValue(selectCollectionTemplate(collectionPath));
    const entryPath = insertEntryAtPath(config, collectionPath, template);
    persistConfig(config);
    showToast('Added a new block', 'success');
    window.requestAnimationFrame(() => {
      renderCollectionControls();
      focusEntryPath(entryPath);
    });
  };

  const handleRemoveCollectionEntry = (entryPath) => {
    if (!entryPath) {
      return;
    }
    if (!window.confirm('Remove this item?')) {
      return;
    }
    const config = ensureConfig();
    const removed = deleteEntryAtPath(config, entryPath);
    if (!removed) {
      showToast('Unable to remove entry', 'info');
      return;
    }
    persistConfig(config);
    showToast('Entry removed', 'info');
    window.requestAnimationFrame(() => {
      renderCollectionControls();
    });
  };

  const detachCollectionControls = () => {
    document.querySelectorAll('[data-flowbite-collection-bar="true"], [data-flowbite-entry-actions="true"]').forEach((node) => {
      node.remove();
    });
  };

  const renderCollectionControls = () => {
    detachCollectionControls();
    if (!editorEnabled) {
      return;
    }
    document.querySelectorAll('[data-config-collection]').forEach((container) => {
      const collectionPath = container.dataset.configCollection;
      if (!collectionPath) {
        return;
      }
      let bar = container.querySelector('[data-flowbite-collection-bar="true"]');
      if (!bar) {
        bar = document.createElement('div');
        bar.className = 'inline-collection-bar';
        bar.dataset.flowbiteCollectionBar = 'true';
        const addButton = document.createElement('button');
        addButton.type = 'button';
        addButton.className = 'inline-collection-add';
        addButton.dataset.flowbiteInlineUi = 'true';
        addButton.setAttribute('aria-label', 'Add block');
        addButton.textContent = '+';
        addButton.addEventListener('click', () => {
          handleAddCollectionEntry(collectionPath);
        });
        bar.appendChild(addButton);
        container.appendChild(bar);
      }

      container.querySelectorAll('[data-config-entry]').forEach((entryNode) => {
        const entryPath = entryNode.dataset.configEntry;
        if (!entryPath || entryNode.querySelector('[data-flowbite-entry-actions="true"]')) {
          return;
        }
        const actions = document.createElement('div');
        actions.className = 'inline-entry-actions';
        actions.dataset.flowbiteEntryActions = 'true';

        const removeButton = document.createElement('button');
        removeButton.type = 'button';
        removeButton.className = 'inline-entry-remove';
        removeButton.dataset.flowbiteInlineUi = 'true';
        removeButton.setAttribute('aria-label', 'Remove block');
        removeButton.textContent = '×';
        removeButton.addEventListener('click', () => {
          handleRemoveCollectionEntry(entryPath);
        });

        actions.appendChild(removeButton);
        entryNode.appendChild(actions);
      });
    });
  };

  const focusEntryPath = (entryPath) => {
    if (!entryPath) {
      return;
    }
    window.setTimeout(() => {
      const newest = document.querySelector(`[data-config-entry="${entryPath}"]`);
      if (!newest) {
        return;
      }
      newest.scrollIntoView({ behavior: 'smooth', block: 'center' });
      newest.classList.add('ring', 'ring-cadott-green/40');
      window.setTimeout(() => {
        newest.classList.remove('ring', 'ring-cadott-green/40');
      }, 1600);
    }, 120);
  };


  const setModalMode = (mode) => {
    const isMedia = mode === 'media';
    if (modalTextField) {
      modalTextField.hidden = isMedia;
      modalTextField.classList.toggle('hidden', isMedia);
    }
    if (modalMediaControls) {
      modalMediaControls.hidden = !isMedia;
      modalMediaControls.classList.toggle('hidden', !isMedia);
    }
  };

  const updateMediaPreview = (value) => {
    if (!modalMediaPreviewWrapper || !modalMediaPreview) {
      return;
    }
    const url = typeof value === 'string' ? value.trim() : '';
    if (!url) {
      modalMediaPreviewWrapper.hidden = true;
      modalMediaPreviewWrapper.classList.add('hidden');
      modalMediaPreview.src = '';
      modalMediaPreview.alt = '';
      return;
    }
    modalMediaPreviewWrapper.hidden = false;
    modalMediaPreviewWrapper.classList.remove('hidden');
    modalMediaPreview.src = url;
    modalMediaPreview.alt = 'Inline preview';
  };

  const closeModal = () => {
    if (!modalEl) {
      return;
    }
    modalEl.classList.add('hidden');
    modalEl.setAttribute('aria-hidden', 'true');
    activeTarget = null;
    activePath = '';
    activeType = 'config';
    activeAttr = '';
    if (modalTextarea) {
      modalTextarea.value = '';
    }
    if (modalFontControls) {
      modalFontControls.classList.add('hidden');
      modalFontControls.hidden = true;
    }
    if (modalFontFamilyInput) {
      modalFontFamilyInput.value = '';
      modalFontFamilyInput.placeholder = '';
    }
    if (modalFontSizeInput) {
      modalFontSizeInput.value = '';
      modalFontSizeInput.placeholder = '';
    }
    if (modalMediaUrlInput) {
      modalMediaUrlInput.value = '';
      modalMediaUrlInput.placeholder = 'https://';
    }
    updateMediaPreview('');
    setModalMode('text');
    if (modalPathLabel) {
      modalPathLabel.textContent = '';
    }
  };

  const showFontControlsForTarget = (target, key, type) => {
    if (!modalFontControls || !modalFontFamilyInput || !modalFontSizeInput) {
      return;
    }
    if (!supportsFontControls(type) || !key) {
      modalFontControls.classList.add('hidden');
      modalFontControls.hidden = true;
      modalFontFamilyInput.value = '';
      modalFontFamilyInput.placeholder = '';
      modalFontSizeInput.value = '';
      modalFontSizeInput.placeholder = '';
      return;
    }
    modalFontControls.hidden = false;
    modalFontControls.classList.remove('hidden');
    const entry = unpackFontOverride(fontOverrides[key]);
    modalFontFamilyInput.value = entry.family || '';
    modalFontSizeInput.value = entry.size || '';
    if (target) {
      const computed = window.getComputedStyle(target);
      modalFontFamilyInput.placeholder = computed.fontFamily || 'inherit';
      modalFontSizeInput.placeholder = computed.fontSize || '16px';
    } else {
      modalFontFamilyInput.placeholder = 'inherit';
      modalFontSizeInput.placeholder = '16px';
    }
  };

  const openModalForTarget = (target) => {
    if (!modalEl || !modalTextarea || !modalPathLabel) {
      return;
    }
    const configPath = target.dataset.configField || target.dataset.configText || '';
    const attrName = !configPath ? target.dataset.configAttr : '';
    const attrKey = attrName && target.dataset.configKey ? target.dataset.configKey : '';
    const mediaKey = !configPath && !attrKey ? target.dataset.inlineMediaKey || '' : '';
    const copyKey = !configPath && !attrKey && !mediaKey ? target.dataset.inlineCopyKey || '' : '';

    let type = 'copy';
    if (configPath) {
      type = 'config';
    } else if (attrKey) {
      type = 'config-attr';
    } else if (mediaKey) {
      type = 'media';
    } else if (copyKey) {
      type = 'copy';
    }

    activeTarget = target;
    activePath = configPath || attrKey || mediaKey || copyKey;
    activeType = type;
    activeAttr = type === 'config-attr' ? attrName || '' : type === 'media' ? target.dataset.inlineMediaAttr || 'src' : '';

    let value = '';
    if (type === 'config') {
      const config = ensureConfig();
      value = getValue(config, activePath);
      if (typeof value !== 'string') {
        value = target.textContent || '';
      }
    } else if (type === 'config-attr') {
      const config = ensureConfig();
      value = getValue(config, activePath);
      if (typeof value !== 'string' || value.length === 0) {
        const attrValue = activeAttr ? target.getAttribute(activeAttr) || '' : '';
        const prefix = target.dataset.configPrefix || '';
        const suffix = target.dataset.configSuffix || '';
        value = attrValue;
        if (prefix && value.startsWith(prefix)) {
          value = value.slice(prefix.length);
        }
        if (suffix && value.endsWith(suffix)) {
          value = value.slice(0, value.length - suffix.length);
        }
      }
    } else {
      if (type === 'media') {
        const overrides = loadMediaOverrides();
        if (activePath && Object.prototype.hasOwnProperty.call(overrides, activePath)) {
          value = overrides[activePath];
        } else if (activeAttr) {
          value = target.getAttribute(activeAttr) || '';
        }
      } else {
        const overrides = loadCopyOverrides();
        if (activePath && Object.prototype.hasOwnProperty.call(overrides, activePath)) {
          value = overrides[activePath];
        } else {
          value = target.textContent || '';
        }
      }
    }

    if (type === 'media') {
      setModalMode('media');
      if (modalMediaUrlInput) {
        modalMediaUrlInput.value = value || '';
        modalMediaUrlInput.placeholder = target?.getAttribute(activeAttr) || 'https://';
        updateMediaPreview(modalMediaUrlInput.value);
      }
    } else {
      setModalMode('text');
      modalTextarea.value = value || '';
    }
    if (type === 'config-attr' && activeAttr) {
      modalPathLabel.textContent = `${activePath || 'config attr'} [${activeAttr}]`;
    } else {
      modalPathLabel.textContent = activePath || (type === 'media' ? 'inline media' : 'inline copy');
    }
    showFontControlsForTarget(target, activePath, type);
    modalEl.classList.remove('hidden');
    modalEl.setAttribute('aria-hidden', 'false');
    window.setTimeout(() => {
      if (type === 'media' && modalMediaUrlInput) {
        modalMediaUrlInput.focus();
        const len = modalMediaUrlInput.value.length;
        modalMediaUrlInput.setSelectionRange(len, len);
      } else {
        modalTextarea.focus();
        modalTextarea.setSelectionRange(modalTextarea.value.length, modalTextarea.value.length);
      }
    }, 0);
  };

  const handleModalSave = () => {
    if (!activePath) {
      closeModal();
      return;
    }
    const nextValue = activeType === 'media'
      ? (modalMediaUrlInput ? modalMediaUrlInput.value.trim() : '')
      : modalTextarea.value;

    if (activeType === 'config') {
      const config = ensureConfig();
      setValue(config, activePath, nextValue);
      persistConfig(config);
      if (activeTarget) {
        const typeDescriptor = activeTarget.dataset.configFieldType || '';
        if (typeDescriptor.startsWith('attr:')) {
          const attrName = typeDescriptor.split(':')[1];
          if (attrName) {
            activeTarget.setAttribute(attrName, nextValue);
          }
        } else if (activeTarget.dataset && activeTarget.dataset.configAttr && activeTarget.dataset.configKey === activePath) {
          const attrName = activeTarget.dataset.configAttr;
          const prefix = activeTarget.dataset.configPrefix || '';
          const suffix = activeTarget.dataset.configSuffix || '';
          activeTarget.setAttribute(attrName, `${prefix}${nextValue}${suffix}`);
        } else {
          activeTarget.textContent = nextValue;
        }
      }
      showToast('Saved to site config', 'success');
    } else if (activeType === 'config-attr') {
      const config = ensureConfig();
      setValue(config, activePath, nextValue);
      persistConfig(config);
      if (activeTarget && activeAttr) {
        const prefix = activeTarget.dataset.configPrefix || '';
        const suffix = activeTarget.dataset.configSuffix || '';
        activeTarget.setAttribute(activeAttr, `${prefix}${nextValue}${suffix}`);
      }
      showToast('Saved to site config', 'success');
    } else {
      if (activeType === 'media') {
        const overrides = loadMediaOverrides();
        if (nextValue) {
          overrides[activePath] = nextValue;
        } else {
          delete overrides[activePath];
        }
        saveMediaOverrides(overrides);
        if (activeTarget && activeAttr) {
          if (nextValue) {
            activeTarget.setAttribute(activeAttr, nextValue);
          } else if (activeTarget.dataset.inlineMediaOriginal) {
            activeTarget.setAttribute(activeAttr, activeTarget.dataset.inlineMediaOriginal);
          } else {
            activeTarget.removeAttribute(activeAttr);
          }
        }
        showToast(nextValue ? 'Image updated' : 'Image removed', nextValue ? 'success' : 'info');
      } else {
        const overrides = loadCopyOverrides();
        overrides[activePath] = nextValue;
        saveCopyOverrides(overrides);
        if (activeTarget) {
          activeTarget.textContent = nextValue;
        }
        showToast('Inline text updated', 'success');
      }
    }

    closeModal();
  };

  const handleEditableClick = (event) => {
    if (!editorEnabled) {
      return;
    }
    if (event.altKey) {
      return;
    }
    const uiElement = event.target.closest('[data-flowbite-inline-ui="true"]');
    if (uiElement) {
      return;
    }
    const target = event.target.closest(SELECTOR);
    if (!target) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    openModalForTarget(target);
  };

  const handleEditableKeydown = (event) => {
    if (!editorEnabled) {
      return;
    }
    if (event.key !== 'Enter') {
      return;
    }
    const target = event.target.closest(SELECTOR);
    if (!target) {
      return;
    }
    event.preventDefault();
    openModalForTarget(target);
  };

  const toggleEditor = (state) => {
    editorEnabled = state;
    body.dataset.flowbiteInlineEditor = editorEnabled ? 'on' : 'off';
    updateToggleContent();
    updateStatusPill();
    applyEditableDecor();
    if (editorEnabled) {
      enableBlockSelection();
      renderCollectionControls();
      showToast('Tap highlighted copy or Alt+Click blocks to edit layout', 'info');
    } else {
      disableBlockSelection();
      detachCollectionControls();
    }
  };

  const createToggleButton = () => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.flowbiteInlineUi = 'true';
    button.className = 'fixed bottom-6 right-6 z-40 inline-flex items-center justify-center rounded-full bg-cadott-ink px-5 py-3 text-sm font-semibold text-white shadow-xl shadow-cadott-ink/30 transition hover:bg-cadott-green focus:outline-none focus-visible:ring-4 focus-visible:ring-cadott-blue/30';
    button.addEventListener('click', () => {
      toggleEditor(!editorEnabled);
    });
    document.body.appendChild(button);
    toggleButton = button;
    updateToggleContent();
  };

  const createModal = () => {
    const overlay = document.createElement('div');
    overlay.dataset.flowbiteInlineUi = 'true';
    overlay.className = 'fixed inset-0 z-50 hidden items-center justify-center bg-slate-900/50 px-4 py-8';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.innerHTML = `
      <div class="w-full max-w-2xl rounded-3xl bg-white shadow-2xl">
        <div class="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <p class="text-xs font-semibold uppercase tracking-[0.4em] text-slate-400">Flowbite editor</p>
            <h3 class="text-lg font-semibold text-cadott-ink">Edit content</h3>
          </div>
          <button type="button" class="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:text-cadott-ink" data-flowbite-modal-close>
            <svg class="h-4 w-4" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" fill="none">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div class="space-y-4 px-6 py-6">
          <div class="space-y-3" data-flowbite-modal-text-field>
            <label class="text-sm font-semibold text-slate-600" for="flowbite-inline-editor-textarea">Content</label>
            <textarea id="flowbite-inline-editor-textarea" class="h-40 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 shadow-inner shadow-slate-100 focus:border-cadott-green focus:ring-2 focus:ring-cadott-green/30"></textarea>
            <div class="space-y-3 rounded-2xl border border-slate-100 p-4" data-flowbite-font-controls hidden>
              <p class="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Typography</p>
              <div class="grid gap-4 md:grid-cols-2">
                <label class="space-y-1 text-sm font-semibold text-slate-600" for="flowbite-inline-font-family">
                  <span class="block">Font family</span>
                  <input id="flowbite-inline-font-family" list="flowbite-inline-font-options" class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal text-slate-700 focus:border-cadott-green focus:ring-2 focus:ring-cadott-green/20" placeholder="inherit" data-flowbite-font-family />
                  <datalist id="flowbite-inline-font-options">
                    <option value="General Sans"></option>
                    <option value="Clash Display"></option>
                    <option value="Space Grotesk"></option>
                    <option value="Fraunces"></option>
                    <option value="Outfit"></option>
                    <option value="Playfair Display"></option>
                    <option value="Archivo"></option>
                    <option value="Syne"></option>
                    <option value="Newsreader"></option>
                    <option value="IBM Plex Mono"></option>
                  </datalist>
                </label>
                <label class="space-y-1 text-sm font-semibold text-slate-600" for="flowbite-inline-font-size">
                  <span class="block">Font size</span>
                  <input id="flowbite-inline-font-size" class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal text-slate-700 focus:border-cadott-green focus:ring-2 focus:ring-cadott-green/20" placeholder="16px" data-flowbite-font-size inputmode="decimal" />
                  <span class="text-xs font-medium text-slate-400">Accepts px, rem, clamp(), etc. Leave blank to inherit.</span>
                </label>
              </div>
            </div>
          </div>
          <div class="space-y-3 rounded-2xl border border-slate-100 p-4" data-flowbite-media-controls hidden>
            <div class="flex items-center justify-between">
              <p class="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Media embed</p>
              <button type="button" class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 transition hover:text-cadott-green" data-flowbite-media-reset>Reset</button>
            </div>
            <label class="space-y-1 text-sm font-semibold text-slate-600" for="flowbite-inline-media-url">
              <span class="block">Image URL</span>
              <input id="flowbite-inline-media-url" type="url" class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-cadott-green focus:ring-2 focus:ring-cadott-green/20" placeholder="https://" data-flowbite-media-url inputmode="url" />
              <span class="text-xs font-medium text-slate-400">Use a public https:// link to an image asset.</span>
            </label>
            <div class="space-y-2" data-flowbite-media-preview hidden>
              <span class="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Preview</span>
              <div class="overflow-hidden rounded-2xl border border-slate-100 bg-slate-50">
                <img class="max-h-72 w-full object-cover" alt="" data-flowbite-media-preview-image />
              </div>
            </div>
          </div>
          <p class="text-xs uppercase tracking-[0.3em] text-slate-400" data-flowbite-field-path></p>
        </div>
        <div class="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
          <button type="button" class="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50" data-flowbite-modal-cancel>Cancel</button>
          <button type="button" class="rounded-full bg-cadott-green px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-cadott-green/40 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-cadott-green" data-flowbite-modal-save>Save</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    modalEl = overlay;
    modalTextarea = overlay.querySelector('textarea');
    modalPathLabel = overlay.querySelector('[data-flowbite-field-path]');
    modalFontControls = overlay.querySelector('[data-flowbite-font-controls]');
    modalFontFamilyInput = overlay.querySelector('[data-flowbite-font-family]');
    modalFontSizeInput = overlay.querySelector('[data-flowbite-font-size]');
    modalTextField = overlay.querySelector('[data-flowbite-modal-text-field]');
    modalMediaControls = overlay.querySelector('[data-flowbite-media-controls]');
    modalMediaUrlInput = overlay.querySelector('[data-flowbite-media-url]');
    modalMediaPreviewWrapper = overlay.querySelector('[data-flowbite-media-preview]');
    modalMediaPreview = overlay.querySelector('[data-flowbite-media-preview-image]');
    const commitFontInputs = () => {
      updateFontOverrideForActive();
    };
    if (modalFontFamilyInput) {
      ['change', 'blur'].forEach((eventName) => {
        modalFontFamilyInput.addEventListener(eventName, commitFontInputs);
      });
      modalFontFamilyInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          commitFontInputs();
        }
      });
    }
    if (modalFontSizeInput) {
      ['change', 'blur'].forEach((eventName) => {
        modalFontSizeInput.addEventListener(eventName, commitFontInputs);
      });
      modalFontSizeInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          commitFontInputs();
        }
      });
    }
    if (modalMediaUrlInput) {
      const syncMediaPreview = () => {
        updateMediaPreview(modalMediaUrlInput.value);
      };
      ['input', 'change', 'blur'].forEach((eventName) => {
        modalMediaUrlInput.addEventListener(eventName, syncMediaPreview);
      });
      modalMediaUrlInput.addEventListener('keydown', (event) => {
        if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
          event.preventDefault();
          handleModalSave();
        }
      });
    }
    const mediaResetButton = overlay.querySelector('[data-flowbite-media-reset]');
    if (mediaResetButton) {
      mediaResetButton.addEventListener('click', (event) => {
        event.preventDefault();
        if (modalMediaUrlInput) {
          modalMediaUrlInput.value = '';
          updateMediaPreview('');
          modalMediaUrlInput.focus();
        }
      });
    }
    overlay.querySelector('[data-flowbite-modal-save]').addEventListener('click', handleModalSave);
    overlay.querySelector('[data-flowbite-modal-cancel]').addEventListener('click', closeModal);
    overlay.querySelector('[data-flowbite-modal-close]').addEventListener('click', closeModal);
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) {
        closeModal();
      }
    });
    modalTextarea.addEventListener('keydown', (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault();
        handleModalSave();
      }
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !modalEl.classList.contains('hidden')) {
        closeModal();
      }
    });
  };

  const createToast = () => {
    const toast = document.createElement('div');
    toast.dataset.flowbiteInlineUi = 'true';
    toast.className = 'fixed bottom-6 left-1/2 z-40 hidden -translate-x-1/2 rounded-full px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-slate-900/40';
    toast.setAttribute('role', 'status');
    document.body.appendChild(toast);
    toastEl = toast;
  };

  const updateStatusPill = () => {
    if (!statusPill) {
      return;
    }
    const statusText = statusPill.querySelector('[data-inline-status-text]');
    const statusHint = statusPill.querySelector('[data-inline-status-hint]');
    statusPill.classList.remove('on', 'locked');

    if (!inlineUnlocked) {
      statusText.textContent = '';
      statusHint.textContent = '';
      statusPill.classList.add('hidden');
      return;
    } else if (editorEnabled) {
      statusText.textContent = 'Inline editor on';
      statusHint.textContent = 'Click copy or Alt+Click blocks';
      statusPill.classList.add('on');
    } else {
      statusText.textContent = 'Inline editor off';
      statusHint.textContent = 'Use floating button to edit';
    }
    statusPill.classList.remove('hidden');
  };

  const createStatusPill = () => {
    if (statusPill) {
      return statusPill;
    }
    const pill = document.createElement('div');
    pill.dataset.flowbiteInlineUi = 'true';
    pill.className = 'inline-status-pill hidden';
    pill.innerHTML = `
      <span class="dot"></span>
      <span data-inline-status-text>Inline editor</span>
      <span class="hint" data-inline-status-hint></span>
    `;
    document.body.appendChild(pill);
    statusPill = pill;
    updateStatusPill();
    return pill;
  };

  const toggleHelpOverlay = (forceState) => {
    if (!helpOverlay) {
      return;
    }
    const nextVisible = typeof forceState === 'boolean' ? forceState : !helpOverlay.classList.contains('visible');
    if (nextVisible) {
      helpOverlay.classList.add('visible');
    } else {
      helpOverlay.classList.remove('visible');
    }
  };

  const createHelpOverlay = () => {
    if (helpOverlay) {
      return helpOverlay;
    }
    const overlay = document.createElement('div');
    overlay.dataset.flowbiteInlineUi = 'true';
    overlay.className = 'inline-help-overlay';
    overlay.innerHTML = `
      <div class="inline-help-card" role="dialog" aria-modal="true" aria-label="Inline editor shortcuts">
        <h3>Inline editor shortcuts</h3>
        <p>Keep it fast while you edit live on the page.</p>
        <div class="inline-help-grid">
          <div class="inline-help-item">
            <h4><span class="inline-help-kbd">Alt</span>+<span class="inline-help-kbd">Click</span></h4>
            <p>Select a block to move or resize.</p>
          </div>
          <div class="inline-help-item">
            <h4><span class="inline-help-kbd">Ctrl</span>/<span class="inline-help-kbd">Cmd</span>+<span class="inline-help-kbd">Enter</span></h4>
            <p>Save edits quickly inside the modal.</p>
          </div>
          <div class="inline-help-item">
            <h4><span class="inline-help-kbd">Esc</span></h4>
            <p>Close the modal or help panel.</p>
          </div>
          <div class="inline-help-item">
            <h4><span class="inline-help-kbd">Alt</span>+<span class="inline-help-kbd">Shift</span>+<span class="inline-help-kbd">E</span></h4>
            <p>Unlock the inline editor (if locked).</p>
          </div>
          <div class="inline-help-item">
            <h4><span class="inline-help-kbd">?</span></h4>
            <p>Show or hide this help panel.</p>
          </div>
        </div>
        <div class="inline-help-actions">
          <button type="button" class="inline-help-button" data-inline-help-close>Close</button>
        </div>
      </div>
    `;
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) {
        toggleHelpOverlay(false);
      }
    });
    const closeBtn = overlay.querySelector('[data-inline-help-close]');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => toggleHelpOverlay(false));
    }
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && overlay.classList.contains('visible')) {
        toggleHelpOverlay(false);
      }
    });
    document.body.appendChild(overlay);
    helpOverlay = overlay;
    return overlay;
  };

  const handleHelpShortcut = (event) => {
    if (!inlineUnlocked) {
      return;
    }
    const key = event.key;
    if (key !== '?' && !(key === '/' && event.shiftKey)) {
      return;
    }
    if (document.querySelector('[role="dialog"]:not(.hidden)')) {
      return;
    }
    event.preventDefault();
    toggleHelpOverlay();
  };

  const getInlineSecret = () => {
    if (body && body.dataset && body.dataset.inlineSecret && body.dataset.inlineSecret.trim().length > 0) {
      return body.dataset.inlineSecret.trim();
    }
    return '123';
  };

  function handleUnlockShortcut(event) {
    if (inlineUnlocked || !event.altKey || !event.shiftKey) {
      return;
    }
    const key = (event.key || '').toLowerCase();
    const code = (event.code || '').toLowerCase();
    const matches = key === INLINE_UNLOCK_SHORTCUT_KEY || code === `key${INLINE_UNLOCK_SHORTCUT_KEY}`;
    if (!matches) {
      return;
    }
    event.preventDefault();
    requestInlineUnlock();
  }

  function detachUnlockShortcut() {
    if (!unlockShortcutAttached) {
      return;
    }
    window.removeEventListener('keydown', handleUnlockShortcut);
    unlockShortcutAttached = false;
  }

  function attachUnlockShortcut() {
    if (unlockShortcutAttached || inlineUnlocked) {
      return;
    }
    window.addEventListener('keydown', handleUnlockShortcut);
    unlockShortcutAttached = true;
  }

  function markInlineUnlocked(options = {}) {
    const { silent = false } = options;
    inlineUnlocked = true;
    detachUnlockShortcut();
    updateStatusPill();
    if (!toggleButton) {
      createToggleButton();
    }
    if (!silent) {
      showToast('Inline editor unlocked', 'success');
    }
  }

  function requestInlineUnlock() {
    if (inlineUnlocked || unlockPromptActive) {
      return;
    }
    unlockPromptActive = true;
    const attempt = window.prompt('Enter inline edit key');
    unlockPromptActive = false;
    if (!attempt) {
      showToast('Unlock cancelled', 'info');
      return;
    }
    if (attempt.trim() === getInlineSecret()) {
      markInlineUnlocked();
      return;
    }
    showToast('Incorrect key', 'info');
  }

  function lockInlineEditor() {
    inlineUnlocked = false;
    if (editorEnabled) {
      toggleEditor(false);
    }
    if (toggleButton) {
      toggleButton.remove();
      toggleButton = null;
    }
    attachUnlockShortcut();
    toggleHelpOverlay(false);
    updateStatusPill();
    showToast('Inline editor locked', 'info');
  }

  function setupInlineUnlock() {
    inlineUnlocked = false;
    attachUnlockShortcut();
    const params = new URLSearchParams(window.location.search);
    if (params.has(INLINE_UNLOCK_QUERY_PARAM)) {
      window.setTimeout(requestInlineUnlock, 0);
    }
  }

  const init = () => {
    injectInlineEditorStyles();
    layoutOverrides = loadLayoutOverrides();
    fontOverrides = loadFontOverrides();
    createModal();
    createToast();
    createStatusPill();
    createHelpOverlay();
    setupInlineUnlock();
    document.addEventListener('click', handleEditableClick, true);
    document.addEventListener('keydown', handleEditableKeydown, true);
    document.addEventListener('keydown', handleHelpShortcut, true);
  };

  init();

  window.addEventListener('cca-config-updated', (event) => {
    if (event && event.detail && event.detail.config) {
      cachedConfig = event.detail.config;
    } else if (window.CCAConfig && typeof window.CCAConfig.loadConfig === 'function') {
      cachedConfig = window.CCAConfig.loadConfig();
    }
    if (editorEnabled) {
      window.requestAnimationFrame(applyEditableDecor);
      window.requestAnimationFrame(renderCollectionControls);
    }
  });

  window.addEventListener('cca-inline-copy-updated', () => {
    if (editorEnabled) {
      window.requestAnimationFrame(applyEditableDecor);
    }
  });

  window.addEventListener('cca-inline-font-updated', (event) => {
    fontOverrides = event?.detail?.overrides || loadFontOverrides();
    if (activeTarget && supportsFontControls(activeType) && activePath) {
      const entry = fontOverrides[activePath];
      if (entry) {
        applyFontStyleToTarget(activeTarget, entry);
      }
    }
  });

  window.addEventListener('cca-inline-layout-updated', (event) => {
    layoutOverrides = event?.detail?.overrides || loadLayoutOverrides();
    if (activeBlockTarget && activeBlockKey) {
      applyLayoutStyle(activeBlockTarget, layoutOverrides[activeBlockKey]);
      positionBlockOverlay();
    }
  });
})();
