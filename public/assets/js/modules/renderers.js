const addClasses = (node, classes = []) => {
  if (!node || !Array.isArray(classes)) {
    return;
  }
  classes.forEach((cls) => {
    if (cls) {
      node.classList.add(cls);
    }
  });
};

const emptyState = (message) => {
  const p = document.createElement('p');
  p.className = 'text-center text-sm text-slate-500';
  p.textContent = message;
  return p;
};

export const renderSimpleList = (target, items, basePath = '') => {
  target.innerHTML = '';
  if (basePath) {
    target.dataset.configCollection = basePath;
  } else {
    delete target.dataset.configCollection;
  }

  const variant = target.dataset.listVariant || 'text';
  target.classList.remove('space-y-1', 'space-y-2', 'space-y-3', 'space-y-4');
  target.classList.add(variant === 'card' ? 'space-y-4' : 'space-y-3');

  if (!Array.isArray(items) || items.length === 0) {
    target.appendChild(emptyState('Nothing here yet. Add content from the admin console.'));
    return;
  }

  items.forEach((item, index) => {
    const li = document.createElement('li');
    if (variant === 'card') {
      li.className = 'rounded-2xl border border-slate-200/80 bg-white/95 p-4 text-sm text-slate-700 shadow-sm shadow-slate-200/60';
    } else {
      li.className = 'text-base leading-relaxed text-slate-600';
    }
    li.textContent = item || '';

    if (basePath) {
      li.dataset.configField = `${basePath}.${index}`;
      li.dataset.configEntry = `${basePath}.${index}`;
    }

    if (typeof item === 'string' && item.trim().length === 0) {
      li.dataset.inlineEmpty = 'true';
      li.style.display = 'none';
    } else {
      delete li.dataset.inlineEmpty;
      li.style.display = '';
    }

    target.appendChild(li);
  });
};

export const renderTimelineList = (target, items, basePath = '') => {
  target.innerHTML = '';
  if (basePath) {
    target.dataset.configCollection = basePath;
  } else {
    delete target.dataset.configCollection;
  }

  addClasses(target, ['space-y-6', 'border-l', 'border-slate-200/80', 'pl-6']);

  if (!Array.isArray(items) || items.length === 0) {
    target.appendChild(emptyState('Add a first milestone from the admin console.'));
    return;
  }

  items.forEach((item, index) => {
    const article = document.createElement('article');
    article.className = 'relative pl-6';
    if (basePath) {
      article.dataset.configEntry = `${basePath}.${index}`;
    }

    const marker = document.createElement('span');
    marker.className = 'absolute -left-3 top-2 block h-2.5 w-2.5 rounded-full bg-cadott-amber shadow shadow-cadott-amber/30';
    article.appendChild(marker);

    const heading = document.createElement('h4');
    heading.className = 'text-base font-semibold text-cadott-ink';
    heading.textContent = item?.title || '';
    if (basePath) {
      heading.dataset.configField = `${basePath}.${index}.title`;
    }
    article.appendChild(heading);

    const time = document.createElement('p');
    time.className = 'text-xs font-semibold uppercase tracking-[0.35em] text-slate-500';
    time.textContent = item?.time || '';
    if (basePath) {
      time.dataset.configField = `${basePath}.${index}.time`;
    }
    article.appendChild(time);

    const description = document.createElement('p');
    description.className = 'mt-2 text-sm text-slate-600';
    const hasDescription = typeof item?.description === 'string' && item.description.trim().length > 0;
    description.textContent = item?.description || '';
    if (!hasDescription) {
      description.dataset.inlineEmpty = 'true';
      description.style.display = 'none';
    } else {
      delete description.dataset.inlineEmpty;
      description.style.display = '';
    }
    if (basePath) {
      description.dataset.configField = `${basePath}.${index}.description`;
    }
    article.appendChild(description);

    target.appendChild(article);
  });
};

export const renderLabeledList = (target, items, basePath = '') => {
  target.innerHTML = '';
  if (basePath) {
    target.dataset.configCollection = basePath;
  } else {
    delete target.dataset.configCollection;
  }

  addClasses(target, ['space-y-4']);

  if (!Array.isArray(items) || items.length === 0) {
    target.appendChild(emptyState('Add steps from the admin console.'));
    return;
  }

  items.forEach((item, index) => {
    const li = document.createElement('li');
    li.className = 'rounded-2xl border border-slate-200/80 bg-white/95 p-5 shadow-sm shadow-slate-200/60';
    if (basePath) {
      li.dataset.configEntry = `${basePath}.${index}`;
    }

    const label = document.createElement('strong');
    label.className = 'text-sm font-semibold uppercase tracking-[0.3em] text-cadott-amber';
    label.textContent = item?.label || `Step ${index + 1}`;
    if (basePath) {
      label.dataset.configField = `${basePath}.${index}.label`;
    }

    const body = document.createElement('p');
    body.className = 'mt-2 text-sm text-slate-600';
    body.textContent = item?.body || '';
    if (basePath) {
      body.dataset.configField = `${basePath}.${index}.body`;
    }

    li.appendChild(label);
    li.appendChild(body);
    target.appendChild(li);
  });
};

