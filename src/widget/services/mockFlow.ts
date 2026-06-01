import type {
  CapturedField,
  LinkCardPayload,
  Message,
  ScopeChip,
  UploadedFile,
  WidgetBootConfig,
} from '../types/domain';

/**
 * Scripted PI-intake conversation flow.
 *
 * Real backend swap-point: replace this module with a real LLM-driven flow
 * engine. The public surface is intentionally narrow — `createFlow(config)`
 * returns an object with `start()` and `advance(input)` and nothing else.
 *
 * NOTE: This is the linear MVP. The deferred work item flagged in the spec
 * is to lift this into XState before branches and guards multiply.
 */

// ─────────────────────────────────────────────────────────────────────
// Public surface
// ─────────────────────────────────────────────────────────────────────

export type FlowMessage = Omit<Message, 'id' | 'timestamp' | 'status'>;

export type FlowOutput =
  | { kind: 'ai_message'; message: FlowMessage }
  | { kind: 'field_captured'; field: CapturedField }
  | { kind: 'scope_chip'; chip: ScopeChip };

export type FlowInput =
  | { kind: 'text'; content: string }
  | { kind: 'quick_reply'; value: string }
  | { kind: 'practice_area_selected'; value: string }
  | { kind: 'files_uploaded'; files: UploadedFile[] }
  | { kind: 'retainer_signed'; envelopeId: string };

export interface FlowAdvanceResult {
  outputs: FlowOutput[];
  /** What the flow expects from the lead next. */
  awaiting: 'text' | 'quick_reply' | 'files' | 'retainer_signed' | 'none';
  isTerminal: boolean;
}

export interface Flow {
  start(): FlowAdvanceResult;
  advance(input: FlowInput): FlowAdvanceResult;
}

// ─────────────────────────────────────────────────────────────────────
// Implementation
// ─────────────────────────────────────────────────────────────────────

type Stage =
  | 'intro_picker'
  | 'awaiting_tcpa'
  | 'awaiting_name'
  | 'awaiting_dob'
  | 'awaiting_state'
  | 'awaiting_incident_date'
  | 'awaiting_role'
  | 'awaiting_files'
  | 'awaiting_retainer_sign'
  | 'done';

const STATE_OPTIONS = [
  'NJ',
  'NY',
  'PA',
  'CA',
  'TX',
  'FL',
  'IL',
  'MA',
  'GA',
  'OH',
  'Other',
];

const INCIDENT_DATE_OPTIONS = [
  'Today',
  'Yesterday',
  '2–7 days ago',
  'More than a week ago',
];

const ROLE_OPTIONS = ['Driving', 'Passenger', 'Other'];

let chipCounter = 0;
const chip = (kind: ScopeChip['kind'], label: string): ScopeChip => ({
  id: `chip_${Date.now()}_${chipCounter++}`,
  kind,
  label,
  timestamp: Date.now(),
});

const field = (
  id: string,
  displayName: string,
  type: CapturedField['type'],
  value: string,
  sectionId: string,
  required = true,
): CapturedField => ({
  id,
  name: id,
  displayName,
  type,
  value,
  required,
  sectionId,
  capturedAt: Date.now(),
});

const aiText = (content: string, hasMarkdown = false): FlowOutput => ({
  kind: 'ai_message',
  message: { role: 'ai', type: 'text', content, hasMarkdown },
});

const aiQuickReply = (content: string, options: string[]): FlowOutput => ({
  kind: 'ai_message',
  message: { role: 'ai', type: 'quick_reply', content, options },
});

const aiFileRequest = (content: string): FlowOutput => ({
  kind: 'ai_message',
  message: { role: 'ai', type: 'file_upload', content },
});

const aiLinkCard = (card: LinkCardPayload): FlowOutput => ({
  kind: 'ai_message',
  message: { role: 'ai', type: 'link_card', content: card.title, linkCard: card },
});

const aiRetainer = (content: string): FlowOutput => ({
  kind: 'ai_message',
  message: {
    role: 'ai',
    type: 'retainer',
    content,
    retainerStatus: 'pending',
  },
});

