import { Room, RoomEvent } from 'livekit-client';
import type { WidgetBootConfig } from '../types/domain';
import type {
  ClientEvent,
  ConversationSocket,
  ServerEvent,
  ServerEventHandler,
} from '../types/protocol';
import { createConversationToken, type ConversationTokenResponse } from './api';
import { useWidgetStore } from '../store/widgetStore';
import { getConsultationContext, getAttribution } from '../config/env';

/**
 * Real backend transport over a LiveKit room data channel.
 *
 *   connect()  → POST /token → join the LiveKit room
 *   send()     → publishData(JSON) on topic `widget.client`
 *   on()       → dispatch JSON received on topic `widget`
 *   disconnect → leave the room
 *
 * Per the backend contract, the agent publishes ServerEvents as JSON **data
 * packets** on the `widget` topic (streaming a turn as: scaffold message_complete
 * → message_chunk… → final message_complete). We don't hard-filter inbound by
 * topic — we log it and process any app packet — so a topic mismatch can't
 * silently swallow messages.
 */

const DEFAULT_CLIENT_TOPIC = 'widget.client';
const DEV = import.meta.env.DEV;
/** Belt-and-suspenders: assume the agent is listening if `ready` never arrives. */
const READY_FALLBACK_MS = 9000;

type AnyHandler = (event: ServerEvent) => void;

export class RealSocket implements ConversationSocket {
  private readonly handlers = new Map<ServerEvent['type'], Set<AnyHandler>>();
  // Fires for EVERY inbound server event, regardless of type. The multi-tab
  // SessionSocket leader taps this to relay events to follower tabs.
  private readonly anyHandlers = new Set<AnyHandler>();
  private room: Room | null = null;
  private clientTopic = DEFAULT_CLIENT_TOPIC;
  private readonly encoder = new TextEncoder();
  private readonly decoder = new TextDecoder();
  // The agent joins a beat after room.connect() resolves and only then attaches
  // its data handler; LiveKit doesn't buffer for absent subscribers, so we hold
  // outbound events until the `ready` event (or a fallback timer) and flush then.
  private agentReady = false;
  private pending: ClientEvent[] = [];
  private readyTimer: ReturnType<typeof setTimeout> | null = null;

  // Config is optional so the socket can be created/connected in parallel with
  // GET /config — the LiveKit URL comes from /token; config is only a fallback.
  constructor(private readonly config?: WidgetBootConfig) {}

  async connect(
    firmId: string,
    conversationId: string,
    presetSession?: ConversationTokenResponse,
  ): Promise<void> {
    // A "start new chat" already POSTed /token {new_chat:true} and holds the
    // minted session — reuse it so we join THAT room (no second /token, and no
    // risk of the agent's opener landing in an empty room before we join).
    const session =
      presetSession ??
      (await createConversationToken({
        firm_id: firmId,
        conversation_id: conversationId,
        language: useWidgetStore.getState().language,
        // Seed with the Free Consultation answers when the chat was opened from
        // that wizard (null → nothing added, normal cold chat).
        ...(getConsultationContext() ?? {}),
        // Marketing attribution the loader forwarded from the host page → lets the
        // backend attribute this chat lead to its source/campaign.
        ...(getAttribution() ?? {}),
      }));
    if (DEV) console.log('[famaash-widget] /token', session);

    this.clientTopic = session.client_topic || DEFAULT_CLIENT_TOPIC;

    const room = new Room();
    this.room = room;

    room.on(RoomEvent.DataReceived, (payload, participant, _kind, topic) => {
      if (DEV) {
        console.log('[famaash-widget] ◀ data', {
          topic,
          from: participant?.identity,
          bytes: payload.byteLength,
        });
      }
      this.dispatch(payload);
    });

    if (DEV) {
      room.on(RoomEvent.ParticipantConnected, (p) =>
        console.log('[famaash-widget] participant joined', p.identity),
      );
      room.on(RoomEvent.ConnectionStateChanged, (s) =>
        console.log('[famaash-widget] connection state', s),
      );
      room.on(RoomEvent.Disconnected, (r) =>
        console.log('[famaash-widget] disconnected', r),
      );
    }

    const url = session.livekit_url || this.config?.livekitUrl;
    if (!url) throw new Error('[famaash-widget] no LiveKit URL from /token or boot config');

    await room.connect(url, session.token);
    if (DEV) {
      console.log('[famaash-widget] connected to room', session.room_name);
      console.log(
        '[famaash-widget] participants already in room',
        [...room.remoteParticipants.values()].map((p) => p.identity),
      );
    }

    // Fallback in case the agent never emits `ready`.
    this.readyTimer = setTimeout(() => {
      if (DEV) console.log('[famaash-widget] ready fallback fired');
      this.markReady();
    }, READY_FALLBACK_MS);
  }

