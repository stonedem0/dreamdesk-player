/**
 * The transport buttons' icons, drawn the way Winamp's are: an outline pushed
 * into the button, with the button's own face inside, lit from the top-left.
 * A recess is shadowed where its rim is, so edges that face up or left are
 * dark and edges that face down or right are light (the opposite of the
 * button's own raised bevel). Each icon is its closed outline in the light
 * colour with its shadowed edges drawn over it in the dark one, so the line
 * stays joined at every corner and slope. The colours are the button's bevel
 * colours, so every skin gets its own.
 *
 * Text glyphs (⏮ ▶ ⏹ ...) can't do this, and come from whichever font the
 * system finds for each, so their size and baseline differ.
 */
const Icon = ({ shape, lit }: { shape: React.ReactNode; lit: string[] /* the top and left edges: the shadowed ones */ }) => (
  <svg className="dd-player__icon" viewBox="-1 -1 12 12" width="11" height="11" aria-hidden="true" focusable="false">
    <g fill="none" strokeWidth="1" strokeLinejoin="miter" strokeLinecap="butt">
      {/* White, a little stronger than the bevel's: on a pale button the lit edge has to show to close the shape, but not so strong it clashes with the shadow */}
      <g style={{ stroke: 'var(--icon-hi, rgba(255,255,255,0.5))', fill: 'var(--skin-icon-fill, none)' }} strokeWidth="1.1">{shape}</g>
      <g style={{ stroke: 'var(--skin-icon-lo, var(--bevel-lo))' }}>{lit.map((d) => <path key={d} d={d} />)}</g>
    </g>
  </svg>
);

export const PrevIcon = () => (
  <Icon
    shape={<><rect x="1.5" y="1.5" width="2.4" height="7" /><path d="M8.5 1.5v7L5 5z" /></>}
    lit={['M1.5 8.5v-7h2.4', 'M8.5 1.5L5 5']}
  />
);
export const NextIcon = () => (
  <Icon
    shape={<><path d="M1.5 1.5v7L5 5z" /><rect x="6.1" y="1.5" width="2.4" height="7" /></>}
    lit={['M1.5 8.5v-7L5 5', 'M6.1 8.5v-7h2.4']}
  />
);
export const PlayIcon = () => <Icon shape={<path d="M2.5 1.5v7L8.5 5z" />} lit={['M2.5 8.5v-7L8.5 5']} />;
export const PauseIcon = () => (
  <Icon
    shape={<><rect x="1.8" y="1.5" width="2.8" height="7" /><rect x="5.6" y="1.5" width="2.8" height="7" /></>}
    lit={['M1.8 8.5v-7h2.8', 'M5.6 8.5v-7h2.8']}
  />
);
export const StopIcon = () => <Icon shape={<rect x="2" y="2" width="6" height="6" />} lit={['M2 8V2h6']} />;
export const EjectIcon = () => (
  <Icon
    shape={<><path d="M5 1.5L9 6H1z" /><rect x="1" y="7.5" width="8" height="2" /></>}
    lit={['M1 6L5 1.5', 'M1 9.5v-2h8']}
  />
);

/**
 * Shuffle and repeat are line drawings (arrows), not closed shapes, so they are
 * engraved another way: the drawing in the icon colour, over a copy of it one
 * step below-right in the light edge colour.
 */
const LineIcon = ({ children }: { children: React.ReactNode }) => (
  <svg className="dd-player__icon" viewBox="-1 -1 12 12" width="14" height="14" aria-hidden="true" focusable="false">
    <g style={{ color: 'var(--skin-icon-hi, rgba(255,255,255,0.5))' }} transform="translate(0.7 0.7)">{children}</g>
    <g style={{ color: 'var(--skin-icon-fill, currentColor)' }}>{children}</g>
  </svg>
);

const line = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinejoin: 'round', strokeLinecap: 'butt' } as const;

export const ShuffleIcon = () => (
  <LineIcon>
    <path {...line} d="M0.8 3H2.6C4.6 3 5 7 7.4 7" />
    <path {...line} d="M0.8 7H2.6C4.6 7 5 3 7.4 3" />
    <path fill="currentColor" d="M7.2 1.2L9.8 3 7.2 4.8z" />
    <path fill="currentColor" d="M7.2 5.2L9.8 7 7.2 8.8z" />
  </LineIcon>
);

export const RepeatIcon = () => (
  <LineIcon>
    <path {...line} d="M1.5 6V4.6Q1.5 2.6 3.5 2.6H7.2" />
    <path {...line} d="M8.5 4V5.4Q8.5 7.4 6.5 7.4H2.8" />
    <path fill="currentColor" d="M7 0.9L9.6 2.6 7 4.3z" />
    <path fill="currentColor" d="M3 5.7L0.4 7.4 3 9.1z" />
  </LineIcon>
);
