/**
 * Transport wiring for the live backend. App.tsx imports only from here and
 * stays decoupled from the LiveKit/REST details.
 *
 * RealSocket (which pulls in livekit-client) is loaded with dynamic import() so
 * the heavy LiveKit code splits into its own chunk and loads in parallel while
 * the shell renders the "Connecting…" state.
 */

import type { WidgetBootConfig } from '../types/domain';
import type { ConversationSocket } from '../types/protocol';
import type { SessionSocketOptions } from './sessionSocket';
import {
  getConsultationContext,
  isMultiTabSyncEnabled,
  isPersistenceEnabled,
} from '../config/env';
import { useWidgetStore } from '../store/widgetStore';
import { generateId } from '../utils/id';
import { fetchConversationHistory, fetchWidgetConfig } from './api';

const CONV_STORAGE_PREFIX = 'famaash_conv_';

/** Boot config from the backend REST endpoint. Pass the visitor's language to
 *  get the language-matched videos (posters/captions); omitted = firm default. */
export function loadBootConfig(
  firmId: string,
  language?: string,
  signal?: AbortSignal,
): Promise<WidgetBootConfig> {
  return fetchWidgetConfig(firmId, language, signal);
}

/**
 * Conversation socket. Returns a `SessionSocket` — a multi-tab-safe wrapper that
 * elects one leader tab to hold the single LiveKit connection and mirrors it to
 * follower tabs (so two open tabs of the same conversation can't each connect and
 * duplicate messages). When multi-tab sync is off/unsupported the wrapper is a
 * thin pass-through to a single LiveKit `RealSocket` (the old behavior). The
 * LiveKit code is loaded lazily inside the leader, so followers never fetch it.
 */
export async function createSocket(
  opts: SessionSocketOptions = {},
): Promise<ConversationSocket> {
  const { SessionSocket } = await import('./sessionSocket');
  return new SessionSocket(opts, isMultiTabSyncEnabled());
}

/**
 * Conversation id. When persistence is ON (the default), it's stored per-firm in
 * localStorage so closing the tab and reopening resumes the SAME conversation
 * (`/token` is idempotent — a returning id reuses the Call+Lead+room and the
 * agent resumes). localStorage (not sessionStorage) is what survives a tab close.
 * `?persist=0` forces a fresh conversation for testing. `returning` drives the
 * history rehydrate + live resume.
 */
export function getOrCreateConversationId(firmId: string): {
  id: string;
  returning: boolean;
} {
  const key = `${CONV_STORAGE_PREFIX}${firmId}`;

  // A Free-Consultation → Chat handoff MUST reuse its conversation_id across
  // reloads: minting a fresh id while still carrying the consultation params
  // makes the agent auto-open again (re-greet in a new room). So persist on a
  // handoff even when global persistence is off.
  const handoff = getConsultationContext() != null;

  if (!isPersistenceEnabled() && !handoff) {
    // Fresh each load; clear any stale id so turning persistence back on starts clean.
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
    return { id: generateId('conv'), returning: false };
  }

  try {
    const existing = localStorage.getItem(key);
    if (existing) return { id: existing, returning: true };
    const id = generateId('conv');
    localStorage.setItem(key, id);
    return { id, returning: false };
  } catch {
    // localStorage blocked (e.g. strict iframe) — fall back to ephemeral id.
    return { id: generateId('conv'), returning: false };
  }
}

/**
 * Mint a fresh conversation id (a "start new chat") and persist it in place of
 * the old one, so the next `/token` creates a new Call+Lead. The old
 * conversation is preserved server-side; we just stop pointing at it.
 */
export function resetConversationId(firmId: string): string {
  const key = `${CONV_STORAGE_PREFIX}${firmId}`;
  const id = generateId('conv');
  try {
    localStorage.setItem(key, id);
  } catch {
    /* storage blocked — the ephemeral id still works for this load */
  }
  return id;
}

/**
 * Persist a SPECIFIC conversation id for the firm (unlike `resetConversationId`,
 * which mints a new one). Used when another tab starts a new chat and this tab
 * follows to the same fresh id, so a later reload resumes that new chat.
 */
export function persistConversationId(firmId: string, id: string): void {
  try {
    localStorage.setItem(`${CONV_STORAGE_PREFIX}${firmId}`, id);
  } catch {
    /* storage blocked — the id still works for this load */
  }
}

/**
 * Cold-load rehydration. Pulls the transcript, captured fields, and scope chips
 * for a returning conversation and replays them into the store. Reconnecting to
 * the live room resumes streaming on top of this.
 *
 * Best-effort: a failure (e.g. unknown conversation) is swallowed so boot can
 * still proceed to a fresh connection.
 */
export async function rehydrateFromHistory(
  conversationId: string,
  signal?: AbortSignal,
): Promise<{ messageCount: number; status: 'active' | 'ended' | null }> {
  try {
    const history = await fetchConversationHistory(conversationId, signal);
    const store = useWidgetStore.getState();
    for (const field of history.fields ?? []) store.captureField(field);
    for (const chip of history.chips ?? []) store.addChip(chip);
    for (const message of history.messages ?? []) store.upsertMessage(message);
    if (history.agentTakeover) store.setAgentTakeover(history.agentTakeover);
    const messageCount = (history.messages ?? []).length;
    // The conversation already started → skip the opener, show the transcript.
    if (messageCount > 0) store.setCaseTypePicked(true);
    return { messageCount, status: history.status ?? null };
  } catch (err) {
    console.warn('[famaash-widget] history rehydrate skipped', err);
    return { messageCount: 0, status: null };
  }
}
