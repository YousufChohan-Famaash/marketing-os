import { useWidgetStore } from './store/widgetStore';

// UI (chrome) localization for the widget. Separate from the AGENT's language:
// the agent is backend-clamped to English for now, so this only translates what
// the widget itself renders. Keyed by the English source string, so any string
// that hasn't been translated yet falls back to English rather than breaking.
// Trigger: the visitor's UI locale (Free Consultation hand-off, or the host
// page's <html lang> forwarded by the loader). See resolveUiLocale in config/env.

export type UiLocale = 'en' | 'es';

const ES: Record<string, string> = {
  // ── Schedule a callback ──
  'Checking available times…': 'Buscando horarios disponibles…',
  'No times to show right now': 'No hay horarios disponibles ahora',
  "Online scheduling isn't available at the moment. Leave your number and we'll call you instead.":
    'La programación en línea no está disponible en este momento. Déjenos su número y le llamaremos.',
  'Request a call instead': 'Solicitar una llamada',
  'Pick a day': 'Elija un día',
  'Pick a time': 'Elija una hora',
  'Confirm your callback': 'Confirme su llamada',
  "All times in Eastern Time (ET). We'll send a confirmation and a reminder.":
    'Todos los horarios en hora del Este (ET). Le enviaremos confirmación y recordatorio.',
  'That time is no longer available. Please pick another.': 'Ese horario ya no está disponible. Elija otro.',
  "We'll call you then, Eastern time": 'Le llamaremos entonces, hora del Este',
  'Choose a time below': 'Elija una hora abajo',
  'Change': 'Cambiar',
  'Change day': 'Cambiar día',
  'Next available': 'Próximo disponible',
  'Or choose a day': 'O elija un día',
  'Morning': 'Mañana',
  'Afternoon': 'Tarde',
  'Evening': 'Noche',
  'Today': 'Hoy',
  'Tomorrow': 'Mañana',
  // ── Booked confirmation ──
  "You're booked": 'Su llamada está agendada',
  "We'll call you at": 'Le llamaremos al',
  'The call comes from': 'La llamada vendrá del número',
  "save this number so you know it's us": 'guarde este número para saber que somos nosotros',
  'A confirmation and reminder are on their way to your phone and email.':
    'Le enviaremos confirmación y recordatorio por mensaje de texto y correo.',
  'Add to calendar': 'Agregar al calendario',
  'Need a different time?': '¿Necesita otra hora?',
  // ── Callback form ──
  'Where should we call you?': '¿A qué número le llamamos?',
  "Add your details and we'll call at the time above.": 'Agregue sus datos y le llamaremos a la hora indicada.',
  'Confirm booking': 'Confirmar reserva',
  'Booking your callback…': 'Agendando su llamada…',
  'Pick a time above first.': 'Primero elija una hora arriba.',
  'Your session expired. Please restart the chat.': 'Su sesión expiró. Reinicie el chat.',
  'Your session expired. Please reopen the chat and try again.': 'Su sesión expiró. Reabra el chat e inténtelo de nuevo.',
  "We couldn't book that time. Please try again.": 'No pudimos reservar ese horario. Inténtelo de nuevo.',
  // ── Contact fields (CallbackForm / SendDetails) ──
  'Your name': 'Su nombre',
  'First and last name': 'Nombre y apellido',
  'Phone Number': 'Número de teléfono',
  'Email': 'Correo electrónico',
  '(for your confirmation)': '(para su confirmación)',
  'Please agree before we continue.': 'Por favor acepte para continuar.',
  'Is this the best number to reach you?': '¿Es este el mejor número para contactarle?',
  // Field validation (utils/validation)
  'Please enter your name.': 'Por favor escriba su nombre.',
  'Please enter your full name.': 'Por favor escriba su nombre completo.',
  'Please enter your phone number.': 'Por favor escriba su número de teléfono.',
  'Phone numbers can only contain digits.': 'El número de teléfono solo puede contener dígitos.',
  'Enter a valid phone number.': 'Escriba un número de teléfono válido.',
  'Enter a complete phone number.': 'Escriba un número de teléfono completo.',
  'That number has too many digits.': 'Ese número tiene demasiados dígitos.',
  'Please enter your email.': 'Por favor escriba su correo electrónico.',
  'Enter a valid email address.': 'Escriba una dirección de correo válida.',
};

export function translate(loc: UiLocale, en: string): string {
  return loc === 'es' ? ES[en] ?? en : en;
}

/** t('English source') → the visitor's UI-locale string (English fallback). */
export function useT(): (en: string) => string {
  const loc = useWidgetStore((s) => s.uiLocale);
  return (en: string) => translate(loc, en);
}
