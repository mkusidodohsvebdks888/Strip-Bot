import {useMemo, useState} from 'react';
import type {KeyboardEvent} from 'react';
import {Icon} from '../../Icons';

export type QuestionOption = {value: string; label: string; description?: string; recommended?: boolean};
export type QuestionSpec = {
  id: string;
  title: string;
  description?: string;
  options: QuestionOption[];
  multiple?: boolean;
  /** Allow an "other" custom answer. */
  allowCustom?: boolean;
  /** Label for the custom choice; defaults to "其他". */
  customLabel?: string;
};
export type QuestionAnswer = {questionId: string; values: string[]; custom?: string};

type Props = {
  heading?: string;
  questions: QuestionSpec[];
  onSubmit: (answers: QuestionAnswer[]) => void | Promise<void>;
  onChange?: (answers: QuestionAnswer[]) => void;
  onCancel?: () => void;
  submitLabel?: string;
  defaultAnswers?: QuestionAnswer[];
};

const CUSTOM = '__custom__';

/** Claude Code / Codex-style question card with card options instead of native selects. */
export function QuestionCard({
  heading = '需要你确认',
  questions,
  onSubmit,
  onChange,
  onCancel,
  submitLabel = '提交答复',
  defaultAnswers = [],
}: Props) {
  const defaults = useMemo(() => new Map(defaultAnswers.map(answer => [answer.questionId, answer])), [defaultAnswers]);
  const [picked, setPicked] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(questions.map(question => {
      const answer = defaults.get(question.id);
      return [question.id, [...(answer?.values ?? []), ...(answer?.custom ? [CUSTOM] : [])]];
    })),
  );
  const [custom, setCustom] = useState<Record<string, string>>(() =>
    Object.fromEntries(questions.map(question => [question.id, defaults.get(question.id)?.custom ?? ''])),
  );
  const [busy, setBusy] = useState(false);

  const answered = useMemo(
    () => questions.filter(question => (picked[question.id]?.length ?? 0) > 0 && (!picked[question.id]?.includes(CUSTOM) || Boolean(custom[question.id]?.trim()))).length,
    [custom, picked, questions],
  );
  const complete = answered === questions.length;
  const instant = questions.length === 1 && !questions[0].multiple && !questions[0].allowCustom;

  const buildAnswers = (state = picked, customState = custom): QuestionAnswer[] =>
    questions.map(question => ({
      questionId: question.id,
      values: (state[question.id] ?? []).filter(value => value !== CUSTOM),
      custom: state[question.id]?.includes(CUSTOM) ? customState[question.id]?.trim() || undefined : undefined,
    }));

  const submit = async (state = picked) => {
    if (busy) return;
    setBusy(true);
    try {
      await onSubmit(buildAnswers(state));
    } finally {
      setBusy(false);
    }
  };

  const choose = (question: QuestionSpec, value: string) => {
    const current = picked[question.id] ?? [];
    const next = question.multiple
      ? current.includes(value) ? current.filter(item => item !== value) : [...current, value]
      : [value];
    const state = {...picked, [question.id]: next};
    setPicked(state);
    onChange?.(buildAnswers(state));
    if (instant) void submit(state);
  };

  const updateCustom = (question: QuestionSpec, value: string) => {
    const next = {...custom, [question.id]: value};
    setCustom(next);
    onChange?.(buildAnswers(picked, next));
  };

  const onKey = (question: QuestionSpec) => (event: KeyboardEvent<HTMLDivElement>) => {
    const number = Number(event.key);
    const total = question.options.length + (question.allowCustom ? 1 : 0);
    if (number >= 1 && number <= total && !event.ctrlKey && !event.metaKey && !(event.target as HTMLElement).matches('textarea')) {
      event.preventDefault();
      choose(question, number <= question.options.length ? question.options[number - 1].value : CUSTOM);
    }
  };

  return <section className="strip-q" aria-label={heading}>
    <header className="strip-q__head">
      <span className="strip-q__icon"><Icon name="circle-help" /></span>
      <h3 className="strip-q__heading">{heading}</h3>
      {questions.length > 1 ? <span className="strip-q__progress">{answered} / {questions.length}</span> : null}
    </header>

    <ol className="strip-q__list">
      {questions.map((question, questionIndex) => {
        const current = picked[question.id] ?? [];
        return <li key={question.id} className={`strip-q__item${current.length ? ' is-answered' : ''}`}>
          <div className="strip-q__title">
            {questions.length > 1 ? <span className="strip-q__num">{questionIndex + 1}</span> : null}
            <span>{question.title}</span>
          </div>
          {question.description ? <p className="strip-q__desc">{question.description}</p> : null}
          <div className="strip-q__options" role={question.multiple ? 'group' : 'radiogroup'} onKeyDown={onKey(question)}>
            {question.options.map((option, optionIndex) => {
              const active = current.includes(option.value);
              return <button key={option.value} type="button" role={question.multiple ? 'checkbox' : 'radio'} aria-checked={active}
                className={`strip-q__opt${active ? ' is-active' : ''}${option.recommended ? ' is-recommended' : ''}`}
                disabled={busy} onClick={() => choose(question, option.value)}>
                <span className="strip-q__key" aria-hidden="true">{optionIndex + 1}</span>
                <span className="strip-q__text">
                  <span className="strip-q__label">{option.label}{option.recommended ? <em className="strip-q__rec">推荐</em> : null}</span>
                  {option.description ? <span className="strip-q__sub">{option.description}</span> : null}
                </span>
                <span className="strip-q__mark" aria-hidden="true"><Icon name={active ? 'check' : question.multiple ? 'plus' : 'arrow-right'} /></span>
              </button>;
            })}
            {question.allowCustom ? <div className={`strip-q__opt strip-q__opt--custom${current.includes(CUSTOM) ? ' is-active' : ''}`}>
              <button type="button" className="strip-q__custom-toggle" role={question.multiple ? 'checkbox' : 'radio'} aria-checked={current.includes(CUSTOM)}
                disabled={busy} onClick={() => choose(question, CUSTOM)}>
                <span className="strip-q__key" aria-hidden="true">{question.options.length + 1}</span>
                <span className="strip-q__label">{question.customLabel || '其他'}</span>
              </button>
              {current.includes(CUSTOM) ? <textarea className="strip-q__custom" rows={2} placeholder="输入你的要求…" value={custom[question.id] ?? ''} autoFocus
                onChange={event => updateCustom(question, event.target.value)} /> : null}
            </div> : null}
          </div>
        </li>;
      })}
    </ol>

    {!instant ? <footer className="strip-q__foot">
      <span className="strip-q__hint">数字键快速选择 · Tab 切换问题</span>
      {onCancel ? <button type="button" className="strip-q__btn" onClick={onCancel} disabled={busy}>跳过</button> : null}
      <button type="button" className="strip-q__btn strip-q__btn--primary" disabled={!complete || busy} onClick={() => void submit()}>
        {busy ? '提交中…' : submitLabel}
      </button>
    </footer> : null}
  </section>;
}
