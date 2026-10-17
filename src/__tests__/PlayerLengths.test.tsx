import { act, fireEvent, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Player } from '../Player';

vi.mock('@dreamdesk/ui', () => ({
  Window: (props: { children?: ReactNode }) => <div data-testid="window">{props.children}</div>,
}));

// Lengths answered by the test, as each file's header would
const probe = vi.hoisted(() => ({ lengths: {} as Record<string, number>, asked: [] as string[] }));
vi.mock('../trackLength', () => ({
  probeLength: (src: string) => {
    probe.asked.push(src);
    return Promise.resolve(probe.lengths[src] ?? 0);
  },
}));

const TRACKS = [
  { title: 'Rival Dealer', artist: 'Burial', src: '/rival.mp3' },
  { title: 'Archangel', artist: 'Burial', src: '/archangel.mp3' },
  { title: 'Untitled', artist: '', src: '/untitled.mp3' },
];
const rows = () => [...document.querySelectorAll('.dd-player__track-items li')];
const lengthOf = (row: Element) => row.querySelector('.dd-player__track-length')?.textContent ?? null;
const total = () => document.querySelector('.dd-player__playlist-time')!.textContent;
const settle = () => act(async () => { await Promise.resolve(); });

beforeEach(() => { probe.lengths = {}; probe.asked = []; });

describe('Player — track lengths', () => {
  it("shows each track's length, and the total", async () => {
    probe.lengths = { '/rival.mp3': 348, '/archangel.mp3': 238, '/untitled.mp3': 3100 };
    render(<Player initialTracks={TRACKS} defaultFullscreen />);
    await settle();
    expect(rows().map(lengthOf)).toEqual(['5:48', '3:58', '51:40']);
    // An hour or more: h:mm:ss
    expect(total()).toBe('0:00/1:01:26');
  });

  it("adds a + while some lengths aren't known", async () => {
    probe.lengths = { '/rival.mp3': 348 };
    render(<Player initialTracks={TRACKS} defaultFullscreen />);
    await settle();
    expect(rows().map(lengthOf)).toEqual(['5:48', null, null]);
    expect(total()).toBe('0:00/5:48+');
  });

  it('counts what is selected, Winamp style', async () => {
    probe.lengths = { '/rival.mp3': 348, '/archangel.mp3': 238, '/untitled.mp3': 60 };
    render(<Player initialTracks={TRACKS} defaultFullscreen />);
    await settle();
    await act(async () => { fireEvent.click(rows()[0]!); });
    await act(async () => { fireEvent.click(rows()[1]!, { ctrlKey: true }); });
    expect(total()).toBe('9:46/10:46');
  });

  it('asks once per file, even for a track listed twice', async () => {
    render(<Player initialTracks={[...TRACKS, TRACKS[0]!]} defaultFullscreen />);
    await settle();
    expect(probe.asked.sort()).toEqual(['/archangel.mp3', '/rival.mp3', '/untitled.mp3']);
  });
});
