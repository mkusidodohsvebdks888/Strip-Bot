import empty from './EmptyState.module.css';
import {NonoWelcome} from '../Brand/NonoWelcome';
import type {NonoInputActivity} from '../Brand/NonoWelcome';

/** Compact home welcome: logo, title and subtitle only. */
export function HomeWelcome({inputActivity}:{inputActivity:NonoInputActivity}) {
  return (
    <div className={`${empty.root} strip-claude-empty strip-home-enter`}>
      <NonoWelcome activity={inputActivity}/>
      <h1 className={`${empty.heading} strip-claude-empty-heading strip-home-heading`}>
        今天想做点<em>什么</em>？
      </h1>
      <p className={`${empty.subtext} strip-claude-empty-subtext strip-home-subtext`}>
        灵感、问题或一个正在进行的项目，都可以从这里开始。
      </p>
    </div>
  );
}

export default HomeWelcome;
