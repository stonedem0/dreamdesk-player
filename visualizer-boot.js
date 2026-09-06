// Wires the framework-agnostic visualizer to the static page.
//
// player.js owns the audio graph and publishes it as window.visualizer, so the
// getters read from there per frame rather than capturing it at load time -
// this script may well run before the graph exists.
import { createVisualizer } from './main.js';

const enabled = !!(window.FEATURES && window.FEATURES.visualizer);
const canvas = enabled ? document.getElementById('glcanvas') : null;

if (!enabled) {
  // Flag off: never touch WebGL at all, so a disabled visualizer costs nothing.
} else if (!canvas) {
  console.warn('Missing <canvas id="glcanvas"> - visualizer not started');
} else {
  const viz = createVisualizer({
    canvas,
    getAnalyser: () => window.visualizer && window.visualizer.analyser,
    getAudio: () => window.visualizer && window.visualizer.audio,
    onError: (err) => console.warn('Visualizer unavailable:', err.message),
  });

  viz.start();

  // Part of the old global surface. Nothing in the repo calls them, but they
  // cost two lines to keep working.
  window.startVisualizerAnimation = viz.start;
  window.stopVisualizerAnimation = viz.stop;
}
