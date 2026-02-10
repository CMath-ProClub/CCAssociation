const TOKEN_CLASS_MAP = {
  'hero-shell': 'rounded-[32px] border border-slate-200/70 bg-white/95 p-8 lg:p-12 shadow-[0_12px_40px_rgba(15,23,42,0.08)]',
  'panel-shell': 'rounded-[28px] border border-slate-200/70 bg-white/95 p-8 shadow-[0_10px_30px_rgba(15,23,42,0.06)]',
  'note-card': 'rounded-3xl border border-dashed border-slate-300 bg-white/80 p-6',
  'cta-cluster': 'flex flex-wrap gap-3',
  'list-stack': 'space-y-4',
  'gallery-shell': 'rounded-[28px] border border-slate-200/60 bg-white/90 p-8 shadow-sm shadow-slate-200/60',
  'meta-strip': 'border-b border-slate-200 bg-white/90 text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-slate-500',
  'site-shell': 'mx-auto max-w-6xl space-y-16 px-4 py-12 lg:py-16',
  'nav-shell': 'bg-white/95 backdrop-blur border-b border-slate-200',
  'stat-pill': 'inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-slate-500',
  'section-label': 'text-xs font-semibold uppercase tracking-[0.35em] text-cadott-amber',
  'surface-muted': 'rounded-[24px] border border-slate-200/70 bg-cadott-sand/40 p-6'
};

export const applyModuleTokens = () => {
  document.querySelectorAll('[data-module]').forEach((node) => {
    const tokens = node.dataset.module
      .split(/\s+/)
      .map((token) => token.trim())
      .filter(Boolean);
    tokens.forEach((token) => {
      const classes = TOKEN_CLASS_MAP[token];
      if (!classes) {
        return;
      }
      classes.split(' ').forEach((cls) => {
        if (cls) {
          node.classList.add(cls);
        }
      });
    });
  });
};
