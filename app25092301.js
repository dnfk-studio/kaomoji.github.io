(function(){
  const data = window.KAOMOJI_DATA || [];
  const grid = document.getElementById('grid');
  const stats = document.getElementById('stats');
  const searchInput = document.getElementById('searchInput');
  const clearBtn = document.getElementById('clearBtn');
  const tagRow = document.getElementById('tagRow');
  const themeBtn = document.getElementById('themeBtn');
  const densityBtn = document.getElementById('densityBtn');
  const shuffleBtn = document.getElementById('shuffleBtn');
  const toast = document.getElementById('toast');
  const docEl = document.documentElement;

  const savedTheme = localStorage.getItem('mk-theme');
  if(savedTheme){ docEl.setAttribute('data-theme', savedTheme); }

  themeBtn.addEventListener('click', (e) => {
    ripple(e);
    const cur = docEl.getAttribute('data-theme');
    const next = (cur === 'dark') ? 'auto' : (cur === 'auto' ? 'light' : 'dark');
    docEl.setAttribute('data-theme', next);
    localStorage.setItem('mk-theme', next);
    showToast('主題：' + (next === 'dark' ? '深色' : next === 'light' ? '淺色' : '跟隨系統'));
  });

  const savedDensity = localStorage.getItem('mk-density') || 'cozy';
  docEl.setAttribute('data-density', savedDensity === 'compact' ? 'compact':'cozy');
  densityBtn.dataset.density = savedDensity;
  densityBtn.textContent = '版面：' + (savedDensity === 'compact' ? '緊湊' : '舒適');

  densityBtn.addEventListener('click', (e) => {
    ripple(e);
    const cur = densityBtn.dataset.density;
    const next = (cur === 'cozy') ? 'compact' : 'cozy';
    densityBtn.dataset.density = next;
    densityBtn.textContent = '版面：' + (next === 'compact' ? '緊湊' : '舒適');
    docEl.setAttribute('data-density', next === 'compact' ? 'compact' : 'cozy');
    localStorage.setItem('mk-density', next);
  });

  function ripple(ev){
    const btn = ev.currentTarget;
    if(!btn || !btn.matches('[data-ripple]')) return;
    btn.classList.remove('ripple');
    const rect = btn.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;
    btn.style.setProperty('--r-x', x + 'px');
    btn.style.setProperty('--r-y', y + 'px');
    btn.classList.add('ripple');
    setTimeout(()=>btn.classList.remove('ripple'), 600);
  }
  document.querySelectorAll('[data-ripple]').forEach(el => {
    el.addEventListener('click', ripple, {passive:true});
  });

  const allTags = new Set();
  data.forEach(d => (d.tags||[]).forEach(t => allTags.add(t)));
  const tagList = Array.from(allTags).sort();

  const activeTags = new Set();

  function renderTags(){
    tagRow.innerHTML = '';
    tagList.forEach(t => {
      const el = document.createElement('button');
      el.className = 'tag' + (activeTags.has(t) ? ' active':'');
      el.textContent = t;
      el.onclick = () => {
        if(activeTags.has(t)) activeTags.delete(t); else activeTags.add(t);
        renderTags(); render();
      };
      tagRow.appendChild(el);
    });
  }

  function showToast(msg){
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 1200);
  }

  function match(item, q){
    const hay = (item.k + ' ' + (item.tags||[]).join(' ')).toLowerCase();
    return hay.includes(q);
  }

  function filterByTags(item){
    if(activeTags.size === 0) return true;
    const tags = new Set(item.tags||[]);
    for(const t of activeTags){ if(!tags.has(t)) return false; }
    return true;
  }

  const gradients = [
    'linear-gradient(135deg, var(--p1), var(--p5))',
    'linear-gradient(135deg, var(--p2), var(--p10))',
    'linear-gradient(135deg, var(--p3), var(--p7))',
    'linear-gradient(135deg, var(--p4), var(--p9))',
    'linear-gradient(135deg, var(--p6), var(--p2))',
    'linear-gradient(135deg, var(--p5), var(--p3))',
    'linear-gradient(135deg, var(--p10), var(--p1))',
    'linear-gradient(135deg, var(--p7), var(--p4))'
  ];
  function gradFor(str){
    let h = 0;
    for(let i=0;i<str.length;i++){ h = (h*31 + str.charCodeAt(i)) >>> 0; }
    return gradients[h % gradients.length];
  }

  function render(){
    const q = searchInput.value.trim().toLowerCase();
    const filtered = data.filter(d => filterByTags(d) && (q ? match(d,q) : true));
    stats.textContent = `共 ${filtered.length} / ${data.length} 個顏文字`;

    const frag = document.createDocumentFragment();
    filtered.forEach(d => {
      const card = document.createElement('article');
      card.className = 'card';
      card.style.setProperty('--card-grad', gradFor(d.k));

      const k = document.createElement('div');
      k.className = 'k';
      k.textContent = d.k;
      card.appendChild(k);

      const tags = document.createElement('div');
      tags.className = 'tags';
      (d.tags||[]).slice(0,4).forEach(t => {
        const pill = document.createElement('span');
        pill.className = 'pill';
        pill.textContent = t;
        pill.onclick = () => {
          if(activeTags.has(t)) activeTags.delete(t); else activeTags.add(t);
          renderTags(); render();
        };
        tags.appendChild(pill);
      });
      card.appendChild(tags);

      const actions = document.createElement('div');
      actions.className = 'actions';
      const copyBtn = document.createElement('button');
      copyBtn.className = 'btn';
      copyBtn.textContent = '複製';
      copyBtn.setAttribute('data-ripple','');
      copyBtn.onclick = async (e) => {
        ripple(e);
        try{
          await navigator.clipboard.writeText(d.k);
        }catch(_){ try{
          const ta = document.createElement('textarea');
          ta.value = d.k; document.body.appendChild(ta);
          ta.select(); document.execCommand('copy'); ta.remove();
        }catch(__){} }
        card.classList.add('copied');
        emojiBurst(card);
        setTimeout(() => card.classList.remove('copied'), 600);
        showToast('已複製：' + d.k);
      };
      const addTagBtn = document.createElement('button');
      addTagBtn.className = 'btn';
      addTagBtn.textContent = d.tags?.[0] ? ('#' + d.tags[0]) : '標籤';
      addTagBtn.setAttribute('data-ripple','');
      addTagBtn.onclick = (e) => {
        ripple(e);
        if(d.tags?.[0]){
          const t = d.tags[0];
          if(activeTags.has(t)) activeTags.delete(t); else activeTags.add(t);
          renderTags(); render();
        }
      };
      actions.appendChild(copyBtn);
      actions.appendChild(addTagBtn);
      card.appendChild(actions);

      frag.appendChild(card);
    });
    grid.innerHTML = '';
    grid.appendChild(frag);
  }

  function emojiBurst(card){
    const emojis = ['✨','💖','⭐','🌸','🎉','💫'];
    const rect = card.getBoundingClientRect();
    const baseX = rect.width - 40;
    const baseY = 10;
    for(let i=0;i<3;i++){
      const span = document.createElement('span');
      span.className = 'emoji-burst';
      span.textContent = emojis[(Math.random()*emojis.length)|0];
      span.style.left = (baseX + Math.random()*18 - 9) + 'px';
      span.style.top = (baseY + Math.random()*8) + 'px';
      card.appendChild(span);
      setTimeout(()=>span.remove(), 700);
    }
  }

  searchInput.addEventListener('input', render);
  clearBtn.addEventListener('click', (e) => { ripple(e); searchInput.value=''; render(); });
  shuffleBtn.addEventListener('click', (e) => {
    ripple(e);
    for(let i=data.length-1;i>0;i--){
      const j = (Math.random() * (i+1)) | 0;
      const tmp = data[i]; data[i] = data[j]; data[j] = tmp;
    }
    render();
  });

  renderTags();
  render();
})();