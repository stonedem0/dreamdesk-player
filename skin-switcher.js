/**
 * Skin Switcher - Handles switching between default and Tokyo-3 Sunset skins
 */

const SKINS = {
  default: {
    name: 'Default',
    path: '',
    icons: {
      color: '#fa73ab',
      minimize: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#fa73ab"><rect x="0" y="20" width="22" height="7"/></svg>',
      fullscreen: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#fa73ab" stroke-width="3"><rect x="3" y="3" width="18" height="18" fill="none"/><line x1="3" y1="7" x2="21" y2="7" stroke="#fa73ab" stroke-width="3"/></svg>',
      close: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" stroke="#fa73ab" stroke-width="5" stroke-linecap="butt"><line x1="3" y1="3" x2="21" y2="21"/><line x1="21" y1="3" x2="3" y2="21"/></svg>'
    },
    histogramGradient: [
      [0.0, "#fa73ab"],
      [0.1, "#f26bc5"],
      [0.2, "#ea63dd"],
      [0.3, "#e25bf5"],
      [0.4, "#da53ff"],
      [0.5, "#d24bff"],
      [0.6, "#ca43ff"],
      [0.7, "#c23bff"],
      [0.8, "#ba33ff"],
      [1.0, "#b22bff"],
    ]
  },
  sunset: {
    name: 'Sunset',
    path: 'tokyo-3-sunset-skin.css',
    icons: {
      color: '#ff8500',
      minimize: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#ff8500"><rect x="0" y="20" width="22" height="7"/></svg>',
      fullscreen: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#ff8500" stroke-width="3"><rect x="3" y="3" width="18" height="18" fill="none"/><line x1="3" y1="7" x2="21" y2="7" stroke="#ff8500" stroke-width="3"/></svg>',
      close: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" stroke="#ff8500" stroke-width="5" stroke-linecap="butt"><line x1="3" y1="3" x2="21" y2="21"/><line x1="21" y1="3" x2="3" y2="21"/></svg>'
    },
    histogramGradient: [
      [0.0, "#ff4800"],
      [0.1, "#ff5400"],
      [0.2, "#ff6000"],
      [0.3, "#ff6d00"],
      [0.4, "#ff7900"],
      [0.5, "#ff8500"],
      [0.6, "#ff9100"],
      [0.7, "#ff9e00"],
      [0.8, "#ffaa00"],
      [1.0, "#ffb600"],
    ]
  }
};

const SKIN_STORAGE_KEY = 'winamp-current-skin';

function getSkinStylesheet() {
  const link = document.getElementById('skin-stylesheet');
  if (!link) {
    console.warn('Skin stylesheet element not found');
    return null;
  }
  return link;
}

function getPlayerWindow() {
  return document.getElementById('player-window');
}

function getCurrentSkin() {
  const stored = localStorage.getItem(SKIN_STORAGE_KEY);
  return stored || 'default';
}

function getCurrentHistogramGradient() {
  const currentSkin = getCurrentSkin();
  return SKINS[currentSkin]?.histogramGradient || SKINS.default.histogramGradient;
}

function updatePlayerWindowIcons(skinName) {
  const playerWindow = getPlayerWindow();
  if (!playerWindow) return;

  const skin = SKINS[skinName];
  if (!skin) return;

  // Update window control icons
  playerWindow.setAttribute('minimize-icon', skin.icons.minimize);
  playerWindow.setAttribute('fullscreen-icon', skin.icons.fullscreen);
  playerWindow.setAttribute('close-icon', skin.icons.close);
}

function setSkin(skinName) {
  const skin = SKINS[skinName];
  if (!skin) {
    console.warn(`Skin "${skinName}" not found`);
    return;
  }

  const stylesheet = getSkinStylesheet();
  if (!stylesheet) return;

  // Update the stylesheet href
  stylesheet.href = skin.path;

  // Update player window icons
  updatePlayerWindowIcons(skinName);

  // Store preference
  localStorage.setItem(SKIN_STORAGE_KEY, skinName);

  // Update button text
  updateSkinIndicator(skinName);

  // Notify player.js that gradient has changed (if it's loaded)
  if (window.onSkinChange) {
    window.onSkinChange(skinName);
  }
}

function updateSkinIndicator(skinName) {
  const indicator = document.querySelector('.skin-indicator');
  if (indicator) {
    indicator.textContent = SKINS[skinName]?.name || 'Unknown';
  }
}

function toggleSkin() {
  const currentSkin = getCurrentSkin();
  const nextSkin = currentSkin === 'default' ? 'sunset' : 'default';
  setSkin(nextSkin);
}

function initializeSkinSwitcher() {
  // Set up the toggle button
  const toggleBtn = document.getElementById('skin-toggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', toggleSkin);
  }

  // Load saved skin preference or default
  const savedSkin = getCurrentSkin();
  setSkin(savedSkin);
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeSkinSwitcher);
} else {
  initializeSkinSwitcher();
}

// Export functions to window for use in other scripts
window.getCurrentHistogramGradient = getCurrentHistogramGradient;
window.getCurrentSkin = getCurrentSkin;
window.setSkin = setSkin;

