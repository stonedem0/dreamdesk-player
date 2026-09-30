import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Player } from './Player';
import { SKINS } from './skins';

// The Player keeps the chosen skin in state and reports changes through
// onSkinChange; remembering it is the host's job, which is this file. Same
// split the vanilla page uses, where skin-switcher.js owns the storage.
const SKIN_KEY = 'winamp-demo-skin';

// Not DEFAULT_SKIN: the demo has always opened on pastelcore, and a first
// visit should still look the way it did.
const FALLBACK_SKIN = 'pastelcore';

function storedSkin(): string {
  try {
    const id = localStorage.getItem(SKIN_KEY);
    // A key left over from a renamed or removed skin would otherwise render
    // the player with no theme at all.
    if (id && SKINS[id]) return id;
  } catch {
    /* private mode - fall back to the shipped skin */
  }
  return FALLBACK_SKIN;
}

function rememberSkin(id: string) {
  try {
    localStorage.setItem(SKIN_KEY, id);
  } catch {
    /* private mode - the choice just won't persist */
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Player skin={storedSkin()} onSkinChange={rememberSkin} />
  </StrictMode>
);
