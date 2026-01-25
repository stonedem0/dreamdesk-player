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
    }
  },
  sunset: {
    name: 'Sunset',
    path: 'tokyo-3-sunset-skin.css',
    icons: {
      color: '#ff8500',
      minimize: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#ff8500"><rect x="0" y="20" width="22" height="7"/></svg>',
      fullscreen: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#ff8500" stroke-width="3"><rect x="3" y="3" width="18" height="18" fill="none"/><line x1="3" y1="7" x2="21" y2="7" stroke="#ff8500" stroke-width="3"/></svg>',
      close: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" stroke="#ff8500" stroke-width="5" stroke-linecap="butt"><line x1="3" y1="3" x2="21" y2="21"/><line x1="21" y1="3" x2="3" y2="21"/></svg>'
    }
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

