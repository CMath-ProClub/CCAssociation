import { initNavigation, initDeviceMarker } from './modules/layout.js';
import { applyConfig } from './modules/configurator.js';
import {
  prepareInlineCopyTargets,
  prepareInlineBlockTargets,
  prepareInlineMediaTargets,
  applyCopyOverrides,
  applyFontOverrides,
  applyLayoutOverrides,
  applyMediaOverrides
} from './modules/inline-hooks.js';
import { applyModuleTokens } from './modules/tokens.js';

/* ═══════════════════════════════════════════════════════════════════════════
   SCROLL-REVEAL ANIMATION SYSTEM
   Professional scroll-triggered animations for visual polish
   ═══════════════════════════════════════════════════════════════════════════ */

function initScrollReveal() {
  // Elements that animate on scroll
  const revealSelectors = [
    '.panel-shell',
    '[data-module="panel-shell"]',
    '.stat-card',
    '.impact-card',
    '.testimonial-card',
    '.media-card',
    '.hero-photo',
    '.mission-hero',
    '.form-card',
    '.section-heading',
    '.schedule-list li'
  ];

  const revealElements = document.querySelectorAll(revealSelectors.join(', '));
  
  // Apply initial hidden state
  revealElements.forEach((el, index) => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(30px)';
    el.style.transition = `opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1) ${index * 0.05}s, transform 0.6s cubic-bezier(0.4, 0, 0.2, 1) ${index * 0.05}s`;
  });

  // Intersection Observer for reveal
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
        revealObserver.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  });

  // Observe all elements
  revealElements.forEach(el => revealObserver.observe(el));
}

/* ═══════════════════════════════════════════════════════════════════════════
   SMOOTH SCROLL FOR ANCHOR LINKS
   ═══════════════════════════════════════════════════════════════════════════ */

function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#') return;
      
      const targetEl = document.querySelector(targetId);
      if (targetEl) {
        e.preventDefault();
        targetEl.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
   PARALLAX SUBTLE EFFECT FOR HERO
   ═══════════════════════════════════════════════════════════════════════════ */

function initParallax() {
  const heroPhoto = document.querySelector('.hero-photo img');
  if (!heroPhoto) return;

  let ticking = false;
  
  window.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        const scrolled = window.pageYOffset;
        const rate = scrolled * 0.1;
        if (rate < 50) {
          heroPhoto.style.transform = `scale(1.02) translateY(${rate}px)`;
        }
        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });
}

/* ═══════════════════════════════════════════════════════════════════════════
   COUNTER ANIMATION FOR STATS
   ═══════════════════════════════════════════════════════════════════════════ */

function initCounterAnimation() {
  const statValues = document.querySelectorAll('.stat-value');
  
  const animateCounter = (el) => {
    const text = el.textContent;
    const match = text.match(/^([\d,]+)/);
    if (!match) return;
    
    const targetNum = parseInt(match[1].replace(/,/g, ''), 10);
    const suffix = text.slice(match[0].length);
    const duration = 1500;
    const startTime = performance.now();
    
    const updateCounter = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease out cubic
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const current = Math.floor(targetNum * easeOut);
      
      el.textContent = current.toLocaleString() + suffix;
      
      if (progress < 1) {
        requestAnimationFrame(updateCounter);
      }
    };
    
    requestAnimationFrame(updateCounter);
  };

  const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animateCounter(entry.target);
        counterObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  statValues.forEach(el => counterObserver.observe(el));
}

/* ═══════════════════════════════════════════════════════════════════════════
   BACK TO TOP BUTTON - FRIENDLY NAVIGATION
   ═══════════════════════════════════════════════════════════════════════════ */

