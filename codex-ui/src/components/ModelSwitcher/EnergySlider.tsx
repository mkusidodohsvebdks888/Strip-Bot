import {useCallback, useEffect, useRef, useState} from 'react';
import type {CSSProperties, Ref} from 'react';
import './energy-slider.css';

/** Five response levels. Visual only – the parent decides what each level means. */
export const energyLevels = [
  {name: 'Instant',  color: '#75dceb', rgb: '117,220,235'},
  {name: 'Fast',     color: '#6cbfff', rgb: '108,191,255'},
  {name: 'Balanced', color: '#7b9fff', rgb: '123,159,255'},
  {name: 'Deep',     color: '#9689f5', rgb: '150,137,245'},
  {name: 'Max',      color: '#b493f2', rgb: '180,147,242'},
] as const;

const MAX = energyLevels.length - 1;
const clamp = (v: number) => Math.max(0, Math.min(MAX, Number.isFinite(v) ? v : 2));

type Props = {
  value: number;
  label: string;
  valueText: string;
  disabled?: boolean;
  supported: readonly boolean[];
  /** Fired continuously while dragging (preview only). */
  onChange: (step: number) => void;
  /** Fired once per completed gesture – wire your save/API call here. */
  onCommit?: (step: number) => void;
  /** Fired when a gesture is abandoned (Escape, blur, disabled mid-drag, rejected level). */
  onCancel?: () => void;
  /** When true (default) an unsupported release snaps to the nearest supported level
   *  instead of reverting to the starting level. */
  snapToSupported?: boolean;
  inputRef?: Ref<HTMLInputElement>;
};

/** Nearest supported step to `target`, preferring the travel direction on ties. */
function nearestSupported(target: number, supported: readonly boolean[], bias: 1 | -1): number | null {
  const step = Math.round(target);
  if (supported[step]) return step;
  for (let d = 1; d <= MAX; d++) {
    const ahead = step + bias * d, behind = step - bias * d;
    if (ahead >= 0 && ahead <= MAX && supported[ahead]) return ahead;
    if (behind >= 0 && behind <= MAX && supported[behind]) return behind;
  }
  return null;
}

/** Decorative layer that follows an invisible native <input type="range">.
 *  Only completed gestures commit; everything else is preview. */
