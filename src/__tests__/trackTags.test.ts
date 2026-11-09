import { describe, it, expect } from 'vitest';
import { readTags } from '../trackTags';

const enc = (s: string) => Array.from(new TextEncoder().encode(s));
const synchsafe = (n: number) => [(n >> 21) & 0x7f, (n >> 14) & 0x7f, (n >> 7) & 0x7f, n & 0x7f];
const be32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];

/** An ID3v2.3 frame with a text payload. */
const frame = (id: string, encoding: number, body: number[]) => [...enc(id), ...be32(body.length + 1), 0, 0, encoding, ...body];
const id3v2 = (frames: number[][]) => {
  const body = frames.flat();
  return new Blob([new Uint8Array([...enc('ID3'), 3, 0, 0, ...synchsafe(body.length), ...body, ...new Array(64).fill(0)])]);
};
const utf16 = (s: string) => [0xff, 0xfe, ...Array.from(s).flatMap((c) => [c.charCodeAt(0) & 255, c.charCodeAt(0) >> 8])];

describe('readTags', () => {
  it('reads title and artist from ID3v2 (Latin-1)', async () => {
    const tags = await readTags(id3v2([frame('TIT2', 0, enc('Alive')), frame('TPE1', 0, enc('Pearl Jam'))]));
    expect(tags).toEqual({ title: 'Alive', artist: 'Pearl Jam' });
  });

  it('reads UTF-8 and UTF-16 text', async () => {
    const tags = await readTags(id3v2([frame('TIT2', 3, enc('Привет')), frame('TPE1', 1, utf16('Björk'))]));
    expect(tags).toEqual({ title: 'Привет', artist: 'Björk' });
  });

  it('falls back to ID3v1 at the end of the file', async () => {
    const pad = (s: string, n: number) => [...enc(s), ...new Array(n - s.length).fill(0)];
    const v1 = [...enc('TAG'), ...pad('Black', 30), ...pad('Pearl Jam', 30), ...new Array(65).fill(0)];
    const tags = await readTags(new Blob([new Uint8Array([...new Array(500).fill(1), ...v1])]));
    expect(tags).toEqual({ title: 'Black', artist: 'Pearl Jam' });
  });

  it('returns nothing for a file without tags', async () => {
    expect(await readTags(new Blob([new Uint8Array(300)]))).toEqual({});
  });
});