export const renderCardGrid = (target, items, basePath = '') => {
  target.innerHTML = '';
  if (basePath) {
    target.dataset.configCollection = basePath;
  } else {
    delete target.dataset.configCollection;
  }

  addClasses(target, ['grid', 'gap-6', 'sm:grid-cols-2']);

  if (!Array.isArray(items) || items.length === 0) {
    target.appendChild(emptyState('Add cards from the admin console.'));
    return;
  }

  items.forEach((item, index) => {
    const card = document.createElement('article');
    card.className = 'rounded-3xl border border-slate-200/80 bg-white/95 p-6 shadow-[0_12px_30px_rgba(15,23,42,0.08)]';
    if (basePath) {
      card.dataset.configEntry = `${basePath}.${index}`;
    }

    const heading = document.createElement('h3');
    heading.className = 'text-xl font-semibold text-cadott-ink';
    heading.textContent = item?.title || '';
    if (basePath) {
      heading.dataset.configField = `${basePath}.${index}.title`;
    }

    const copy = document.createElement('p');
    copy.className = 'mt-2 text-sm text-slate-600';
    copy.textContent = item?.details || '';
    if (basePath) {
      copy.dataset.configField = `${basePath}.${index}.details`;
    }

    card.appendChild(heading);
    card.appendChild(copy);
    target.appendChild(card);
  });
};

export const renderFaqList = (target, items, basePath = '') => {
  target.innerHTML = '';
  if (basePath) {
    target.dataset.configCollection = basePath;
  } else {
    delete target.dataset.configCollection;
  }

  addClasses(target, ['space-y-4']);

  if (!Array.isArray(items) || items.length === 0) {
    target.appendChild(emptyState('Add FAQs from the admin console.'));
    return;
  }

  items.forEach((item, index) => {
    const article = document.createElement('article');
    article.className = 'rounded-3xl border border-slate-200/80 bg-white/95 p-6 shadow-sm shadow-slate-200/60';
    if (basePath) {
      article.dataset.configEntry = `${basePath}.${index}`;
    }

    const heading = document.createElement('h3');
    heading.className = 'text-lg font-semibold text-cadott-ink';
    heading.textContent = item?.question || 'Untitled question';
    if (basePath) {
      heading.dataset.configField = `${basePath}.${index}.question`;
    }

    const answer = document.createElement('p');
    answer.className = 'mt-2 text-sm text-slate-600';
    answer.textContent = item?.answer || '';
    if (basePath) {
      answer.dataset.configField = `${basePath}.${index}.answer`;
    }

    article.appendChild(heading);
    article.appendChild(answer);
    target.appendChild(article);
  });
};

export const renderGallery = (target, items, basePath = '') => {
  target.innerHTML = '';
  if (basePath) {
    target.dataset.configCollection = basePath;
  } else {
    delete target.dataset.configCollection;
  }

  const columns = target.dataset.galleryColumns || '3';
  target.className = '';
  addClasses(target, ['grid', 'gap-5', 'sm:grid-cols-2']);
  if (columns === '4') {
    addClasses(target, ['lg:grid-cols-4']);
  } else if (columns === '2') {
    addClasses(target, ['lg:grid-cols-2']);
  } else {
    addClasses(target, ['lg:grid-cols-3']);
  }

  if (!Array.isArray(items) || items.length === 0) {
    target.appendChild(emptyState('Upload photos from the admin console to populate this gallery.'));
    return;
  }

  items.forEach((item, index) => {
    const figure = document.createElement('figure');
    figure.className = 'flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/70';
    if (basePath) {
      figure.dataset.configEntry = `${basePath}.${index}`;
    }

    const img = document.createElement('img');
    img.src = item?.src || '';
    img.alt = item?.alt || '';
    img.loading = 'lazy';
    img.className = 'h-48 w-full object-cover';
    if (basePath) {
      img.dataset.configField = `${basePath}.${index}.src`;
      img.dataset.configFieldType = 'attr:src';
      img.dataset.configAltField = `${basePath}.${index}.alt`;
    }
    figure.appendChild(img);

    const caption = document.createElement('figcaption');
    caption.className = 'px-4 py-3 text-sm text-slate-600';
    const hasCaption = typeof item?.caption === 'string' && item.caption.trim().length > 0;
    caption.textContent = item?.caption || '';
    if (!hasCaption) {
      caption.dataset.inlineEmpty = 'true';
      caption.style.display = 'none';
    } else {
      delete caption.dataset.inlineEmpty;
      caption.style.display = '';
    }
    if (basePath) {
      caption.dataset.configField = `${basePath}.${index}.caption`;
    }
    figure.appendChild(caption);

    target.appendChild(figure);
  });
};

