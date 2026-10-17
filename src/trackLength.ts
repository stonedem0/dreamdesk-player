/**
 * A track's length in seconds, read without playing it: the browser fetches
 * only enough of the file for its header. 0 when it can't tell (a broken file,
 * a stream) or when `signal` aborts first.
 */
export function probeLength(src: string, signal?: AbortSignal): Promise<number> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve(0);
    const audio = new Audio();
    audio.preload = 'metadata';
    let settled = false;
    const done = (seconds: number) => {
      if (settled) return;
      settled = true;
      // Let go of the file
      audio.removeAttribute('src');
      audio.load();
      resolve(seconds);
    };
    audio.addEventListener('loadedmetadata', () => done(isFinite(audio.duration) ? Math.round(audio.duration) : 0));
    audio.addEventListener('error', () => done(0));
    signal?.addEventListener('abort', () => done(0), { once: true });
    audio.src = src;
  });
}
