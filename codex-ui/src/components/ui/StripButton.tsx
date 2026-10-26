import type {ButtonHTMLAttributes,ReactNode} from 'react';
import {Button as CodexKitButton} from '../../vendor/codex-ui-kit/Button';

export type StripButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type StripButtonSize = 'sm' | 'md' | 'lg';
export type StripButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?:StripButtonVariant;
  size?:StripButtonSize;
  loading?:boolean;
  children:ReactNode;
};
/**
 * StripBot button adapter using the MIT Codex UI Kit Button.
 * Legacy class names remain so feature-specific CSS and handlers continue working.
 */
export function StripButton({variant='secondary',size='md',loading=false,disabled=false,
  className='',children,type='button',...rest}:StripButtonProps){
  return <CodexKitButton
    {...rest}
    type={type}
    disabled={disabled}
    loading={loading}
    size={size==='sm'?'small':size==='lg'?'large':'medium'}
    tone={variant}
    className={['strip-action-control',`strip-action-control--${variant}`,`strip-action-control--${size}`,className].filter(Boolean).join(' ')}
  >{children}</CodexKitButton>;
}
