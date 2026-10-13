/** The title bar's minimize, fullscreen and close icons, drawn in the skin's accent colour. */
export function windowIcons(c: string) {
  return {
    minimizeIcon:   `<svg viewBox="0 0 24 24" width="14" height="14"><line x1="3" y1="17" x2="21" y2="17" stroke="${c}" stroke-width="3.5" stroke-linecap="butt"/></svg>`,
    fullscreenIcon: `<svg viewBox="0 0 24 24" width="10" height="10"><rect x="3" y="3" width="18" height="18" fill="none" stroke="${c}" stroke-width="2.5"/><line x1="3" y1="8" x2="21" y2="8" stroke="${c}" stroke-width="3.5"/></svg>`,
    closeIcon:      `<svg viewBox="0 0 24 24" width="14" height="14"><path d="M5 5l14 14M19 5L5 19" stroke="${c}" stroke-width="3.5" stroke-linecap="butt"/></svg>`,
  };
}
