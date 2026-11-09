/**
 * A track's title and artist, read from the tags inside the file: ID3v2 at the
 * start (v2.2, v2.3, v2.4), or ID3v1 in the last 128 bytes. Empty when the file
 * has none (WAV, or a format with other tags), so the caller can fall back to
 * the file name.
 */
export interface TrackTags {
  title?: string;
  artist?: string;
}

const MAX_TAG = 1024 * 1024; // a tag with big cover art can be megabytes; we only need the text frames

const ascii = (b: Uint8Array, from: number, to: number) => String.fromCharCode(...b.subarray(from, to));
const synchsafe = (b: Uint8Array, o: number) => ((b[o] & 0x7f) << 21) | ((b[o + 1] & 0x7f) << 14) | ((b[o + 2] & 0x7f) << 7) | (b[o + 3] & 0x7f);
const clean = (s: string) => s.replace(/\0+$/g, '').replace(/\0/g, ' / ').trim() || undefined;

function decode(bytes: Uint8Array): string | undefined {
  const [encoding, ...rest] = bytes;
  const data = Uint8Array.from(rest);
  try {
    if (encoding === 1) return clean(new TextDecoder(data[0] === 0xfe && data[1] === 0xff ? 'utf-16be' : 'utf-16le').decode(data.subarray(data[0] === 0xff || data[0] === 0xfe ? 2 : 0)));
    if (encoding === 2) return clean(new TextDecoder('utf-16be').decode(data));
    if (encoding === 3) return clean(new TextDecoder('utf-8').decode(data));
  } catch { /* fall through to Latin-1 */ }
  return clean(new TextDecoder('latin1').decode(data));
}

function readV2(b: Uint8Array): TrackTags {
  if (b.length < 10 || ascii(b, 0, 3) !== 'ID3') return {};
  const major = b[3];
  const end = Math.min(b.length, 10 + synchsafe(b, 6));
  const idLen = major === 2 ? 3 : 4;
  const headLen = major === 2 ? 6 : 10;
  const tags: TrackTags = {};
  let o = 10;
  // Skip an extended header (v2.3/2.4)
  if (b[5] & 0x40 && major >= 3) o += major === 4 ? synchsafe(b, o) : 4 + ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]);
  while (o + headLen <= end && b[o] !== 0) {
    const id = ascii(b, o, o + idLen);
    const size = major === 2
      ? (b[o + 3] << 16) | (b[o + 4] << 8) | b[o + 5]
      : major === 4 ? synchsafe(b, o + 4) : ((b[o + 4] << 24) | (b[o + 5] << 16) | (b[o + 6] << 8) | b[o + 7]) >>> 0;
    const start = o + headLen;
    if (size <= 0 || start + size > b.length) break;
    if (id === 'TIT2' || id === 'TT2') tags.title = decode(b.subarray(start, start + size));
    else if (id === 'TPE1' || id === 'TP1') tags.artist = decode(b.subarray(start, start + size));
    o = start + size;
  }
  return tags;
}

function readV1(b: Uint8Array): TrackTags {
  if (b.length < 128 || ascii(b, b.length - 128, b.length - 125) !== 'TAG') return {};
  const field = (from: number, len: number) => clean(new TextDecoder('latin1').decode(b.subarray(b.length - 128 + from, b.length - 128 + from + len)));
  return { title: field(3, 30), artist: field(33, 30) };
}

const strip = (t: TrackTags): TrackTags => Object.fromEntries(Object.entries(t).filter(([, v]) => v)) as TrackTags;

export async function readTags(file: Blob): Promise<TrackTags> {
  try {
    const head = new Uint8Array(await file.slice(0, 10).arrayBuffer());
    const v2 = head.length >= 10 && ascii(head, 0, 3) === 'ID3'
      ? strip(readV2(new Uint8Array(await file.slice(0, Math.min(10 + synchsafe(head, 6), MAX_TAG)).arrayBuffer())))
      : {};
    if (v2.title && v2.artist) return v2;
    const v1 = strip(readV1(new Uint8Array(await file.slice(Math.max(0, file.size - 128)).arrayBuffer())));
    return { ...v1, ...v2 };
  } catch {
    return {};
  }
}
