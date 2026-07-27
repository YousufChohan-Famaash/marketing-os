/**
 * Ephemeral, page-session playback positions keyed by clip URL. Lets a video
 * resume where a sibling element of the SAME clip left off — e.g. the contact
 * screen's full-width stage collapsing into the header avatar: they are two
 * separate <video> elements, so without this the avatar would restart from 0.
 *
 * Plain module state (not the store) since it is throwaway UI timing that needs
 * no reactivity — writing on every `timeupdate` must never trigger re-renders.
 */
const positions = new Map<string, number>();

export function saveVideoPosition(key: string, seconds: number): void {
  if (Number.isFinite(seconds) && seconds >= 0) positions.set(key, seconds);
}

export function loadVideoPosition(key: string): number {
  return positions.get(key) ?? 0;
}
