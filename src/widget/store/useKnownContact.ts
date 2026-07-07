import { useMemo } from 'react';
import { useWidgetStore } from './widgetStore';
import { contactFromFields, type LeadContact } from '../services/leadContact';

/**
 * The best contact details we currently know for the visitor: what the chat has
 * captured this session takes priority, falling back to what was remembered
 * (persisted) earlier. Used to pre-fill the "Call me now" / "I need help" / text
 * / schedule forms so the visitor never re-enters their number.
 */
export function useKnownContact(): LeadContact {
  const capturedFields = useWidgetStore((s) => s.capturedFields);
  const leadContact = useWidgetStore((s) => s.leadContact);
  return useMemo(() => {
    const captured = contactFromFields(capturedFields);
    return {
      phone: captured.phone ?? leadContact.phone,
      name: captured.name ?? leadContact.name,
      email: captured.email ?? leadContact.email,
    };
  }, [capturedFields, leadContact]);
}
