// A minimal stand-in for the Web Audio API, which happy-dom doesn't have.
// Nodes remember their connections and params, so tests can check the graph.
import { vi } from 'vitest';

class Param { value = 0; }

export class FakeNode {
  connected: FakeNode[] = [];
  connect = vi.fn((to: FakeNode) => { this.connected.push(to); return to; });
  disconnect = vi.fn(() => { this.connected = []; });
}

export class FakeBiquad extends FakeNode {
  type = '';
  Q = new Param();
  frequency = new Param();
  gain = new Param();
}

export class FakeAnalyser extends FakeNode {
  fftSize = 2048;
  get frequencyBinCount() { return this.fftSize / 2; }
  getFloatFrequencyData = vi.fn((a: Float32Array) => a.fill(-120));
}

export class FakeGain extends FakeNode { gain = new Param(); }
export class FakePanner extends FakeNode { pan = new Param(); }

export class FakeAudioContext {
  state = 'running';
  sampleRate = 44100;
  currentTime = 0;
  destination = new FakeNode();
  createAnalyser() { return new FakeAnalyser(); }
  createBiquadFilter() { return new FakeBiquad(); }
  createGain() { return new FakeGain(); }
  createStereoPanner() { return new FakePanner(); }
  createChannelSplitter() { return new FakeNode(); }
  createChannelMerger() { return new FakeNode(); }
  createMediaElementSource() { return new FakeNode(); }
  resume = vi.fn(() => Promise.resolve());
  suspend = vi.fn(() => Promise.resolve());
  close = vi.fn(() => Promise.resolve());
}

/** Like old Safari: no StereoPannerNode, so the engine uses its gain-pair fallback. */
export class FakeAudioContextNoPanner extends FakeAudioContext {}
Object.defineProperty(FakeAudioContextNoPanner.prototype, 'createStereoPanner', { value: undefined });
