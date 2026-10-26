// From JaminZhou/codex-ui-kit (MIT, 2026); see LICENSE. Adapted imports/types for StripBot.
import type { HTMLAttributes } from "react";
import type { AgentItemStatus } from "./types";

export type StatusIndicatorStatus = AgentItemStatus | "warning";

export interface StatusIndicatorProps extends HTMLAttributes<HTMLSpanElement> {
  status: StatusIndicatorStatus;
}

export function StatusIndicator({
  className,
  status,
  ...props
}: StatusIndicatorProps) {
  const classes = ["codex-ui-status-indicator", className]
    .filter(Boolean)
    .join(" ");

  return (
    <span
      aria-hidden="true"
      className={classes}
      data-status={status}
      {...props}
    />
  );
}
