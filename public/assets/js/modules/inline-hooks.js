const COPY_STORAGE_KEY = 'ccaInlineCopyOverrides';
const FONT_STORAGE_KEY = 'ccaInlineFontOverrides';
const LAYOUT_STORAGE_KEY = 'ccaInlineLayoutOverrides';
const MEDIA_STORAGE_KEY = 'ccaInlineMediaOverrides';
const INLINE_SIMPLE_SELECTOR = 'h1,h2,h3,h4,h5,h6,p,li,figcaption,span,strong,em,small,th,td,blockquote,pre,code,dt,dd,label,legend,div';
const FORCE_WRAP_TAGS = new Set(['A', 'BUTTON', 'LABEL']);
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'SELECT', 'OPTION']);
const BLOCK_SKIP_TAGS = new Set(['HTML', 'BODY', 'SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'HEAD', 'META', 'LINK', 'TITLE']);
const BLOCK_SKIP_SELECTOR = '.inline-block-overlay, .inline-control-bar, .inline-admin-pill, .inline-admin-toast, .inline-text-toolbar';
const MEDIA_SELECTOR = 'img';

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

const getPageScope = () => {
  const body = document.body;
  if (body && body.dataset && body.dataset.page) {
    return body.dataset.page;
  }
  const rawPath = window.location.pathname.split('/').pop() || 'index';
  return rawPath.replace(/\.[^/.]+$/, '') || 'global';
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

const resolveCopyScope = (element) => {
  if (!element) {
    return getPageScope();
  }
  if (element.closest('header.site-header, footer')) {
    return 'global';
  }
  return getPageScope();
};

const assignCopyKey = (element) => {
  if (!element) {
    return;
  }
  const scope = resolveCopyScope(element);
  const path = computeElementPath(element);
  const key = `copy:${scope}:${path}`;
  element.dataset.inlineCopyKey = key;
  if (!element.dataset.inlineCopyOriginal) {
    element.dataset.inlineCopyOriginal = element.textContent || '';
  }
};

const shouldSkipSimpleNode = (node) => {
  if (!node || node.dataset.inlineCopyKey) {
    return true;
  }
  if (node.dataset.configText || node.dataset.configField || node.dataset.configKey || node.dataset.configList || node.dataset.configGallery || node.dataset.configAccordion) {
    return true;
  }
  if (node.hasAttribute('data-inline-copy-exempt') || node.hasAttribute('data-year')) {
    return true;
  }
  if (SKIP_TAGS.has(node.tagName)) {
    return true;
  }
  if (!node.textContent || node.textContent.trim().length === 0) {
    return true;
  }
  if (node.childElementCount > 0) {
    return true;
  }
  return false;
};

const markSimpleCopyNodes = () => {
  document.querySelectorAll(INLINE_SIMPLE_SELECTOR).forEach((node) => {
    if (shouldSkipSimpleNode(node)) {
      return;
    }
    assignCopyKey(node);
  });
};

const wrapTextNodesForCopy = () => {
  if (!document.body) {
    return;
  }
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node || !node.parentElement) {
        return NodeFilter.FILTER_REJECT;
      }
      if (!node.textContent || node.textContent.trim().length === 0) {
        return NodeFilter.FILTER_REJECT;
      }
      const parent = node.parentElement;
      if (parent.dataset && (parent.dataset.configText || parent.dataset.configField || parent.dataset.configKey || parent.dataset.inlineCopyKey || parent.dataset.inlineCopyExempt || parent.dataset.configList || parent.dataset.configGallery || parent.dataset.configAccordion)) {
        return NodeFilter.FILTER_REJECT;
      }
      if (parent.classList.contains('inline-copy-node')) {
        return NodeFilter.FILTER_REJECT;
      }
      if (SKIP_TAGS.has(parent.tagName)) {
        return NodeFilter.FILTER_REJECT;
      }
      if (parent.hasAttribute('data-year')) {
        return NodeFilter.FILTER_REJECT;
      }
      const needsWrap = parent.childElementCount > 0 || FORCE_WRAP_TAGS.has(parent.tagName);
      return needsWrap ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    }
  });
  const nodesToWrap = [];
  while (walker.nextNode()) {
    nodesToWrap.push(walker.currentNode);
  }
  nodesToWrap.forEach((textNode) => {
    const wrapper = document.createElement('span');
    wrapper.className = 'inline-copy-node';
    wrapper.textContent = textNode.textContent;
    const parent = textNode.parentElement;
    parent.replaceChild(wrapper, textNode);
    assignCopyKey(wrapper);
  });
};

export const prepareInlineCopyTargets = () => {
  wrapTextNodesForCopy();
  markSimpleCopyNodes();
};

const assignBlockKey = (element) => {
  if (!element || element.dataset.inlineBlockKey) {
    return;
  }
  element.dataset.inlineBlockKey = computeElementPath(element);
};

export const prepareInlineBlockTargets = () => {
  if (!document.body) {
    return;
  }
  document.body.querySelectorAll('*').forEach((node) => {
    if (!node.tagName || BLOCK_SKIP_TAGS.has(node.tagName) || node.matches(BLOCK_SKIP_SELECTOR)) {
      return;
    }
    assignBlockKey(node);
  });
};

