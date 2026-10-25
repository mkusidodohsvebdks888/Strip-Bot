import type { CSSProperties, ReactNode } from 'react';

/**
 * Shared, monochrome 24px stroke icon vocabulary for interactive controls.
 * Icons inherit currentColor; their rendered size is set by the button, not by a font.
 */
export type ControlIconName =
  | 'down' | 'right' | 'left' | 'up' | 'close' | 'bolt' | 'star' | 'check' | 'search'
  | 'plus' | 'mic' | 'file' | 'laptop' | 'shield' | 'stop' | 'eye' | 'eye-off';

const shapes: Record<ControlIconName, ReactNode> = {
  down: <path d="m6 9 6 6 6-6" />,
  right: <path d="m9 6 6 6-6 6" />,
  left: <path d="m15 6-6 6 6 6" />,
  up: <><path d="M12 19V5" /><path d="m5 12 7-7 7 7" /></>,
  close: <path d="M18 6 6 18M6 6l12 12" />,
  bolt: <path d="m13 3-8 11h6l-1 7 9-12h-6l1-6" />,
  star: <path d="m12 3 2.8 5.7 6.3.9-4.6 4.4 1.1 6.3-5.6-3-5.6 3 1.1-6.3L2.9 9.6l6.3-.9L12 3Z" />,
  check: <path d="m5 12 4 4L19 6" />,
  search: <><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  mic: <><rect x="9" y="2.5" width="6" height="12" rx="3" /><path d="M5.5 10.5a6.5 6.5 0 0 0 13 0M12 17v4m-4 0h8" /></>,
  file: <><path d="M13 2.5H6a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9.5z" /><path d="M13 2.5v7h7" /></>,
  laptop: <><rect x="4" y="3" width="16" height="13" rx="2" /><path d="M2 20h20" /></>,
  shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" /></>,
  stop: <rect x="7" y="7" width="10" height="10" rx="2" />,
  eye: <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
  'eye-off': <><path d="M10.6 5.2A11 11 0 0 1 12 5c6.4 0 10 7 10 7a15 15 0 0 1-3.1 3.7M6.2 6.2C3.5 8.2 2 12 2 12s3.6 7 10 7a9.9 9.9 0 0 0 4.2-.9" /><path d="m3 3 18 18" /><path d="M10 10a3 3 0 0 0 4 4" /></>,
};

export function ControlIcon({name, size = 16, className = '', style}: {
  name: ControlIconName;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return <svg
    className={'strip-control-icon' + (className ? ' ' + className : '')}
    style={style}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >{shapes[name]}</svg>;
}
