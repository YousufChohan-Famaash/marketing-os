import type { WidgetBootConfig } from '../types/domain';

/**
 * Simulates GET /api/widget/config?firm_id=...
 *
 * Real backend swap-point: replace this function with a fetch() call.
 * The returned shape MUST stay identical to `WidgetBootConfig`.
 */

const SIMULATED_LATENCY_MS = 200;

const MENDELSON_DEMO: WidgetBootConfig = {
  firmId: 'firm_mendelson_demo',
  firmName: 'Mendelson & Associates — Personal Injury',
  plan: 'chat_plus_voice',
  flowId: 'flow_pi_intake_v1',
  features: {
    voice: true,
    video_intro: true,
    video_record: true,
    file_upload: true,
    esign: true,
    human_takeover: true,
    scheduling: true,
    multi_language: false,
  },
  branding: {
    name: 'Mendelson & Associates',
    primaryColor: '#534FEB',
    accentColor: '#0F172A',
    launcherPosition: 'bottom-right',
    greetingMessage:
      "Hi! I'm Mendelson & Associates' AI intake assistant. I'm here to help you understand if you have a case.",
    introVideoUrl:
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    introVideoPoster:
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/BigBuckBunny.jpg',
    introVideoCaption:
      "Hi 👋 I'm John Mendelson. What kind of matter can we help with?",
    practiceAreas: [
      'Car Accident',
      'Slip & Fall',
      'Workers’ Compensation',
      'Medical Malpractice',
      'Animal Bite',
      'Something else',
    ],
  },
  compliance: {
    aiDisclosure:
      "You're chatting with an AI assistant. A licensed attorney will review your case before any retainer is finalized.",
    tcpaConsent:
      'By replying YES, you consent to receive automated messages from Mendelson & Associates at the number you provide. Message and data rates may apply.',
    privacyUrl: 'https://mendelson-law.com/privacy',
    termsUrl: 'https://mendelson-law.com/terms',
  },
  allowedOrigins: ['http://localhost:5173', 'https://mendelson-law.com'],
};

export async function fetchBootConfig(_firmId: string): Promise<WidgetBootConfig> {
  await new Promise((r) => setTimeout(r, SIMULATED_LATENCY_MS));
  return MENDELSON_DEMO;
}
