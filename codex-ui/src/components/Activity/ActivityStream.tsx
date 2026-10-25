import {memo, useEffect, useRef, useState} from 'react';
import type {ReactNode} from 'react';
import {Icon} from '../../Icons';
import {formatDuration, groupActivities, summarize} from './activity-types.ts';
import type {ActivityEvent, ActivityGroup, ActivityStatus} from './activity-types.ts';
import {useThrottledValue} from './useThrottledValue.ts';

const KIND_ICON: Record<ActivityEvent['kind'], string> = {
  read: 'file', shell: 'terminal', edit: 'square-pen', search: 'search', question: 'circle-help', approval: 'checklist-minimalistic', note: 'info',
};
const STATUS_LABEL: Record<ActivityStatus, string> = {running: '执行中', completed: '已完成', failed: '失败', cancelled: '已停止'};

type Props = {
  events: ActivityEvent[];
  /** Problems/approvals can be handed back to the host for rich rendering. */
  renderSpecial?: (event: ActivityEvent) => ReactNode;
  /** Host-provided renderer for normal events, used here to preserve the existing rich details. */
  renderEvent?: (event: ActivityEvent) => ReactNode;
  /** How many recent rows to show before "show earlier". */
  previewCount?: number;
  /** UI refresh interval for streaming events. */
  throttleMs?: number;
  /** Explicit toolbar state; null keeps the automatic running-open/completed-closed behaviour. */
  allOpen?: boolean | null;
};

export function ActivityStream({events, renderSpecial, renderEvent, previewCount = 6, throttleMs = 150, allOpen = null}: Props) {
  const throttled = useThrottledValue(events, throttleMs);
  const groups = groupActivities(throttled);
  return <ol className="strip-act" aria-label="执行记录">
    {groups.map(group =>
      group.type === 'single'
        ? renderEvent
          ? <li className="strip-act__custom" key={group.event.id}>{renderEvent(group.event)}</li>
          : <SingleRow key={group.event.id} event={group.event} renderSpecial={renderSpecial} />
        : <GroupRow key={group.id} group={group} previewCount={previewCount} renderEvent={renderEvent} allOpen={allOpen} />,
    )}
  </ol>;
}

const SingleRow = memo(function SingleRow({event, renderSpecial}: {event: ActivityEvent; renderSpecial?: Props['renderSpecial']}) {
  const special = renderSpecial?.(event);
  return <li className={`strip-act__row is-${event.status}`}>
    <span className="strip-act__icon"><Icon name={KIND_ICON[event.kind]} /></span>
    <div className="strip-act__body">
      <div className="strip-act__head">
        <span className="strip-act__title">{event.title}</span>
        <StatusBadge status={event.status} />
      </div>
      {special ?? (event.detail ? <Detail text={event.detail} /> : null)}
    </div>
  </li>;
});

const GroupRow = memo(function GroupRow({group, previewCount, renderEvent, allOpen}: {
  group: Extract<ActivityGroup, {type: 'group'}>;
  previewCount: number;
  renderEvent?: Props['renderEvent'];
  allOpen: boolean | null;
}) {
  const [open, setOpen] = useState(group.status === 'running');
  const [showAll, setShowAll] = useState(false);
  const wasRunning = useRef(group.status === 'running');
  useEffect(() => {
    if (allOpen !== null) {
      setOpen(allOpen);
      wasRunning.current = group.status === 'running';
      return;
    }
    if (wasRunning.current && group.status !== 'running') {
      setOpen(false);
      setShowAll(false);
    }
    wasRunning.current = group.status === 'running';
  }, [allOpen, group.status]);
  const {events} = group;
  const last = events[events.length - 1];
  const visible = showAll ? events : events.slice(Math.max(0, events.length - previewCount));
  const hidden = events.length - visible.length;

  return <li className={`strip-act__row strip-act__row--group is-${group.status}`}>
    <span className="strip-act__icon"><Icon name={KIND_ICON[last.kind]} /></span>
    <div className="strip-act__body">
      <button type="button" className="strip-act__summary" aria-expanded={open} onClick={() => setOpen(value => !value)}>
        <span className="strip-act__title">{summarize(events)}</span>
        {group.status === 'running' ? <code className="strip-act__current">{last.title}</code> : null}
        <StatusBadge status={group.status} />
        <span className="strip-act__chev"><Icon name={open ? 'chevron-up' : 'chevron-down'} /></span>
      </button>
      {open ? <ul className="strip-act__list">
        {hidden > 0 ? <li><button type="button" className="strip-act__more" onClick={() => setShowAll(true)}>显示更早的 {hidden} 条</button></li> : null}
        {visible.map(event => renderEvent
          ? <li className="strip-act__custom" key={event.id}>{renderEvent(event)}</li>
          : <ItemRow key={event.id} event={event} />)}
      </ul> : null}
    </div>
  </li>;
});

function ItemRow({event}: {event: ActivityEvent}) {
  const [open, setOpen] = useState(false);
  const duration = formatDuration(event);
  const prefix = event.status === 'running' ? '正在运行' : event.status === 'failed' ? '运行失败' : duration ? `已在 ${duration} 内运行` : '已运行';
  return <li className={`strip-act__item is-${event.status}`}>
    <button type="button" className="strip-act__item-line" onClick={() => event.detail && setOpen(value => !value)} aria-expanded={event.detail ? open : undefined}>
      <span className="strip-act__dot" aria-hidden="true" />
      <span className="strip-act__item-prefix">{prefix}</span>
      <code className="strip-act__item-cmd">{event.title}</code>
      {event.detail ? <span className="strip-act__chev"><Icon name={open ? 'chevron-up' : 'chevron-down'} /></span> : null}
    </button>
    {open && event.detail ? <Detail text={event.detail} /> : null}
  </li>;
}

function Detail({text}: {text: string}) {
  return <pre className="strip-act__detail">{text}</pre>;
}

function StatusBadge({status}: {status: ActivityStatus}) {
  return <span className={`strip-act__status is-${status}`}>
    {status === 'running' ? <span className="strip-act__spinner" aria-hidden="true" /> : null}
    {STATUS_LABEL[status]}
  </span>;
}
