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
  getAttribution,
  getConsultationContext,
  isMultiTabSyncEnabled,
  isPersistenceEnabled,
} from '../config/env';
import { useWidgetStore } from '../store/widgetStore';
import {
  ApiError,
  createConversationToken,
  fetchConversationHistory,
  fetchWidgetConfig,
  type ConversationTokenResponse,
} from './api';

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
 * Read the stored conversation id (READ-ONLY — never mint one here). A client
 * id doesn't exist server-side until POST /token creates the Call, so minting
 * one only produces a phantom id whose /messages 404s. The id is now always the
 * one the SERVER returned from /token and we persisted (see createFreshChatSession
 * + connect). Guide §1. `returning` (a stored id exists) drives resume.
 *
 * `?persist=0` clears any stored id and forces a cold first-visit. A Free-
 * Consultation handoff still resumes across reloads even with persistence off.
 */
export function readStoredConversationId(firmId: string): {
  id: string | null;
  returning: boolean;
} {
  const handoff = getConsultationContext() != null;
  if (!isPersistenceEnabled() && !handoff) {
    clearConversationId(firmId);
    return { id: null, returning: false };
  }
  try {
    const id = localStorage.getItem(`${CONV_STORAGE_PREFIX}${firmId}`);
    return { id: id || null, returning: !!id };
  } catch {
    // localStorage blocked (e.g. strict iframe) — no resume, always cold.
    return { id: null, returning: false };
  }
}

/**
 * Mint a conversation SERVER-SIDE via POST /token and return the full session
 * (conversation_id + LiveKit token) so we join the minted room directly (no
 * second round-trip that would drop the agent's opener into an empty room).
 *
 *   cold first visit → send NO conversation_id (and no new_chat): the server
 *                      mints a fresh conv + Call+Lead. Guide §1-§2.
 *   "start new chat" → new_chat:true: the server mints a fresh one while the OLD
 *                      conversation/lead is preserved. Guide §4.
 *
 * The caller persists the returned id (that stored id is what makes the next
 * load resume).
 */
export function createFreshChatSession(
  firmId: string,
  opts?: { newChat?: boolean },
  signal?: AbortSignal,
): Promise<ConversationTokenResponse> {
  const newChat = opts?.newChat ?? false;
  return createConversationToken(
    {
      firm_id: firmId,
      language: useWidgetStore.getState().language,
      ...(getAttribution() ?? {}),
      // New chat is a fresh intake; a cold visit may be seeded by a consultation
      // hand-off (its answers go on the FIRST token so the agent acknowledges them).
      ...(newChat ? { new_chat: true } : (getConsultationContext() ?? {})),
    },
    signal,
  );
}

/**
 * Persist a SPECIFIC conversation id for the firm (the server-minted id from the
 * first /token, a "start new chat", or a peer tab's new chat). Used so a later
 * reload resumes that conversation.
 */
export function persistConversationId(firmId: string, id: string): void {
  try {
    localStorage.setItem(`${CONV_STORAGE_PREFIX}${firmId}`, id);
  } catch {
    /* storage blocked — the id still works for this load */
  }
}

/** Drop the stored id (a stale/unknown id, or ?persist=0). Next load is cold. */
export function clearConversationId(firmId: string): void {
  try {
    localStorage.removeItem(`${CONV_STORAGE_PREFIX}${firmId}`);
  } catch {
    /* ignore */
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
): Promise<{ messageCount: number; status: 'active' | 'ended' | null; notFound: boolean }> {
  try {
    const history = await fetchConversationHistory(conversationId, signal);
    const store = useWidgetStore.getState();
    for (const field of history.fields ?? []) store.captureField(field);
    for (const chip of history.chips ?? []) store.addChip(chip);
    // Key each replayed message on its ARRAY INDEX (hist#0, hist#1, …), NOT its
    // message_id: the agent restarts numbering every session, so a transcript
    // resumed N times contains msg_ai_1 N+1 times. Keying on message_id collapsed
    // duplicates into one bubble (16 AI messages → 5) and let a live msg_ai_1
    // overwrite a replayed one in place. Index-keying gives every history row its
    // own bubble and keeps live ids (msg_ai_N) in a separate space. Guide §5.
    (history.messages ?? []).forEach((message, i) =>
      store.upsertMessage({ ...message, id: `hist#${i}` }),
    );
    if (history.agentTakeover) store.setAgentTakeover(history.agentTakeover);
    const messageCount = (history.messages ?? []).length;
    // The conversation already started → skip the opener, show the transcript.
    if (messageCount > 0) store.setCaseTypePicked(true);
    return { messageCount, status: history.status ?? null, notFound: false };
  } catch (err) {
    // 404 = the stored id has no server conversation (a stale client-minted id
    // from before the read-only change) → nothing to replay; the caller clears
    // the key and carries on cold. Any other error → carry on with a blank thread.
    const notFound = err instanceof ApiError && err.status === 404;
    if (!notFound) console.warn('[famaash-widget] history rehydrate skipped', err);
    return { messageCount: 0, status: null, notFound };
  }
}
