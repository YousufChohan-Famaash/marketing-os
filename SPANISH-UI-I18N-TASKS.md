# Chat widget — Spanish UI (chrome) i18n

Translate everything the widget itself renders into Spanish for Spanish visitors.
The agent conversation stays English (backend-clamped, `CONVERSATION_LANGS={"en"}`)
and becomes Spanish in a later backend run — the "continue in English" notice
already covers that gap.

**Trigger (same signal as the Free Consultation wizard):** the visitor's language,
detected as `data-lang` on the embed → the host page's `<html lang>` → English.
The widget runs in an iframe, so the loader (on the host page) reads that and
forwards it in; a Free-Consultation hand-off already carries it in `ctx.language`.

This is a UI locale, kept SEPARATE from the agent's language gate: Spanish chrome,
English agent.

## Infrastructure
- [x] loader: read `data-lang` / host `<html lang>`, forward as `&ui_lang=` into the iframe
- [x] env: `resolveUiLocale()` = hand-off language → `ui_lang` → `en`
- [x] store: `uiLocale` + `setUiLocale`
- [x] i18n: `strings.ts` (en/es tables) + `useT()` hook
- [x] App boot: set `uiLocale`; fetch boot config in it so the backend's ES
      compliance/consent variants (already saved in /chat/compliance) load
- [x] compliance: AI-disclosure + TCPA rendered in `uiLocale`; boot config fetched in it so the backend's ES variants load

## Components to translate
- [x] ScheduleCallback (day/time picker, summary, booked screen)
- [x] CallbackForm (name/phone/email, consent, CTAs, errors)
- [x] ConnectHome (the connect menu: Call / Schedule / Chat / Send details) + CHANNEL_META labels
- [x] Composer (input placeholder, call banners, recording/listening, attachment menu)
- [x] SendDetails (the leave-your-details form)
- [x] ChannelView (title, "we kept your…" banner, call/text flows, call lifecycle screens)
- [x] ChatHeader (Live chat / specialist identity, controls)
- [x] ConnectingState
- [x] PoweredByFooter (Privacy / Terms)
- [x] ConversationIntro / ChatOpenerChips / QuickReplyChips (hardcoded labels; backend chips pass through)
- [x] PracticeOptions, SafetyButtons, ConsentModal, TextHandoffModal, CallMeModal, EmergencyModal, HumanTakeoverModal
- [~] CaptureDrawer — only aria-labels (screen-reader), content is backend field names; left English for now
- [~] a few remaining aria-labels elsewhere (screen-reader only)

All visible visitor-facing chrome is translated. Anything still in English is
either backend-owned (agent messages, quick replies), a screen-reader aria-label,
or falls back to English by design via the source-keyed table.

## Out of scope (later backend run)
- The agent's chat messages (English until `es` is added to `CONVERSATION_LANGS`)
- Any opener / quick-reply text the backend supplies (backend-owned)
