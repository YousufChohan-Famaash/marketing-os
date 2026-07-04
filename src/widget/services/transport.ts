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
import { getConsultationContext, isPersistenceEnabled } from '../config/env';
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

/** Conversation socket over the LiveKit room data channel. Config is optional
 *  so this can be created in parallel with GET /config (the LiveKit URL comes
 *  from POST /token). */
export async function createSocket(
  config?: WidgetBootConfig,
): Promise<ConversationSocket> {
  const { RealSocket } = await import('./realSocket');
  return new RealSocket(config);
}

/**
 * Conversation id. When persistence is ON, it's stored per-firm in
 * sessionStorage so a refresh resumes the same conversation (`/token` is
 * idempotent). When OFF (the default), every load is a fresh conversation —
 * handy for repeated end-to-end testing. `returning` drives history rehydrate.
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
      sessionStorage.removeItem(key);
    } catch {
      /* ignore */
    }
    return { id: generateId('conv'), returning: false };
  }

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
    // The conversation already started → skip the opener, show the transcript.
    if ((history.messages ?? []).length > 0) store.setCaseTypePicked(true);
  } catch (err) {
    console.warn('[famaash-widget] history rehydrate skipped', err);
  }
}
