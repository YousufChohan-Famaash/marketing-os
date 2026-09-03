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
  // ── Connect home menu ──
  'Hurt? Talk to us': '¿Lesionado? Hable con nosotros',
  'your way.': 'como prefiera.',
  'We answer. Day or night. 24/7': 'Respondemos. De día o de noche. 24/7',
  'Call me now': 'Llámenme ahora',
  "We'll ring you in under 60 seconds": 'Le llamamos en menos de 60 segundos',
  'Chat with us': 'Chatee con nosotros',
  'Message us now, we reply in seconds': 'Escríbanos ahora, respondemos en segundos',
  'Text me': 'Envíenme un mensaje',
  'SMS or WhatsApp, on your phone': 'SMS o WhatsApp, en su teléfono',
  'Book a call': 'Agende una llamada',
  'Pick a time that works for you': 'Elija la hora que le convenga',
  'Send your details': 'Envíe sus datos',
  "Fill out a quick form and we'll reach back within the hour.":
    'Complete un formulario rápido y le contactaremos en menos de una hora.',
  // ── Composer ──
  'Type a message…': 'Escriba un mensaje…',
  'Listening…': 'Escuchando…',
  'This conversation has ended.': 'Esta conversación ha terminado.',
  "We're on the phone with you.": 'Estamos al teléfono con usted.',
  'Recording video. Tap send when done.': 'Grabando video. Toque enviar cuando termine.',
  'Recording voice note…': 'Grabando nota de voz…',
  'Cancel': 'Cancelar',
  'Calling you now…': 'Llamándole ahora…',
  "We couldn't reach you. Try again, or keep chatting here.":
    'No pudimos localizarle. Inténtelo de nuevo o siga chateando aquí.',
  'Try again': 'Intentar de nuevo',
  'Call me instead': 'Mejor llámenme',
  'Listening': 'Escuchando',
  'Speak now. Your words will appear in the box.': 'Hable ahora. Sus palabras aparecerán en el cuadro.',
  'Done': 'Listo',
  'Voice note': 'Nota de voz',
  'Record and send audio': 'Grabe y envíe audio',
  'Speech to text': 'Voz a texto',
  "Talk and we'll type it": 'Hable y lo escribimos',
  'Video': 'Video',
  'Record and send video': 'Grabe y envíe video',
  // ── Send your details (web form) ──
  'What type of case is this?': '¿Qué tipo de caso es?',
  'How severe were the injuries?': '¿Qué tan graves fueron las lesiones?',
  'When did it happen?': '¿Cuándo ocurrió?',
  'Where can we reach you?': '¿Cómo podemos contactarle?',
  'Minor, treated and released': 'Leve, atendido y dado de alta',
  'Moderate, ongoing treatment': 'Moderada, en tratamiento',
  'Severe, hospitalization or surgery': 'Grave, hospitalización o cirugía',
  'Not sure yet': 'Aún no lo sé',
  'Within the last week': 'En la última semana',
  '1 to 4 weeks ago': 'Hace 1 a 4 semanas',
  '1 to 6 months ago': 'Hace 1 a 6 meses',
  'More than 6 months ago': 'Hace más de 6 meses',
  'Not sure': 'No estoy seguro',
  'Car / motor vehicle accident': 'Accidente de auto o vehículo',
  'Truck or commercial vehicle': 'Camión o vehículo comercial',
  'Slip & fall / premises': 'Resbalón y caída / propiedad',
  'Something else': 'Otra cosa',
  'Loading…': 'Cargando…',
  'Not available right now': 'No disponible en este momento',
  "This form isn't enabled for this firm. Please use one of the other options to reach us.":
    'Este formulario no está habilitado para este bufete. Use otra opción para contactarnos.',
  "A few quick questions and we'll reach back shortly.": 'Unas preguntas rápidas y le contactaremos en breve.',
  'Phone number': 'Número de teléfono',
  'optional': 'opcional',
  'Submit my details': 'Enviar mis datos',
  'Sending…': 'Enviando…',
  "We couldn't submit your details. Please try again.": 'No pudimos enviar sus datos. Inténtelo de nuevo.',
  "This form isn't available right now. Please try another option.": 'Este formulario no está disponible ahora. Pruebe otra opción.',
  'Too many submissions. Please try again in a bit.': 'Demasiados envíos. Inténtelo de nuevo en un momento.',
  'Previous step': 'Paso anterior',
  'Thanks': 'Gracias',
  "We've got your details": 'Tenemos sus datos',
  // ── Connecting state ──
  'Connecting you to': 'Conectándole con',
  'Connecting…': 'Conectando…',
  // ── Footer ──
  'Privacy': 'Privacidad',
  'Terms': 'Términos',
  // ── Chat header ──
  'Live chat': 'Chat en vivo',
  'Specialist': 'Especialista',
  'Live agent': 'Agente en vivo',
  'Back to all options': 'Volver a las opciones',
  'Start a new chat': 'Iniciar un nuevo chat',
  'New chat': 'Nuevo chat',
  // ── Channel views (call / text) + call lifecycle ──
  'Edit anything below.': 'Edite lo que quiera abajo.',
  'name': 'nombre',
  'phone': 'teléfono',
  'email': 'correo',
  'We start the callback the moment you confirm, usually under a minute.':
    'Comenzamos la llamada en cuanto confirme, normalmente en menos de un minuto.',
  'Starting your call…': 'Iniciando su llamada…',
  "We couldn't start the call. Please try again.": 'No pudimos iniciar la llamada. Inténtelo de nuevo.',
  'Pick up this chat by text': 'Continúe este chat por mensaje',
  'Starting…': 'Iniciando…',
  'Message me on WhatsApp': 'Escríbanme por WhatsApp',
  "Texting isn't available right now. Try another option.": 'Los mensajes no están disponibles ahora. Pruebe otra opción.',
  "We couldn't send that just now. Try another option.": 'No pudimos enviarlo ahora. Pruebe otra opción.',
  "We couldn't start the text. Please try again.": 'No pudimos iniciar el mensaje. Inténtelo de nuevo.',
  'Continue in WhatsApp. We opened it with your message ready to send.':
    'Continúe en WhatsApp. Lo abrimos con su mensaje listo para enviar.',
  "We've messaged you on WhatsApp. Check your phone to continue.":
    'Le escribimos por WhatsApp. Revise su teléfono para continuar.',
  'We just texted you. Reply to that message to continue.':
    'Le enviamos un mensaje. Responda a ese mensaje para continuar.',
  "We're dialing you now": 'Le estamos llamando ahora',
  'Keep it nearby.': 'Téngalo a la mano.',
  "You're connected": 'Está conectado',
  "We couldn't reach you": 'No pudimos localizarle',
  "You're all set": 'Todo listo',
  'Back to options': 'Volver a las opciones',
  'Back': 'Atrás',
  // ── Modals ──
  'Talk instead of type?': '¿Prefiere hablar en vez de escribir?',
  "We'll call you now and pick up right where we left off — everything you've already shared is carried into the call.":
    'Le llamamos ahora y seguimos justo donde lo dejamos; todo lo que ya compartió pasa a la llamada.',
  'Talk to a human': 'Hablar con una persona',
  "We're here to help": 'Estamos aquí para ayudar',
  'Please provide your phone number so we can call you immediately.': 'Proporcione su número de teléfono para llamarle de inmediato.',
  'Call me immediately': 'Llámenme de inmediato',
  'A team member will call you within 60 seconds.': 'Un miembro del equipo le llamará en menos de 60 segundos.',
  'Call me in 15 minutes': 'Llámenme en 15 minutos',
  'Select 15, 30, 45 min or 1 hour.': 'Elija 15, 30, 45 min o 1 hora.',
  'Pick a specific date and time.': 'Elija una fecha y hora específica.',
  'When should we call you back?': '¿Cuándo le devolvemos la llamada?',
  '1 hour': '1 hora',
  'Continue over text': 'Continuar por mensaje',
  'Enter your number and we’ll text you so you can continue this conversation from your phone.':
    'Escriba su número y le enviaremos un mensaje para continuar esta conversación desde su teléfono.',
  // ── Intro / opener / consent / chips ──
  "Let's talk about it": 'Hablemos de su caso',
  'Chat with us! You can also continue this on your phone or schedule a call with one of our experts.':
    '¡Chatee con nosotros! También puede continuar en su teléfono o agendar una llamada con uno de nuestros expertos.',
  'Review the following before continuing:': 'Revise lo siguiente antes de continuar:',
  'Continue': 'Continuar',
  'Close': 'Cerrar',
  'What happened?': '¿Qué ocurrió?',
  'More': 'Más',
  'Confirm': 'Confirmar',
  'What kind of matter brings you here?': '¿Qué tipo de asunto le trae aquí?',
};

export function translate(loc: UiLocale, en: string): string {
  return loc === 'es' ? ES[en] ?? en : en;
}

/** t('English source') → the visitor's UI-locale string (English fallback). */
export function useT(): (en: string) => string {
  const loc = useWidgetStore((s) => s.uiLocale);
  return (en: string) => translate(loc, en);
}
