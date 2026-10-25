import type {ButtonHTMLAttributes,ReactNode} from 'react';

export type StripButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type StripButtonSize = 'sm' | 'md' | 'lg';

export type StripButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: StripButtonVariant;
  size?: StripButtonSize;
  loading?: boolean;
  children: ReactNode;
};

/** Shared action button. Existing onClick/disabled handlers pass through unchanged. */
export function StripButton({
  variant='secondary',size='md',loading=false,disabled=false,
  className='',children,type='button',...rest
}:StripButtonProps){
  return <button
    {...rest}
    type={type}
    disabled={disabled || loading}
    aria-busy={loading || undefined}
    className={['strip-action-control',`strip-action-control--${variant}`,`strip-action-control--${size}`,className].filter(Boolean).join(' ')}
  >{children}</button>;
}
