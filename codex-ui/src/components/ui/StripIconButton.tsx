import {forwardRef} from 'react';
import type {ButtonHTMLAttributes,ReactNode} from 'react';
import {Icon} from '../../Icons';

export type StripIconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: string;
  label: string;
  active?: boolean;
  children?: ReactNode;
};

/** Accessible shared icon control with DOM ref support for popovers and focus. */
export const StripIconButton = forwardRef<HTMLButtonElement,StripIconButtonProps>(
  function StripIconButton({icon,label,active=false,children,className='',title,type='button',...props},ref){
    return <button
      {...props}
      ref={ref}
      type={type}
      className={['strip-icon-control',className,active?'is-active':''].filter(Boolean).join(' ')}
      aria-label={label}
      title={title ?? label}
    >{children ?? (icon ? <Icon name={icon}/> : null)}</button>;
  }
);