function initBackToTop() {
  // Create the button
  const btn = document.createElement('a');
  btn.href = '#';
  btn.className = 'back-to-top';
  btn.setAttribute('aria-label', 'Back to top');
  btn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M5 15l7-7 7 7" />
    </svg>
    <span>Top</span>
  `;
  document.body.appendChild(btn);

  // Show/hide based on scroll
  let ticking = false;
  const handleScroll = () => {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        if (window.pageYOffset > 400) {
          btn.classList.add('visible');
        } else {
          btn.classList.remove('visible');
        }
        ticking = false;
      });
      ticking = true;
    }
  };

  window.addEventListener('scroll', handleScroll, { passive: true });

  // Smooth scroll to top
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
   EVENT COUNTDOWN - BUILD COMMUNITY ANTICIPATION
   ═══════════════════════════════════════════════════════════════════════════ */

function initEventCountdown() {
  const countdownEl = document.querySelector('[data-countdown]');
  if (!countdownEl) return;

  const targetDate = new Date(countdownEl.dataset.countdown);
  if (isNaN(targetDate.getTime())) return;

  const update = () => {
    const now = new Date();
    const diff = targetDate - now;

    if (diff <= 0) {
      countdownEl.innerHTML = '<span class="countdown-label">🎉 It\'s happening now!</span>';
      return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    const daysEl = countdownEl.querySelector('[data-countdown-days]');
    const hoursEl = countdownEl.querySelector('[data-countdown-hours]');
    const minsEl = countdownEl.querySelector('[data-countdown-mins]');

    if (daysEl) daysEl.textContent = days;
    if (hoursEl) hoursEl.textContent = hours;
    if (minsEl) minsEl.textContent = mins;
  };

  update();
  setInterval(update, 60000); // Update every minute
}

/* ═══════════════════════════════════════════════════════════════════════════
   SEASONAL GREETING - CONTEXTUAL COMMUNITY MESSAGE
   ═══════════════════════════════════════════════════════════════════════════ */

function initSeasonalBanner() {
  const bannerEl = document.querySelector('[data-seasonal-banner]');
  if (!bannerEl) return;

  const now = new Date();
  const month = now.getMonth();
  const day = now.getDate();

  let message = '';

  // Seasonal messages for Wisconsin community
  if (month === 11 && day >= 20 || month === 0 && day <= 5) {
    message = '🎄 <strong>Happy Holidays</strong> from your neighbors in Cadott!';
  } else if (month === 6) {
    message = '🎪 <strong>Nabor Days is coming!</strong> Get ready to celebrate with us.';
  } else if (month === 0 || month === 1) {
    message = '❄️ Stay warm, neighbors! <strong>Purse Bingo</strong> is coming up — grab your friends!';
  } else if (month >= 2 && month <= 4) {
    message = '🌷 Spring is here! Time to plan for <strong>summer festivities</strong>.';
  } else if (month >= 8 && month <= 10) {
    message = '🍂 <strong>Fall fun</strong> in Cadott — Purse Bingo and more!';
  } else {
    message = '☀️ <strong>Welcome, neighbor!</strong> Join us at our community events.';
  }

  if (message) {
    bannerEl.innerHTML = message;
    bannerEl.classList.remove('hidden');
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   KEYBOARD PAGE NAVIGATION - ARROW KEYS TO BROWSE PAGES
   ═══════════════════════════════════════════════════════════════════════════ */

function initKeyboardPageNav() {
  // Define the page order for navigation
  const pages = [
    { path: 'index.html', label: 'Home' },
    { path: 'events.html', label: 'Events' },
    { path: 'gallery.html', label: 'Gallery' },
    { path: 'faq.html', label: 'FAQ' },
    { path: 'contact.html', label: 'Contact' }
  ];

  // Get current page
  const currentPath = window.location.pathname;
  const currentFile = currentPath.split('/').pop() || 'index.html';
  
  // Handle root path as index.html
  const normalizedCurrent = currentFile === '' ? 'index.html' : currentFile;
  
  // Find current page index
  const currentIndex = pages.findIndex(p => p.path === normalizedCurrent);
  if (currentIndex === -1) return; // Not on a known page

  // Create navigation indicator
  const indicator = document.createElement('div');
  indicator.className = 'keyboard-nav-indicator';
  indicator.setAttribute('role', 'status');
  indicator.setAttribute('aria-live', 'polite');
  indicator.hidden = true;
  document.body.appendChild(indicator);

  let indicatorTimeout = null;
  let isTransitioning = false;
  const transitionDelay = 360;

  const showIndicator = (direction, targetPage) => {
    const arrow = direction === 'left' ? '←' : '→';
    indicator.innerHTML = `<span class="keyboard-nav-arrow">${arrow}</span> <span>${targetPage.label}</span>`;
    indicator.hidden = false;
    indicator.classList.add('visible');
    
    clearTimeout(indicatorTimeout);
    indicatorTimeout = setTimeout(() => {
      indicator.classList.remove('visible');
      setTimeout(() => { indicator.hidden = true; }, 300);
    }, 1500);
  };

  const navigateToPage = (direction) => {
    if (isTransitioning) {
      return;
    }

    let targetIndex;
    
    if (direction === 'left') {
      targetIndex = currentIndex > 0 ? currentIndex - 1 : pages.length - 1;
    } else {
      targetIndex = currentIndex < pages.length - 1 ? currentIndex + 1 : 0;
    }

    const targetPage = pages[targetIndex];
    showIndicator(direction, targetPage);
    
    // Navigate after brief indicator display
    isTransitioning = true;
    try {
      sessionStorage.setItem('ccaPageTransitionDirection', direction);
    } catch (error) {
      // Non-blocking; continue without persisted direction if storage fails
    }
    if (document.body) {
      document.body.dataset.pageTransition = direction;
      document.body.classList.add('page-transition-exit');
    }

    setTimeout(() => {
      window.location.href = targetPage.path;
    }, transitionDelay);
  };

  // Listen for arrow keys
  document.addEventListener('keydown', (event) => {
    // Don't trigger when typing in inputs, textareas, or contenteditable
    const activeEl = document.activeElement;
    const isTyping = activeEl && (
      activeEl.tagName === 'INPUT' ||
      activeEl.tagName === 'TEXTAREA' ||
      activeEl.isContentEditable ||
      activeEl.closest('[contenteditable="true"]')
    );
    
    if (isTyping) return;

    // Don't trigger if any modal is open
    if (document.querySelector('[role="dialog"]:not(.hidden)')) return;
    
    // Don't trigger with modifier keys (except for accessibility)
    if (event.ctrlKey || event.metaKey) return;

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      navigateToPage('left');
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      navigateToPage('right');
    }
  });

  // Add hint to footer or create floating hint
  const addKeyboardHint = () => {
    const footer = document.querySelector('.site-footer, footer');
    if (!footer) return;

    const hint = document.createElement('div');
    hint.className = 'keyboard-nav-hint';
    hint.innerHTML = `
      <span class="keyboard-nav-hint-label">Quick navigate:</span>
      <kbd>←</kbd> <kbd>→</kbd>
    `;
    
    // Insert hint into footer
    const footerBottom = footer.querySelector('.footer-bottom');
    if (footerBottom) {
      footerBottom.appendChild(hint);
    }
  };

  addKeyboardHint();
}

function applyPageEntryTransition() {
  if (!document?.body) {
    return;
  }

  let direction = '';
  try {
    direction = sessionStorage.getItem('ccaPageTransitionDirection') || '';
    sessionStorage.removeItem('ccaPageTransitionDirection');
  } catch (error) {
    direction = '';
  }

  document.body.dataset.pageTransition = direction;
  document.body.classList.add('page-transition-enter');
  window.setTimeout(() => {
    document.body.classList.remove('page-transition-enter');
  }, 450);
}

document.addEventListener('DOMContentLoaded', () => {
  applyPageEntryTransition();
  initNavigation();
  initDeviceMarker();
  applyModuleTokens();
  
  // Initialize premium animations
  initScrollReveal();
  initSmoothScroll();
  initParallax();
  initCounterAnimation();
  initBackToTop();
  initEventCountdown();
  initSeasonalBanner();
  initKeyboardPageNav();

  const yearEl = document.querySelector('[data-year]');
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }

  const configApi = window.CCAConfig;
  if (configApi && typeof configApi.loadConfig === 'function') {
    const initialConfig = configApi.loadConfig();
    applyConfig(initialConfig);
    prepareInlineCopyTargets();
    prepareInlineBlockTargets();
    prepareInlineMediaTargets();
    applyCopyOverrides();
    applyFontOverrides();
    applyLayoutOverrides();
    applyMediaOverrides();

    window.addEventListener('cca-config-updated', (event) => {
      const nextConfig = event?.detail?.config;
      if (!nextConfig) {
        return;
      }
      applyConfig(nextConfig);
      prepareInlineCopyTargets();
      prepareInlineBlockTargets();
      prepareInlineMediaTargets();
      applyCopyOverrides();
      applyFontOverrides();
      applyLayoutOverrides();
      applyMediaOverrides();
    });
  } else {
    prepareInlineCopyTargets();
    prepareInlineBlockTargets();
    prepareInlineMediaTargets();
    applyCopyOverrides();
    applyFontOverrides();
    applyLayoutOverrides();
    applyMediaOverrides();
  }

  window.addEventListener('cca-inline-copy-updated', (event) => {
    prepareInlineCopyTargets();
    applyCopyOverrides(event?.detail?.overrides);
    applyFontOverrides();
  });

  window.addEventListener('cca-inline-font-updated', (event) => {
    prepareInlineCopyTargets();
    applyFontOverrides(event?.detail?.overrides);
  });

  window.addEventListener('cca-inline-layout-updated', (event) => {
    prepareInlineBlockTargets();
    applyLayoutOverrides(event?.detail?.overrides);
  });

  window.addEventListener('cca-inline-media-updated', (event) => {
    prepareInlineMediaTargets();
    applyMediaOverrides(event?.detail?.overrides);
  });
});
