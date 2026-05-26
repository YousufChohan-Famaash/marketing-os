export function TypingIndicator() {
  return (
    <div
      className="flex items-center gap-1 px-3 py-2"
      role="status"
      aria-label="Assistant is typing"
    >
      <span className="typing-dot block h-1.5 w-1.5 rounded-full bg-muted-soft" />
      <span className="typing-dot block h-1.5 w-1.5 rounded-full bg-muted-soft" />
      <span className="typing-dot block h-1.5 w-1.5 rounded-full bg-muted-soft" />
    </div>
  );
}
