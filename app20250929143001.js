// v5 (reverted data loader): use window.KAOMOJI_DATA directly
(function(){
  const q = document.getElementById('q');
  const tagQ = document.getElementById('tagQ');
  const perPageEl = document.getElementById('perPage');
  const tagModeEl = document.getElementById('tagMode');
  const listModeEl = document.getElementById('listMode');
  const grid = document.getElementById('grid');
  const vgrid = document.getElementById('vgrid');
  const vspacer = document.getElementById('vspacer');
  const vitems = document.getElementById('vitems');
  const stats = document.getElementById('stats');
  const pager = document.getElementById('pager');
  const activeTagsEl = document.getElementById('activeTags');
  const toastEl = document.getElementById('toast');
  const annList = document.getElementById('annList');
  const clearAnns = document.getElementById('clearAnns');
  const clearTagsBtn = document.getElementById('clearTags');
  const tabAll = document.getElementById('tabAll');
  const tabFav = document.getElementById('tabFav');

  // State
  const state = {
    q: '', tagQ: '', tagMode: 'and', perPage: 36, page: 1, favOnly: false, listMode: 'auto',
    activeTags: new Set(),
    favorites: new Set(JSON.parse(localStorage.getItem('kao-favs')||'[]')),
    tagUsage: JSON.parse(localStorage.getItem('tag-usage')||'{}'),
    data: Array.isArray(window.KAOMOJI_DATA) ? window.KAOMOJI_DATA.slice() : []
  };

  // Tag groups mapping
  const groups = {
    mood: ['happy','love','sad','angry','wow','wink','smug','sleep','confused','blush','cry','thinking'],
    actions: ['greeting','dance','tableflip','fight','hug'],
    animals: ['bear','cat','bunny'],
    meta: ['cute','sparkle','tear','serious','heart','variant']
  };

  function toast(msg){ toastEl.textContent = msg; toastEl.classList.add('show'); setTimeout(()=> toastEl.classList.remove('show'), 1200); }
  const normalize = s => (s||'').trim().toLowerCase();
  function saveFavs(){ localStorage.setItem('kao-favs', JSON.stringify(Array.from(state.favorites))); }
  function bumpTag(t){ state.tagUsage[t] = (state.tagUsage[t]||0) + 1; localStorage.setItem('tag-usage', JSON.stringify(state.tagUsage)); }

  // Announcements helpers
  function annEl({title, body, type='info', actions=[]}){
    const el = document.createElement('div'); el.className = 'ann ' + type;
    const t = document.createElement('div'); t.className = 'title'; t.textContent = title; el.appendChild(t);
    const b = document.createElement('div'); b.className = 'body'; b.textContent = body; el.appendChild(b);
    if(actions.length){
      const act = document.createElement('div'); act.className = 'actions';
      actions.forEach(a => { const btn = document.createElement('button'); btn.className = 'btn sm'; btn.textContent = a.label; btn.onclick = a.onClick; act.appendChild(btn); });
      el.appendChild(act);
    }
    return el;
  }
  function announce(msg){ annList.prepend(annEl(msg)); }
  clearAnns.onclick = () => { annList.innerHTML = ''; };

  // PWA SW registration + update prompt (same as v5)
  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('sw20250929143101.js').then(reg => {
      function promptUpdate(worker){
        announce({
          title: '有新版本可用',
          body: '點擊「立即更新」載入最新版本（離線快取會同步更新）。',
          type: 'warn',
          actions: [{ label:'立即更新', onClick: () => { if(worker) worker.postMessage({type:'SKIP_WAITING'}); } }]
        });
      }
      if(reg.waiting) promptUpdate(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const newW = reg.installing;
        newW && newW.addEventListener('statechange', () => {
          if(newW.state === 'installed' && navigator.serviceWorker.controller){
            promptUpdate(newW);
          }
        });
      });
      navigator.serviceWorker.addEventListener('controllerchange', () => { location.reload(); });
    });
  }

  // Build tag counts from current data
  let tagCounts = {};
  function rebuildTagCounts(){
    tagCounts = {};
    state.data.forEach(d => (d.tags||[]).forEach(t => tagCounts[t]=(tagCounts[t]||0)+1));
  }
  function popularTags(limit=10){
    const entries = Object.entries(state.tagUsage);
    if(!entries.length) return [];
    return entries.sort((a,b) => b[1]-a[1]).slice(0,limit).map(([t])=>t).filter(t => tagCounts[t]);
  }
  rebuildTagCounts();

  // Matching
  function matches(item){
    if(state.favOnly && !state.favorites.has(item.k)) return false;
    const txt = (item.k + ' ' + (item.tags||[]).join(' ')).toLowerCase();
    if(state.q && !txt.includes(state.q)) return false;
    if(state.activeTags.size){
      const set = new Set(item.tags||[]);
      if(state.tagMode === 'and'){
        for(const t of state.activeTags){ if(!set.has(t)) return false; }
      }else{
        let ok=false; for(const t of state.activeTags){ if(set.has(t)){ ok=true; break; } } if(!ok) return false;
      }
    }
    return true;
  }

  // Render tags (weighted by usage, with Popular group)
  function renderGroup(groupKey, container){
    const tq = normalize(state.tagQ);
    container.innerHTML = '';
    let list = [];
    if(groupKey==='others'){
      const mapped = new Set(Object.values(groups).flat());
      list = Object.keys(tagCounts).filter(t => !mapped.has(t));
    }else if(groupKey==='popular'){
      list = popularTags(12);
      if(list.length === 0){ container.parentElement.hidden = true; return; } else { container.parentElement.hidden = false; }
    }else{
      list = (groups[groupKey]||[]).filter(t => tagCounts[t]);
    }
    list = list
      .filter(t => !tq || t.toLowerCase().includes(tq))
      .sort((a,b)=> (state.tagUsage[b]||0)-(state.tagUsage[a]||0) || a.localeCompare(b,'zh-Hant'));
    list.forEach(t => {
      const count = tagCounts[t] || 0;
      const el = document.createElement('button');
      el.className = 'tag' + (state.activeTags.has(t)?' active':'');
      el.dataset.tag = t;
      el.innerHTML = `<span>${t}</span><span class="count">${count}</span>`;
      el.onclick = () => {
        if(state.activeTags.has(t)) state.activeTags.delete(t);
        else { state.activeTags.add(t); bumpTag(t); }
        renderAll();
      };
      container.appendChild(el);
    });
  }
  function renderTags(){
    renderGroup('popular', document.querySelector('.tags[data-group="popular"]'));
    renderGroup('mood', document.querySelector('.tags[data-group="mood"]'));
    renderGroup('actions', document.querySelector('.tags[data-group="actions"]'));
    renderGroup('animals', document.querySelector('.tags[data-group="animals"]'));
    renderGroup('meta', document.querySelector('.tags[data-group="meta"]'));
    renderGroup('others', document.querySelector('.tags[data-group="others"]'));
  }
  function renderActiveTags(){
    activeTagsEl.innerHTML = '';
    state.activeTags.forEach(t => {
      const at = document.createElement('span');
      at.className = 'at';
      at.innerHTML = `<span>#${t}</span><button title="移除" aria-label="移除 ${t}">×</button>`;
      at.querySelector('button').onclick = () => { state.activeTags.delete(t); renderAll(); };
      activeTagsEl.appendChild(at);
    });
  }

  // Card HTML (shared; event delegation used below)
  function cardHTML(d, fav){
    const tags = (d.tags||[]).slice(0,4).map(t => `<span class="pill" data-pill="${t}">${t}</span>`).join('');
    return `<article class="card">
      <div class="k">${escapeHtml(d.k)}</div>
      <div class="meta">${tags}</div>
      <div class="actions">
        <button class="btn act-copy">複製</button>
        <button class="btn icon act-fav" title="加入收藏">${fav?'❤️':'🤍'}</button>
      </div>
    </article>`;
  }
  function escapeHtml(s){ return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c])); }

  // Standard rendering with pager
  function renderStandard(filtered){
    grid.hidden = false; vgrid.hidden = true; pager.hidden = false;
    const per = state.perPage;
    const maxPage = Math.max(1, Math.ceil(filtered.length / per));
    if(state.page > maxPage) state.page = maxPage;
    const start = (state.page - 1) * per;
    const slice = filtered.slice(start, start + per);
    grid.innerHTML = slice.map(d => cardHTML(d, state.favorites.has(d.k))).join('');
  }
  function renderPager(total){
    const per = state.perPage;
    const maxPage = Math.max(1, Math.ceil(total / per));
    const p = state.page;
    pager.innerHTML = '';
    function addBtn(label, page, disabled=false, active=false){
      const b = document.createElement('button');
      b.className = 'page-btn' + (active?' active':'');
      b.textContent = label;
      if(disabled){ b.disabled = true; }
      else{ b.onclick = () => { state.page = page; renderAll(false); window.scrollTo({top:0,behavior:'smooth'}); }; }
      pager.appendChild(b);
    }
    addBtn('«', 1, p===1);
    addBtn('‹', Math.max(1,p-1), p===1);
    const win = 2; const start = Math.max(1, p-win); const end = Math.min(maxPage, p+win);
    for(let i=start;i<=end;i++) addBtn(String(i), i, false, i===p);
    addBtn('›', Math.min(maxPage,p+1), p===maxPage);
    addBtn('»', maxPage, p===maxPage);
  }

  // Virtual grid
  const VGAP = 12, VMIN = 240, VHEIGHT = 150;
  function computeCols(){
    const width = vgrid.clientWidth || vgrid.getBoundingClientRect().width || 1100;
    const cols = Math.max(1, Math.floor((width + VGAP) / (VMIN + VGAP)));
    const colW = Math.floor((width - VGAP*(cols-1)) / cols);
    return {cols, colW, width};
  }
  function renderVirtual(filtered){
    grid.hidden = true; vgrid.hidden = false; pager.hidden = true;
    const {cols, colW} = computeCols();
    const totalRows = Math.ceil(filtered.length / cols);
    const totalHeight = totalRows * (VHEIGHT + VGAP) - VGAP;
    vspacer.style.height = totalHeight + 'px';
    vitems.innerHTML = '';

    function update(){
      const {cols, colW} = computeCols();
      const containerTop = vgrid.getBoundingClientRect().top + window.scrollY;
      const viewTop = Math.max(0, window.scrollY - containerTop);
      const viewH = window.innerHeight;
      const startRow = Math.max(0, Math.floor((viewTop - 2*(VHEIGHT+VGAP)) / (VHEIGHT + VGAP)));
      const endRow = Math.ceil((viewTop + viewH + 2*(VHEIGHT+VGAP)) / (VHEIGHT + VGAP));
      const startIndex = Math.max(0, startRow * cols);
      const endIndex = Math.min(filtered.length, (endRow+1) * cols);

      let html = '';
      for(let i=startIndex; i<endIndex; i++){
        const d = filtered[i];
        const row = Math.floor(i / cols);
        const col = i % cols;
        const left = col * (colW + VGAP);
        const topPx = row * (VHEIGHT + VGAP);
        html += `<article class="vcard" style="width:${colW}px; transform: translate(${left}px, ${topPx}px)">
          <div class="k">${escapeHtml(d.k)}</div>
          <div class="meta">${(d.tags||[]).slice(0,4).map(t=>`<span class="pill" data-pill="${t}">${t}</span>`).join('')}</div>
          <div class="actions">
            <button class="btn act-copy">複製</button>
            <button class="btn icon act-fav" title="加入收藏">${state.favorites.has(d.k)?'❤️':'🤍'}</button>
          </div>
        </article>`;
      }
      vitems.innerHTML = html;
      vitems.dataset.start = startIndex;
      vitems.dataset.end = endIndex;
    }
    update();
    function onScroll(){ requestAnimationFrame(update); }
    function onResize(){ requestAnimationFrame(update); }
    window.addEventListener('scroll', onScroll, {passive:true});
    window.addEventListener('resize', onResize);
    vgrid._cleanup = () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onResize); };
  }

  // Event delegation for copy/fav/pill
  function handleActions(e){
    const copyBtn = e.target.closest('.act-copy');
    const favBtn = e.target.closest('.act-fav');
    const pill = e.target.closest('.pill');
    if(copyBtn || favBtn || pill){
      const card = e.target.closest('.card,.vcard'); if(!card) return;
      const kEl = card.querySelector('.k'); if(!kEl) return;
      const kText = kEl.textContent;
      if(copyBtn){
        (async () => {
          try{ await navigator.clipboard.writeText(kText); }
          catch{ const ta=document.createElement('textarea'); ta.value=kText; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); }
          toast('已複製：' + kText);
        })();
      }else if(favBtn){
        if(state.favorites.has(kText)) state.favorites.delete(kText); else state.favorites.add(kText);
        saveFavs();
        favBtn.textContent = state.favorites.has(kText)?'❤️':'🤍';
        toast(state.favorites.has(kText)?'已加入收藏':'已移除收藏');
        if(state.favOnly) renderAll(false);
      }else if(pill){
        const t = pill.dataset.pill; state.activeTags.add(t); bumpTag(t); renderAll();
      }
    }
  }
  grid.addEventListener('click', handleActions);
  vitems.addEventListener('click', handleActions);

  // Pager / renderer chooser
  let filteredCache = [];
  function renderAll(resetPage=true){
    if(resetPage) state.page = 1;
    q.value = state.q; tagQ.value = state.tagQ; perPageEl.value = String(state.perPage); tagModeEl.value = state.tagMode; listModeEl.value = state.listMode;

    renderActiveTags(); renderTags();

    filteredCache = state.data.filter(matches);
    const tagText = state.activeTags.size ? `；標籤(${state.tagMode.toUpperCase()}): ${Array.from(state.activeTags).join(', ')}` : '';
    const favText = state.favOnly ? '（僅收藏）' : '';
    const modeText = state.listMode.toUpperCase();
    stats.textContent = `找到 ${filteredCache.length} / ${state.data.length} 個${favText}${tagText}｜模式：${modeText}`;

    const useVirtual = state.listMode==='virtual' || (state.listMode==='auto' && filteredCache.length>2000);
    if(useVirtual){ if(vgrid._cleanup) vgrid._cleanup(); renderVirtual(filteredCache); }
    else { if(vgrid._cleanup) vgrid._cleanup(); renderStandard(filteredCache); renderPager(filteredCache.length); }
  }

  // Group header actions
  document.querySelectorAll('.group').forEach(g => {
    const container = g.querySelector('.tags');
    g.querySelectorAll('[data-act="all"]').forEach(btn => btn.addEventListener('click', ()=>{
      container.querySelectorAll('.tag').forEach(el => { const t=el.dataset.tag; if(t){ state.activeTags.add(t); bumpTag(t); } });
      renderAll();
    }));
    g.querySelectorAll('[data-act="none"]').forEach(btn => btn.addEventListener('click', ()=>{
      container.querySelectorAll('.tag').forEach(el => { const t=el.dataset.tag; if(t) state.activeTags.delete(t); });
      renderAll();
    }));
  });
  clearTagsBtn.addEventListener('click', () => { state.activeTags.clear(); renderAll(); });

  // Tabs
  tabAll.onclick = () => { tabAll.classList.add('active'); tabFav.classList.remove('active'); state.favOnly=false; renderAll(); };
  tabFav.onclick = () => { tabFav.classList.add('active'); tabAll.classList.remove('active'); state.favOnly=true; renderAll(); };

  // Inputs
  q.addEventListener('input', () => { state.q = normalize(q.value); renderAll(); });
  tagQ.addEventListener('input', () => { state.tagQ = normalize(tagQ.value); renderAll(false); });
  perPageEl.addEventListener('change', () => { state.perPage = parseInt(perPageEl.value,10)||36; renderAll(); });
  tagModeEl.addEventListener('change', () => { state.tagMode = tagModeEl.value; renderAll(); });
  listModeEl.addEventListener('change', () => { state.listMode = listModeEl.value; renderAll(); });

  // Initial render
  rebuildTagCounts();
  renderAll();
})();