const loadCopyOverrides = () => {
  try {
    const raw = localStorage.getItem(COPY_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    return JSON.parse(raw);
  } catch (error) {
    console.warn('Inline copy: unable to load overrides.', error);
    return {};
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
    console.warn('Inline font: unable to load overrides.', error);
    return {};
  }
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
      console.warn('Inline layout: unable to rewrite overrides.', error);
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
    console.warn('Inline layout: unable to load overrides.', error);
    return {};
  }
};

export const applyCopyOverrides = (overrides) => {
  const data = overrides || loadCopyOverrides();
  document.querySelectorAll('[data-inline-copy-key]').forEach((node) => {
    if (!node.dataset.inlineCopyOriginal) {
      node.dataset.inlineCopyOriginal = node.textContent || '';
    }
    const key = node.dataset.inlineCopyKey;
    if (!key) {
      return;
    }
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      node.textContent = data[key];
    } else if (node.dataset.inlineCopyOriginal !== undefined) {
      node.textContent = node.dataset.inlineCopyOriginal;
    }
  });
};

export const applyFontOverrides = (overrides) => {
  const data = overrides || loadFontOverrides();
  const nodes = document.querySelectorAll('[data-config-text],[data-config-field],[data-inline-copy-key]');
  nodes.forEach((node) => {
    const path = node.dataset.configText || node.dataset.configField || node.dataset.inlineCopyKey;
    if (!path) {
      return;
    }
    const entry = data[path];
    const applySize = (value) => {
      if (typeof value === 'string' && value.length > 0) {
        node.style.fontSize = value;
      } else {
        node.style.removeProperty('font-size');
      }
    };
    const applyFamily = (value) => {
      if (typeof value === 'string' && value.length > 0) {
        node.style.fontFamily = value;
      } else {
        node.style.removeProperty('font-family');
      }
    };

    if (typeof entry === 'string') {
      applySize(entry);
      applyFamily('');
      return;
    }
    if (entry && typeof entry === 'object') {
      applySize(entry.size || '');
      applyFamily(entry.family || '');
      return;
    }
    applySize('');
    applyFamily('');
  });
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

  const hasAny = hasX || hasY || hasWidth || hasHeight || fontSizeValue !== null || fontStretchValue !== null || scaleXValue !== null || scaleYValue !== null;
  if (hasAny) {
    node.classList.add('inline-block-customized');
  } else {
    node.classList.remove('inline-block-customized');
  }
};

export const applyLayoutOverrides = (overrides) => {
  const data = overrides || loadLayoutOverrides();
  document.querySelectorAll('[data-inline-block-key]').forEach((node) => {
    if (node.matches(BLOCK_SKIP_SELECTOR)) {
      return;
    }
    const key = node.dataset.inlineBlockKey;
    applyLayoutStyle(node, data[key]);
  });
};

const assignMediaKey = (element) => {
  if (!element || element.dataset.inlineMediaKey) {
    return;
  }
  const scope = resolveCopyScope(element);
  const path = computeElementPath(element);
  element.dataset.inlineMediaKey = `media:${scope}:${path}`;
  if (!element.dataset.inlineMediaAttr) {
    element.dataset.inlineMediaAttr = element.tagName === 'SOURCE' ? 'srcset' : 'src';
  }
  const attr = element.dataset.inlineMediaAttr;
  if (attr && !Object.prototype.hasOwnProperty.call(element.dataset, 'inlineMediaOriginal')) {
    element.dataset.inlineMediaOriginal = element.getAttribute(attr) || '';
  }
};

export const prepareInlineMediaTargets = () => {
  if (!document.body) {
    return;
  }
  document.querySelectorAll(MEDIA_SELECTOR).forEach((node) => {
    if (node.hasAttribute('data-inline-media-exempt')) {
      return;
    }
    if (
      node.dataset.configAttr ||
      node.dataset.configField ||
      node.dataset.configText ||
      node.dataset.configKey
    ) {
      return;
    }
    assignMediaKey(node);
  });
};

const loadMediaOverrides = () => {
  try {
    const raw = localStorage.getItem(MEDIA_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    return JSON.parse(raw);
  } catch (error) {
    console.warn('Inline media: unable to load overrides.', error);
    return {};
  }
};

export const applyMediaOverrides = (overrides) => {
  const data = overrides || loadMediaOverrides();
  document.querySelectorAll('[data-inline-media-key]').forEach((node) => {
    const key = node.dataset.inlineMediaKey;
    if (!key) {
      return;
    }
    const attr = node.dataset.inlineMediaAttr || (node.tagName === 'SOURCE' ? 'srcset' : 'src');
    if (!attr) {
      return;
    }
    if (!Object.prototype.hasOwnProperty.call(node.dataset, 'inlineMediaOriginal')) {
      node.dataset.inlineMediaOriginal = node.getAttribute(attr) || '';
    }
    if (data && Object.prototype.hasOwnProperty.call(data, key)) {
      const value = data[key];
      if (typeof value === 'string') {
        node.setAttribute(attr, value);
      }
      return;
    }
    const original = node.dataset.inlineMediaOriginal;
    if (typeof original === 'string' && original.length > 0) {
      node.setAttribute(attr, original);
    } else {
      node.removeAttribute(attr);
    }
  });
};
