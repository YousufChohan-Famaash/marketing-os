/**
 * Multi-tab-safe conversation transport.
 *
 * Without coordination, every open tab of the same (persisted) conversation
 * opens its OWN LiveKit connection. LiveKit evicts the duplicate identity and,
 * worse, each live session re-persists inbound messages — so reloading a tab
 * shows the same message two or three times (the multi-tab duplication bug).
 *
 * Here a single tab wins a Web Lock and becomes the LEADER: it holds the one
 * LiveKit connection (a real `RealSocket`) and relays every server event to the
 * other tabs over a per-conversation BroadcastChannel. FOLLOWERS never touch
 * LiveKit; they render the relayed events through the same store wiring and
 * relay their own outgoing events back to the leader to publish. When the leader
 * tab closes, its lock frees and a follower is promoted (failover), reconnecting
 * the single LiveKit session.
 *
 * When multi-tab support is unavailable, this collapses to the old behavior: the
 * tab is its own leader with its own connection (see `SessionSocket` `multiTab`
 * flag, driven by `isMultiTabSyncEnabled()`).
 */

import type { Message } from '../types/domain';
import type {
  ClientEvent,
  ConversationSocket,
  ServerEvent,
  ServerEventHandler,
} from '../types/protocol';
import { useWidgetStore } from '../store/widgetStore';
import type { RealSocket } from './realSocket';

const DEV = import.meta.env.DEV;

type AnyHandler = (event: ServerEvent) => void;

/** Messages relayed between tabs on a conversation's BroadcastChannel. */
type RelayMsg =
  // leader → followers: a server event to render (upsert-by-id dedupes it)
  | { kind: 'server'; event: ServerEvent }
  // follower → leader: an outgoing event for the leader to publish over LiveKit
  | { kind: 'client'; event: ClientEvent }
  // any tab → peers: a user message THIS tab rendered optimistically, so peers
  // render it too (the leader's server-event relay only carries AI messages)
  | { kind: 'local'; message: Message }
  // a tab announcing / confirming it is the current leader
  | { kind: 'leader' }
  // a late-joining tab asking who the current leader is
  | { kind: 'ping' }
  // a tab started a fresh chat → peers should follow to this new conversation id
  | { kind: 'newchat'; conversationId: string };

/**
 * Reconstruct the user's own message from the outgoing event, so peer tabs can
 * render it. The composer adds the lead's message to the LOCAL store and sends
 * the event separately — that local add never reaches peers, so mirror it here
 * from the same data the backend receives. Returns null for events that aren't a
 * visible user message. Uses `clientMessageId` as the id so it dedupes (upsert
 * by id) against the sender's optimistic copy and any same-id server echo.
 */
function userMessageFromEvent(event: ClientEvent): Message | null {
  if (event.type === 'lead_message') {
    return {
      id: event.clientMessageId,
      role: 'lead',
      type: 'text',
      content: event.content,
      timestamp: Date.now(),
      status: 'sent',
    };
  }
  if (event.type === 'lead_media_message') {
    return {
      id: event.clientMessageId,
      role: 'lead',
      type: 'media',
      content: '',
      mediaKind: event.kind,
      mediaUrl: event.url ?? undefined,
      mediaDurationMs: event.durationMs,
      timestamp: Date.now(),
      status: 'sent',
    };
  }
  return null;
}

export interface SessionSocketOptions {
  /** Another tab started a new chat; adopt this fresh conversation id. */
  onRemoteNewChat?: (conversationId: string) => void;
  /** This tab settled into (or changed to) a leader/follower role. */
  onRoleChange?: (isLeader: boolean) => void;
  /** The leader's underlying LiveKit connection failed. */
  onError?: (message: string) => void;
}

export class SessionSocket implements ConversationSocket {
  private readonly handlers = new Map<ServerEvent['type'], Set<AnyHandler>>();
  private channel: BroadcastChannel | null = null;
  private leaderSocket: RealSocket | null = null;
  private offAny: (() => void) | null = null;
  private isLeader = false;
  /** True until this tab settles into a role (becomes leader or a follower). */
  private awaitingRole = true;
  private releaseLock: (() => void) | null = null;
  private firmId = '';
  private conversationId = '';
  private disposed = false;
  /** Outgoing events sent before the role settled — flushed once it does. */
  private preRolePending: ClientEvent[] = [];

  constructor(
    private readonly opts: SessionSocketOptions,
    private readonly multiTab: boolean,
  ) {}

  async connect(firmId: string, conversationId: string): Promise<void> {
    this.firmId = firmId;
    this.conversationId = conversationId;

    if (!this.multiTab) {
      // Single-tab mode: own the connection directly (the old behavior).
      await this.becomeLeader();
      return;
    }

    this.channel = new BroadcastChannel(`famaash_chat:${conversationId}`);
    this.channel.onmessage = (e) => this.onRelay(e.data as RelayMsg);
    // Ask whoever currently holds the conversation to identify itself, so a tab
    // that joins AFTER the leader was elected still learns to relay to it (a
    // one-shot `leader` announcement isn't replayed to late joiners).
    this.post({ kind: 'ping' });

    // Elect a leader. The winner's callback runs and holds the lock (and the one
    // LiveKit connection) until this tab disposes or its context is destroyed;
    // then the lock frees and a follower wins it (failover). We deliberately do
    // NOT await — a follower must return from connect() immediately to stay
    // interactive; the winner connects LiveKit inside becomeLeader().
    void navigator.locks
      .request(
        `famaash_chat_leader:${conversationId}`,
        { mode: 'exclusive' },
        () =>
          new Promise<void>((release) => {
            if (this.disposed) {
              release();
              return;
            }
            this.releaseLock = release;
            void this.becomeLeader();
          }),
      )
      .catch((err) => {
        if (DEV) console.warn('[famaash-widget] leader lock request failed', err);
      });
  }