export function createFlow(_config: WidgetBootConfig): Flow {
  let stage: Stage = 'intro_picker';
  let leadName = 'there';
  let practiceArea = '';

  function start(): FlowAdvanceResult {
    // Intro video + practice-area chips are a UI-only stage. The flow waits
    // here until the user picks a chip; nothing is emitted into the transcript
    // until then.
    return { outputs: [], awaiting: 'none', isTerminal: false };
  }

  function advance(input: FlowInput): FlowAdvanceResult {
    switch (stage) {
      case 'intro_picker':
        return handleIntroPicker(input);
      case 'awaiting_tcpa':
        return handleTcpa(input);
      case 'awaiting_name':
        return handleName(input);
      case 'awaiting_dob':
        return handleDob(input);
      case 'awaiting_state':
        return handleState(input);
      case 'awaiting_incident_date':
        return handleIncidentDate(input);
      case 'awaiting_role':
        return handleRole(input);
      case 'awaiting_files':
        return handleFiles(input);
      case 'awaiting_retainer_sign':
        return handleRetainer(input);
      case 'done':
      default:
        return { outputs: [], awaiting: 'none', isTerminal: stage === 'done' };
    }
  }

  function handleIntroPicker(input: FlowInput): FlowAdvanceResult {
    if (input.kind !== 'practice_area_selected') {
      return { outputs: [], awaiting: 'none', isTerminal: false };
    }
    practiceArea = input.value;
    stage = 'awaiting_tcpa';
    return {
      outputs: [
        {
          kind: 'field_captured',
          field: field('practice_area', 'Matter type', 'select', input.value, 'identity'),
        },
        aiQuickReply(
          `I'm really sorry that happened to you. Before we start, may I send you automated updates about your case?`,
          ['Yes', 'No'],
        ),
      ],
      awaiting: 'quick_reply',
      isTerminal: false,
    };
  }

  function handleTcpa(input: FlowInput): FlowAdvanceResult {
    const said =
      input.kind === 'text'
        ? input.content.toLowerCase()
        : input.kind === 'quick_reply'
          ? input.value.toLowerCase()
          : '';
    const consented = said === 'yes' || said.includes('yes');
    if (!consented) {
      return {
        outputs: [
          aiQuickReply(
            "Got it — I can't continue without your consent to send updates. It's just so we can reach you about your case. Ready to give consent?",
            ['Yes', 'No'],
          ),
        ],
        awaiting: 'quick_reply',
        isTerminal: false,
      };
    }

    stage = 'awaiting_name';
    return {
      outputs: [
        { kind: 'scope_chip', chip: chip('tcpa_captured', 'TCPA consent captured') },
        aiText(
          "Thank you. Let me ask a few quick questions so I can help. What's your first name?",
        ),
      ],
      awaiting: 'text',
      isTerminal: false,
    };
  }

  function handleName(input: FlowInput): FlowAdvanceResult {
    if (input.kind !== 'text') return repromptText();
    leadName = input.content.trim().split(/\s+/)[0] || 'there';
    stage = 'awaiting_dob';
    return {
      outputs: [
        {
          kind: 'field_captured',
          field: field('first_name', 'First name', 'text', input.content.trim(), 'identity'),
        },
        aiText(`Got it, ${leadName}. What's your date of birth?`),
      ],
      awaiting: 'text',
      isTerminal: false,
    };
  }

  function handleDob(input: FlowInput): FlowAdvanceResult {
    if (input.kind !== 'text') return repromptText();
    stage = 'awaiting_state';
    return {
      outputs: [
        {
          kind: 'field_captured',
          field: field('dob', 'Date of birth', 'date', input.content.trim(), 'identity'),
        },
        aiQuickReply('And what state are you in?', STATE_OPTIONS),
      ],
      awaiting: 'quick_reply',
      isTerminal: false,
    };
  }

  function handleState(input: FlowInput): FlowAdvanceResult {
    if (input.kind !== 'quick_reply') return repromptQuickReply();
    stage = 'awaiting_incident_date';
    return {
      outputs: [
        {
          kind: 'field_captured',
          field: field('state', 'State', 'select', input.value, 'identity'),
        },
        {
          kind: 'scope_chip',
          chip: chip(
            'section_complete',
            'Section 1 · Identity complete (3/3 fields)',
          ),
        },
        {
          kind: 'scope_chip',
          chip: chip(
            'sol_passed',
            `SOL passed · ${input.value} · 698 days remaining`,
          ),
        },
        aiQuickReply(
          'Tell me what happened. When did the accident occur?',
          INCIDENT_DATE_OPTIONS,
        ),
      ],
      awaiting: 'quick_reply',
      isTerminal: false,
    };
  }

  function handleIncidentDate(input: FlowInput): FlowAdvanceResult {
    const value =
      input.kind === 'quick_reply'
        ? input.value
        : input.kind === 'text'
          ? input.content.trim()
          : '';
    if (!value) return repromptQuickReply();
    stage = 'awaiting_role';
    return {
      outputs: [
        {
          kind: 'field_captured',
          field: field(
            'incident_date',
            'Incident date',
            'date',
            value,
            'accident',
          ),
        },
        aiQuickReply('Were you driving or a passenger?', ROLE_OPTIONS),
      ],
      awaiting: 'quick_reply',
      isTerminal: false,
    };
  }

  function handleRole(input: FlowInput): FlowAdvanceResult {
    if (input.kind !== 'quick_reply') return repromptQuickReply();
    stage = 'awaiting_files';
    return {
      outputs: [
        {
          kind: 'field_captured',
          field: field(
            'role_in_vehicle',
            'Role in vehicle',
            'select',
            input.value,
            'accident',
          ),
        },
        aiFileRequest(
          'Can you upload photos of the accident scene and your insurance card?',
        ),
      ],
      awaiting: 'files',
      isTerminal: false,
    };
  }

  function handleFiles(input: FlowInput): FlowAdvanceResult {
    if (input.kind !== 'files_uploaded' || input.files.length === 0) {
      return {
        outputs: [
          aiText(
            'Whenever you have those photos, drop them right here in the chat.',
          ),
        ],
        awaiting: 'files',
        isTerminal: false,
      };
    }

    stage = 'awaiting_retainer_sign';
    const fileFields: FlowOutput[] = input.files.map((f, idx) => ({
      kind: 'field_captured',
      field: field(
        `evidence_${idx + 1}`,
        `Evidence file ${idx + 1}`,
        'file_ref',
        f.name,
        'evidence',
        false,
      ),
    }));

    return {
      outputs: [
        ...fileFields,
        {
          kind: 'scope_chip',
          chip: chip(
            'section_complete',
            `Section 2 · Evidence complete (${input.files.length} files)`,
          ),
        },
        {
          kind: 'scope_chip',
          chip: chip(
            'conflict_passed',
            'Conflict check passed · 4,127 records scanned · 612ms',
          ),
        },
        aiRetainer(
          `Based on what you've told me, ${leadName}, you have a strong case. I'd like to present our retainer agreement — 33% contingency. You can sign right here.`,
        ),
        {
          kind: 'scope_chip',
          chip: chip(
            'retainer_presented',
            'Retainer presented · 33% contingency · DocuSign envelope #DS-99481',
          ),
        },
      ],
      awaiting: 'retainer_signed',
      isTerminal: false,
    };
  }

  function handleRetainer(input: FlowInput): FlowAdvanceResult {
    if (input.kind !== 'retainer_signed') {
      return {
        outputs: [
          aiText(
            'Tap "Review & sign" on the retainer above whenever you\'re ready.',
          ),
        ],
        awaiting: 'retainer_signed',
        isTerminal: false,
      };
    }

    stage = 'done';
    const links: LinkCardPayload[] = [
      {
        url: 'https://famaash-law.com/blog/first-48-hours',
        title: 'What to expect in your first 48 hours',
        description:
          'A short guide to the medical, insurance, and communication steps that matter most.',
        domain: 'famaash-law.com',
      },
      {
        url: 'https://famaash-law.com/blog/contingency-fees',
        title: 'How contingency fees work',
        description:
          'No fees unless we win. Here\'s exactly how that math plays out.',
        domain: 'famaash-law.com',
      },
      {
        url: 'https://famaash-law.com/checklists/medical-documentation',
        title: 'Required medical documentation checklist',
        description:
          'Print this and bring it to every appointment for the next 30 days.',
        domain: 'famaash-law.com',
      },
    ];

    return {
      outputs: [
        {
          kind: 'scope_chip',
          chip: chip(
            'retainer_signed',
            'Retainer SIGNED · DocuSign verified · audit log #DS-99481-S',
          ),
        },
        {
          kind: 'scope_chip',
          chip: chip(
            'cms_pushed',
            'Pushed to Filevine · Case #FV-2026-3491 · 14 fields synced · 287ms',
          ),
        },
        aiText(
          "Perfect, you're all set. Here are a few things to read while you wait:",
          true,
        ),
        ...links.map(aiLinkCard),
        aiText(
          'If you have any urgent questions, [text us anytime](sms:+15551234567) or [email Sarah directly](mailto:sarah@famaash-law.com).',
          true,
        ),
        aiText(
          `Sarah from our team will reach out about your ${practiceArea.toLowerCase()} matter within 24 hours. Thanks for choosing Famaash Law.`,
        ),
      ],
      awaiting: 'none',
      isTerminal: true,
    };
  }

  function repromptText(): FlowAdvanceResult {
    return {
      outputs: [aiText("Sorry, I didn't catch that — could you type a reply?")],
      awaiting: 'text',
      isTerminal: false,
    };
  }

  function repromptQuickReply(): FlowAdvanceResult {
    return {
      outputs: [aiText('Please pick one of the options above.')],
      awaiting: 'quick_reply',
      isTerminal: false,
    };
  }

  return { start, advance };
}
