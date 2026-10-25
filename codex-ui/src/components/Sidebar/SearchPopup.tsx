import {useCallback, useEffect, useId, useRef, useState} from 'react';
import type {KeyboardEvent as ReactKeyboardEvent} from 'react';
import {Icon} from '../../Icons';
import styles from './SearchPopup.module.css';

type SearchEntry = {
  id: string;
  title: string;
  description: string;
  updatedAt: number;
};

type SearchPopupProps = {
  entries: SearchEntry[];
  active: string;
  busy: boolean;
  onSelect: (id: string) => void;
};

const RECENT_LIMIT = 8;
const POPUP_WIDTH = 392;
const SCREEN_GAP = 12;

function formatDate(timestamp: number) {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return '';
  if(!Number.isFinite(new Date(timestamp).getTime()))return '';
  return new Intl.DateTimeFormat('zh-CN', {month: 'numeric', day: 'numeric'}).format(new Date(timestamp));
}

/** A compact, anchored search palette. The sidebar history remains untouched. */
export function SearchPopup({entries, active, busy, onSelect}: SearchPopupProps) {
  const uid=useId();
  const popupId=uid+'-search-popover',resultsId=uid+'-search-results';
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlighted, setHighlighted] = useState(0);
  const [position, setPosition] = useState({left: SCREEN_GAP, top: 60});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const normalized = query.trim().toLocaleLowerCase();
  const matched = normalized
    ? entries.filter(entry => `${entry.title}\n${entry.description}`.toLocaleLowerCase().includes(normalized))
    : entries.slice(0, RECENT_LIMIT);
  const selectedIndex = matched.length ? Math.min(highlighted, matched.length - 1) : -1;

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const width = Math.min(POPUP_WIDTH, window.innerWidth - SCREEN_GAP * 2);
    const left = Math.max(SCREEN_GAP, Math.min(rect.left - 8, window.innerWidth - width - SCREEN_GAP));
    const top = Math.max(document.documentElement.dataset.stripDesktop==='true'?52:SCREEN_GAP, Math.min(rect.bottom + 9, window.innerHeight - 170));
    setPosition({left, top});
  }, []);

  const openSearch = useCallback(() => {
    setQuery('');
    setHighlighted(0);
    updatePosition();
    setOpen(true);
  }, [updatePosition]);

  const closeSearch = useCallback((restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    function onShortcut(event: KeyboardEvent) {
      if(event.isComposing || event.repeat || event.defaultPrevented)return;
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        if (!open) openSearch();
        else inputRef.current?.focus();
      }
      if (event.key === 'Escape' && open) {
        event.preventDefault();
        closeSearch(true);
      }
    }
    document.addEventListener('keydown', onShortcut);
    return () => document.removeEventListener('keydown', onShortcut);
  }, [open, openSearch, closeSearch]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    function onOutsidePointer(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (!popupRef.current?.contains(target) && !triggerRef.current?.contains(target)) closeSearch();
    }
    document.addEventListener('pointerdown', onOutsidePointer);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      document.removeEventListener('pointerdown', onOutsidePointer);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open, closeSearch, updatePosition]);

  useEffect(() => {
    if (!open || selectedIndex < 0) return;
    const selected = resultsRef.current?.querySelector<HTMLElement>(`[data-search-index="${selectedIndex}"]`);
    selected?.scrollIntoView({block: 'nearest'});
  }, [open, selectedIndex]);

  function select(id: string) {
    if (busy) return;
    closeSearch(true);
    onSelect(id);
  }

  function onInputKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing || event.keyCode===229 || !matched.length) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlighted((selectedIndex + 1) % matched.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlighted((selectedIndex + matched.length - 1) % matched.length);
    } else if (event.key === 'Enter' && !busy) {
      event.preventDefault();
      const result = matched[selectedIndex];
      if (result) select(result.id);
    }
  }

  return <div className={styles.root} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node|null))closeSearch();}}>
    <button
      ref={triggerRef}
      type="button"
      className={styles.trigger+' strip-tool-btn'}
      title="搜索聊天记录 (Ctrl+K)"
      aria-keyshortcuts="Control+K Meta+K"
      aria-label="搜索聊天记录"
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-controls={open ? popupId : undefined}
      onClick={() => open ? closeSearch(true) : openSearch()}
    >
      <Icon name="search" />
    </button>
    {open && <div
      id={popupId}
      ref={popupRef}
      className={styles.popover}
      style={{...position,maxHeight:Math.max(100,window.innerHeight-position.top-SCREEN_GAP)}}
      role="dialog"
      aria-label="搜索聊天记录"
    >
      <div className={styles.searchField}>
        <Icon name="search" />
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          className={styles.input}
          value={query}
          placeholder="搜索聊天记录…"
          aria-label="输入聊天记录关键词"
          aria-controls={resultsId}
          aria-activedescendant={selectedIndex >= 0 ? `${uid}-result-${selectedIndex}` : undefined}
          autoComplete="off"
          onChange={event => {setQuery(event.target.value); setHighlighted(0);}}
          onKeyDown={onInputKeyDown}
        />
        {!!query && <button type="button" className={styles.clear} aria-label="清空搜索" onClick={() => {setQuery(''); setHighlighted(0); inputRef.current?.focus();}}><Icon name="x" /></button>}
        <kbd className={styles.escapeHint}>Esc</kbd>
      </div>
      <div className={styles.caption}>
        <span>{normalized ? '搜索结果' : '最近会话'}</span>
        <span>{normalized ? `${matched.length} 条匹配` : `${matched.length} 条`}</span>
      </div>
      <div id={resultsId} ref={resultsRef} className={styles.results} role="listbox" aria-label="会话搜索结果">
        {matched.map((entry, index) => <button
          key={entry.id}
          id={`${uid}-result-${index}`}
          data-search-index={index}
          type="button"
          role="option"
          tabIndex={-1}
          aria-selected={selectedIndex === index}
          className={styles.result + (selectedIndex === index ? ' ' + styles.highlighted : '')}
          disabled={busy}
          onMouseEnter={() => setHighlighted(index)}
          onClick={() => select(entry.id)}
        >
          <span className={styles.resultIcon}><Icon name="chat-soft" /></span>
          <span className={styles.resultText}>
            <span className={styles.title}>{entry.title || '未命名会话'}</span>
            <span className={styles.description}>{entry.description || '聊天记录'}</span>
          </span>
          {entry.id === active ? <span className={styles.current}>当前</span> : <span className={styles.date}>{formatDate(entry.updatedAt)}</span>}
        </button>)}
        {!matched.length && <div className={styles.empty} role="status">
          <Icon name="search" />
          <span>{normalized ? '没有找到匹配的聊天记录' : '暂无聊天记录'}</span>
          {normalized && <small>试试其他关键词</small>}
        </div>}
      </div>
      <div className={styles.footer}>
        <span><kbd>↑</kbd><kbd>↓</kbd> 选择</span>
        <span><kbd>↵</kbd> 打开</span>
        <span><kbd>Esc</kbd> 关闭</span>
      </div>
    </div>}
  </div>;
}
