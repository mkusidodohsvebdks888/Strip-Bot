import {forwardRef} from 'react';
import type {ButtonHTMLAttributes,ReactNode} from 'react';
import {Icon} from '../../Icons';
import {IconButton as CodexKitIconButton} from '../../vendor/codex-ui-kit/Button';

export type StripIconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?:string;
  label:string;
  active?:boolean;
  children?:ReactNode;
};

/** Codex UI Kit icon control preserving ref, keyboard support and existing handlers. */
export const StripIconButton=forwardRef<HTMLButtonElement,StripIconButtonProps>(
  function StripIconButton({icon,label,active=false,children,className='',title,type='button',...props},ref){
    return <CodexKitIconButton
      {...props}
      ref={ref}
      type={type}
      label={label}
      icon={children??(icon?<Icon name={icon}/>:null)}
      pressed={active}
      tone="ghost"
      className={['strip-icon-control',className,active?'is-active':''].filter(Boolean).join(' ')}
      title={title??label}
    />;
  }
);
