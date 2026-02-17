import {
  renderSimpleList,
  renderTimelineList,
  renderLabeledList,
  renderCardGrid,
  renderFaqList,
  renderGallery,
  renderCtaStack,
  renderAccordion
} from './renderers.js';

export const getValueFromPath = (source, path) => {
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

export const applyConfig = (config) => {
  if (!config) {
    return;
  }

  document.querySelectorAll('[data-config-text]').forEach((node) => {
    const value = getValueFromPath(config, node.dataset.configText);
    if (typeof value === 'string') {
      node.textContent = value;
    }
  });

  document.querySelectorAll('[data-config-attr]').forEach((node) => {
    const attr = node.dataset.configAttr;
    const key = node.dataset.configKey;
    const prefix = node.dataset.configPrefix || '';
    const suffix = node.dataset.configSuffix || '';
    const value = getValueFromPath(config, key);

    if (attr && typeof value === 'string' && value.length > 0) {
      node.setAttribute(attr, `${prefix}${value}${suffix}`);
    }
  });

  document.querySelectorAll('[data-config-list]').forEach((node) => {
    const key = node.dataset.configList;
    const type = node.dataset.listType || 'text';
    const items = getValueFromPath(config, key);
    if (!Array.isArray(items)) {
      return;
    }
    if (type === 'timeline') {
      renderTimelineList(node, items, key);
    } else {
      renderSimpleList(node, items, key);
    }
  });

  document.querySelectorAll('[data-config-gallery]').forEach((node) => {
    const key = node.dataset.configGallery || 'gallery';
    const items = getValueFromPath(config, key);
    if (Array.isArray(items)) {
      renderGallery(node, items, key);
    }
  });

  document.querySelectorAll('[data-config-accordion]').forEach((node) => {
    const key = node.dataset.configAccordion;
    const items = getValueFromPath(config, key);
    if (Array.isArray(items)) {
      renderAccordion(node, items, key);
    }
  });

  document.querySelectorAll('[data-config-labeled-list]').forEach((node) => {
    const key = node.dataset.configLabeledList;
    const items = getValueFromPath(config, key);
    if (Array.isArray(items)) {
      renderLabeledList(node, items, key);
    }
  });

  document.querySelectorAll('[data-config-card-grid]').forEach((node) => {
    const key = node.dataset.configCardGrid;
    const items = getValueFromPath(config, key);
    if (Array.isArray(items)) {
      renderCardGrid(node, items, key);
    }
  });

  document.querySelectorAll('[data-config-faq]').forEach((node) => {
    const key = node.dataset.configFaq;
    const items = getValueFromPath(config, key);
    if (Array.isArray(items)) {
      renderFaqList(node, items, key);
    }
  });

  document.querySelectorAll('[data-config-cta]').forEach((node) => {
    const key = node.dataset.configCta;
    const items = getValueFromPath(config, key);
    if (Array.isArray(items)) {
      renderCtaStack(node, items, key);
    }
  });

  document.querySelectorAll('[data-config-alt-field]').forEach((node) => {
    const key = node.dataset.configAltField;
    const value = getValueFromPath(config, key);
    if (typeof value === 'string') {
      node.setAttribute('alt', value);
    }
  });

  const orgName = getValueFromPath(config, 'branding.orgName') || 'Cadott Community Association';
  document.querySelectorAll('[data-branding="org-name"]').forEach((node) => {
    node.textContent = orgName;
  });

  const headerTitle = getValueFromPath(config, 'branding.headerTitle');
  document.querySelectorAll('[data-branding="header-title"]').forEach((node) => {
    if (typeof headerTitle === 'string') {
      node.textContent = headerTitle;
    }
  });

  const headerSubtitle = getValueFromPath(config, 'branding.headerSubtitle');
  document.querySelectorAll('[data-branding="header-subtitle"]').forEach((node) => {
    if (typeof headerSubtitle === 'string') {
      node.textContent = headerSubtitle;
    }
  });

  const footerNote = getValueFromPath(config, 'branding.footerNote');
  document.querySelectorAll('[data-branding="footer-note"]').forEach((node) => {
    if (typeof footerNote === 'string') {
      node.textContent = footerNote;
    }
  });
};
