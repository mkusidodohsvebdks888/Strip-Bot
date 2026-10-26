// From JaminZhou/codex-ui-kit (MIT, 2026); see LICENSE. Adapted imports/types for StripBot.
import {
  useId,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import type { AgentActivityKind } from "./types";
import {
  StatusIndicator,
  type StatusIndicatorStatus,
} from "./StatusIndicator";

export type AgentActivityStatus = StatusIndicatorStatus;

export interface AgentActivityProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  children?: ReactNode;
  defaultOpen?: boolean;
  description?: ReactNode;
  detail?: ReactNode;
  disabled?: boolean;
  disclosureIcon?: ReactNode;
  disclosureIndicator?: boolean;
  disclosureMode?: "button" | "details" | "overlay-button";
  indicator?: ReactNode;
  kind?: AgentActivityKind;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  status: AgentActivityStatus;
  summary: ReactNode;
}

export function AgentActivity({
  children,
  className,
  defaultOpen = false,
  description,
  detail,
  disabled = false,
  disclosureIcon,
  disclosureIndicator = false,
  disclosureMode = "details",
  indicator,
  kind = "generic",
  onOpenChange,
  open,
  status,
  summary,
  ...props
}: AgentActivityProps) {
  const generatedSummaryId = useId();
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const resolvedOpen = open ?? internalOpen;
  const classes = ["codex-ui-activity", className].filter(Boolean).join(" ");
  const hasBody = children !== undefined && children !== null;
  const summaryId =
    disclosureMode === "overlay-button" ? generatedSummaryId : undefined;
  const updateOpen = (nextOpen: boolean) => {
    if (open === undefined) {
      setInternalOpen(nextOpen);
    }
    onOpenChange?.(nextOpen);
  };
  const header = (
    <>
      {indicator === undefined ? <StatusIndicator status={status} /> : indicator}
      <span className="codex-ui-activity__summary" id={summaryId}>
        {summary}
      </span>
      {detail ? (
        <span className="codex-ui-activity__detail">{detail}</span>
      ) : null}
    </>
  );
  const buttonChevron = (
    <span
      aria-hidden="true"
      className="codex-ui-activity__button-chevron"
      data-visible={disclosureIndicator || resolvedOpen || undefined}
    >
      {disclosureIcon ?? (
        <svg fill="none" height="20" viewBox="0 0 20 20" width="20">
          <path
            d="M7.52925 3.7793C7.75652 3.55203 8.10803 3.52383 8.36616 3.69434L8.47065 3.7793L14.2207 9.5293C14.4804 9.789 14.4804 10.211 14.2207 10.4707L8.47065 16.2207C8.21095 16.4804 7.78895 16.4804 7.52925 16.2207C7.26955 15.961 7.26955 15.539 7.52925 15.2793L12.8085 10L7.52925 4.7207L7.44429 4.61621C7.27378 4.35808 7.30198 4.00657 7.52925 3.7793Z"
            fill="currentColor"
          />
        </svg>
      )}
    </span>
  );

  return (
    <div
      aria-disabled={disabled || undefined}
      className={classes}
      data-kind={kind}
      data-status={status}
      data-disabled={disabled || undefined}
      data-expandable={hasBody || undefined}
      {...props}
    >
      {hasBody && disclosureMode === "overlay-button" ? (
        <div
          className="codex-ui-activity__disclosure"
          data-disclosure-mode="overlay-button"
          data-open={resolvedOpen || undefined}
        >
          <div className="codex-ui-activity__header">
            {header}
            {buttonChevron}
            <button
              aria-expanded={resolvedOpen}
              aria-labelledby={summaryId}
              className="codex-ui-activity__overlay-toggle"
              disabled={disabled}
              onClick={() => {
                if (!disabled) updateOpen(!resolvedOpen);
              }}
              type="button"
            />
          </div>
          <div
            aria-hidden={!resolvedOpen}
            className="codex-ui-activity__body"
            hidden={!resolvedOpen}
          >
            {children}
          </div>
        </div>
      ) : hasBody && disclosureMode === "button" ? (
        <div
          className="codex-ui-activity__disclosure"
          data-disclosure-mode="button"
          data-open={resolvedOpen || undefined}
        >
          <button
            aria-expanded={resolvedOpen}
            className="codex-ui-activity__header"
            disabled={disabled}
            onClick={() => {
              if (!disabled) updateOpen(!resolvedOpen);
            }}
            type="button"
          >
            {header}
            {buttonChevron}
          </button>
          <div
            aria-hidden={!resolvedOpen}
            className="codex-ui-activity__body"
            hidden={!resolvedOpen}
          >
            {children}
          </div>
        </div>
      ) : hasBody ? (
        <details
          className="codex-ui-activity__disclosure"
          onToggle={(event) => {
            if (disabled) {
              event.currentTarget.open = resolvedOpen;
              return;
            }
            const nextOpen = event.currentTarget.open;
            if (open !== undefined) {
              if (nextOpen !== open) {
                updateOpen(nextOpen);
                event.currentTarget.open = open;
              }
              return;
            }

            updateOpen(nextOpen);
          }}
          open={resolvedOpen}
        >
          <summary
            aria-expanded={resolvedOpen}
            className="codex-ui-activity__header"
            onClick={(event) => {
              if (disabled) {
                event.preventDefault();
                return;
              }
              if (open === undefined) return;
              event.preventDefault();
              updateOpen(!open);
            }}
          >
            {header}
          </summary>
          <div className="codex-ui-activity__body">{children}</div>
        </details>
      ) : (
        <div className="codex-ui-activity__header">{header}</div>
      )}
      {description ? (
        <div className="codex-ui-activity__description">{description}</div>
      ) : null}
    </div>
  );
}
