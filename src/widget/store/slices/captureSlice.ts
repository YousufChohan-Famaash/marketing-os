import type { StateCreator } from 'zustand';
import type { CapturedField, Section } from '../../types/domain';
import type { WidgetStore } from '../widgetStore';
import { contactFromFields } from '../../services/leadContact';

const INITIAL_SECTIONS: Section[] = [
  { id: 'identity', name: 'Identity', fields: [], isComplete: false },
  { id: 'accident', name: 'Accident', fields: [], isComplete: false },
  { id: 'evidence', name: 'Evidence', fields: [], isComplete: false },
];

const DEFAULT_PROGRESS_TOTAL = 16;

export interface CaptureSlice {
  sections: Section[];
  capturedFields: Record<string, CapturedField>;
  /** Edits that have been written client-side but are awaiting server ack. */
  pendingEdits: Record<string, string>;
  /** Edits that failed to confirm — UI can surface a retry. */
  failedEdits: Record<string, string>;
  /** Total number of fields the flow expects to capture (denominator of the pill). */
  progressTotal: number;
  captureField: (field: CapturedField) => void;
  /** Optimistic edit — surfaces immediately, awaits confirm/fail. */
  editField: (id: string, newValue: string) => void;
  /** Server confirmed the edit — clear pending state. */
  confirmEdit: (id: string, finalValue: string) => void;
  /** Server rejected the edit — revert pending value, mark failed. */
  failEdit: (id: string) => void;
  setSectionComplete: (sectionId: string, isComplete: boolean) => void;
  setProgressTotal: (total: number) => void;
  resetCapture: () => void;
}

export const createCaptureSlice: StateCreator<
  WidgetStore,
  [],
  [],
  CaptureSlice
> = (set, get) => ({
  sections: INITIAL_SECTIONS.map((s) => ({ ...s, fields: [] })),
  capturedFields: {},
  pendingEdits: {},
  failedEdits: {},
  progressTotal: DEFAULT_PROGRESS_TOTAL,
  captureField: (field) => {
    set((state) => {
      const sections = state.sections.map((s) =>
        s.id === field.sectionId
          ? {
              ...s,
              fields: s.fields.some((f) => f.id === field.id)
                ? s.fields.map((f) => (f.id === field.id ? field : f))
                : [...s.fields, field],
            }
          : s,
      );
      return {
        capturedFields: { ...state.capturedFields, [field.id]: field },
        sections,
      };
    });
    // Remember a captured phone/name/email so quick actions auto-fill it, even
    // after a reload.
    const contact = contactFromFields({ [field.id]: field });
    if (contact.phone || contact.name || contact.email) get().rememberContact(contact);
  },
  editField: (id, newValue) =>
    set((state) => ({
      pendingEdits: { ...state.pendingEdits, [id]: newValue },
      failedEdits: omit(state.failedEdits, id),
    })),
  confirmEdit: (id, finalValue) => {
    set((state) => {
      const existing = state.capturedFields[id];
      const updated: Record<string, CapturedField> = existing
        ? {
            ...state.capturedFields,
            [id]: { ...existing, value: finalValue, editedByLead: true },
          }
        : state.capturedFields;
      const sections = state.sections.map((s) => ({
        ...s,
        fields: s.fields.map((f) =>
          f.id === id ? { ...f, value: finalValue, editedByLead: true } : f,
        ),
      }));
      return {
        capturedFields: updated,
        sections,
        pendingEdits: omit(state.pendingEdits, id),
        failedEdits: omit(state.failedEdits, id),
      };
    });
    // A lead correcting their own value (e.g. fixing a phone) should update what
    // we remember for auto-fill.
    const field = get().capturedFields[id];
    if (field) {
      const contact = contactFromFields({ [id]: field });
      if (contact.phone || contact.name || contact.email) get().rememberContact(contact);
    }
  },
  failEdit: (id) =>
    set((state) => {
      const pending = state.pendingEdits[id];
      return {
        pendingEdits: omit(state.pendingEdits, id),
        failedEdits:
          pending !== undefined
            ? { ...state.failedEdits, [id]: pending }
            : state.failedEdits,
      };
    }),
  setSectionComplete: (sectionId, isComplete) =>
    set((state) => ({
      sections: state.sections.map((s) =>
        s.id === sectionId ? { ...s, isComplete } : s,
      ),
    })),
  setProgressTotal: (total) => set({ progressTotal: total }),
  resetCapture: () =>
    set({
      sections: INITIAL_SECTIONS.map((s) => ({ ...s, fields: [] })),
      capturedFields: {},
      pendingEdits: {},
      failedEdits: {},
      progressTotal: DEFAULT_PROGRESS_TOTAL,
    }),
});

function omit<T extends Record<string, unknown>>(obj: T, key: string): T {
  if (!(key in obj)) return obj;
  const next = { ...obj };
  delete next[key];
  return next;
}
