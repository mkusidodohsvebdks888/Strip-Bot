// From JaminZhou/codex-ui-kit (MIT, 2026); see LICENSE. Adapted imports/types for StripBot.
import {
  useEffect,
  useId,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from "react";

export type AgentPlanStepStatus = "pending" | "in_progress" | "completed";

export interface AgentPlanStep {
  id?: string;
  status: AgentPlanStepStatus;
  step: ReactNode;
}

export interface AgentPlanProps
  extends Omit<HTMLAttributes<HTMLElement>, "children"> {
  defaultOpen?: boolean;
  disabled?: boolean;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  steps: readonly AgentPlanStep[];
  summary?: ReactNode;
}

function defaultSummary(completed: number, total: number) {
  const taskLabel = total === 1 ? "task" : "tasks";
  return `${completed} out of ${total} ${taskLabel} completed`;
}

export function AgentPlan({
  className,
  defaultOpen = true,
  disabled = false,
  onOpenChange,
  open,
  steps,
  summary,
  ...props
}: AgentPlanProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const contentId = useId();
  const currentStepRef = useRef<HTMLLIElement>(null);
  const stepsRef = useRef<HTMLOListElement>(null);
  const resolvedOpen = open ?? internalOpen;
  const completedCount = steps.filter(
    ({ status }) => status === "completed",
  ).length;
  const isComplete = completedCount === steps.length;
  const activeIndex = steps.findIndex(
    ({ status }) => status === "in_progress",
  );
  const nextIndex = steps.findIndex(({ status }) => status !== "completed");
  const currentIndex =
    activeIndex >= 0
      ? activeIndex
      : nextIndex >= 0
        ? nextIndex
        : Math.max(steps.length - 1, 0);
  const classes = ["codex-ui-plan", className].filter(Boolean).join(" ");

  useEffect(() => {
    if (!resolvedOpen || steps.length === 0) return;
    const currentStep = currentStepRef.current;
    const stepViewport = stepsRef.current;
    if (!currentStep || !stepViewport) return;
    stepViewport.scrollTo?.({
      behavior: "smooth",
      top:
        currentStep.offsetTop -
        stepViewport.clientHeight / 2 +
        currentStep.offsetHeight / 2,
    });
  }, [currentIndex, resolvedOpen, steps.length]);

  const setOpen = (nextOpen: boolean) => {
    if (disabled) return;
    if (open === undefined) setInternalOpen(nextOpen);
    onOpenChange?.(nextOpen);
  };

  return (
    <section
      aria-disabled={disabled || undefined}
      className={classes}
      data-complete={isComplete || undefined}
      data-disabled={disabled || undefined}
      data-expanded={resolvedOpen || undefined}
      {...props}
    >
      <button
        aria-controls={contentId}
        aria-expanded={resolvedOpen}
        className="codex-ui-plan__header"
        disabled={disabled}
        onClick={() => setOpen(!resolvedOpen)}
        type="button"
      >
        <span className="codex-ui-plan__summary">
          {!isComplete ? (
            <span aria-hidden="true" className="codex-ui-plan__progress" />
          ) : null}
          <span className="codex-ui-plan__summary-text">
            {summary ?? defaultSummary(completedCount, steps.length)}
          </span>
        </span>
        <span aria-hidden="true" className="codex-ui-plan__chevron" />
      </button>
      <div
        aria-hidden={!resolvedOpen}
        className="codex-ui-plan__content"
        hidden={!resolvedOpen}
        id={contentId}
      >
        <ol className="codex-ui-plan__steps" ref={stepsRef} tabIndex={0}>
          {steps.map((item, index) => (
            <li
              aria-current={index === currentIndex ? "step" : undefined}
              className="codex-ui-plan__step"
              data-status={item.status}
              id={item.id}
              key={item.id ?? index}
              ref={index === currentIndex ? currentStepRef : undefined}
            >
              <span className="codex-ui-plan__step-leading">
                <span
                  aria-hidden="true"
                  className="codex-ui-plan__step-status"
                />
                <span className="codex-ui-plan__step-index">{index + 1}.</span>
              </span>
              <span className="codex-ui-plan__step-text">{item.step}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
