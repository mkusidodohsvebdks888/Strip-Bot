/* Strip Activity Feed v2. Zero dependencies; no Shadow DOM; safe text rendering.
   Public API: setEvents, appendEvent, patchEvent, setStatus, setDensity,
   setFilter, expandAll, collapseAll. Host events: strip:approval, strip:retry. */
(() => {
  'use strict';
  if (customElements.get('strip-activity-feed')) return;

  const ICONS = {
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    activity: '<path d="M3 12h3l3-7 5 14 3-7h4"/>',
    bulb: '<path d="M9 18h6M10 22h4M8.5 14.5A6 6 0 1 1 15.5 14.5c-.9.8-1.5 1.6-1.5 3h-4c0-1.4-.6-2.2-1.5-3Z"/>',
    search: '<circle cx="10.8" cy="10.8" r="6.6"/><path d="m16 16 4.5 4.5"/>',
    terminal: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="m7 9 3 3-3 3M13 16h4"/>',
    file: '<path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z"/><path d="M13 2v7h7M8 14h8M8 18h6"/>',
    edit: '<path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L9 17l-4 1 1-4Z"/>',
    test: '<path d="m5 12 4 4L19 6"/><circle cx="12" cy="12" r="9"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="M12 8v4M12 16h.01"/>',
    alert: '<path d="m10.3 3.9-8.1 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3.1l-8.1-14a2 2 0 0 0-3.3 0Z"/><path d="M12 9v4M12 17h.01"/>',
    xcircle: '<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6m0-6-6 6"/>',
    layers: '<path d="m12 2-9 5 9 5 9-5-9-5ZM3 12l9 5 9-5M3 17l9 5 9-5"/>',
    chevron: '<path d="m6 9 6 6 6-6"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10H3Z"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    dots: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    gauge: '<path d="M12 14l4-4"/><path d="M3.3 17a10 10 0 1 1 17.4 0"/><path d="M12 4v2M4.5 10l1.8 1M19.5 10l-1.8 1"/>',
    bars: '<path d="M4 20v-5M9 20V9M14 20v-8M19 20V4"/>'
  };
  const TYPE_ICONS = { thinking:'bulb', search:'search', read:'file', command:'terminal', edit:'edit', test:'test', approval:'shield', error:'xcircle', warning:'alert', summary:'check', plan:'list' };
  const FILTERS = [['all','全部'],['ops','执行过程'],['files','文件修改'],['alerts','提醒与异常']];
  const STATUS_TEXT = { running:'执行中', success:'已完成', error:'执行异常', pending:'等待确认', idle:'本轮已结束' };
  const ICON_NS = 'http://www.w3.org/2000/svg';
  const METRIC_SOURCES = {demo:'演示数据 · 非真实调用',estimated:'客户端估算',measured:'流式观测',server:'API 用量 · 流式计时',hybrid:'API 用量 · 速率估算',external:'外部数据',observed:'事件流观测 · Token 估算',engine:'引擎用量 · 可见输出速率估算',usage:'引擎用量 · 无实时计时',partial:'事件流中断 · 速率不可用',pending:'等待模型事件'};
  const METRIC_STATES = {running:'生成中',success:'已完成',error:'生成失败',idle:'未开始'};
  const isNumber = v => typeof v === 'number' && Number.isFinite(v) && v >= 0;
  const metricNum = v => isNumber(v) ? v : null;
  const formatCount = v => v == null ? '—' : new Intl.NumberFormat('zh-CN',{maximumFractionDigits:0}).format(Math.round(v));
  const formatSeconds = v => v == null ? '—' : (v < 1000 ? (v / 1000).toFixed(2) : (v / 1000).toFixed(1)) + ' s';
  // UI-only fallback: estimates Chinese characters near 1 unit and other text near 4 chars/unit.
  // Use token counts from the backend, and final usage, whenever those are available.
  function estimateTokens(text) {
    const han = (String(text).match(/[\u3400-\u9FFF\uF900-\uFAFF]/g) || []).length;
    return han + Math.max(0, (String(text).length - han)) / 4;
  }

  function el(tag, cls, value) {
    const x = document.createElement(tag);
    if (cls) x.className = cls;
    if (value !== undefined && value !== null) x.textContent = String(value);
    return x;
  }
  function svg(name, cls) {
    const s = document.createElementNS(ICON_NS, 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('aria-hidden', 'true');
    s.innerHTML = ICONS[name] || ICONS.dots; // internal, static SVG definitions only
    if (cls) s.setAttribute('class', cls);
    return s;
  }
  function btn(cls, label, action, id) {
    const x = el('button', cls, label);
    x.type = 'button';
    if (action) x.dataset.action = action;
    if (id !== undefined) x.dataset.id = String(id);
    return x;
  }
  function stat(kind, value) {
    const x = el('span', 'strip-activity__inline-stat', value);
    x.dataset.kind = kind;
    return x;
  }
  function safeStatus(status) { return ['running','success','error','pending','idle'].includes(status) ? status : 'idle'; }
  function safeType(type) { return Object.prototype.hasOwnProperty.call(TYPE_ICONS, type) ? type : 'thinking'; }
  function normalize(e, i) {
    return { ...e, id:String(e.id ?? `event-${i}`), type:safeType(e.type), status:safeStatus(e.status || 'success'), detail:e.detail || null };
  }

  class StripActivityFeed extends HTMLElement {
    constructor() {
      super();
      this._events = [];
      this._opened = new Set();
      this._filter = 'all';
      this._status = 'running';
      this._duration = '';
      this._density = 'comfortable';
      this._title = '处理过程';
      this._listener = (event) => this._onClick(event);
      this._modelMetrics = null;
      this._modelRun = null;
      this._meterTimer = null;
    }
    connectedCallback() {
      if (!this._connected) {
        this._connected = true;
        this.addEventListener('click', this._listener);
      }
      if (this.hasAttribute('title')) this._title = this.getAttribute('title') || this._title;
      if (this.hasAttribute('state')) this._status = safeStatus(this.getAttribute('state'));
      if (this.hasAttribute('density')) this._density = this.getAttribute('density') === 'compact' ? 'compact' : 'comfortable';
      this.render();
      if (this._modelRun) this._startMeterClock();
    }
    disconnectedCallback() {
      this.removeEventListener('click', this._listener);
      this._connected = false;
      this._stopMeterClock();
    }
    setEvents(events) {
      if (!Array.isArray(events)) throw new TypeError('setEvents expects an array');
      const previous=new Set(this._events.map(e=>e.id));
      this._events = events.map(normalize);
      this._opened = new Set(this._events.filter(e=>this._opened.has(e.id) || (!previous.has(e.id) && e.defaultOpen)).map(e=>e.id));
      this.render();
    }
    appendEvent(event) {
      const e = normalize(event, this._events.length);
      const at = this._events.findIndex(item=>item.id === e.id);
      if (at >= 0) this._events[at] = e;
      else this._events.push(e);
      if (e.defaultOpen) this._opened.add(e.id);
      this.render();
    }
    patchEvent(id, partial) {
      const at = this._events.findIndex(e=>e.id === String(id));
      if (at < 0) return false;
      this._events[at] = normalize({...this._events[at], ...partial, id:String(id)}, at);
      this.render();
      return true;
    }
    getEvents() { return this._events.map(e=>({...e})); }
    setStatus(status, duration) {
      this._status = safeStatus(status);
      if (duration !== undefined) this._duration = String(duration);
      this.render();
    }
    setDensity(density) { this._density = density === 'compact' ? 'compact' : 'comfortable'; this.render(); }
    setFilter(filter) { if (FILTERS.some(f=>f[0]===filter)) { this._filter = filter; this.render(); } }
    expandAll() { this._opened = new Set(this._events.filter(e=>e.detail).map(e=>e.id)); this.render(); }
    collapseAll() { this._opened.clear(); this.render(); }
    setTitle(title) { this._title = String(title); this.render(); }


    // Option A: set already-computed metrics from an app/backend. No numbers are invented.
    setModelMetrics(metrics) {
      this._stopMeterClock();
      this._modelRun = null;
      if (metrics == null) {
        if (!this._modelMetrics) return;
        this._modelMetrics = null;
        this.render();
        return;
      }
      if (typeof metrics !== 'object') throw new TypeError('setModelMetrics expects an object or null');
      const history = Array.isArray(metrics.history) ? metrics.history.filter(isNumber).slice(-28) : [];
      this._modelMetrics = {
        model: String(metrics.model || '未命名模型'),
        provider: String(metrics.provider || ''),
        status: ['running','success','error','idle'].includes(metrics.status) ? metrics.status : 'idle',
        source: Object.hasOwn(METRIC_SOURCES,metrics.source) ? metrics.source : 'external',
        tokensPerSecond: metricNum(metrics.tokensPerSecond),
        ttftMs: metricNum(metrics.ttftMs),
        outputTokens: metricNum(metrics.outputTokens),
        inputTokens: metricNum(metrics.inputTokens),
        elapsedMs: metricNum(metrics.elapsedMs),
        history
      };
      if (this.querySelector('.strip-activity__meter')) this._updateMeter();
      else this.render();
    }
    clearModelMetrics() { this.setModelMetrics(null); }
    getModelMetrics() {
      return this._modelMetrics ? {...this._modelMetrics, history:[...this._modelMetrics.history]} : null;
    }
    // Option B: track live streaming output. Clock uses monotonic performance.now().
    beginModelResponse(meta = {}) {
      const now = performance.now();
      const demo = meta.source === 'demo';
      this._stopMeterClock();
      this._modelRun = {
        startedAt: now, firstAt: null, lastAt: null, amount: 0,
        estimated: false, samples: [], source: demo ? 'demo' : 'measured',
        model: String(meta.model || '未命名模型'),
        provider: String(meta.provider || ''),
        inputTokens: metricNum(meta.inputTokens)
      };
      this._modelMetrics = {
        model: this._modelRun.model, provider: this._modelRun.provider,
        status:'running', source:demo?'demo':'measured',
        tokensPerSecond:null, ttftMs:null, outputTokens:0,
        inputTokens:this._modelRun.inputTokens, elapsedMs:0, history:[]
      };
      this.render();
      if (this.isConnected) this._startMeterClock();
    }
    ingestModelChunk(chunk, options = {}) {
      const run = this._modelRun;
      if (!run) return false;
      const data = chunk && typeof chunk === 'object' ? chunk : {text:chunk};
      const text = String(data.text ?? '');
      const delta = data.outputTokensDelta ?? data.tokens ?? options.outputTokensDelta;
      const exact = isNumber(delta);
      if ((!exact && !text) || (exact && delta === 0 && !text)) return false;
      const amount = exact ? delta : estimateTokens(text);
      const now = performance.now();
      if (run.firstAt === null) run.firstAt = now;
      run.lastAt = now;
      run.amount += amount;
      run.estimated ||= !exact;
      run.samples.push({at:now, amount});
      if (run.samples.length > 512) run.samples.splice(0,run.samples.length-512);
      this._syncMeterFromRun(now);
      return true;
    }
    finishModelResponse(result = {}) {
      const run = this._modelRun;
      if (!run) return false;
      const now = performance.now();
      const usage = result.usage && typeof result.usage === 'object' ? result.usage : {};
      const apiOutput = metricNum(result.outputTokens ?? usage.output_tokens ?? usage.completion_tokens);
      const apiInput = metricNum(result.inputTokens ?? usage.input_tokens ?? usage.prompt_tokens);
      const amount = apiOutput ?? run.amount;
      const generatingMs = run.firstAt === null ? null : Math.max(0, now - run.firstAt);
      const elapsedMs = metricNum(result.elapsedMs) ?? now - run.startedAt;
      const ttftMs = metricNum(result.ttftMs) ?? (run.firstAt === null ? null : run.firstAt - run.startedAt);
      const explicitRate = metricNum(result.tokensPerSecond);
      // No streaming samples -> no way to infer generation-only time from total latency.
      // Use observed streamed chunks for throughput; final API output_tokens may include unstreamed reasoning tokens.
      const speed = explicitRate ?? (generatingMs && generatingMs >= 350 && run.amount > 0 ? run.amount / (generatingMs / 1000) : null);
      this._modelMetrics = {
        model:run.model, provider:run.provider,
        status:result.status === 'error' ? 'error' : 'success',
        source:run.source === 'demo' ? 'demo' : apiOutput !== null ? (run.estimated ? 'hybrid' : 'server') : run.estimated ? 'estimated' : 'measured',
        tokensPerSecond:speed, ttftMs, outputTokens:amount,
        inputTokens:apiInput ?? run.inputTokens, elapsedMs,
        history:this._makeHistory(run.samples,now)
      };
      this._modelRun = null;
      this._stopMeterClock();
      this._updateMeter();
      return true;
    }
    _startMeterClock() {
      if (this._meterTimer || !this._modelRun) return;
      this._meterTimer = setInterval(() => {
        if (this._modelRun && this.isConnected && !document.hidden) this._syncMeterFromRun(performance.now());
      },250);
    }
    _stopMeterClock() {
      if (this._meterTimer) clearInterval(this._meterTimer);
      this._meterTimer = null;
    }
    _makeHistory(samples,now) {
      const bars = new Array(24).fill(0);
      const span = 6000; // 24 bars over the last 6 seconds.
      for (const item of samples) {
        const diff = now - item.at;
        if (diff < 0 || diff >= span) continue;
        const i = Math.min(bars.length-1, Math.floor((span-diff)/span*bars.length));
        bars[i] += item.amount;
      }
      return bars;
    }
    _syncMeterFromRun(now) {
      const run=this._modelRun;
      if (!run) return;
      const generatingMs = run.firstAt === null ? null : now - run.firstAt;
      // Cumulative average after first output. Minimum window prevents initial burst spikes.
      const speed = generatingMs !== null && generatingMs >= 350 ? run.amount / (generatingMs/1000) : null;
      this._modelMetrics = {
        model:run.model, provider:run.provider, status:'running',
        source:run.source==='demo' ? 'demo' : run.estimated ? 'estimated' : 'measured',
        tokensPerSecond:speed,
        ttftMs:run.firstAt===null?null:run.firstAt-run.startedAt,
        outputTokens:run.amount, inputTokens:run.inputTokens,
        elapsedMs:now-run.startedAt, history:this._makeHistory(run.samples,now)
      };
      this._updateMeter();
    }
    _modelPanel() {
      const meter=el('section','strip-activity__meter');
      meter.setAttribute('aria-label','模型生成速率');
      const top=el('div','strip-activity__meter-top');
      const ident=el('div','strip-activity__meter-ident');
      ident.append(svg('gauge'),el('span','strip-activity__meter-kicker','模型性能'));
      const model=el('span','strip-activity__meter-model');model.dataset.metric='model';
      ident.append(model);
      const flag=el('div','strip-activity__meter-flags');
      const active=el('span','strip-activity__meter-state');active.dataset.metric='state';
      const source=el('span','strip-activity__meter-source');source.dataset.metric='source';
      flag.append(active,source);
      const close=el('button','strip-metrics-close');close.append(svg('close'));
      close.type='button';close.setAttribute('aria-label','关闭模型性能');close.title='关闭模型性能';
      close.addEventListener('click',()=>this.dispatchEvent(new CustomEvent('strip:close-metrics',{bubbles:true})));
      flag.append(close);
      top.append(ident,flag);meter.append(top);
      const grid=el('div','strip-activity__meter-grid');
      const speed=el('div','strip-activity__meter-speed');
      const value=el('div','strip-activity__meter-reading');
      const num=el('strong','strip-activity__meter-number');num.dataset.metric='speed';
      value.append(num,el('span','strip-activity__meter-unit','tok/s'));
      speed.append(value,el('span','strip-activity__meter-hint','可见输出平均速率（估算）'));
      grid.append(speed);
      [['ttft','首输出延迟 TTFT'],['output','输出 Token'],['elapsed','请求耗时']].forEach(([key,label])=>{
        const tile=el('div','strip-activity__meter-stat');
        tile.append(el('span','strip-activity__meter-key',label));
        const result=el('b','strip-activity__meter-data');result.dataset.metric=key;
        tile.append(result);grid.append(tile);
      });
      meter.append(grid);
      const bottom=el('div','strip-activity__meter-bottom');
      const trend=el('div','strip-activity__meter-trend');
      trend.append(svg('bars'),el('span','','最近 6 秒输出变化'));
      const bars=el('div','strip-activity__meter-bars');
      bars.dataset.metric='bars';bars.setAttribute('aria-hidden','true');
      trend.append(bars);bottom.append(trend);
      const input=el('span','strip-activity__meter-input');input.dataset.metric='input';
      bottom.append(input);meter.append(bottom);
      return meter;
    }
    _updateMeter() {
      if (!this.isConnected || !this._modelMetrics) return;
      const meter=this.querySelector('.strip-activity__meter');
      if (!meter) return;
      const m=this._modelMetrics;
      const set=(key,content)=>{ const target=meter.querySelector(`[data-metric="${key}"]`); if(target) target.textContent=content; };
      set('model',m.provider ? `${m.model} · ${m.provider}` : m.model);
      set('state',METRIC_STATES[m.status] || '未开始');
      const state=meter.querySelector('[data-metric="state"]'); if(state) state.dataset.status=m.status;
      set('source',METRIC_SOURCES[m.source] || METRIC_SOURCES.external);
      set('speed',m.tokensPerSecond==null?'—':m.tokensPerSecond.toFixed(1));
      set('ttft',formatSeconds(m.ttftMs));
      set('output',(m.source==='observed' && m.outputTokens!=null?'≈ ':'')+formatCount(m.outputTokens));
      set('elapsed',formatSeconds(m.elapsedMs));
      set('input',m.inputTokens==null?'输入 Token —':`输入 ${formatCount(m.inputTokens)} tokens（含缓存）`);
      const bars=meter.querySelector('[data-metric="bars"]');
      if (bars) {
        const vals=m.history || [], max=Math.max(...vals,1);
        const nodes=new Array(24).fill(0).map((_,i)=>{
          const value=vals[vals.length-24+i] || 0;
          const bar=el('i');bar.style.height=`${Math.max(3,Math.round((value/max)*23))}px`;
          if (value>0) bar.dataset.active='true';
          return bar;
        });
        bars.replaceChildren(...nodes);
      }
    }
    _shown() {
      return this._events.filter(e => this._filter === 'all' ||
        (this._filter === 'ops' && ['thinking','search','read','command','test','plan'].includes(e.type)) ||
        (this._filter === 'files' && e.type === 'edit') ||
        (this._filter === 'alerts' && ['approval','warning','error'].includes(e.type)));
    }
    render() {
      if (!this.isConnected) return;
      const root = el('div', `strip-activity${this._density === 'compact' ? ' strip-activity--compact' : ''}`);
      if (this.hasAttribute('data-theme')) root.dataset.theme = this.getAttribute('data-theme');
      const header = el('header', 'strip-activity__top');
      const left = el('div', 'strip-activity__headline');
      left.append(el('strong', '', this._title));
      const state = el('span', 'strip-activity__runstate');
      state.dataset.status = this._status;
      state.append(el('span','strip-activity__pulse'), document.createTextNode(STATUS_TEXT[this._status]));
      left.append(state);
      const actions = el('div', 'strip-activity__top-actions');
      if (this._duration) actions.append(el('span','strip-activity__meta',this._duration));
      const expand = btn('strip-activity__utility', '', 'expand-all');
      expand.append(svg('layers'),document.createTextNode(' 展开全部'));
      const collapse = btn('strip-activity__utility', '收起全部', 'collapse-all');
      actions.append(expand,collapse);
      header.append(left,actions);
      root.append(header);
      if (this._modelMetrics) root.append(this._modelPanel());
      const filters = el('nav','strip-activity__filters');
      filters.setAttribute('aria-label','活动类型筛选');
      FILTERS.forEach(([name,label])=>{
        const filter = btn('strip-activity__filter',label,'filter');
        filter.dataset.filter = name;
        filter.setAttribute('aria-pressed',String(this._filter===name));
        filters.append(filter);
      });
      root.append(filters);
      const shown = this._shown();
      const list = el('section','strip-activity__list');
      list.setAttribute('aria-label','执行事件');
      if (!shown.length) list.append(el('p','strip-activity__empty','当前分类中没有记录'));
      shown.forEach(e=>list.append(this._row(e)));
      root.append(list);
      const footer = el('footer','strip-activity__footer');
      footer.append(el('span','',`${this._events.length} 条记录 · 详情可展开查看`),el('span','', 'Strip Activity Feed'));
      root.append(footer);
      this.replaceChildren(root);
      this._updateMeter();
    }

    _row(e) {
      const row = el('article','strip-activity__row');
      row.dataset.id=e.id; row.dataset.type=e.type; row.dataset.status=e.status;
      const sym = el('span','strip-activity__symbol'); sym.append(svg(TYPE_ICONS[e.type]));
      const body = el('div','strip-activity__body');
      const heading = e.detail ? btn('strip-activity__trigger','', 'toggle',e.id) : el('div','strip-activity__trigger');
      heading.dataset.expandable=String(!!e.detail);
      if (e.detail) heading.setAttribute('aria-expanded',String(this._opened.has(e.id)));
      const line = el('span','strip-activity__line');
      line.append(el('span','strip-activity__title',e.title || '处理中'));
      if (e.path) line.append(el('code','strip-activity__inline-path',e.path));
      if (typeof e.add === 'number' || typeof e.del === 'number') {
        const group = el('span', 'strip-activity__count-group');
        if (typeof e.add === 'number') group.append(stat('add',`+${e.add}`));
        if (typeof e.del === 'number') group.append(stat('del',`-${e.del}`));
        line.append(group);
      }
      const trailing = el('span','strip-activity__trailing');
      if (e.time) trailing.append(el('span','',e.time));
      if (e.detail) trailing.append(svg('chevron','strip-activity__chevron'));
      heading.append(line,trailing);
      body.append(heading);
      if (e.subtitle) body.append(el('p','strip-activity__note',e.subtitle));
      if (e.detail && this._opened.has(e.id)) {
        const content = this._details(e);
        if (content) body.append(content);
      }
      row.append(sym,body);
      return row;
    }
    _details(e) {
      const d=e.detail;
      const wrap=el('div','strip-activity__detail');
      if (d.kind==='files' || d.kind==='diff') {
        if (d.files?.length) wrap.append(this._files(d.files));
        if (d.kind==='diff' && d.diff?.length) {
          const diff=el('div','strip-activity__diff');
          diff.append(el('div','strip-activity__diff-head',d.diffTitle || e.path || 'patch'));
          d.diff.forEach((item,i)=>{
            const line=el('div','strip-activity__diff-line');
            line.dataset.kind=['add','del','context'].includes(item.kind)?item.kind:'context';
            line.append(el('span','',item.line || String(i+1)),el('code','',item.text || ''));
            diff.append(line);
          });
          wrap.append(diff);
        }
      } else if (d.kind==='command') {
        const term=el('div','strip-activity__terminal');
        const head=el('div','strip-activity__terminal-head');
        head.append(el('span','strip-activity__path',d.cwd || '终端'));
        const copy=btn('strip-activity__mini-btn','', 'copy',e.id);
        copy.append(svg('copy'),document.createTextNode(' 复制'));
        head.append(copy); term.append(head);
        term.append(el('pre','strip-activity__terminal-code',`$ ${d.command || ''}\n${d.output || ''}`.trimEnd()));
        wrap.append(term);
      } else if (d.kind==='plan') {
        const plan=el('ol','strip-activity__plan');
        (d.steps||[]).forEach(step=>{
          const li=el('li');
          li.dataset.step=step.status || 'todo';
          const ico=el('span','strip-activity__plan-icon');
          ico.append(svg(step.status==='done'?'check':step.status==='active'?'clock':'dots'));
          li.append(ico,el('span','',step.title));plan.append(li);
        });
        wrap.append(plan);
      } else if (d.kind==='approval') {
        const panel=el('div','strip-activity__panel');panel.dataset.kind='approval';
        panel.append(el('p','',d.message || '此操作需要确认。'));
        if (d.command) panel.append(el('code','',d.command));
        if (e.status==='pending') {
          const actions=el('div','strip-activity__actions');
          const yes=btn('strip-activity__button','允许本次','approve',e.id);yes.dataset.primary='true';
          actions.append(yes,btn('strip-activity__button','拒绝','deny',e.id));panel.append(actions);
        }
        wrap.append(panel);
      } else if (d.kind==='error') {
        const panel=el('div','strip-activity__panel');panel.dataset.kind='error';
        panel.append(el('p','',d.message || '本次执行发生异常。'));
        if (d.code) panel.append(el('code','',d.code));
        if (d.retryable) {
          const actions=el('div','strip-activity__actions');
          const retry=btn('strip-activity__button','', 'retry',e.id);retry.append(svg('refresh'),document.createTextNode(' 重试'));
          actions.append(retry);panel.append(actions);
        }
        wrap.append(panel);
      } else if (d.kind==='summary') {
        const panel=el('div','strip-activity__panel');panel.dataset.kind='summary';
        panel.append(el('p','',d.message || '处理已完成。'));
        if (d.stats?.length) {
          const stats=el('div','strip-activity__stats');
          d.stats.forEach(s=>stats.append(el('span','strip-activity__stat',s)));
          panel.append(stats);
        }
        wrap.append(panel);
        if (d.files?.length) wrap.append(this._files(d.files));
      } else {
        const panel=el('div','strip-activity__panel');
        panel.append(el('p','',d.message || ''));wrap.append(panel);
      }
      return wrap;
    }
    _files(files) {
      const list=el('ul','strip-activity__files');
      files.forEach(item=>{
        const f=typeof item==='string'?{path:item}:item;
        const li=el('li','strip-activity__file');
        li.append(el('span','strip-activity__file-name',f.path || 'file'));
        if (typeof f.add==='number' || typeof f.del==='number') {
          const stats=el('span','strip-activity__file-stats');
          if (typeof f.add==='number') stats.append(el('b','',`+${f.add}`));
          if (typeof f.del==='number') stats.append(el('em','',`-${f.del}`));
          li.append(stats);
        }
        list.append(li);
      });
      return list;
    }
    _onClick(event) {
      const b=event.target.closest?.('button[data-action]');
      if (!b || !this.contains(b)) return;
      const action=b.dataset.action;
      const id=b.dataset.id;
      if (action==='toggle') {
        if (this._opened.has(id)) this._opened.delete(id);
        else this._opened.add(id);
        this.render();
      } else if (action==='filter') this.setFilter(b.dataset.filter);
      else if (action==='expand-all') this.expandAll();
      else if (action==='collapse-all') this.collapseAll();
      else if (action==='approve' || action==='deny') {
        this.dispatchEvent(new CustomEvent('strip:approval',{bubbles:true,detail:{id,decision:action==='approve'?'allow':'deny'}}));
      } else if (action==='retry') {
        this.dispatchEvent(new CustomEvent('strip:retry',{bubbles:true,detail:{id}}));
      } else if (action==='copy') {
        const e=this._events.find(item=>item.id===id);
        if (e?.detail?.kind==='command') {
          const t=`$ ${e.detail.command || ''}\n${e.detail.output || ''}`.trim();
          this._copy(t,b);
        }
      }
    }
    async _copy(text,button) {
      try {
        if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
        else {
          const ta=el('textarea');ta.value=text;ta.style.position='fixed';ta.style.opacity='0';
          this.append(ta);ta.select();
          if (!document.execCommand('copy')) throw new Error('clipboard unavailable');
          ta.remove();
        }
        button.textContent='已复制';
        window.setTimeout(()=>{ if (button.isConnected) button.replaceChildren(svg('copy'), document.createTextNode(' 复制')); },1250);
      } catch (_) {
        this.dispatchEvent(new CustomEvent('strip:copy-error',{bubbles:true,detail:{text}}));
      }
    }
  }
  customElements.define('strip-activity-feed',StripActivityFeed);
})();
