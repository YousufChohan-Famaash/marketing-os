import type { Message } from '../types/domain';
import type {
  ClientEvent,
  ConversationSocket,
  ServerEvent,
  ServerEventHandler,
} from '../types/protocol';
import { createFlow, type Flow, type FlowInput, type FlowMessage, type FlowOutput } from './mockFlow';
import type { WidgetBootConfig } from '../types/domain';

/**
 * Simulated WebSocket. Bridges client events to the scripted `mockFlow`
 * and emits server events back to the store.
 *
 * Real backend swap-point: replace this class with a real WebSocket client
 * that implements `ConversationSocket`. Conversation logic moves server-side.
 */

const NETWORK_DELAY_MIN_MS = 150;
const NETWORK_DELAY_MAX_MS = 400;
const TOKEN_BASE_MS = 70;
const TOKEN_JITTER_MS = 60;

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const randomNetworkDelay = () =>
  delay(
    NETWORK_DELAY_MIN_MS + Math.random() * (NETWORK_DELAY_MAX_MS - NETWORK_DELAY_MIN_MS),
  );

type AnyHandler = (event: ServerEvent) => void;

export class MockSocket implements ConversationSocket {
  private handlers = new Map<ServerEvent['type'], Set<AnyHandler>>();
  private flow: Flow | null = null;
  private connected = false;
  private msgCounter = 0;

  constructor(private readonly config: WidgetBootConfig) {}

  async connect(_firmId: string, _conversationId: string): Promise<void> {
    await delay(NETWORK_DELAY_MIN_MS);
    this.flow = createFlow(this.config);
    this.connected = true;

    const result = this.flow.start();
    void this.processOutputs(result.outputs);
  }

  send(event: ClientEvent): void {
    if (!this.connected || !this.flow) return;
    void this.handleClientEvent(event);
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
    this.flow = null;
    this.handlers.clear();
  }

  // ─────────────────────────────────────────────────────────────────

  private async handleClientEvent(event: ClientEvent): Promise<void> {
    if (event.type === 'field_edit') {
      // Field edits ack quickly without going through the flow.
      await delay(180);
      this.emit({
        type: 'field_edited',
        fieldId: event.fieldId,
        value: event.value,
      });
      return;
    }

    await randomNetworkDelay();

    const flowInput = this.translateClientEvent(event);
    if (!flowInput || !this.flow) return;

    const result = this.flow.advance(flowInput);
    await this.processOutputs(result.outputs);

    if (result.isTerminal) {
      this.emit({ type: 'conversation_ended', reason: 'completed' });
    }
  }

  private translateClientEvent(event: ClientEvent): FlowInput | null {
    switch (event.type) {
      case 'lead_message':
        return { kind: 'text', content: event.content };
      case 'quick_reply_selected':
        return { kind: 'quick_reply', value: event.selectedOption };
      case 'practice_area_selected':
        return { kind: 'practice_area_selected', value: event.value };
      case 'file_uploaded':
        return { kind: 'files_uploaded', files: event.files };
      case 'retainer_signed':
        return { kind: 'retainer_signed', envelopeId: event.envelopeId };
      case 'field_edit':
        return null;
    }
  }

  private async processOutputs(outputs: FlowOutput[]): Promise<void> {
    for (const output of outputs) {
      if (output.kind === 'field_captured') {
        this.emit({ type: 'field_captured', field: output.field });
        await delay(40);
      } else if (output.kind === 'scope_chip') {
        this.emit({ type: 'scope_chip_added', chip: output.chip });
        await delay(120);
      } else if (output.kind === 'ai_message') {
        await this.emitMessage(output.message);
      }
    }
  }

  private async emitMessage(msg: FlowMessage): Promise<void> {
    const id = `msg_ai_${++this.msgCounter}_${Date.now()}`;
    const baseMessage: Message = {
      id,
      timestamp: Date.now(),
      status: 'delivered',
      ...msg,
    };

    const isStreamable =
      msg.type === 'text' ||
      msg.type === 'quick_reply' ||
      msg.type === 'file_upload' ||
      msg.type === 'rich_text';

    if (!isStreamable) {
      this.emit({ type: 'message_complete', messageId: id, message: baseMessage });
      await delay(300);
      return;
    }

    // Streaming path: scaffold (empty content, isStreaming=true) → chunks → finalize
    const scaffold: Message = {
      ...baseMessage,
      content: '',
      isStreaming: true,
    };
    this.emit({ type: 'message_complete', messageId: id, message: scaffold });

    const tokens = msg.content.match(/\S+\s*/g) ?? [];
    for (const token of tokens) {
      await delay(TOKEN_BASE_MS + Math.random() * TOKEN_JITTER_MS);
      this.emit({ type: 'message_chunk', messageId: id, chunk: token });
    }

    const finalMessage: Message = {
      ...baseMessage,
      content: msg.content,
      isStreaming: false,
    };
    this.emit({ type: 'message_complete', messageId: id, message: finalMessage });
    await delay(150);
  }

  private emit<E extends ServerEvent>(event: E): void {
    const set = this.handlers.get(event.type);
    if (!set) return;
    for (const handler of set) {
      handler(event);
    }
  }
}
