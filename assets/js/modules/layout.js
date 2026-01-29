const setNavState = (navMenu, navToggle, open) => {
  navMenu.setAttribute('data-open', open.toString());
  navToggle.setAttribute('aria-expanded', open.toString());
  if (open) {
    navMenu.classList.remove('hidden');
    navMenu.classList.add('flex');
  } else {
    navMenu.classList.add('hidden');
    navMenu.classList.remove('flex');
  }
};

export const initNavigation = () => {
  const navToggle = document.querySelector('[data-nav-toggle]');
  const navMenu = document.querySelector('[data-nav-menu]');
  if (!navToggle || !navMenu) {
    return;
  }

  navToggle.addEventListener('click', () => {
    const isOpen = navMenu.getAttribute('data-open') === 'true';
    setNavState(navMenu, navToggle, !isOpen);
  });

  const syncNavForViewport = () => {
    if (window.innerWidth >= 640) {
      navMenu.classList.remove('hidden');
      navMenu.classList.add('flex');
    } else if (navMenu.getAttribute('data-open') !== 'true') {
      navMenu.classList.add('hidden');
      navMenu.classList.remove('flex');
    }
  };

  window.addEventListener('resize', () => {
    window.requestAnimationFrame(syncNavForViewport);
  });
  syncNavForViewport();
};

const detectDeviceType = () => {
  const width = window.innerWidth;
  if (width < 640) {
    return 'mobile';
  }
  if (width < 1024) {
    return 'tablet';
  }
  return 'desktop';
};

export const initDeviceMarker = () => {
  const body = document.body;
  if (!body) {
    return;
  }
  const applyDeviceType = () => {
    const device = detectDeviceType();
    if (body.getAttribute('data-device') !== device) {
      body.setAttribute('data-device', device);
    }
  };
  applyDeviceType();
  window.addEventListener('resize', () => {
    window.requestAnimationFrame(applyDeviceType);
  });
};
