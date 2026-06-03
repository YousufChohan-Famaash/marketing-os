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
import { useWidgetStore } from '../store/widgetStore';
import { generateId } from '../utils/id';
import { fetchConversationHistory, fetchWidgetConfig } from './api';

const CONV_STORAGE_PREFIX = 'famaash_conv_';

/** Boot config from the backend REST endpoint. */
export function loadBootConfig(
  firmId: string,
  signal?: AbortSignal,
): Promise<WidgetBootConfig> {
  return fetchWidgetConfig(firmId, signal);
}

/** Conversation socket over the LiveKit room data channel. */
export async function createSocket(
  config: WidgetBootConfig,
): Promise<ConversationSocket> {
  const { RealSocket } = await import('./realSocket');
  return new RealSocket(config);
}

/**
 * Conversation id, persisted per-firm in sessionStorage so a page refresh
 * resumes the same conversation (the backend treats /token as idempotent on
 * conversation_id). `returning` is true when we found a stored id.
 */
export function getOrCreateConversationId(firmId: string): {
  id: string;
  returning: boolean;
} {
  const key = `${CONV_STORAGE_PREFIX}${firmId}`;
  try {
    const existing = sessionStorage.getItem(key);
    if (existing) return { id: existing, returning: true };
    const id = generateId('conv');
    sessionStorage.setItem(key, id);
    return { id, returning: false };
  } catch {
    // sessionStorage blocked (e.g. strict iframe) — fall back to ephemeral id.
    return { id: generateId('conv'), returning: false };
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
): Promise<void> {
  try {
    const history = await fetchConversationHistory(conversationId, signal);
    const store = useWidgetStore.getState();
    for (const field of history.fields ?? []) store.captureField(field);
    for (const chip of history.chips ?? []) store.addChip(chip);
    for (const message of history.messages ?? []) store.upsertMessage(message);
    if (history.agentTakeover) store.setAgentTakeover(history.agentTakeover);
  } catch (err) {
    console.warn('[famaash-widget] history rehydrate skipped', err);
  }
}
