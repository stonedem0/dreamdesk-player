// Feature flags. A plain classic script rather than a module, because player.js
// is a classic script and cannot import - this has to be readable from both it
// and visualizer-boot.js.
//
// Resolution order: URL query wins, then a previous choice in localStorage,
// then the default. Defaults are on for local development and off everywhere
// else, so master stays publishable to GitHub Pages with work-in-progress
// merged but not exposed. Override live with ?visualizer=1 (and =0 to clear).
(function () {
  const isLocal =
    location.protocol === 'file:' ||
    ['localhost', '127.0.0.1', '[::1]'].indexOf(location.hostname) !== -1;

  const DEFAULTS = {
    visualizer: isLocal,
  };

  let stored = {};
  try {
    stored = JSON.parse(localStorage.getItem('features') || '{}') || {};
  } catch (_) {
    stored = {};
  }

  const params = new URLSearchParams(location.search);
  const flags = Object.assign({}, DEFAULTS, stored);
  let dirty = false;

  Object.keys(DEFAULTS).forEach((key) => {
    const q = params.get(key);
    if (q === null) return;
    flags[key] = q !== '0' && q !== 'false' && q !== '';
    stored[key] = flags[key];
    dirty = true;
  });

  if (dirty) {
    try {
      localStorage.setItem('features', JSON.stringify(stored));
    } catch (_) { /* private mode - the flag just won't persist */ }
  }

  // Say so when a flag is not at its default. Without this an enabled flag is
  // invisible - the VIZ button simply appears - and it is easy to forget you
  // are not seeing what everyone else sees on the published site.
  const overridden = Object.keys(DEFAULTS).filter((k) => flags[k] !== DEFAULTS[k]);
  if (overridden.length) {
    console.info(
      '[features] non-default: ' +
        overridden.map((k) => k + '=' + flags[k]).join(', ') +
        ' (reset with ?' + overridden[0] + '=' + (DEFAULTS[overridden[0]] ? 1 : 0) + ')'
    );
  }

  window.FEATURES = flags;
})();