export const renderCtaStack = (target, items, basePath = '') => {
  target.innerHTML = '';
  if (basePath) {
    target.dataset.configCollection = basePath;
  } else {
    delete target.dataset.configCollection;
  }

  addClasses(target, ['flex', 'flex-wrap', 'gap-3']);

  if (!Array.isArray(items) || items.length === 0) {
    target.appendChild(emptyState('Add action buttons from the admin console.'));
    return;
  }

  items.forEach((item, index) => {
    const link = document.createElement('a');
    const isSecondary = item?.style === 'secondary';
    link.className = `button ${isSecondary ? 'secondary' : 'primary'}`;
    link.href = item?.href || '#';
    if (link.classList) {
      link.classList.add('cta-pill');
    }
    if (item?.target) {
      link.setAttribute('target', item.target);
    }
    if (item?.rel) {
      link.setAttribute('rel', item.rel);
    }

    const labelSpan = document.createElement('span');
    labelSpan.textContent = item?.label || 'Button';
    if (basePath) {
      link.dataset.configEntry = `${basePath}.${index}`;
      labelSpan.dataset.configField = `${basePath}.${index}.label`;
      link.dataset.configField = `${basePath}.${index}.href`;
      link.dataset.configFieldType = 'attr:href';
    }
    link.textContent = '';
    link.appendChild(labelSpan);
    target.appendChild(link);
  });
};

export const renderAccordion = (target, items, basePath = '') => {
  target.innerHTML = '';
  if (basePath) {
    target.dataset.configCollection = basePath;
  } else {
    delete target.dataset.configCollection;
  }

  addClasses(target, ['space-y-4']);

  if (!Array.isArray(items) || items.length === 0) {
    target.appendChild(emptyState('Add events from the admin console.'));
    return;
  }

  items.forEach((item, index) => {
    const entry = document.createElement('article');
    entry.className = 'overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/70 transition';
    if (basePath) {
      entry.dataset.configEntry = `${basePath}.${index}`;
    }

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'flex w-full items-center justify-between gap-4 px-5 py-4 text-left';
    const panelId = `${target.id || 'accordion'}-panel-${index}`;
    trigger.setAttribute('aria-controls', panelId);
    trigger.setAttribute('aria-expanded', 'false');

    const title = document.createElement('span');
    title.className = 'text-base font-semibold text-cadott-ink';
    title.textContent = item?.title || 'Untitled event';
    if (basePath) {
      title.dataset.configField = `${basePath}.${index}.title`;
    }
    trigger.appendChild(title);

    if (item?.timing) {
      const timing = document.createElement('span');
      timing.className = 'text-xs font-semibold uppercase tracking-[0.35em] text-slate-500';
      timing.textContent = item.timing;
      if (basePath) {
        timing.dataset.configField = `${basePath}.${index}.timing`;
      }
      trigger.appendChild(timing);
    }

    const panel = document.createElement('div');
    panel.id = panelId;
    panel.hidden = true;
    panel.className = 'border-t border-slate-100 px-5 py-4 text-sm text-slate-600';

    const summary = document.createElement('p');
    summary.className = 'font-semibold text-cadott-ink';
    const hasSummary = typeof item?.summary === 'string' && item.summary.trim().length > 0;
    summary.textContent = item?.summary || '';
    if (!hasSummary) {
      summary.dataset.inlineEmpty = 'true';
      summary.style.display = 'none';
    } else {
      delete summary.dataset.inlineEmpty;
      summary.style.display = '';
    }
    if (basePath) {
      summary.dataset.configField = `${basePath}.${index}.summary`;
    }
    panel.appendChild(summary);

    const details = document.createElement('p');
    details.className = 'mt-3';
    const hasDetails = typeof item?.details === 'string' && item.details.trim().length > 0;
    details.textContent = item?.details || '';
    if (!hasDetails) {
      details.dataset.inlineEmpty = 'true';
      details.style.display = 'none';
    } else {
      delete details.dataset.inlineEmpty;
      details.style.display = '';
    }
    if (basePath) {
      details.dataset.configField = `${basePath}.${index}.details`;
    }
    panel.appendChild(details);

    const setOpenState = (isOpen) => {
      entry.classList.toggle('border-cadott-green', isOpen);
      entry.classList.toggle('shadow-cadott-green/20', isOpen);
    };

    trigger.addEventListener('click', () => {
      const next = trigger.getAttribute('aria-expanded') !== 'true';
      trigger.setAttribute('aria-expanded', next.toString());
      panel.hidden = !next;
      setOpenState(next);
    });

    entry.appendChild(trigger);
    entry.appendChild(panel);
    target.appendChild(entry);
  });
};
