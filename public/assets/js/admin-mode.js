(function () {
  'use strict';

  const UPDATE_EVENT = 'cca-config-updated';
  const AUTH_STORAGE_KEY = 'ccaInlineAdminCredentials';
  const STYLE_STORAGE_KEY = 'ccaInlineStyleOverrides';
  const COPY_STORAGE_KEY = 'ccaInlineCopyOverrides';
  const FONT_STORAGE_KEY = 'ccaInlineFontOverrides';
  const ADMIN_UNLOCK_STORAGE_KEY = 'ccaInlineAdminUnlocked';
  const ADMIN_QUERY_PARAM = 'admin';
  const LAYOUT_STORAGE_KEY = 'ccaInlineLayoutOverrides';
  const EDITABLE_NODE_SELECTOR = '[data-config-text], [data-config-field], [data-inline-copy-key]';
  const BLOCK_SKIP_TAGS = new Set(['HTML', 'BODY', 'HEAD', 'SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE']);
  const BLOCK_SKIP_SELECTOR = '.inline-block-overlay, .inline-control-bar, .inline-admin-pill, .inline-admin-toast, .inline-text-toolbar';

  const loadInlineStyles = () => {
    try {
      const raw = localStorage.getItem(STYLE_STORAGE_KEY);
      if (!raw) {
        return {};
      }
      return JSON.parse(raw);
    } catch (error) {
      console.warn('Inline admin: unable to load style overrides.', error);
      return {};
    }
  };

  const saveInlineStyles = (styles) => {
    try {
      localStorage.setItem(STYLE_STORAGE_KEY, JSON.stringify(styles));
    } catch (error) {
      console.warn('Inline admin: unable to save style overrides.', error);
    }
  };

  const loadInlineCopyOverrides = () => {
    try {
      const raw = localStorage.getItem(COPY_STORAGE_KEY);
      if (!raw) {
        return {};
      }
      return JSON.parse(raw);
    } catch (error) {
      console.warn('Inline admin: unable to load copy overrides.', error);
      return {};
    }
  };

  const saveInlineCopyOverrides = (overrides) => {
    try {
      localStorage.setItem(COPY_STORAGE_KEY, JSON.stringify(overrides));
    } catch (error) {
      console.warn('Inline admin: unable to save copy overrides.', error);
    }
  };

  const loadInlineFontOverrides = () => {
    try {
      const raw = localStorage.getItem(FONT_STORAGE_KEY);
      if (!raw) {
        return {};
      }
      return JSON.parse(raw);
    } catch (error) {
      console.warn('Inline admin: unable to load font overrides.', error);
      return {};
    }
  };

  const saveInlineFontOverrides = (overrides) => {
    try {
      localStorage.setItem(FONT_STORAGE_KEY, JSON.stringify(overrides));
    } catch (error) {
      console.warn('Inline admin: unable to save font overrides.', error);
    }
  };

  const loadLayoutOverrides = () => {
    try {
      const raw = localStorage.getItem(LAYOUT_STORAGE_KEY);
      if (!raw) {
        return {};
      }
      return JSON.parse(raw);
    } catch (error) {
      console.warn('Inline admin: unable to load layout overrides.', error);
      return {};
    }
  };

  const saveLayoutOverrides = (overrides) => {
    try {
      localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(overrides));
    } catch (error) {
      console.warn('Inline admin: unable to save layout overrides.', error);
    }
  };

  const getValue = (source, path) => {
    if (!source || !path) {
      return undefined;
    }
    return path.split('.').reduce((acc, key) => {
      if (acc && Object.prototype.hasOwnProperty.call(acc, key)) {
        return acc[key];
      }
      return undefined;
    }, source);
  };

  const setValue = (source, path, nextValue) => {
    if (!source || !path) {
      return;
    }
    const keys = path.split('.');
    let cursor = source;

    keys.forEach((key, index) => {
      if (index === keys.length - 1) {
        cursor[key] = nextValue;
        return;
      }
      if (!cursor[key] || typeof cursor[key] !== 'object') {
        cursor[key] = {};
      }
      cursor = cursor[key];
    });
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

  const getBlockKey = (node) => {
    if (!node) {
      return '';
    }
    if (!node.dataset.inlineBlockKey) {
      node.dataset.inlineBlockKey = computeElementPath(node);
    }
    return node.dataset.inlineBlockKey;
  };

  const applyLayoutStyle = (node, style) => {
    if (!node) {
      return;
    }
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

    const hasAny = hasX || hasY || hasWidth || hasHeight;
    if (hasAny) {
      node.classList.add('inline-block-customized');
    } else {
      node.classList.remove('inline-block-customized');
    }
  };

  const deleteEntryAtPath = (source, entryPath) => {
    if (!source || !entryPath) {
      return;
    }
    const parts = entryPath.split('.');
    const index = Number(parts.pop());
    const collectionPath = parts.join('.');
    const list = getValue(source, collectionPath);
    if (!Array.isArray(list)) {
      return;
    }
    list.splice(index, 1);
  };

  const insertEntryAtPath = (source, collectionPath, template) => {
    if (!source || !collectionPath) {
      return;
    }
    const list = getValue(source, collectionPath);
    if (!Array.isArray(list)) {
      setValue(source, collectionPath, []);
    }
    const resolvedList = getValue(source, collectionPath);
    resolvedList.push(template);
    return `${collectionPath}.${resolvedList.length - 1}`;
  };

  const cloneEntry = (value) => {
    if (Array.isArray(value)) {
      return value.map((item) => cloneEntry(item));
    }
    if (value && typeof value === 'object') {
      return Object.keys(value).reduce((acc, key) => {
        acc[key] = cloneEntry(value[key]);
        return acc;
      }, {});
    }
    return value;
  };

  const dispatchConfigUpdate = (config) => {
    window.dispatchEvent(new CustomEvent(UPDATE_EVENT, { detail: { config } }));
  };

  const loadCredentials = () => {
    try {
      const raw = localStorage.getItem(AUTH_STORAGE_KEY);
      if (!raw) {
        return null;
      }
      return JSON.parse(raw);
    } catch (error) {
      console.warn('Inline admin: unable to load credentials.', error);
      return null;
    }
  };

  const saveCredentials = (record) => {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(record));
  };

  const clearCredentials = () => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  };

  const promptForCredentials = (message) => {
    const username = window.prompt(message || 'Set admin username (case sensitive)');
    if (!username) {
      window.alert('Username is required.');
      return null;
    }
    const password = window.prompt('Set admin password (case sensitive)');
    if (!password) {
      window.alert('Password is required.');
      return null;
    }
    const record = { username: username.trim(), password };
    saveCredentials(record);
    return record;
  };

  const authenticate = (record) => {
    if (!record) {
      return false;
    }
    const username = window.prompt('Admin username');
    if (username === null) {
      return false;
    }
    const password = window.prompt('Admin password');
    if (password === null) {
      return false;
    }
    const matches = username.trim() === record.username && password === record.password;
    if (!matches) {
      window.alert('Incorrect username or password.');
    }
    return matches;
  };

  const selectEntryTemplate = (collectionPath) => {
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

  const expandShortHex = (value) => {
    if (!value || value.length !== 4 || value[0] !== '#') {
      return value;
    }
    const [, r, g, b] = value;
    return `#${r}${r}${g}${g}${b}${b}`;
  };

  const rgbToHex = (value) => {
    if (!value) {
      return '#000000';
    }
    if (value.startsWith('#')) {
      return expandShortHex(value.toLowerCase());
    }
    const match = value.match(/rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    if (!match) {
      return '#000000';
    }
    const [, r, g, b] = match.map(Number);
    const toHex = (num) => num.toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  };

  const createFloatButton = (label) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'inline-admin-pill';
    button.textContent = label;
    button.setAttribute('aria-pressed', 'false');
    return button;
  };

  const createToast = () => {
    const toast = document.createElement('div');
    toast.className = 'inline-admin-toast';
    toast.hidden = true;
    return toast;
  };

  const showToast = (toast, message, variant = 'info') => {
    toast.textContent = message;
    toast.dataset.variant = variant;
    toast.hidden = false;
    window.clearTimeout(Number(toast.dataset.timeoutId));
    const id = window.setTimeout(() => {
      toast.hidden = true;
    }, 3500);
    toast.dataset.timeoutId = String(id);
  };

  const markEditableNodes = () => {
    document.querySelectorAll(EDITABLE_NODE_SELECTOR).forEach((node) => {
      const computedDisplay = window.getComputedStyle(node).display;
      if (computedDisplay === 'inline' && !node.dataset.inlineOriginalDisplay) {
        node.dataset.inlineOriginalDisplay = computedDisplay;
        node.style.display = 'inline-block';
      }
      node.contentEditable = 'true';
      node.spellcheck = false;
      node.dataset.inlineEditable = 'true';
      if (!node.hasAttribute('tabindex')) {
        node.dataset.inlineTabindex = 'true';
        node.setAttribute('tabindex', '0');
      }
    });
  };

  const unmarkEditableNodes = () => {
    document.querySelectorAll('[data-inline-editable="true"]').forEach((node) => {
      node.removeAttribute('contenteditable');
      node.removeAttribute('spellcheck');
      if (node.dataset.inlineTabindex === 'true') {
        node.removeAttribute('tabindex');
        delete node.dataset.inlineTabindex;
      }
      if (node.dataset.inlineOriginalDisplay) {
        node.style.display = node.dataset.inlineOriginalDisplay;
        delete node.dataset.inlineOriginalDisplay;
      }
      delete node.dataset.inlineEditable;
    });
  };

  document.addEventListener('DOMContentLoaded', () => {
    const configApi = window.CCAConfig;
    const body = document.body;

    if (!configApi || !body) {
      return;
    }

    const searchParams = new URLSearchParams(window.location.search);
    let adminToggleUnlocked = false;
    const rawAdminParam = searchParams.get(ADMIN_QUERY_PARAM);
    if (rawAdminParam && rawAdminParam !== '0' && rawAdminParam.toLowerCase() !== 'false') {
      adminToggleUnlocked = true;
      localStorage.setItem(ADMIN_UNLOCK_STORAGE_KEY, 'true');
      searchParams.delete(ADMIN_QUERY_PARAM);
      const queryString = searchParams.toString();
      const sanitizedUrl = `${window.location.pathname}${queryString ? `?${queryString}` : ''}${window.location.hash}`;
      window.history.replaceState({}, document.title, sanitizedUrl);
    } else if (localStorage.getItem(ADMIN_UNLOCK_STORAGE_KEY) === 'true') {
      adminToggleUnlocked = true;
    }

    let workingConfig = configApi.loadConfig();
    let isActive = false;
    let isDirty = false;
    let isAuthenticated = false;
    let credentials = loadCredentials();
    let attrHandlerAttached = false;
    let toggleButton = null;

    const toast = createToast();
    body.appendChild(toast);

    const setStatus = (message, variant = 'info') => {
      showToast(toast, message, variant);
    };

    let inlineStyles = loadInlineStyles();
    let inlineCopyOverrides = loadInlineCopyOverrides();
    let inlineFontOverrides = loadInlineFontOverrides();
    let layoutOverrides = loadLayoutOverrides();
    const focusHandlers = new WeakMap();
    const blurHandlers = new WeakMap();
    let textToolbar = null;
    let toolbarColorInput = null;
    let toolbarClearButton = null;
    let activeToolbarTarget = null;
    let blockOverlay = null;
    let blockLabelEl = null;
    let blockSelectHandlerAttached = false;
    let blockDragState = null;
    let blockHintShown = false;
    let activeBlockTarget = null;
    let activeBlockKey = '';
    let adminInteractionMode = 'edit';
    let modeSwitchButton = null;
    let navigationGuardAttached = false;

    const emitCopyOverrideUpdate = () => {
      window.dispatchEvent(new CustomEvent('cca-inline-copy-updated', { detail: { overrides: inlineCopyOverrides } }));
    };

    const applyAllLayoutOverrides = () => {
      document.querySelectorAll('[data-inline-block-key]').forEach((node) => {
        if (node.matches(BLOCK_SKIP_SELECTOR)) {
          return;
        }
        const key = node.dataset.inlineBlockKey;
        applyLayoutStyle(node, layoutOverrides[key]);
      });
    };

    const emitLayoutOverrideUpdate = () => {
      applyAllLayoutOverrides();
      window.dispatchEvent(new CustomEvent('cca-inline-layout-updated', { detail: { overrides: layoutOverrides } }));
    };

    applyAllLayoutOverrides();
    const emitFontOverrideUpdate = () => {
      window.dispatchEvent(new CustomEvent('cca-inline-font-updated', { detail: { overrides: inlineFontOverrides } }));
    };

    const getPathForNode = (node) => {
      if (!node || !node.dataset) {
        return '';
      }
      return node.dataset.configText || node.dataset.configField || node.dataset.configKey || node.dataset.inlineCopyKey || '';
    };

    const applyInlineStyles = () => {
      document.querySelectorAll(EDITABLE_NODE_SELECTOR).forEach((node) => {
        const path = getPathForNode(node);
        if (!path) {
          return;
        }
        const color = inlineStyles[path];
        if (color) {
          node.style.setProperty('color', color);
        } else {
          node.style.removeProperty('color');
        }
      });
    };

    const updateColorForPath = (path, color) => {
      if (!path) {
        return;
      }
      if (!color) {
        delete inlineStyles[path];
      } else {
        inlineStyles[path] = color;
      }
      saveInlineStyles(inlineStyles);
      document.querySelectorAll(`[data-config-text="${path}"]`).forEach((node) => {
        if (color) {
          node.style.setProperty('color', color);
        } else {
          node.style.removeProperty('color');
        }
      });
      document.querySelectorAll(`[data-config-field="${path}"]`).forEach((node) => {
        if (color) {
          node.style.setProperty('color', color);
        } else {
          node.style.removeProperty('color');
        }
      });
      document.querySelectorAll(`[data-inline-copy-key="${path}"]`).forEach((node) => {
        if (color) {
          node.style.setProperty('color', color);
        } else {
          node.style.removeProperty('color');
        }
      });
      setStatus(color ? 'Color updated.' : 'Color cleared.', 'info');
    };

    const positionToolbar = () => {
      if (!textToolbar || textToolbar.hidden || !activeToolbarTarget) {
        return;
      }
      const rect = activeToolbarTarget.getBoundingClientRect();
      const top = window.scrollY + rect.top - textToolbar.offsetHeight - 8;
      const left = window.scrollX + rect.left + rect.width / 2 - textToolbar.offsetWidth / 2;
      textToolbar.style.top = `${Math.max(8, top)}px`;
      textToolbar.style.left = `${Math.max(8, left)}px`;
    };

    const hideToolbar = () => {
      if (textToolbar) {
        textToolbar.hidden = true;
      }
      activeToolbarTarget = null;
    };

    const createTextToolbar = () => {
      const toolbar = document.createElement('div');
      toolbar.className = 'inline-text-toolbar';

      const colorInput = document.createElement('input');
      colorInput.type = 'color';
      colorInput.value = '#000000';
      colorInput.addEventListener('input', (event) => {
        if (!activeToolbarTarget) {
          return;
        }
        const path = getPathForNode(activeToolbarTarget);
        updateColorForPath(path, event.target.value);
      });

      const clearButton = document.createElement('button');
      clearButton.type = 'button';
      clearButton.textContent = 'Clear color';
      clearButton.addEventListener('click', () => {
        if (!activeToolbarTarget) {
          return;
        }
        const path = getPathForNode(activeToolbarTarget);
        updateColorForPath(path, null);
        if (toolbarColorInput) {
          toolbarColorInput.value = '#000000';
        }
      });

      toolbar.appendChild(colorInput);
      toolbar.appendChild(clearButton);
      toolbar.hidden = true;

      toolbar.addEventListener('pointerdown', (event) => {
        event.stopPropagation();
      });

      toolbar.addEventListener('focusout', () => {
        window.setTimeout(() => {
          if (!textToolbar) {
            return;
          }
          const active = document.activeElement;
          if (textToolbar.contains(active) || active === activeToolbarTarget) {
            return;
          }
          hideToolbar();
        }, 80);
      });

      toolbarColorInput = colorInput;
      toolbarClearButton = clearButton;
      document.body.appendChild(toolbar);
      return toolbar;
    };

    const showToolbarForNode = (node) => {
      if (!node) {
        return;
      }
      if (!textToolbar) {
        textToolbar = createTextToolbar();
      }
      activeToolbarTarget = node;
      const path = getPathForNode(node);
      const preset = inlineStyles[path] || rgbToHex(window.getComputedStyle(node).color);
      if (toolbarColorInput) {
        toolbarColorInput.value = preset || '#000000';
      }
      textToolbar.hidden = false;
      positionToolbar();
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
      overlay.className = 'inline-block-overlay';
      overlay.hidden = true;

      const moveHandle = document.createElement('button');
      moveHandle.type = 'button';
      moveHandle.className = 'inline-block-handle move';
      moveHandle.textContent = 'Move';
      moveHandle.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        startBlockMove(event);
      });
      overlay.appendChild(moveHandle);

      const resizeHandle = document.createElement('span');
      resizeHandle.className = 'inline-block-handle resize';
      resizeHandle.setAttribute('role', 'presentation');
      resizeHandle.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        startBlockResize(event);
      });
      overlay.appendChild(resizeHandle);

      const toolbar = document.createElement('div');
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
      resetButton.addEventListener('click', resetActiveBlockLayout);
      toolbar.appendChild(resetButton);

      const closeButton = document.createElement('button');
      closeButton.type = 'button';
      closeButton.textContent = 'Close';
      closeButton.addEventListener('click', () => {
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

    const repositionToolbar = () => {
      positionToolbar();
      positionBlockOverlay();
    };

    const applyInlineFonts = () => {
      document.querySelectorAll(EDITABLE_NODE_SELECTOR).forEach((node) => {
        const path = getPathForNode(node);
        if (!path) {
          return;
        }
        const size = inlineFontOverrides[path];
        if (size) {
          node.style.fontSize = size;
        } else {
          node.style.removeProperty('font-size');
        }
      });
    };

    applyInlineStyles();
    applyInlineFonts();
    window.addEventListener('scroll', repositionToolbar, true);
    window.addEventListener('resize', repositionToolbar);

    const shouldSkipGuard = (target) => {
      if (!target) {
        return true;
      }
      return Boolean(target.closest('.inline-control-bar, .inline-collection-bar, .inline-entry-actions, .inline-block-overlay, .inline-admin-pill, .inline-admin-toast, .inline-text-toolbar'));
    };

    const navigationGuard = (event) => {
      if (!isActive || adminInteractionMode !== 'edit') {
        return;
      }
      const target = event.target;
      if (!target || shouldSkipGuard(target)) {
        return;
      }
      const interactive = target.closest('a[href], button, input[type="submit"], form');
      if (!interactive || interactive.dataset.inlineAllowNavigation === 'true') {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      setStatus('Edit mode active. Switch to Test mode to use live links.', 'info');
    };

    const ensureNavigationGuard = () => {
      if (navigationGuardAttached || adminInteractionMode !== 'edit') {
        return;
      }
      document.addEventListener('click', navigationGuard, true);
      navigationGuardAttached = true;
    };

    const removeNavigationGuard = () => {
      if (!navigationGuardAttached) {
        return;
      }
      document.removeEventListener('click', navigationGuard, true);
      navigationGuardAttached = false;
    };

    const applyFontSizeToPath = (path, fontSize) => {
      if (!path) {
        return;
      }
      const selectors = [
        `[data-config-text="${path}"]`,
        `[data-config-field="${path}"]`,
        `[data-inline-copy-key="${path}"]`
      ];
      selectors.forEach((selector) => {
        document.querySelectorAll(selector).forEach((node) => {
          if (fontSize) {
            node.style.fontSize = fontSize;
          } else {
            node.style.removeProperty('font-size');
          }
        });
      });
    };

    const updateFontSizeForPath = (path, fontSize) => {
      if (!path) {
        return;
      }
      if (!fontSize) {
        delete inlineFontOverrides[path];
      } else {
        inlineFontOverrides[path] = fontSize;
      }
      saveInlineFontOverrides(inlineFontOverrides);
      applyFontSizeToPath(path, fontSize);
      emitFontOverrideUpdate();
    };

    const ensureDragHandle = (node) => {
      if (node.querySelector('.inline-resize-handle')) {
        return;
      }
      const handle = document.createElement('span');
      handle.className = 'inline-resize-handle';
      handle.setAttribute('role', 'presentation');
      node.appendChild(handle);

      let isDragging = false;
      let startX = 0;
      let startY = 0;
      let startWidth = 0;
      let startHeight = 0;
      let fontPath = '';
      let startFontSize = 0;

      const formatFontSize = (value) => `${Math.round(value * 10) / 10}px`;

      const onPointerDown = (event) => {
        event.preventDefault();
        isDragging = true;
        startX = event.clientX;
        startY = event.clientY;
        const rect = node.getBoundingClientRect();
        startWidth = rect.width || 0;
        startHeight = rect.height || 0;
        fontPath = getPathForNode(node);
        startFontSize = parseFloat(window.getComputedStyle(node).fontSize) || 16;
        document.addEventListener('pointermove', onPointerMove);
        document.addEventListener('pointerup', onPointerUp);
      };

      const onPointerMove = (event) => {
        if (!isDragging) {
          return;
        }
        const deltaX = event.clientX - startX;
        const deltaY = event.clientY - startY;
        node.style.width = `${Math.max(120, startWidth + deltaX)}px`;
        node.style.minHeight = `${Math.max(60, startHeight + deltaY)}px`;
        if (fontPath && startWidth > 0) {
          const ratio = Math.max(0.4, Math.min(3.5, (startWidth + deltaX) / startWidth));
          const nextFont = Math.max(10, Math.min(160, startFontSize * ratio));
          const formatted = formatFontSize(nextFont);
          node.style.fontSize = formatted;
          node.dataset.inlinePendingFont = formatted;
        }
      };

      const onPointerUp = () => {
        isDragging = false;
        document.removeEventListener('pointermove', onPointerMove);
        document.removeEventListener('pointerup', onPointerUp);
        if (fontPath && node.dataset.inlinePendingFont) {
          updateFontSizeForPath(fontPath, node.dataset.inlinePendingFont);
          delete node.dataset.inlinePendingFont;
          isDirty = true;
          setStatus('Text resized. Save to persist.', 'pending');
        }
      };

      handle.addEventListener('pointerdown', onPointerDown);
    };

    function resolveBlockSelectionTarget(origin) {
      if (!origin || origin === document.body) {
        return null;
      }
      if (origin.closest('.inline-block-overlay') || origin.closest('.inline-control-bar') || origin.closest('.inline-admin-pill') || origin.closest('.inline-admin-toast') || origin.closest('.inline-text-toolbar')) {
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
        if (!node.dataset.inlineBlockKey) {
          node.dataset.inlineBlockKey = computeElementPath(node);
        }
        return node;
      }
      return null;
    }

    function commitBlockOverrides(nextStyle) {
      if (!activeBlockKey) {
        return;
      }
      const existing = { ...(layoutOverrides[activeBlockKey] || {}) };
      const merged = { ...existing };
      ['x', 'y', 'width', 'height'].forEach((prop) => {
        if (typeof nextStyle?.[prop] === 'number' && !Number.isNaN(nextStyle[prop])) {
          const rounded = Math.round(nextStyle[prop]);
          merged[prop] = prop === 'width' || prop === 'height' ? Math.max(prop === 'width' ? 80 : 60, rounded) : rounded;
        }
      });
      const cleaned = {};
      ['x', 'y', 'width', 'height'].forEach((prop) => {
        if (typeof merged[prop] === 'number' && !Number.isNaN(merged[prop])) {
          cleaned[prop] = merged[prop];
        }
      });
      if (Object.keys(cleaned).length === 0) {
        delete layoutOverrides[activeBlockKey];
      } else {
        layoutOverrides[activeBlockKey] = cleaned;
      }
      saveLayoutOverrides(layoutOverrides);
      emitLayoutOverrideUpdate();
      if (activeBlockTarget) {
        applyLayoutStyle(activeBlockTarget, layoutOverrides[activeBlockKey]);
      }
      isDirty = true;
      setStatus('Layout updated. Save to persist.', 'pending');
    }

    function resetActiveBlockLayout() {
      if (!activeBlockKey) {
        return;
      }
      delete layoutOverrides[activeBlockKey];
      saveLayoutOverrides(layoutOverrides);
      emitLayoutOverrideUpdate();
      if (activeBlockTarget) {
        applyLayoutStyle(activeBlockTarget, undefined);
      }
      setStatus('Layout reset for this block.', 'info');
      positionBlockOverlay();
    }

    function handleBlockPointerMove(event) {
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
        preview.width = Math.max(80, blockDragState.originWidth + deltaX);
        preview.height = Math.max(60, blockDragState.originHeight + deltaY);
        blockDragState.preview = preview;
        applyLayoutStyle(activeBlockTarget, preview);
      }
      positionBlockOverlay();
    }

    function endBlockInteraction() {
      document.removeEventListener('pointermove', handleBlockPointerMove);
      document.removeEventListener('pointerup', endBlockInteraction);
      if (blockDragState && blockDragState.preview) {
        commitBlockOverrides(blockDragState.preview);
      }
      blockDragState = null;
      positionBlockOverlay();
    }

    function startBlockMove(event) {
      if (!activeBlockTarget) {
        return;
      }
      blockDragState = {
        mode: 'move',
        startX: event.clientX,
        startY: event.clientY,
        originX: layoutOverrides[activeBlockKey]?.x || 0,
        originY: layoutOverrides[activeBlockKey]?.y || 0,
        preview: null
      };
      document.addEventListener('pointermove', handleBlockPointerMove);
      document.addEventListener('pointerup', endBlockInteraction);
    }

    function startBlockResize(event) {
      if (!activeBlockTarget) {
        return;
      }
      const rect = activeBlockTarget.getBoundingClientRect();
      blockDragState = {
        mode: 'resize',
        startX: event.clientX,
        startY: event.clientY,
        originWidth: layoutOverrides[activeBlockKey]?.width || rect.width,
        originHeight: layoutOverrides[activeBlockKey]?.height || rect.height,
        preview: null
      };
      document.addEventListener('pointermove', handleBlockPointerMove);
      document.addEventListener('pointerup', endBlockInteraction);
    }

    function handleBlockSelect(event) {
      if (!isActive || !event.altKey) {
        return;
      }
      if (blockOverlay && blockOverlay.contains(event.target)) {
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
        setStatus('Drag Move to reposition or corner to resize. Alt+Click another block to switch.', 'info');
        blockHintShown = true;
      }
    }

    function enableBlockSelection() {
      if (blockSelectHandlerAttached) {
        return;
      }
      document.addEventListener('click', handleBlockSelect, true);
      blockSelectHandlerAttached = true;
    }

    function disableBlockSelection() {
      if (!blockSelectHandlerAttached) {
        return;
      }
      document.removeEventListener('click', handleBlockSelect, true);
      blockSelectHandlerAttached = false;
    }

    const syncLinkedNodes = (path, value, sourceNode) => {
      if (!path) {
        return;
      }
      document.querySelectorAll(`[data-config-text="${path}"]`).forEach((node) => {
        if (node !== sourceNode) {
          node.textContent = value;
          if (node.dataset.inlineEmpty === 'true') {
            node.style.display = value.trim().length === 0 ? 'none' : '';
          }
        }
      });
      document.querySelectorAll(`[data-config-field="${path}"]`).forEach((node) => {
        if (node !== sourceNode) {
          node.textContent = value;
          if (node.dataset.inlineEmpty === 'true') {
            node.style.display = value.trim().length === 0 ? 'none' : '';
          }
        }
      });
      document.querySelectorAll(`[data-config-key="${path}"]`).forEach((node) => {
        const attr = node.dataset.configAttr;
        if (!attr) {
          return;
        }
        const prefix = node.dataset.configPrefix || '';
        const suffix = node.dataset.configSuffix || '';
        node.setAttribute(attr, `${prefix}${value}${suffix}`);
      });
      document.querySelectorAll(`[data-inline-copy-key="${path}"]`).forEach((node) => {
        if (node !== sourceNode) {
          node.textContent = value;
        }
      });
    };

    const attrClickHandler = (event) => {
      if (!isActive) {
        return;
      }
      const target = event.target.closest('[data-config-field-type^="attr:"]');
      if (!target) {
        return;
      }
      event.preventDefault();
      handleAttrEdit(target, target.dataset.configField, target.dataset.configFieldType);
    };

    const ensureAuth = () => {
      if (isAuthenticated) {
        return true;
      }
      credentials = loadCredentials();
      if (!credentials) {
        if (!window.confirm('Inline admin requires a username/password. Set them now?')) {
          return false;
        }
        const record = promptForCredentials();
        if (!record) {
          return false;
        }
        credentials = record;
        isAuthenticated = true;
        return true;
      }
      const ok = authenticate(credentials);
      if (ok) {
        isAuthenticated = true;
        return true;
      }
      return false;
    };

    const saveChanges = () => {
      configApi.saveConfig(workingConfig);
      saveInlineCopyOverrides(inlineCopyOverrides);
      emitCopyOverrideUpdate();
      saveInlineFontOverrides(inlineFontOverrides);
      emitFontOverrideUpdate();
      isDirty = false;
      setStatus('Saved changes.', 'success');
    };

    const reloadChanges = () => {
      workingConfig = configApi.loadConfig();
      dispatchConfigUpdate(workingConfig);
      inlineCopyOverrides = loadInlineCopyOverrides();
      emitCopyOverrideUpdate();
      inlineStyles = loadInlineStyles();
      applyInlineStyles();
      inlineFontOverrides = loadInlineFontOverrides();
      applyInlineFonts();
      emitFontOverrideUpdate();
      layoutOverrides = loadLayoutOverrides();
      emitLayoutOverrideUpdate();
      isDirty = false;
      setStatus('Reloaded last saved copy.', 'info');
      window.requestAnimationFrame(() => {
        refreshInlineBindings();
      });
    };

    const resetDefaults = () => {
      if (!window.confirm('Reset everything to defaults?')) {
        return;
      }
      configApi.resetConfig();
      workingConfig = configApi.loadConfig();
      dispatchConfigUpdate(workingConfig);
      inlineCopyOverrides = {};
      saveInlineCopyOverrides(inlineCopyOverrides);
      emitCopyOverrideUpdate();
      inlineStyles = {};
      saveInlineStyles(inlineStyles);
      applyInlineStyles();
      inlineFontOverrides = {};
      saveInlineFontOverrides(inlineFontOverrides);
      applyInlineFonts();
      emitFontOverrideUpdate();
      layoutOverrides = {};
      saveLayoutOverrides(layoutOverrides);
      emitLayoutOverrideUpdate();
      isDirty = false;
      setStatus('Defaults restored.', 'info');
      window.requestAnimationFrame(() => {
        refreshInlineBindings();
      });
    };

    const updateCredentials = () => {
      const record = promptForCredentials('Update admin username');
      if (record) {
        credentials = record;
        isAuthenticated = true;
        setStatus('Credentials updated.', 'success');
      }
    };

    const signOut = () => {
      clearCredentials();
      credentials = null;
      isAuthenticated = false;
      toggleAdminMode(false);
      setStatus('Inline admin locked. Set credentials to re-enable.', 'info');
    };

    const buildExportPayload = () => ({
      version: 1,
      exportedAt: new Date().toISOString(),
      page: body?.dataset?.page || 'global',
      config: workingConfig,
      inlineCopyOverrides,
      inlineStyles,
      inlineFontOverrides,
      layoutOverrides
    });

    const exportConfigState = () => {
      try {
        const payload = buildExportPayload();
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const link = document.createElement('a');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const objectUrl = URL.createObjectURL(blob);
        link.href = objectUrl;
        link.download = `cca-config-${timestamp}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.setTimeout(() => {
          URL.revokeObjectURL(objectUrl);
        }, 0);
        setStatus('Export downloaded.', 'success');
      } catch (error) {
        console.error('Inline admin: export failed.', error);
        setStatus('Unable to export config.', 'error');
      }
    };

    const applyImportedPayload = (payload) => {
      const nextConfig = payload?.config || payload;
      if (!nextConfig || typeof nextConfig !== 'object') {
        throw new Error('Invalid config payload.');
      }
      workingConfig = cloneEntry(nextConfig);
      inlineCopyOverrides = payload && typeof payload.inlineCopyOverrides === 'object' ? payload.inlineCopyOverrides : {};
      saveInlineCopyOverrides(inlineCopyOverrides);
      emitCopyOverrideUpdate();
      inlineStyles = payload && typeof payload.inlineStyles === 'object' ? payload.inlineStyles : {};
      saveInlineStyles(inlineStyles);
      applyInlineStyles();
      inlineFontOverrides = payload && typeof payload.inlineFontOverrides === 'object' ? payload.inlineFontOverrides : {};
      saveInlineFontOverrides(inlineFontOverrides);
      applyInlineFonts();
      emitFontOverrideUpdate();
      layoutOverrides = payload && typeof payload.layoutOverrides === 'object' ? payload.layoutOverrides : {};
      saveLayoutOverrides(layoutOverrides);
      emitLayoutOverrideUpdate();
      dispatchConfigUpdate(workingConfig);
      isDirty = true;
      setStatus('Import applied. Review, then save.', 'pending');
      window.requestAnimationFrame(() => {
        refreshInlineBindings();
      });
    };

    const importConfigState = () => {
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = 'application/json';
      fileInput.addEventListener('change', (event) => {
        const file = event.target?.files?.[0];
        if (!file) {
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const parsed = JSON.parse(String(reader.result || '{}'));
            applyImportedPayload(parsed);
          } catch (error) {
            console.error('Inline admin: invalid import payload.', error);
            setStatus('Import failed. Check JSON.', 'error');
          }
        };
        reader.readAsText(file);
      });
      fileInput.click();
    };

    const updateModeToggleLabel = () => {
      if (!modeSwitchButton) {
        return;
      }
      modeSwitchButton.textContent = adminInteractionMode === 'edit' ? 'Test mode' : 'Edit mode';
    };

    const setInteractionMode = (mode, { silent = false } = {}) => {
      if (mode !== 'edit' && mode !== 'test') {
        return;
      }
      if (adminInteractionMode === mode) {
        return;
      }
      adminInteractionMode = mode;
      if (body) {
        body.dataset.inlineMode = mode;
      }
      updateModeToggleLabel();
      if (!isActive) {
        return;
      }
      if (mode === 'edit') {
        setupInline();
        ensureNavigationGuard();
        if (!silent) {
          setStatus('Edit mode: navigation disabled for safer editing.', 'info');
        }
      } else {
        tearDownInline({ keepChrome: true });
        removeNavigationGuard();
        if (!silent) {
          setStatus('Test mode: live interactions restored.', 'info');
        }
      }
    };

    const toggleInteractionMode = () => {
      setInteractionMode(adminInteractionMode === 'edit' ? 'test' : 'edit');
    };

    const addControlGroup = (host) => {
      if (host.querySelector('.inline-control-bar')) {
        return;
      }

      const bar = document.createElement('div');
      bar.className = 'inline-control-bar';

      const modeButton = document.createElement('button');
      modeButton.type = 'button';
      modeButton.textContent = adminInteractionMode === 'edit' ? 'Test mode' : 'Edit mode';
      modeButton.addEventListener('click', toggleInteractionMode);
      modeSwitchButton = modeButton;

      const saveButton = document.createElement('button');
      saveButton.type = 'button';
      saveButton.textContent = 'Save';
      saveButton.addEventListener('click', saveChanges);

      const reloadButton = document.createElement('button');
      reloadButton.type = 'button';
      reloadButton.textContent = 'Reload';
      reloadButton.addEventListener('click', reloadChanges);

      const defaultsButton = document.createElement('button');
      defaultsButton.type = 'button';
      defaultsButton.textContent = 'Defaults';
      defaultsButton.addEventListener('click', resetDefaults);

      const exportButton = document.createElement('button');
      exportButton.type = 'button';
      exportButton.textContent = 'Export';
      exportButton.addEventListener('click', exportConfigState);

      const importButton = document.createElement('button');
      importButton.type = 'button';
      importButton.textContent = 'Import';
      importButton.addEventListener('click', importConfigState);

      const credsButton = document.createElement('button');
      credsButton.type = 'button';
      credsButton.textContent = 'Credentials';
      credsButton.addEventListener('click', updateCredentials);

      const signOutButton = document.createElement('button');
      signOutButton.type = 'button';
      signOutButton.textContent = 'Sign out';
      signOutButton.addEventListener('click', signOut);

      bar.appendChild(modeButton);
      bar.appendChild(saveButton);
      bar.appendChild(reloadButton);
      bar.appendChild(defaultsButton);
      bar.appendChild(exportButton);
      bar.appendChild(importButton);
      bar.appendChild(credsButton);
      bar.appendChild(signOutButton);

      host.appendChild(bar);
      host.dataset.inlineControls = 'true';
    };

    const handleTextInput = (event) => {
      if (!isActive) {
        return;
      }
      const target = event.target;
      const path = target.dataset.configText || target.dataset.configField;
      const copyKey = target.dataset.inlineCopyKey;
      if (!path && !copyKey) {
        return;
      }
      const value = target.textContent;
      if (path) {
        setValue(workingConfig, path, value.trim());
        if (target.dataset.inlineEmpty === 'true') {
          target.style.display = value.trim().length === 0 ? 'none' : '';
        }
        syncLinkedNodes(path, value, target);
      } else if (copyKey) {
        inlineCopyOverrides[copyKey] = value;
        syncLinkedNodes(copyKey, value, target);
      }
      isDirty = true;
      setStatus('Unsaved changes...', 'pending');
    };

    const handleAttrEdit = (node, path, fieldType) => {
      if (!isActive || !fieldType || !fieldType.startsWith('attr:')) {
        return;
      }
      const attr = fieldType.split(':')[1];
      const label = attr === 'href' ? 'Link URL' : 'Image URL';
      const current = node.getAttribute(attr) || '';
      const next = window.prompt(label, current);
      if (next === null) {
        return;
      }
      node.setAttribute(attr, next);
      setValue(workingConfig, path, next);
      syncLinkedNodes(path, next, node);
      if (attr === 'src') {
        const altField = node.dataset.configAltField;
        if (altField) {
          const nextAlt = window.prompt('Alt text', getValue(workingConfig, altField) || '');
          if (nextAlt !== null) {
            setValue(workingConfig, altField, nextAlt);
            node.setAttribute('alt', nextAlt);
            syncLinkedNodes(altField, nextAlt);
          }
        }
      }
      isDirty = true;
      setStatus(attr === 'href' ? 'Updated link URL.' : 'Updated image source.', 'pending');
    };

    const handleAddListItem = (collectionPath) => {
      const container = document.querySelector(`[data-config-collection="${collectionPath}"]`);
      if (!container) {
        return;
      }
      const templateValue = selectEntryTemplate(collectionPath);
      const entryPath = insertEntryAtPath(workingConfig, collectionPath, cloneEntry(templateValue));
      dispatchConfigUpdate(workingConfig);
      isDirty = true;
      setStatus('Added new block. Edit inline, then save.', 'pending');
      window.requestAnimationFrame(() => {
        refreshInlineBindings();
        if (entryPath) {
          window.requestAnimationFrame(() => {
            const updatedContainer = document.querySelector(`[data-config-collection="${collectionPath}"]`);
            const newest = updatedContainer?.querySelector(`[data-config-entry="${entryPath}"]`);
            if (newest) {
              newest.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          });
        }
      });
    };

    const handleDeleteEntry = (entryPath) => {
      if (!entryPath) {
        return;
      }
      if (!window.confirm('Remove this item?')) {
        return;
      }
      deleteEntryAtPath(workingConfig, entryPath);
      dispatchConfigUpdate(workingConfig);
      isDirty = true;
      setStatus('Entry removed. Save to persist.', 'pending');
      window.requestAnimationFrame(() => {
        refreshInlineBindings();
      });
    };

    const attachCollectionControls = () => {
      document.querySelectorAll('[data-config-collection]').forEach((node) => {
        const path = node.dataset.configCollection;
        if (!path) {
          return;
        }

        if (!node.querySelector('.inline-collection-bar')) {
          const bar = document.createElement('div');
          bar.className = 'inline-collection-bar';

          const addButton = document.createElement('button');
          addButton.type = 'button';
          addButton.className = 'inline-collection-add';
          addButton.setAttribute('aria-label', 'Add block');
          addButton.textContent = '+';
          addButton.addEventListener('click', () => {
            handleAddListItem(path);
          });

          bar.appendChild(addButton);
          node.appendChild(bar);
        }

        node.querySelectorAll('[data-config-entry]').forEach((entryNode) => {
          const entryPath = entryNode.dataset.configEntry;
          if (!entryPath) {
            return;
          }
          if (!entryNode.querySelector('.inline-entry-actions')) {
            const actions = document.createElement('div');
            actions.className = 'inline-entry-actions';

            const removeButton = document.createElement('button');
            removeButton.type = 'button';
            removeButton.className = 'inline-entry-remove';
            removeButton.setAttribute('aria-label', 'Remove block');
            removeButton.textContent = '×';
            removeButton.addEventListener('click', () => {
              handleDeleteEntry(entryPath);
            });

            actions.appendChild(removeButton);
            entryNode.appendChild(actions);
          }
        });
      });
    };

    const removeCollectionControls = () => {
      document.querySelectorAll('.inline-collection-bar, .inline-entry-actions').forEach((node) => node.remove());
    };

    const setupInline = () => {
      if (adminInteractionMode !== 'edit') {
        return;
      }
      markEditableNodes();
      addControlGroup(body);
      attachCollectionControls();
      enableBlockSelection();

      document.querySelectorAll(EDITABLE_NODE_SELECTOR).forEach((node) => {
        node.addEventListener('input', handleTextInput);
        ensureDragHandle(node);
      });
      if (!attrHandlerAttached) {
        document.addEventListener('click', attrClickHandler, true);
        attrHandlerAttached = true;
      }
      applyInlineFonts();
      ensureNavigationGuard();
    };

    const tearDownInline = (options = {}) => {
      const { keepChrome = false } = options;
      document.querySelectorAll(EDITABLE_NODE_SELECTOR).forEach((node) => {
        node.removeEventListener('input', handleTextInput);
      });
      removeCollectionControls();
      if (!keepChrome) {
        document.querySelectorAll('.inline-control-bar').forEach((bar) => bar.remove());
        modeSwitchButton = null;
      }
      document.querySelectorAll('.inline-resize-handle').forEach((handle) => handle.remove());
      if (attrHandlerAttached) {
        document.removeEventListener('click', attrClickHandler, true);
        attrHandlerAttached = false;
      }
      disableBlockSelection();
      clearBlockSelection();
      removeNavigationGuard();
      unmarkEditableNodes();
    };

    const refreshInlineBindings = () => {
      if (!isActive || adminInteractionMode !== 'edit') {
        return;
      }
      tearDownInline({ keepChrome: true });
      if (activeBlockTarget && !document.body.contains(activeBlockTarget)) {
        clearBlockSelection();
      }
      setupInline();
      applyAllLayoutOverrides();
    };

    const toggleAdminMode = (nextState) => {
      const targetState = typeof nextState === 'boolean' ? nextState : !isActive;
      if (targetState === isActive) {
        return;
      }
      if (targetState && !ensureAuth()) {
        return;
      }
      isActive = targetState;
      body.toggleAttribute('data-inline-admin', isActive);
      if (!isActive) {
        body.removeAttribute('data-inline-mode');
      }
      if (toggleButton) {
        toggleButton.textContent = isActive ? 'Exit admin' : 'Admin mode';
        toggleButton.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      }

      if (isActive) {
        adminInteractionMode = 'edit';
        updateModeToggleLabel();
        body.dataset.inlineMode = adminInteractionMode;
        setupInline();
        ensureNavigationGuard();
        setStatus('Inline admin active. Edit directly on the page.', 'info');
      } else {
        tearDownInline();
        adminInteractionMode = 'edit';
        updateModeToggleLabel();
        setStatus('Inline admin disabled.', 'info');
      }
    };

    const ensureToggleButton = () => {
      if (toggleButton || !body) {
        return;
      }
      toggleButton = createFloatButton('Admin mode');
      toggleButton.addEventListener('click', () => {
        toggleAdminMode();
      });
      body.appendChild(toggleButton);
    };

    if (adminToggleUnlocked) {
      ensureToggleButton();
    }

    const handleSecretCombo = (event) => {
      const key = event.key || event.code;
      if (!key || !(event.altKey && event.shiftKey)) {
        return;
      }
      const normalized = key.toLowerCase();
      if (normalized !== 'a' && normalized !== 'keya') {
        return;
      }
      event.preventDefault();
      if (!adminToggleUnlocked) {
        adminToggleUnlocked = true;
        localStorage.setItem(ADMIN_UNLOCK_STORAGE_KEY, 'true');
      }
      if (!toggleButton) {
        ensureToggleButton();
        setStatus('Admin controls unlocked for this browser.', 'success');
      } else {
        setStatus('Admin controls already unlocked.', 'info');
      }
    };

    document.addEventListener('keydown', handleSecretCombo);
  });
})();
