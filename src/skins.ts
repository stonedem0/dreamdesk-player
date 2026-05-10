import tokyoSunsetBg from '../public/img/image-asset.jpeg';
import tokyoSunsetPlaylist from '../public/img/playlist-bg.png';
import tokyoSunsetEq from '../public/img/eq-bg.webp';

export interface Skin {
  id: string;
  label: string;
  vars: Record<string, string>;
  histogramGradient: [number, string][];
  accentColor: string;
}

export const SKINS: Record<string, Skin> = {
  'tokyo-3-sunset': {
    id: 'tokyo-3-sunset',
    label: 'Tokyo Sunset',
    vars: {
      '--player-bg':           '#000b19',
      '--player-bg-soft':      'rgba(0,11,25,0.73)',
      '--player-bg-strong':    'rgba(0,11,25,0.86)',
      '--border-color':        '#d0774a',
      '--color-text-primary':  '#fff6a9',
      '--color-display-bg':    '#001127c9',
      '--color-slider-bg':     '#0d1624',
      '--color-slider-thumb':  '#080808',
      '--color-button-bg':     '#000000b9',
      '--color-button-press-bg': '#1b1b1b',
      '--color-neon-primary':  '#ffa500',
      '--color-neon-red':      '#ff0000',
      '--color-accent-primary':'#ff9e00',
      '--color-pure-black':    '#000',
      '--player-gradient':     'linear-gradient(90deg,#ff4800,#ff5400,#ff6000,#ff6d00,#ff7900,#ff8500,#ff9100,#ff9e00,#ffaa00,#ffb600)',
      '--eq-gradient':         'linear-gradient(180deg,#ff4800,#ff5400,#ff6000,#ff6d00,#ff7900,#ff8500,#ff9100,#ff9e00,#ffaa00,#ffb600)',
      '--player-body-bg':      `url(${tokyoSunsetBg})`,
      '--playlist-body-bg':    `url(${tokyoSunsetPlaylist})`,
      '--eq-body-bg':          `url(${tokyoSunsetEq})`,
      '--titlebar-bg':         'linear-gradient(90deg,#ff4800,#ff5400,#ff6000,#ff6d00,#ff7900,#ff8500,#ff9100,#ff9e00,#ffaa00,#ffb600)',
      '--titlebar-color':      '#2d1b3d',
      '--win-controls-bg':     '#1d1c1c',
      '--win-controls-border': '1px solid #ff8500',
    },
    histogramGradient: [
      [0.0, '#ff4800'], [0.1, '#ff5400'], [0.2, '#ff6000'], [0.3, '#ff6d00'],
      [0.4, '#ff7900'], [0.5, '#ff8500'], [0.6, '#ff9100'], [0.7, '#ff9e00'],
      [0.8, '#ffaa00'], [1.0, '#ffb600'],
    ],
    accentColor: '#ff8500',
  },
};

export const DEFAULT_SKIN = 'tokyo-3-sunset';
