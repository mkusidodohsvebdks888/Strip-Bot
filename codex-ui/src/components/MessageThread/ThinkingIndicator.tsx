/** Claude-style pre-token indicator: rotating warm asterisk + muted label. Uses theme variables only. */
export function ThinkingIndicator({label = '正在思考…'}: {label?: string}) {
  return (
    <div className="strip-thinking" role="status" aria-live="polite">
      <span className="strip-thinking__star" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path d="M12 2c.4 0 .7.3.8.7l.9 5.1 4.3-2.9c.3-.2.8-.2 1.1.1.3.3.3.8.1 1.1l-2.9 4.3 5.1.9c.4.1.7.4.7.8s-.3.7-.7.8l-5.1.9 2.9 4.3c.2.3.2.8-.1 1.1-.3.3-.8.3-1.1.1l-4.3-2.9-.9 5.1c-.1.4-.4.7-.8.7s-.7-.3-.8-.7l-.9-5.1-4.3 2.9c-.3.2-.8.2-1.1-.1-.3-.3-.3-.8-.1-1.1l2.9-4.3-5.1-.9C2.3 12.7 2 12.4 2 12s.3-.7.7-.8l5.1-.9-2.9-4.3c-.2-.3-.2-.8.1-1.1.3-.3.8-.3 1.1-.1l4.3 2.9.9-5.1c.1-.4.4-.7.8-.7z" />
        </svg>
      </span>
      <span className="strip-thinking__label">{label}</span>
    </div>
  );
}
