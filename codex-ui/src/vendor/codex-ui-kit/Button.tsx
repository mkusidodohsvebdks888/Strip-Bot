// From JaminZhou/codex-ui-kit (MIT, 2026); see LICENSE. Adapted imports/types for StripBot.
import type {ButtonHTMLAttributes,ReactNode} from 'react';
export type ControlTone =
  | "danger"
  | "ghost"
  | "outline"
  | "primary"
  | "secondary";
export type ControlSize = "large" | "medium" | "small" | "toolbar";

export interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  children: ReactNode;
  endIcon?: ReactNode;
  loading?: boolean;
  loadingLabel?: string;
  pressed?: boolean;
  size?: ControlSize;
  startIcon?: ReactNode;
  tone?: ControlTone;
  uniform?: boolean;
}

export function Button({
  "aria-label": ariaLabel,
  children,
  className,
  disabled = false,
  endIcon,
  loading = false,
  loadingLabel = "Loading",
  pressed,
  size = "medium",
  startIcon,
  tone = "secondary",
  type = "button",
  uniform = false,
  ...props
}: ButtonProps) {
  const classes = ["codex-ui-button", className].filter(Boolean).join(" ");
  return (
    <button
      aria-busy={loading || undefined}
      aria-label={loading && !ariaLabel ? loadingLabel : ariaLabel}
      aria-pressed={pressed}
      className={classes}
      data-loading={loading || undefined}
      data-pressed={pressed || undefined}
      data-size={size}
      data-tone={tone}
      data-uniform={uniform || undefined}
      disabled={disabled || loading}
      type={type}
      {...props}
    >
      {loading ? (
        <span aria-hidden="true" className="codex-ui-button__spinner" />
      ) : startIcon ? (
        <span aria-hidden="true" className="codex-ui-button__icon">
          {startIcon}
        </span>
      ) : null}
      <span className="codex-ui-button__label">{children}</span>
      {endIcon ? (
        <span aria-hidden="true" className="codex-ui-button__icon">
          {endIcon}
        </span>
      ) : null}
    </button>
  );
}

export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label" | "children"> {
  icon: ReactNode;
  label: string;
  loading?: boolean;
  pressed?: boolean;
  size?: ControlSize;
  tone?: ControlTone;
}

export function IconButton({
  className,
  disabled = false,
  icon,
  label,
  loading = false,
  pressed,
  size = "toolbar",
  tone = "ghost",
  type = "button",
  ...props
}: IconButtonProps) {
  const classes = ["codex-ui-icon-button", className]
    .filter(Boolean)
    .join(" ");
  return (
    <button
      aria-busy={loading || undefined}
      aria-label={label}
      aria-pressed={pressed}
      className={classes}
      data-loading={loading || undefined}
      data-pressed={pressed || undefined}
      data-size={size}
      data-tone={tone}
      disabled={disabled || loading}
      type={type}
      {...props}
    >
      {loading ? (
        <span aria-hidden="true" className="codex-ui-button__spinner" />
      ) : (
        <span aria-hidden="true" className="codex-ui-icon-button__icon">
          {icon}
        </span>
      )}
    </button>
  );
}

