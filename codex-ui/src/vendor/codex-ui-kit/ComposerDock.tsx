// From JaminZhou/codex-ui-kit (MIT, 2026); see LICENSE. Adapted imports/types for StripBot.
import type {HTMLAttributes,ReactNode} from 'react';
export interface ComposerDockProps extends Omit<HTMLAttributes<HTMLDivElement>,"children"> {
  composer:ReactNode;
  context?:ReactNode;
  label?:string;
  queue?:ReactNode;
}
export function ComposerDock({className,composer,context,label="Composer dock",queue,...props}:ComposerDockProps){
  return <div {...props} role="group" aria-label={label}
    className={["codex-ui-composer-dock",className].filter(Boolean).join(" ")}
    data-has-context={context!=null||undefined} data-has-queue={queue!=null||undefined}>
    {context!=null&&<div className="codex-ui-composer-dock__context">{context}</div>}
    {queue!=null&&<div className="codex-ui-composer-dock__queue">{queue}</div>}
    <div className="codex-ui-composer-dock__surface">{composer}</div>
  </div>;
}
