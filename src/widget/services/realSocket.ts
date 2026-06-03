import { Room, RoomEvent } from 'livekit-client';
import type { WidgetBootConfig } from '../types/domain';
import type {
  ClientEvent,
  ConversationSocket,
  ServerEvent,
  ServerEventHandler,
} from '../types/protocol';
import { createConversationToken } from './api';

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

type AnyHandler = (event: ServerEvent) => void;

export class RealSocket implements ConversationSocket {
  private readonly handlers = new Map<ServerEvent['type'], Set<AnyHandler>>();
  private room: Room | null = null;
  private connected = false;
  private clientTopic = DEFAULT_CLIENT_TOPIC;
  private readonly encoder = new TextEncoder();
  private readonly decoder = new TextDecoder();

  constructor(private readonly config: WidgetBootConfig) {}

  async connect(firmId: string, conversationId: string): Promise<void> {
    const session = await createConversationToken({
      firm_id: firmId,
      conversation_id: conversationId,
      language: 'en',
    });
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

    const url = session.livekit_url || this.config.livekitUrl;
    if (!url) throw new Error('[famaash-widget] no LiveKit URL from /token or boot config');

    await room.connect(url, session.token);
    this.connected = true;
    if (DEV) {
      console.log('[famaash-widget] connected to room', session.room_name);
      console.log(
        '[famaash-widget] participants already in room',
        [...room.remoteParticipants.values()].map((p) => p.identity),
      );
    }
  }

  send(event: ClientEvent): void {
    const room = this.room;
    if (!this.connected || !room) return;
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

  disconnect(): void {
    this.connected = false;
    this.handlers.clear();
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
    const set = this.handlers.get(ev.type);
    if (!set) return;
    for (const handler of set) handler(ev);
  }
}
