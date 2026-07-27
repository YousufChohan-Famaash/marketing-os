import { useState, type FormEvent } from 'react';
import { useSocket } from '../services/socketContext';
import { useWidgetStore } from '../store/widgetStore';
import { CheckIcon, EditIcon, SpinnerIcon } from '../utils/icons';
import { cn } from '../utils/cn';

export function CaptureDrawer() {
  const isOpen = useWidgetStore((s) => s.isCaptureDrawerOpen);
  const sections = useWidgetStore((s) => s.sections);
  const capturedFields = useWidgetStore((s) => s.capturedFields);
  const pendingEdits = useWidgetStore((s) => s.pendingEdits);
  const failedEdits = useWidgetStore((s) => s.failedEdits);
  const editField = useWidgetStore((s) => s.editField);
  const socket = useSocket();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  if (!isOpen) return null;

  const beginEdit = (id: string, value: string | null) => {
    setEditingId(id);
    setDraft(value ?? '');
  };

  const submitEdit = (e: FormEvent) => {
    e.preventDefault();
    if (!editingId || !socket) return;
    const id = editingId;
    editField(id, draft);
    socket.send({ type: 'field_edit', fieldId: id, value: draft });
    setEditingId(null);
  };

  const visibleSections = sections.filter((s) => s.fields.length > 0);

  return (
    <div
      id="capture-drawer"
      className="shrink-0 border-b border-hairline bg-bg-canvas px-4 py-3"
      role="region"
      aria-label="Captured details"
    >
      <div className="space-y-3">
        {visibleSections.map((section) => (
          <div key={section.id}>
            <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
              {section.name}
              {section.isComplete && (
                <CheckIcon size={11} className="text-success" aria-label="Section complete" />
              )}
            </p>
            <ul className="space-y-1">
              {section.fields.map((field) => {
                const current = capturedFields[field.id]?.value ?? field.value;
                const pending = pendingEdits[field.id];
                const failed = failedEdits[field.id];
                const displayValue = pending ?? current ?? '—';
                const isEditing = editingId === field.id;
                return (
                  <li
                    key={field.id}
                    className={cn(
                      'flex items-center gap-2 rounded-md border bg-white px-2.5 py-1.5',
                      failed ? 'border-danger/30' : 'border-hairline',
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] text-muted">{field.displayName}</p>
                      {isEditing ? (
                        <form onSubmit={submitEdit} className="mt-0.5">
                          <input
                            autoFocus
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            onBlur={submitEdit}
                            className="w-full rounded border border-famaash-border bg-white px-1.5 py-0.5 text-[16px] focus:outline-none sm:text-[13px]"
                            aria-label={`Edit ${field.displayName}`}
                          />
                        </form>
                      ) : (
                        <p className="flex items-center gap-1.5 truncate text-[13px] text-ink">
                          <span>{displayValue}</span>
                          {pending !== undefined && (
                            <SpinnerIcon
                              size={12}
                              className="text-muted"
                              aria-label="Syncing edit"
                            />
                          )}
                          {failed && (
                            <span className="text-[10px] text-danger">retry</span>
                          )}
                        </p>
                      )}
                    </div>
                    {!isEditing && (
                      <button
                        type="button"
                        onClick={() => beginEdit(field.id, current)}
                        aria-label={`Edit ${field.displayName}`}
                        className="rounded p-1 text-muted hover:bg-hairline-soft hover:text-ink"
                      >
                        <EditIcon size={13} />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
