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
- [ ] compliance: render AI-disclosure + TCPA copy in `uiLocale`

## Components to translate
- [x] ScheduleCallback (day/time picker, summary, booked screen)
- [x] CallbackForm (name/phone/email, consent, CTAs, errors)
- [ ] ConnectHome (the connect menu: Call / Schedule / Chat / Send details)
- [ ] SendDetails (the leave-your-details form)
- [ ] Composer (input placeholder, send, mic states)
- [ ] ChatHeader ("Book a call" etc., controls)
- [ ] ConnectingState / ConnectHome states
- [ ] ConversationIntro / ChatOpenerChips / QuickReplyChips (hardcoded labels only)
- [ ] PracticeOptions, SafetyButtons, ConsentModal, TextHandoffModal, SendDetails, CaptureDrawer
- [ ] PoweredByFooter / misc chrome

## Out of scope (later backend run)
- The agent's chat messages (English until `es` is added to `CONVERSATION_LANGS`)
- Any opener / quick-reply text the backend supplies (backend-owned)
