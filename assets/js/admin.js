document.addEventListener('DOMContentLoaded', () => {
  const configApi = window.CCAConfig;
  if (!configApi) {
    return;
  }

  let state = configApi.loadConfig();
  const statusNode = document.querySelector('[data-status]');
  const basicFields = Array.from(document.querySelectorAll('[data-state-path]'));
  const listEditors = Array.from(document.querySelectorAll('[data-list-editor]'));

  const uiClasses = {
    rows: 'space-y-4',
    row: 'flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm shadow-slate-100 md:flex-row md:items-center',
    rowStacked: 'flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm shadow-slate-100',
    subfield: 'flex flex-col gap-2 text-sm text-slate-600',
    input: 'rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 shadow-inner shadow-white focus:border-cadott-green focus:outline-none focus:ring-2 focus:ring-cadott-green/30',
    textarea: 'min-h-[120px] rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 shadow-inner shadow-white focus:border-cadott-green focus:outline-none focus:ring-2 focus:ring-cadott-green/30',
    removeButton:
      'inline-flex items-center justify-center rounded-full border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 transition hover:border-red-400 hover:text-red-700 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-red-200',
    ghostButton:
      'inline-flex items-center justify-center rounded-full border border-dashed border-slate-300 px-4 py-2 text-sm font-semibold text-cadott-ink transition hover:border-cadott-ink focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-cadott-ink/30'
  };

  const styleInput = (node, variant = 'input') => {
    node.className = variant === 'textarea' ? uiClasses.textarea : uiClasses.input;
    return node;
  };

  const setStatus = (message, type = 'info') => {
    if (!statusNode) {
      return;
    }
    statusNode.textContent = message;
    statusNode.dataset.statusType = type;
  };

  const getValue = (path, source = state) => {
    if (!path) {
      return undefined;
    }
    return path.split('.').reduce((acc, key) => {
      if (acc && Object.prototype.hasOwnProperty.call(acc, key)) {
        return acc[key];
      }
      return undefined;
    }, source);
  };

  const setValue = (path, value) => {
    if (!path) {
      return;
    }
    const keys = path.split('.');
    let cursor = state;

    keys.forEach((key, index) => {
      if (index === keys.length - 1) {
        cursor[key] = value;
        return;
      }

      if (!cursor[key] || typeof cursor[key] !== 'object') {
        cursor[key] = {};
      }
      cursor = cursor[key];
    });
  };

  const cloneArrayValue = (value) => {
    if (!Array.isArray(value)) {
      return [];
    }
    return value.map((entry) => {
      if (entry && typeof entry === 'object') {
        return { ...entry };
      }
      return entry;
    });
  };

  const syncBasicFields = () => {
    basicFields.forEach((field) => {
      const path = field.dataset.statePath;
      const value = getValue(path);
      if (typeof value === 'string') {
        field.value = value;
      } else {
        field.value = '';
      }
    });
  };

  const renderTextEditor = (editor) => {
    const path = editor.dataset.listEditor;
    const placeholder = editor.dataset.placeholder || '';
    const items = getValue(path) || [];

    editor.innerHTML = '';
    const rows = document.createElement('div');
    rows.className = uiClasses.rows;

    items.forEach((value, index) => {
      const row = document.createElement('div');
      row.className = uiClasses.row;

      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = placeholder;
      input.value = value || '';
      styleInput(input);
      input.addEventListener('input', (event) => {
        const updated = cloneArrayValue(getValue(path));
        updated[index] = event.target.value;
        setValue(path, updated);
        setStatus('Unsaved changes', 'pending');
      });

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = uiClasses.removeButton;
      remove.textContent = 'Remove';
      remove.addEventListener('click', () => {
        const updated = cloneArrayValue(getValue(path));
        updated.splice(index, 1);
        setValue(path, updated);
        renderEditors();
        setStatus('Unsaved changes', 'pending');
      });

      row.appendChild(input);
      row.appendChild(remove);
      rows.appendChild(row);
    });

    const addButton = document.createElement('button');
    addButton.type = 'button';
    addButton.className = uiClasses.ghostButton;
    addButton.textContent = 'Add line';
    addButton.addEventListener('click', () => {
      const updated = cloneArrayValue(getValue(path));
      updated.push('');
      setValue(path, updated);
      renderEditors();
      setStatus('Unsaved changes', 'pending');
    });

    editor.appendChild(rows);
    editor.appendChild(addButton);
  };

  const renderTimelineEditor = (editor) => {
    const path = editor.dataset.listEditor;
    const items = getValue(path) || [];

    editor.innerHTML = '';
    const rows = document.createElement('div');
    rows.className = uiClasses.rows;

    const fieldLabels = {
      title: 'Title',
      time: 'Time + location',
      description: 'Description'
    };

    items.forEach((entry, index) => {
      const row = document.createElement('div');
      row.className = uiClasses.rowStacked;

      ['title', 'time', 'description'].forEach((field) => {
        const label = document.createElement('label');
        label.className = uiClasses.subfield;

        const labelText = document.createElement('span');
        labelText.textContent = fieldLabels[field];
        label.appendChild(labelText);

        const control = field === 'description' ? document.createElement('textarea') : document.createElement('input');
        control.value = entry?.[field] || '';
        control.placeholder = field === 'title' ? 'Purse Bingo Round 1' : field === 'time' ? 'Doors open · Check Facebook for times' : 'Designer purse prizes each round...';
        if (field === 'description') {
          control.rows = 3;
        }
        styleInput(control, field === 'description' ? 'textarea' : 'input');
        control.addEventListener('input', (event) => {
          const updated = cloneArrayValue(getValue(path));
          const nextEntry = { ...updated[index], [field]: event.target.value };
          updated[index] = nextEntry;
          setValue(path, updated);
          setStatus('Unsaved changes', 'pending');
        });

        label.appendChild(control);
        row.appendChild(label);
      });

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = uiClasses.removeButton;
      remove.textContent = 'Remove block';
      remove.addEventListener('click', () => {
        const updated = cloneArrayValue(getValue(path));
        updated.splice(index, 1);
        setValue(path, updated);
        renderEditors();
        setStatus('Unsaved changes', 'pending');
      });

      row.appendChild(remove);
      rows.appendChild(row);
    });

    const addButton = document.createElement('button');
    addButton.type = 'button';
    addButton.className = uiClasses.ghostButton;
    addButton.textContent = 'Add timeline block';
    addButton.addEventListener('click', () => {
      const updated = cloneArrayValue(getValue(path));
      updated.push({ title: '', time: '', description: '' });
      setValue(path, updated);
      renderEditors();
      setStatus('Unsaved changes', 'pending');
    });

    editor.appendChild(rows);
    editor.appendChild(addButton);
  };

  const renderGalleryEditor = (editor) => {
    const path = editor.dataset.listEditor;
    const items = getValue(path) || [];

    editor.innerHTML = '';
    const rows = document.createElement('div');
    rows.className = uiClasses.rows;

    items.forEach((entry, index) => {
      const row = document.createElement('div');
      row.className = uiClasses.rowStacked;

      const fields = [
        { key: 'src', label: 'Image URL (https://...)', placeholder: 'https://images.unsplash.com/...', type: 'url' },
        { key: 'alt', label: 'Alt text', placeholder: 'Describe the scene', type: 'text' },
        { key: 'caption', label: 'Caption', placeholder: 'Fun Run/Walk sets the tone...', type: 'text' }
      ];

      fields.forEach(({ key, label, placeholder, type }) => {
        const fieldLabel = document.createElement('label');
        fieldLabel.className = uiClasses.subfield;

        const labelText = document.createElement('span');
        labelText.textContent = label;
        fieldLabel.appendChild(labelText);

        const input = document.createElement('input');
        input.type = type;
        input.placeholder = placeholder;
        input.value = entry?.[key] || '';
        styleInput(input);
        input.addEventListener('input', (event) => {
          const updated = cloneArrayValue(getValue(path));
          const nextEntry = { ...updated[index], [key]: event.target.value };
          updated[index] = nextEntry;
          setValue(path, updated);
          setStatus('Unsaved changes', 'pending');
        });

        fieldLabel.appendChild(input);
        row.appendChild(fieldLabel);
      });

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = uiClasses.removeButton;
      remove.textContent = 'Remove photo';
      remove.addEventListener('click', () => {
        const updated = cloneArrayValue(getValue(path));
        updated.splice(index, 1);
        setValue(path, updated);
        renderEditors();
        setStatus('Unsaved changes', 'pending');
      });

      row.appendChild(remove);
      rows.appendChild(row);
    });

    const addButton = document.createElement('button');
    addButton.type = 'button';
    addButton.className = uiClasses.ghostButton;
    addButton.textContent = 'Add photo card';
    addButton.addEventListener('click', () => {
      const updated = cloneArrayValue(getValue(path));
      updated.push({ src: '', alt: '', caption: '' });
      setValue(path, updated);
      renderEditors();
      setStatus('Unsaved changes', 'pending');
    });

    editor.appendChild(rows);
    editor.appendChild(addButton);
  };

  const renderAccordionEditor = (editor) => {
    const path = editor.dataset.listEditor;
    const items = getValue(path) || [];

    editor.innerHTML = '';
    const rows = document.createElement('div');
    rows.className = uiClasses.rows;

    items.forEach((entry, index) => {
      const row = document.createElement('div');
      row.className = uiClasses.rowStacked;

      const fields = [
        { key: 'title', label: 'Event title', placeholder: 'Purse Bingo Night', type: 'text' },
        { key: 'timing', label: 'Timing + location', placeholder: 'Spring 2026 · Check Facebook for details', type: 'text' },
        { key: 'summary', label: 'Summary', placeholder: 'Designer purse prizes, raffles, cash bar', type: 'textarea' },
        { key: 'details', label: 'Details', placeholder: 'Tickets available on Facebook...', type: 'textarea' }
      ];

      fields.forEach(({ key, label, placeholder, type }) => {
        const fieldLabel = document.createElement('label');
        fieldLabel.className = uiClasses.subfield;

        const labelText = document.createElement('span');
        labelText.textContent = label;
        fieldLabel.appendChild(labelText);

        const control = type === 'textarea' ? document.createElement('textarea') : document.createElement('input');
        if (type !== 'textarea') {
          control.type = 'text';
        } else {
          control.rows = 3;
        }
        control.placeholder = placeholder;
        control.value = entry?.[key] || '';
        styleInput(control, type === 'textarea' ? 'textarea' : 'input');
        control.addEventListener('input', (event) => {
          const updated = cloneArrayValue(getValue(path));
          const nextEntry = { ...updated[index], [key]: event.target.value };
          updated[index] = nextEntry;
          setValue(path, updated);
          setStatus('Unsaved changes', 'pending');
        });

        fieldLabel.appendChild(control);
        row.appendChild(fieldLabel);
      });

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = uiClasses.removeButton;
      remove.textContent = 'Remove event';
      remove.addEventListener('click', () => {
        const updated = cloneArrayValue(getValue(path));
        updated.splice(index, 1);
        setValue(path, updated);
        renderEditors();
        setStatus('Unsaved changes', 'pending');
      });

      row.appendChild(remove);
      rows.appendChild(row);
    });

    const addButton = document.createElement('button');
    addButton.type = 'button';
    addButton.className = uiClasses.ghostButton;
    addButton.textContent = 'Add event';
    addButton.addEventListener('click', () => {
      const updated = cloneArrayValue(getValue(path));
      updated.push({ title: '', timing: '', summary: '', details: '' });
      setValue(path, updated);
      renderEditors();
      setStatus('Unsaved changes', 'pending');
    });

    editor.appendChild(rows);
    editor.appendChild(addButton);
  };

  const renderEditors = () => {
    listEditors.forEach((editor) => {
      const type = editor.dataset.editorType || 'text';
      if (type === 'timeline') {
        renderTimelineEditor(editor);
      } else if (type === 'gallery') {
        renderGalleryEditor(editor);
      } else if (type === 'accordion') {
        renderAccordionEditor(editor);
      } else {
        renderTextEditor(editor);
      }
    });
  };

  const handleSave = () => {
    configApi.saveConfig(state);
    setStatus('Changes saved. Reload public pages to view them.', 'success');
  };

  const handleReset = () => {
    configApi.resetConfig();
    state = configApi.loadConfig();
    syncBasicFields();
    renderEditors();
    setStatus('Defaults restored. Remember to save.', 'info');
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cca-config-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setStatus('Backup downloaded.', 'success');
  };

  basicFields.forEach((field) => {
    field.addEventListener('input', (event) => {
      setValue(field.dataset.statePath, event.target.value);
      setStatus('Unsaved changes', 'pending');
    });
  });

  document.querySelectorAll('[data-action="save-config"]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      handleSave();
    });
  });

  document.querySelectorAll('[data-action="reset-config"]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      handleReset();
    });
  });

  document.querySelectorAll('[data-action="export-config"]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      handleExport();
    });
  });

  syncBasicFields();
  renderEditors();
  setStatus('Loaded current settings.', 'info');
});
