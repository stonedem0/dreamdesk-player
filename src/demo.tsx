import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Player } from './Player';
import { VisualizerWindow, type AudioSource } from './Visualizer';
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

// Visualization (right-click the Player) opens the WebGL visualizer in a window of its own, as a host would:
// against the Player's right edge (its default place and width), in its skin
function Demo() {
  const [skin, setSkin] = useState(storedSkin);
  const [source, setSource] = useState<AudioSource | null>(null);
  const [vizOpen, setVizOpen] = useState(false);
  return (
    <>
      <Player skin={skin} onSkinChange={(id) => { setSkin(id); rememberSkin(id); }} onAudioSource={setSource}
        onVisualizerToggle={() => setVizOpen((v) => !v)} visualizerOpen={vizOpen} />
      {vizOpen && (
        <VisualizerWindow source={source} skin={skin} initialX={200 + 297} initialY={100}
          dockTo={() => document.querySelector<HTMLElement>('.dd-player:not(.dd-player--viz)')}
          onClose={() => setVizOpen(false)} />
      )}
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Demo />
  </StrictMode>
);
