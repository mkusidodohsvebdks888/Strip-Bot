export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export type TaskNode = {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
};
export type TaskEdge = { id: string; from: string; to: string };
export type TaskPlan = { nodes: TaskNode[]; edges: TaskEdge[] };
export type TaskEvent = { taskId: string; status: Exclude<TaskStatus, 'pending'> };
export type ActivityStep = {
  id: string;
  type: string;
  status: string;
  title?: string;
  subtitle?: string;
  path?: string;
};
export type ActivityTurn<T extends ActivityStep = ActivityStep> = {
  message: { type: string };
  events: T[];
};

/** Aggregate every execution event after the latest user message, not just the latest assistant message. */
export function currentTaskEvents<T extends ActivityStep>(turns: ActivityTurn<T>[], tail: T[] = []): T[] {
  const lastUser = turns.map(turn => turn.message.type).lastIndexOf('user');
  const current = (lastUser >= 0 ? turns.slice(lastUser) : turns).flatMap(turn => turn.events);
  return current.some(event => event.type !== 'approval') ? current : tail;
}

export function taskStatusFromActivity(status: string): TaskStatus {
  if (status === 'success') return 'completed';
  if (status === 'running') return 'running';
  if (status === 'error') return 'failed';
  if (status === 'idle') return 'cancelled';
  return 'pending';
}

/** Convert real execution events into an honest linear flow. No planning is inferred. */
export function taskPlanFromEvents(events: ActivityStep[]): TaskPlan {
  const unique = new Map<string, ActivityStep>();
  for (const event of events) {
    if (event.type === 'approval') continue;
    unique.set(event.id, event);
  }
  const steps = [...unique.values()];
  const nodes = steps.map(event => ({
    id: event.id,
    title: event.title || event.type || '执行步骤',
    description: event.subtitle || event.path,
    status: taskStatusFromActivity(event.status),
  }));
  const edges = nodes.slice(1).map((node, index) => ({
    id: `tf-edge:${index}:${nodes[index].id}:${node.id}`,
    from: nodes[index].id,
    to: node.id,
  }));
  return { nodes, edges };
}

export function applyTaskEvent(plan: TaskPlan, event: TaskEvent): TaskPlan {
  return {
    ...plan,
    nodes: plan.nodes.map(node => node.id === event.taskId ? { ...node, status: event.status } : node),
  };
}

export function isEdgeLit(a: TaskStatus, b: TaskStatus): boolean {
  return (a === 'completed' && b === 'completed') ||
    (a === 'completed' && b === 'running') ||
    (a === 'running' && b === 'completed');
}