  send(event: ClientEvent): void {
    // Mirror the user's own message to peer tabs (the composer rendered it only
    // in this tab; the leader's relay only carries AI/server events). Peers
    // upsert it by id, so it dedupes against their own copy or a server echo.
    if (this.multiTab) {
      const mine = userMessageFromEvent(event);
      if (mine) this.post({ kind: 'local', message: mine });
    }

    if (this.isLeader && this.leaderSocket) {
      this.leaderSocket.send(event);
      return;
    }
    if (!this.multiTab || this.awaitingRole) {
      // Either becomeLeader() is still in flight (single-tab), or we don't yet
      // know whether we'll lead (publish over LiveKit) or follow (relay over the
      // channel). Hold until the role settles, then flush to the right place.
      this.preRolePending.push(event);
      return;
    }
    // Settled follower: relay to the leader to publish.
    this.post({ kind: 'client', event });
  }

  on<T extends ServerEvent['type']>(
    eventType: T,
    handler: ServerEventHandler<T>,
  ): () => void {
    let set = this.handlers.get(eventType);
    if (!set) {
      set = new Set();
      this.handlers.set(eventType, set);
    }
    set.add(handler as AnyHandler);
    return () => {
      set!.delete(handler as AnyHandler);
    };
  }

  notifyNewChat(conversationId: string): void {
    // Posted on the OLD conversation's channel (still open at this point) so peer
    // tabs still on it follow to the fresh id.
    this.post({ kind: 'newchat', conversationId });
  }

  disconnect(): void {
    this.disposed = true;
    this.awaitingRole = false;
    this.preRolePending = [];
    this.offAny?.();
    this.offAny = null;
    this.leaderSocket?.disconnect();
    this.leaderSocket = null;
    // Release the leader lock so another tab can take over immediately.
    this.releaseLock?.();
    this.releaseLock = null;
    if (this.channel) {
      this.channel.onmessage = null;
      this.channel.close();
      this.channel = null;
    }
    this.handlers.clear();
    this.isLeader = false;
  }

  // ─────────────────────────────────────────────────────────────────

  private async becomeLeader(): Promise<void> {
    if (this.disposed || this.isLeader) return;
    this.isLeader = true;
    this.awaitingRole = false;
    if (DEV) console.log('[famaash-widget] became leader for', this.conversationId);
    this.opts.onRoleChange?.(true);
    // Announce leadership so followers (and future ping replies) relay to us.
    this.post({ kind: 'leader' });

    // Lazy-load LiveKit only in the tab that actually connects — follower tabs
    // never download it.
    const { RealSocket } = await import('./realSocket');
    if (this.disposed) return;
    const real = new RealSocket();
    this.leaderSocket = real;
    // Tap EVERY server event: render it locally AND relay it to follower tabs.
    this.offAny = real.onAny((event) => {
      this.dispatchLocal(event);
      this.post({ kind: 'server', event });
    });

    const queued = this.preRolePending;
    this.preRolePending = [];
    try {
      await real.connect(this.firmId, this.conversationId);
    } catch (err) {
      if (DEV) console.warn('[famaash-widget] leader connect failed', err);
      this.opts.onError?.(err instanceof Error ? err.message : 'Connection failed');
      return;
    }
    if (this.disposed) return;
    for (const ev of queued) real.send(ev);
  }

  private settleAsFollower(): void {
    if (this.isLeader || !this.awaitingRole || this.disposed) return;
    this.awaitingRole = false;
    if (DEV) console.log('[famaash-widget] settled as follower for', this.conversationId);
    this.opts.onRoleChange?.(false);
    // Flush anything sent before we settled, now that we know to relay it.
    const queued = this.preRolePending;
    this.preRolePending = [];
    for (const ev of queued) this.post({ kind: 'client', event: ev });
  }

  private onRelay(msg: RelayMsg): void {
    if (!msg || typeof msg.kind !== 'string' || this.disposed) return;
    switch (msg.kind) {
      case 'ping':
        // A joining tab asks who leads; if that's us, reassure it.
        if (this.isLeader) this.post({ kind: 'leader' });
        break;
      case 'leader':
        // Someone else leads → we're a follower.
        if (!this.isLeader) this.settleAsFollower();
        break;
      case 'server':
        // Followers apply the relay; the leader already dispatched it via its tap.
        if (!this.isLeader && msg.event) this.dispatchLocal(msg.event);
        break;
      case 'local':
        // A user message another tab sent — render it here too (upsert by id).
        if (msg.message) useWidgetStore.getState().upsertMessage(msg.message);
        break;
      case 'client':
        // Only the leader publishes a follower's outgoing event.
        if (this.isLeader && this.leaderSocket && msg.event) {
          this.leaderSocket.send(msg.event);
        }
        break;
      case 'newchat':
        if (msg.conversationId && msg.conversationId !== this.conversationId) {
          this.opts.onRemoteNewChat?.(msg.conversationId);
        }
        break;
    }
  }

  private post(msg: RelayMsg): void {
    try {
      this.channel?.postMessage(msg);
    } catch (err) {
      if (DEV) console.warn('[famaash-widget] relay post failed', err);
    }
  }

  private dispatchLocal(event: ServerEvent): void {
    const set = this.handlers.get(event.type);
    if (!set) return;
    for (const handler of set) handler(event);
  }
}
