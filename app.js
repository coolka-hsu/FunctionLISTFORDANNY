/***** 1) 設定你的試算表資訊 *****/
const SHEET_ID = '11DLlDZKMUlnfxuZ3_XcsQBcHwTOdkPNr5KVUByLiDIo';
const GID      = '0';

/***** 2) gviz JSONP 來源 (免 CORS) *****/
function buildGvizUrl() {
  const base = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq`;
  const params = new URLSearchParams({ gid: GID, tqx: 'out:json' });
  return `${base}?${params.toString()}`;
}

/***** 3) 載入 + 解析 gviz JSON *****/
function jsonp(url) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const prev = window.google && window.google.visualization && window.google.visualization.Query && window.google.visualization.Query.setResponse;
    const googleNS = window.google = window.google || {};
    googleNS.visualization = googleNS.visualization || {};
    googleNS.visualization.Query = googleNS.visualization.Query || {};
    googleNS.visualization.Query.setResponse = function(resp) {
      try { resolve(resp); } finally {
        if (prev) googleNS.visualization.Query.setResponse = prev;
        else delete googleNS.visualization.Query.setResponse;
        script.remove();
      }
    };
    script.src = url;
    script.onerror = () => { reject(new Error('JSONP failed')); script.remove(); };
    document.body.appendChild(script);
  });
}

function gvizToObjects(resp) {
  const cols = resp.table.cols.map(c => (c.label || c.id || '').trim());
  const rows = (resp.table.rows || []).map(r => r.c.map(c => c ? c.v : ''));
  return rows.map(r => {
    const obj = {};
    cols.forEach((h, i) => obj[h] = r[i]);
    return obj;
  });
}

/***** 4) 將各種表頭映射成統一鍵名 *****/
const KEY_MAP = {
  name:       ['name','名稱','功能名稱','標題','title'],
  slug:       ['slug','代稱','識別碼','ID','id'],
  description:['description','說明','內容','簡介','描述'],
  category:   ['category','分類','類別'],
  tags:       ['tags','標籤'],
  demo_url:   ['demo_url','Demo','Demo連結','demo連結','demo網址','Demo URL','Demo URL 連結'],
  repo_url:   ['repo_url','Repo','GitHub','程式碼連結','repo連結','github連結'],
  status:     ['status','狀態'],
  updated_at: ['updated_at','更新日期','更新時間','日期','最後更新'],
  note:       ['note','備註','備註說明']
};

function pick(obj, keys){
  for (const k of keys) {
    if (obj.hasOwnProperty(k) && obj[k] !== null && obj[k] !== '') return obj[k];
  }
  return '';
}
function normalizeItems(raw){
  return raw.map(o => {
    const item = {
      name:       pick(o, KEY_MAP.name),
      slug:       pick(o, KEY_MAP.slug),
      description:pick(o, KEY_MAP.description),
      category:   pick(o, KEY_MAP.category),
      tags:       pick(o, KEY_MAP.tags),
      demo_url:   pick(o, KEY_MAP.demo_url),
      repo_url:   pick(o, KEY_MAP.repo_url),
      status:     pick(o, KEY_MAP.status),
      updated_at: pick(o, KEY_MAP.updated_at),
      note:       pick(o, KEY_MAP.note)
    };
    // 預設值避免空白卡片
    if (!item.name) item.name = item.slug || '（未命名）';
    if (item.updated_at && typeof item.updated_at === 'string' && /^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(item.updated_at)) {
      // 保留字串日期讓 new Date 可解析
    } else if (item.updated_at instanceof Date) {
      // 保留 Date 物件
    } else if (typeof item.updated_at === 'number') {
      // 也可能是序列數，這裡不特別處理，交給 new Date()
    }
    return item;
  });
}

/***** 5) UI 與渲染 *****/
const els = {
  items: document.getElementById('items'),
  search: document.getElementById('search'),
  category: document.getElementById('category'),
  status: document.getElementById('status')
};
let allItems = [];

function uniqueSorted(arr) {
  return Array.from(new Set(arr.filter(Boolean))).sort((a,b)=>String(a).localeCompare(String(b),'zh-Hant'));
}
function fillFilters(items) {
  const cats = uniqueSorted(items.map(x => x.category));
  els.category.innerHTML = '<option value="">全部分類</option>' + cats.map(c=>`<option>${escapeHtml_(c)}</option>`).join('');
}
function escapeHtml_(s) {
  return (s || '').toString()
    .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
    .replaceAll('"','&quot;').replaceAll("'","&#039;");
}
function safeUrl(u){
  const s = (u||'').toString().trim();
  return /^https?:\/\//i.test(s) ? s : '';
}

function render() {
  const kw = (els.search.value || '').trim().toLowerCase();
  const cat = els.category.value || '';
  const st  = els.status.value || '';
  const filtered = allItems.filter(it => {
    const hay = [it.name, it.slug, it.category, it.tags, it.description, it.status]
      .map(x => (x || '').toString().toLowerCase()).join(' ');
    const okKw  = !kw || hay.includes(kw);
    const okCat = !cat || (it.category === cat);
    const okSt  = !st  || (it.status === st);
    return okKw && okCat && okSt;
  });

  if (filtered.length === 0) {
    els.items.innerHTML = '<p>沒有項目或條件過於嚴格。</p>';
    return;
  }

  filtered.sort((a,b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0));

  els.items.innerHTML = filtered.map(it => {
    const tags = String(it.tags || '').split(',').map(s => s.trim()).filter(Boolean);
    const updated = it.updated_at ? new Date(it.updated_at).toLocaleDateString() : '';
    const demo = safeUrl(it.demo_url);
    const repo = safeUrl(it.repo_url);
    return `
      <div class="item">
        <h3>${escapeHtml_(it.name || '')}</h3>
        <div class="meta">
          ${it.category ? `<span>分類：${escapeHtml_(it.category)}</span>` : ''}
          ${it.status ? `<span class="status">${escapeHtml_(it.status)}</span>` : ''}
          ${updated ? `<span>更新：${updated}</span>` : ''}
        </div>
        ${it.description ? `<div>${escapeHtml_(it.description)}</div>` : ''}
        ${tags.length ? `<div class="tags">${tags.map(t=>`<span class="tag">${escapeHtml_(t)}</span>`).join('')}</div>` : ''}
        <div class="links">
          ${demo ? `<a href="${demo}" target="_blank" rel="noopener">Demo</a>` : ''}
          ${repo ? `<a href="${repo}" target="_blank" rel="noopener">Repo</a>` : ''}
        </div>
      </div>`;
  }).join('');
}

/***** 6) 初始化 *****/
(async () => {
  try {
    const resp = await jsonp(buildGvizUrl());
    const raw  = gvizToObjects(resp);
    allItems   = normalizeItems(raw); // ★ 關鍵：映射成統一鍵名
    fillFilters(allItems);
    render();

    els.search.addEventListener('input', render);
    els.category.addEventListener('change', render);
    els.status.addEventListener('change', render);

    // 除錯：若仍空白，可打開這行看看原始欄位長什麼樣
    // console.table(raw);
  } catch (e) {
    els.items.innerHTML = `<p class="error">載入發生錯誤：${e.message}</p>`;
  }
})();
