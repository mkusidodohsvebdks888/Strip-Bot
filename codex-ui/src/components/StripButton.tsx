/** Optional React/TypeScript helpers for Strip UI Kit.
 *  This works with strip-buttons.css and icons/*.svg copied to /public/icons/.
 *  No external icon library or runtime dependency is needed beyond React.
 */
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";

type IconMaskStyle = CSSProperties & { "--si"?: string; "--si-size"?: string };

export function StripIcon({ name, size = 18 }: { name: string; size?: number }) {
  const style: IconMaskStyle = {
    "--si": `url("/icons/${encodeURIComponent(name)}.svg")`,
    "--si-size": `${size}px`,
  };
  return <span className="si" style={style} aria-hidden="true" />;
}

type StripButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  leftIcon?: string;
  rightIcon?: string;
  iconOnly?: boolean;
  loading?: boolean;
  children?: ReactNode;
};

export function StripButton({
  variant = "secondary",
  size = "md",
  leftIcon,
  rightIcon,
  iconOnly = false,
  loading = false,
  children,
  className = "",
  disabled,
  type = "button",
  ...buttonProps
}: StripButtonProps) {
  const classes = [
    "strip-btn",
    `strip-btn--${variant}`,
    size !== "md" && `strip-btn--${size}`,
    iconOnly && "strip-btn--icon",
    className,
  ].filter(Boolean).join(" ");
  return (
    <button
      {...buttonProps}
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {loading ? <span className="strip-btn__spinner" aria-hidden="true" /> : leftIcon ? <StripIcon name={leftIcon} /> : null}
      {!iconOnly && children != null && <span className="strip-btn__label">{children}</span>}
      {!loading && rightIcon && <StripIcon name={rightIcon} />}
    </button>
  );
}

// Example inside a <div className="strip-ui" data-theme="light"> ... </div>:
// <StripButton variant="primary" rightIcon="arrow-right">继续</StripButton>
// <StripButton variant="ghost" leftIcon="chevron-left" iconOnly aria-label="返回" />
// Icon-only buttons must always have an accessible aria-label.
