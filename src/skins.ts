
export interface Skin {
  id: string;
  label: string;
  vars: Record<string, string>;
  histogramGradient: [number, string][];
  accentColor: string;
  /** The WebGL visualizer: the three colours its rings cycle through, on this background. */
  visualizer: { colors: [string, string, string]; background: string };
}

export const SKINS: Record<string, Skin> = {
  'tokyo-3-sunset': {
    id: 'tokyo-3-sunset',
    label: 'Tokyo Sunset',
    vars: {
      // One warm near-black for every dark (panels, displays, headers, menus,
      // the visualizer)
      '--player-bg':           '#120906',
      '--panel-header-bg':     '#1c0f0a',
      '--dropdown-menu-bg':    'rgba(18,9,6,0.96)',
      '--dropdown-menu-hover': 'rgba(255,133,0,0.15)',
      '--player-bg-soft':      'rgba(18,9,6,0.73)',
      '--player-bg-strong':    'rgba(18,9,6,0.86)',
      // Edges: a warm amber, thin, so buttons, displays and headers show on the dark
      '--border-color':        'rgba(184,96,30,0.55)',
      '--panel-line-width':    '0.5px',
      // ...every edge drawn in the window frame's red-orange to gold, dimmed so
      // the edges sit back
      '--edge-image':          'linear-gradient(135deg,rgba(255,72,0,0.4),rgba(255,145,0,0.4),rgba(255,182,0,0.4)) 1',
      '--color-text-primary':  '#fff6a9',
      '--color-text-secondary':'#ffb600',
      '--color-display-bg':    '#0a0503',
      '--color-slider-bg':     '#2a1610',
      '--color-slider-thumb':  '#080808',
      '--color-button-bg':     '#000000b9',
      '--color-button-press-bg': '#1b1b1b',
      '--color-neon-primary':  '#ffa500',
      '--color-neon-red':      '#ff0000',
      '--color-accent-primary':'#ff9e00',
      '--color-pure-black':    '#000',
      '--player-gradient':     'linear-gradient(90deg,#ff4800,#ff5400,#ff6000,#ff6d00,#ff7900,#ff8500,#ff9100,#ff9e00,#ffaa00,#ffb600)',
      '--eq-gradient':         'linear-gradient(180deg,#ff4800,#ff5400,#ff6000,#ff6d00,#ff7900,#ff8500,#ff9100,#ff9e00,#ffaa00,#ffb600)',
      // Plain dark for now: the pictures this skin had weren't ours to ship
      '--player-body-bg':      'none',
      '--eq-body-bg':          'none',
      '--playlist-body-bg':    'none',
      // On the plain dark, the EQ's band numbers in amber like the rest
      '--eq-label-color':      '#ffb600',
      '--titlebar-bg':         'linear-gradient(90deg,#ff4800,#ff5400,#ff6000,#ff6d00,#ff7900,#ff8500,#ff9100,#ff9e00,#ffaa00,#ffb600)',
      '--titlebar-color':      '#2d1b3d',
      '--win-controls-bg':     '#1d1c1c',
      '--win-controls-border': '1px solid #ff8500',
      // dreamdesk Window vars — match vanilla tokyo-3-sunset-skin.css
      '--dd-window-body':      '#120906',
      '--dd-border':           '2px solid transparent',
      '--dd-header-bg':        'linear-gradient(90deg,#ff4800,#ff5400,#ff6000,#ff6d00,#ff7900,#ff8500,#ff9100,#ff9e00,#ffaa00,#ffb600)',
      '--dd-header-color':     '#2d1b3d',
      '--dd-header-shadow':    'none',
      '--dd-header-height':    '1.4rem',
      '--dd-header-font-size': '0.75rem',
      '--dd-header-padding':   '0 4px 0 6px',
      '--dd-body-padding':     '0',
      '--btn-minimize-icon':                    'none',
      '--btn-fullscreen-icon':                 'none',
      '--btn-close-icon':                      'none',
      '--dd-controls-bg':                      '#1d1c1c',
      '--color-window-control-bg':             '#1d1c1c',
      '--color-window-control-fullscreen-bg':  '#1d1c1c',
      '--dd-controls-border':                  '1px solid #ff8500',
      '--dd-controls-fg':                      '#ff8500',
      '--dd-controls-shadow':                  '0 0 6px rgba(255,133,0,0.35)',
      '--dd-controls-button-w':                '16px',
      '--dd-controls-button-h':                '16px',
      '--dd-controls-icon-size':               '12px',
      '--dd-header-border-bottom': '1px solid #d0774a',
    },
    histogramGradient: [
      [0.0, '#ff4800'], [0.1, '#ff5400'], [0.2, '#ff6000'], [0.3, '#ff6d00'],
      [0.4, '#ff7900'], [0.5, '#ff8500'], [0.6, '#ff9100'], [0.7, '#ff9e00'],
      [0.8, '#ffaa00'], [1.0, '#ffb600'],
    ],
    accentColor: '#ff8500',
    visualizer: { colors: ['#ff4800', '#fb5607', '#ff9900'], background: '#120906' },
  },
  'pastelcore': {
    id: 'pastelcore',
    label: 'Pastelcore',
    vars: {
      '--player-bg':           '#fff5fa',
      '--player-bg-soft':      'rgba(255,245,250,0.75)',
      '--player-bg-strong':    '#000000',
      '--border-color':        '#3d2d33',
      '--color-text-primary':  '#5b3a4b',
      '--color-text-secondary':'#1c1c1c',
      '--playlist-text-shadow':'none',
      '--color-display-bg':    '#000000',
      '--color-screen-text':   '#ffb6c8',
      '--screen-text-shadow':  'none',
      // '--screen-text-shadow':  '0 0 2px rgba(247,94,189,.95), 0 0 5px rgba(247,94,189,.85), 0 0 9px rgba(247,94,189,.7)',
      '--color-slider-bg':     '#dbd7e4',
      '--color-slider-thumb':  '#ffb6c8',
      '--color-button-bg':     '#fde2e4',
      '--dropdown-menu-bg':    '#fde2e4',
      '--dropdown-menu-text':  '#1c1c1c',
      '--dropdown-menu-hover': 'rgba(28,28,28,0.1)',
      '--panel-header-bg':     'rgba(253,226,228,0.85)',
      '--color-button-press-bg': '#a1e4ff',
      '--color-neon-primary':  '#a7fcfb',
      '--color-neon-red':      '#ff9ea6',
      '--color-accent-primary':'#fb6f92',
      '--color-pure-black':    '#3d2d33',
      '--player-gradient':     'linear-gradient(90deg,#fde2e4,#fec5bb,#fff1e6,#bee1e6,#a7fcfb,#c8b6ff)',
      '--eq-gradient':         'linear-gradient(180deg,#fde2e4,#fec5bb,#fff1e6,#bee1e6,#a7fcfb,#c8b6ff)',
      '--player-body-bg':      'linear-gradient(160deg,#fff5fa,#fde2e4 45%,#bee1e6 100%)',
      '--playlist-body-bg':    'linear-gradient(160deg,#fff1e6,#dbd7e4)',
      '--eq-body-bg':          'linear-gradient(160deg,#fde2e4,#a7fcfb)',
      '--titlebar-bg':         'linear-gradient(90deg,#fde2e4,#fec5bb,#fff1e6,#bee1e6,#a7fcfb,#c8b6ff)',
      '--titlebar-color':      '#3d2d33',
      '--win-controls-bg':     '#ffffff',
      '--win-controls-border': '1px solid #c8b6ff',
      // dreamdesk Window vars — pastelcore palette, matches dreamdesk-ui pastelcore.css tones
      '--dd-window-body':      '#fff5fa',
      '--dd-border':           '2px solid #3d2d33',
      '--dd-header-bg':        'linear-gradient(90deg,#fde2e4,#fec5bb,#fff1e6,#bee1e6,#a7fcfb,#c8b6ff)',
      '--dd-header-color':     '#3d2d33',
      '--dd-header-shadow':    'none',
      '--dd-header-height':    '1.4rem',
      '--dd-header-font-size': '0.75rem',
      '--dd-header-padding':   '0 4px 0 6px',
      '--dd-body-padding':     '0',
      '--btn-minimize-icon':                    'none',
      '--btn-fullscreen-icon':                 'none',
      '--btn-close-icon':                      'none',
      '--dd-controls-bg':                      '#ffffff',
      '--color-window-control-bg':             '#ffffff',
      '--color-window-control-fullscreen-bg':  '#ffffff',
      '--dd-controls-border':                  '1px solid #190201',
      // Black icons, like the title text
      '--dd-controls-fg':                      '#3d2d33',
      '--dd-controls-shadow':                  'none',
      '--dd-controls-button-w':                '16px',
      '--dd-controls-button-h':                '16px',
      '--dd-controls-icon-size':               '12px',
      '--dd-header-border-bottom': '1px solid #c8b6ff',
    },
    histogramGradient: [
      [0.0, '#fde2e4'], [0.1, '#fec5bb'], [0.2, '#fff1e6'], [0.3, '#f7f0c0'],
      [0.4, '#bee1e6'], [0.5, '#a7fcfb'], [0.6, '#a1e4ff'], [0.7, '#c0b6fa'],
      [0.8, '#c8b6ff'], [1.0, '#fb6f92'],
    ],
    accentColor: '#fb6f92',
    // Pastel neon on the black of the player's displays
    visualizer: { colors: ['#fb6f92', '#a1e4ff', '#c8b6ff'], background: '#0e0a14' },
  },
};

export const DEFAULT_SKIN = 'tokyo-3-sunset';