  send(event: ClientEvent): void {
    // Queue until the agent is listening. This also covers the window before
    // room.connect() resolves (the opener can be picked before we're connected).
    if (!this.agentReady) {
      if (DEV) console.log('[famaash-widget] ⏸ queued (waiting for ready)', event.type);
      this.pending.push(event);
      return;
    }
    this.publish(event);
  }

  private publish(event: ClientEvent): void {
    const room = this.room;
    if (!room) return;
    if (DEV) console.log('[famaash-widget] ▶ send', event.type, event);
    const json = JSON.stringify(event);
    // Fresh ArrayBuffer-backed view so the bytes satisfy publishData's typing.
    const encoded = this.encoder.encode(json);
    const bytes = new Uint8Array(encoded.length);
    bytes.set(encoded);
    void room.localParticipant
      .publishData(bytes, { reliable: true, topic: this.clientTopic })
      .catch((err: unknown) => {
        console.warn('[famaash-widget] publishData failed', err);
      });
  }

  private markReady(): void {
    if (this.agentReady) return;
    this.agentReady = true;
    if (this.readyTimer) {
      clearTimeout(this.readyTimer);
      this.readyTimer = null;
    }
    if (DEV && this.pending.length) {
      console.log('[famaash-widget] flushing', this.pending.length, 'queued event(s)');
    }
    const queued = this.pending;
    this.pending = [];
    for (const event of queued) this.publish(event);
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

  /** Subscribe to every inbound server event (used to relay to follower tabs). */
  onAny(handler: (event: ServerEvent) => void): () => void {
    this.anyHandlers.add(handler);
    return () => {
      this.anyHandlers.delete(handler);
    };
  }

  /** No-op: a single LiveKit socket has no peer tabs to notify. */
  notifyNewChat(): void {}

  disconnect(): void {
    this.agentReady = false;
    this.pending = [];
    if (this.readyTimer) {
      clearTimeout(this.readyTimer);
      this.readyTimer = null;
    }
    this.handlers.clear();
    this.anyHandlers.clear();
    void this.room?.disconnect();
    this.room = null;
  }

  // ─────────────────────────────────────────────────────────────────

  /** Parse a raw data packet (JSON) and route it to handlers. */
  private dispatch(payload: Uint8Array): void {
    let event: unknown;
    try {
      event = JSON.parse(this.decoder.decode(payload));
    } catch (err) {
      if (DEV) console.warn('[famaash-widget] non-JSON data packet', err);
      return;
    }
    const ev = event as ServerEvent;
    if (!ev || typeof ev.type !== 'string') return;
    if (DEV) console.log('[famaash-widget] ◀ recv', ev.type, ev);
    // The agent is now listening — release any queued client events.
    if (ev.type === 'ready') this.markReady();
    // The wildcard tap fires for every event (even ones with no typed handler),
    // so the multi-tab leader can relay the full stream to follower tabs.
    for (const handler of this.anyHandlers) handler(ev);
    const set = this.handlers.get(ev.type);
    if (!set) return;
    for (const handler of set) handler(ev);
  }
}
