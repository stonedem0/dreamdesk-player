/**
 * Skin Switcher - Handles switching between default and Tokyo-3 Sunset skins
 */

const SKINS = {
  default: {
    name: 'Default',
    path: ''
  },
  sunset: {
    name: 'Sunset',
    path: 'tokyo-3-sunset-skin.css'
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

function getCurrentSkin() {
  const stored = localStorage.getItem(SKIN_STORAGE_KEY);
  return stored || 'default';
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

