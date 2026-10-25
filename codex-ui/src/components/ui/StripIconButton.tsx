import type {ButtonHTMLAttributes,ReactNode} from 'react';
import {Icon} from '../../Icons';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: string;
  label: string;
  active?: boolean;
  children?: ReactNode;
};

/** Shared accessible icon control. No slider or speed-control behavior is changed. */
export function StripIconButton({icon,label,active=false,children,className='',title,...props}:Props){
  return <button
    type="button"
    {...props}
    className={['strip-icon-control',className,active?'is-active':''].filter(Boolean).join(' ')}
    aria-label={label}
    title={title ?? label}
  >{children ?? (icon ? <Icon name={icon}/> : null)}</button>;
}
