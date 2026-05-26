# Famaash Chat Widget

Embeddable AI intake chat widget for personal injury (PI) law firms.

The widget lives on client law-firm websites and conducts intake conversations with potential leads — qualifying them through structured flows, capturing evidence, and presenting retainers. Production target: `widget.famaash.com`.

This is the **frontend-only** build. All data, events, and conversation logic are mocked client-side. See [Mock data](#mock-data) for how to extend the scripted flow.

> The architectural source of truth is `../claude-code-prompt-chat-widget.md`. When something moves from "deferred" to "done", mark it in that doc rather than deleting it.

## Setup

```bash
npm install
npm run dev
```

Open <http://localhost:5173/demo-host.html> — that's a fake PI-firm landing page that embeds the widget the same way a real client site would.

### Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server at :5173 |
| `npm run build` | Type-check (`tsc --noEmit`) then produce `dist/loader.js` + `dist/assets/*` |
| `npm run preview` | Serve the production build |
| `npm run lint` | ESLint over `src` (includes `jsx-a11y/recommended`) |
| `npm run typecheck` | `tsc --noEmit` only |

> Testing (unit / e2e / a11y) is owned by the dedicated Famaash QA engineer — see the spec doc's "Engineering practices" section. Feature engineers ship testable code; QA owns the suite.

## How embedding works

A client site adds **one line** to its HTML:

```html
<script async src="https://widget.famaash.com/loader.js" data-firm-id="firm_famaash_demo"></script>
```

The loader (`src/loader/loader.ts`):

1. Injects a launcher button (bottom-right, z-index `2147483647`).
2. On first click, lazily creates the widget iframe with `sandbox="allow-scripts allow-forms allow-popups allow-same-origin"`.
3. Establishes a Penpal RPC channel with the iframe (origin-pinned to the widget's origin).
4. Exposes `window.Famaash` with `open()`, `close()`, `identify(user)`, `setContext(data)` for programmatic control.

During dev, the demo-host page references the loader's TypeScript source directly (`/src/loader/loader.ts`) so Vite can serve it as a module. In production it's the built `loader.js`.

## Project structure

```
src/
├── loader/
│   └── loader.ts                # ~250-line plain TS host script
├── widget/
│   ├── App.tsx                  # Boots config → socket → store → bridge
│   ├── main.tsx                 # React entry mounted inside the iframe
│   ├── components/
│   │   ├── lazy/                # Code-split chunks: VoiceCall, ESign, VideoRecorder
│   │   ├── ChatHeader.tsx       # Firm name + minimize/close (swap to agent on takeover)
│   │   ├── Composer.tsx         # Auto-resize textarea, send + attach + mic
│   │   ├── MessageList.tsx      # Timeline of messages + scope chips (role="log", aria-live)
│   │   ├── MessageBubble.tsx    # Memoized; RichText applied when hasMarkdown
│   │   ├── RichText.tsx         # Renders sanitized markdown nodes
│   │   ├── QuickReplyChips.tsx  # Keyboard-navigable chip row
│   │   ├── FileUploadZone.tsx   # react-dropzone + mock progress
│   │   ├── VideoMessage.tsx     # Inline <video> with custom play overlay
│   │   ├── LinkCard.tsx         # Rich-preview card; URL sanitized
│   │   ├── ScopeChip.tsx        # Inline soft pill
│   │   ├── RetainerCard.tsx     # Inline retainer affordance
│   │   ├── CaptureProgress.tsx  # "X of Y details captured" pill
│   │   ├── CaptureDrawer.tsx    # Edit affordance with optimistic state
│   │   ├── SafetyButtons.tsx    # Call me / Talk to a human / I need help now
│   │   ├── PoweredByFooter.tsx  # Famaash F-mark + privacy/terms
│   │   ├── Modal.tsx            # Focus-trapped dialog shell
│   │   ├── EmergencyModal.tsx   # Calm de-escalation copy (never mentions 911)
│   │   ├── HumanTakeoverModal.tsx
│   │   ├── ModalHost.tsx        # Suspense dispatcher
│   │   ├── TypingIndicator.tsx
│   │   ├── WidgetShell.tsx      # Layout: header → progress → drawer → list → safety → composer → footer
│   │   └── WidgetErrorFallback.tsx
│   ├── services/
│   │   ├── mockBootConfig.ts    # GET /api/widget/config → swap point
│   │   ├── mockFlow.ts          # Scripted 9-stage intake flow
│   │   ├── mockSocket.ts        # WebSocket simulation (token-by-token streaming)
│   │   ├── hostBridge.ts        # Iframe-side Penpal w/ origin allow-list
│   │   └── socketContext.ts     # React context for ConversationSocket
│   ├── store/
│   │   ├── widgetStore.ts       # Composes 6 slices via zustand create()
│   │   ├── wireSocket.ts        # Subscribe socket → store mutations
│   │   └── slices/              # conversation, capture, scope, streaming, featureFlags, ui
│   ├── styles/
│   │   ├── tokens.css           # CSS variables — design tokens
│   │   └── widget.css           # Tailwind + base resets + Inter font
│   ├── types/
│   │   ├── domain.ts            # Message, ScopeChip, CapturedField, WidgetBootConfig, ...
│   │   └── protocol.ts          # ServerEvent / ClientEvent discriminated unions
│   └── utils/
│       ├── richText.ts          # Markdown-light parser + sanitizeUrl (XSS-hardened)
│       ├── icons.tsx            # 22 inline SVGs (Lucide-style)
│       ├── cn.ts                # Class-name joiner
│       └── id.ts                # crypto.randomUUID with fallback
├── embed.html                   # Iframe HTML entry
├── index.html                   # Dev index — points at demo-host
public/
└── demo-host.html               # Fake PI-firm landing page embedding the widget
```

## Mock data

All conversation state is scripted client-side. The three swap points:

### 1. Boot config — `src/widget/services/mockBootConfig.ts`

Returns a `WidgetBootConfig` after a 200 ms simulated delay. To change firm branding, flow id, allowed origins, feature flags — edit `MENDELSON_DEMO` in that file.

Real backend swap: replace `fetchBootConfig` with a `fetch(...)` call; the returned shape must continue to satisfy `WidgetBootConfig`.

### 2. Scripted conversation — `src/widget/services/mockFlow.ts`

`createFlow(config)` returns `{ start, advance }`. The flow is a finite-state machine through nine stages:

```
intro → awaiting_tcpa → awaiting_name → awaiting_dob
      → awaiting_state → awaiting_incident_date → awaiting_role
      → awaiting_files → awaiting_retainer_sign → done
```

Each `advance(input)` returns an array of `FlowOutput` events — AI messages, captured fields, and scope chips — which the mock socket then translates to wire events.

To add a new stage:

1. Add the stage name to the `Stage` union.
2. Add a `handleX(input)` function that produces `FlowOutput`s and sets the next stage.
3. Wire it into the `advance()` switch.

> Deferred (tracked in the spec doc): replace this with **XState** before branches multiply. Linear `switch` is fine for the MVP; it won't scale to branching on "commercial vehicle detected → specialist routing" cleanly.

### 3. Socket — `src/widget/services/mockSocket.ts`

`MockSocket` implements `ConversationSocket` (`src/widget/types/protocol.ts`). It:

- Adds 150–400 ms of "network" latency per send.
- Streams text messages token-by-token (~70–130 ms per token) via `message_complete` (scaffold with empty content + `isStreaming: true`) → `message_chunk` events → `message_complete` (final with `isStreaming: false`).
- Emits non-text messages (video, link cards, retainer) in one shot.

Real backend swap: write a `WebSocket`-backed implementation of `ConversationSocket` and substitute it in `App.tsx`.

## Critical engineering practices (this run)

These are baked in from the start — see the spec doc's "Engineering practices — review additions" section for context.

- **Testing.** Owned by the Famaash QA engineer (see spec doc) — not scaffolded in this run. Feature engineers keep code testable (pure functions, clean seams).
- **Accessibility.** `eslint-plugin-jsx-a11y` in the lint config; `focus-trap-react` wraps every modal; streaming messages render inside `aria-live="polite"` + `role="log"`; focus moves to the composer on widget open; QuickReplyChips are arrow-key navigable; the emergency modal uses calm copy that does not name a specific service number directly in the button label.
- **Iframe security.** Loader sets `sandbox="allow-scripts allow-forms allow-popups allow-same-origin"`; Penpal handshakes validate parent origin against an allow-list.
- **Markdown sanitization.** `sanitizeUrl` in `utils/richText.ts` rejects `javascript:`, `data:`, `vbscript:` (including whitespace/case/HTML-entity variants). Unit tested with a battery of XSS payloads.
- **Error boundary.** Top-level `react-error-boundary` in `App.tsx` renders a calm fallback ("Chat is temporarily unavailable") and fires `notifyEvent({type:'widget_error', ...})` through the host bridge.

## Deferred work

See the "Deferred — track here, fold in next pass" section of the spec doc. Highlights to fold in next:

- Framer Motion for drawer/launcher animations.
- date-fns standardization.
- `@fontsource/inter` self-hosting.
- `visualViewport` API for mobile keyboard.
- `rollup-plugin-visualizer` for bundle budget enforcement.
- Husky + lint-staged.
- XState for the conversation flow.
- Stop-generation button.
- i18n shim.
- `localStorage` persistence with TTL.

## Public widget API

```html
<script async src="https://widget.famaash.com/loader.js" data-firm-id="firm_famaash_demo"></script>
<script>
  // Available after the loader runs.
  Famaash.open();
  Famaash.close();
  Famaash.identify({ id: '...', email: '...', name: '...' });
  Famaash.setContext({ pageType: 'pricing', referredBy: 'instagram' });
</script>
```