export function EnergySlider({
  value, label, valueText, disabled = false, supported,
  onChange, onCommit, onCancel, snapToSupported = true, inputRef,
}: Props) {
  const [position, setPosition] = useState(() => clamp(value));
  const [dragging, setDragging] = useState(false);
  const [direction, setDirection] = useState<'left' | 'right'>('right');
  const [speed, setSpeed] = useState(0);          // 0..1, drives tail length + glow
  const [ripple, setRipple] = useState(0);        // remount key: release ripple
  const [pulse, setPulse] = useState(0);          // remount key: commit glow ring
  const [shake, setShake] = useState(0);          // remount key: rejected release
  const [settle, setSettle] = useState(0);        // remount key: thumb spring-settle

  const gesture = useRef(false);
  const previous = useRef(clamp(value));
  const start = useRef(Math.round(clamp(value)));
  const lastMove = useRef({t: 0, x: clamp(value)});
  const decay = useRef<number | undefined>(undefined);

  /* Follow external value changes when the user is not mid-gesture. */
  useEffect(() => {
    if (gesture.current) return;
    const next = clamp(value);
    setPosition(next);
    previous.current = next;
  }, [value]);

  /* Disabled mid-drag → abort the gesture and restore the starting level. */
  useEffect(() => {
    if (disabled && gesture.current) {
      gesture.current = false;
      setDragging(false);
      setSpeed(0);
      setPosition(start.current);
      onCancel?.();
    }
  }, [disabled, onCancel]);

  useEffect(() => () => { if (decay.current) cancelAnimationFrame(decay.current); }, []);

  const index = Math.round(clamp(position));
  const level = energyLevels[index];

  const preview = useCallback((raw: number) => {
    const next = clamp(raw);
    const now = performance.now();
    const dt = Math.max(1, now - lastMove.current.t);
    const v = Math.min(1, (Math.abs(next - lastMove.current.x) / dt) * 160);
    lastMove.current = {t: now, x: next};
    if (next !== previous.current) setDirection(next < previous.current ? 'left' : 'right');
    previous.current = next;
    setSpeed(prev => Math.max(v, prev * 0.6));
    if (decay.current) cancelAnimationFrame(decay.current);
    decay.current = requestAnimationFrame(() => setSpeed(prev => prev * 0.5));
    setPosition(next);
    onChange(Math.round(next));
  }, [onChange]);

  const cancel = useCallback(() => {
    if (!gesture.current) return;
    gesture.current = false;
    setDragging(false);
    setSpeed(0);
    setPosition(start.current);
    previous.current = start.current;
    onCancel?.();
  }, [onCancel]);

  const commit = useCallback((raw: number) => {
    gesture.current = false;
    setDragging(false);
    setSpeed(0);
    const bias: 1 | -1 = direction === 'left' ? -1 : 1;
    const rounded = Math.round(clamp(raw));
    const target = snapToSupported ? nearestSupported(raw, supported, bias) : (supported[rounded] ? rounded : null);
    if (disabled || target === null) {
      setPosition(start.current);
      previous.current = start.current;
      setShake(n => n + 1);
      onCancel?.();
      return;
    }
    setPosition(target);
    previous.current = target;
    setRipple(n => n + 1);
    setSettle(n => n + 1);
    if (target !== start.current) setPulse(n => n + 1);
    onChange(target);
    onCommit?.(target);
  }, [direction, disabled, onCancel, onChange, onCommit, snapToSupported, supported]);

  const style = {
    '--energy-progress': `${(clamp(position) / MAX) * 100}%`,
    '--energy-accent': level.color,
    '--energy-rgb': level.rgb,
    '--energy-speed': speed.toFixed(3),
  } as CSSProperties;

  const rootClass = ['strip-energy-slider', dragging && 'is-dragging', !supported[index] && 'is-unsupported-level']
    .filter(Boolean).join(' ');

  return (
    <div className={rootClass} data-direction={direction} data-level={index} data-disabled={disabled} style={style}>
      <div className="strip-energy-control" data-shake={shake > 0 || undefined} onAnimationEnd={event => {if(event.target === event.currentTarget) setShake(0);}}>
        <div className="strip-energy-track" aria-hidden="true">
          <div className="strip-energy-fill" />
          {energyLevels.map((item, i) => (
            <span
              key={item.name}
              className={['strip-energy-node', i <= position && 'is-filled', i === index && 'is-active', !supported[i] && 'is-unsupported']
                .filter(Boolean).join(' ')}
              style={{left: `${(i / MAX) * 100}%`, '--i': i} as CSSProperties}
            />
          ))}
        </div>

        <div className="strip-energy-thumb" aria-hidden="true">
          <span className="strip-energy-tail" />
          {ripple > 0 && <span key={`ripple-${ripple}`} className="strip-energy-ripple" />}
          {pulse > 0 && <span key={`pulse-${pulse}`} className="strip-energy-pulse" />}
          <span key={`settle-${settle}`} className="strip-energy-core" data-settle={settle > 0 || undefined} />
          <span className="strip-energy-tooltip">
            <span key={level.name} className="strip-energy-tooltip-text">
              {level.name}{!supported[index] ? ' · Unavailable' : ''}
            </span>
          </span>
        </div>

        <input
          ref={inputRef}
          type="range"
          min={0}
          max={MAX}
          step="any"
          value={position}
          disabled={disabled}
          aria-label={label}
          aria-valuetext={valueText}
          onPointerDown={event => {
            if (disabled) return;
            start.current = Math.round(clamp(value));
            lastMove.current = {t: performance.now(), x: clamp(position)};
            gesture.current = true;
            setDragging(true);
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onChange={event => { if (!disabled) preview(Number(event.target.value)); }}
          onPointerUp={event => { if (gesture.current) commit(Number(event.currentTarget.value)); }}
          onPointerCancel={cancel}
          onLostPointerCapture={cancel}
          onBlur={cancel}
          onKeyDown={event => {
            if (event.key === 'Enter') { event.preventDefault(); return; }
            if (event.key === 'Escape') { event.preventDefault(); cancel(); return; }
            const delta = ({ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 1, PageDown: -1} as Record<string, number>)[event.key];
            if (delta === undefined && event.key !== 'Home' && event.key !== 'End') return;
            event.preventDefault();
            if (disabled) return;
            const candidates = energyLevels.map((_, i) => i).filter(i => supported[i]);
            const next =
              event.key === 'Home' ? candidates[0]
              : event.key === 'End' ? candidates[candidates.length - 1]
              : delta > 0 ? candidates.find(i => i > index)
              : [...candidates].reverse().find(i => i < index);
            if (next === undefined) { setShake(n => n + 1); return; }
            start.current = Math.round(clamp(value));
            setDirection(next < index ? 'left' : 'right');
            commit(next);
          }}
        />
      </div>
    </div>
  );
}
