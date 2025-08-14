/***** 1) 試算表資訊 *****/
const SHEET_ID = '11DLlDZKMUlnfxuZ3_XcsQBcHwTOdkPNr5KVUByLiDIo';
const GID      = '0';

/***** 2) gviz JSONP 來源（免 CORS） *****/
function buildGvizUrl() {
  const base = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq`;
  const params = new URLSearchParams({ gid: GID, tqx: 'out:json' });
  return `${base}?${params.toString()}`;
}

/***** 3) 載入 gviz JSON（攔截固定回呼） *****/
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

/***** 4) 表頭正規化 + 列資料解析 *****/
const SYNONYMS = new Map([
  ['名稱','name'], ['功能名稱','name'], ['標題','name'], ['title','name'],
  ['代稱','slug'], ['識別碼','slug'], ['id','slug'], ['ID','slug'],
  ['說明','description'], ['內容','description'], ['簡介','description'], ['描述','description'],
  ['分類','category'], ['類別','category'],
  ['標籤','tags'],
  ['demo','demo_url'], ['demo連結','demo_url'], ['demo url','demo_url'], ['demo網址','demo_url'],
  ['repo','repo_url'], ['github','repo_url'], ['程式碼連結','repo_url'],
  ['狀態','status'],
  ['更新日期','updated_at'], ['更新時間','updated_at'], ['日期','updated_at'], ['最後更新','updated_at'],
  ['備註','note'], ['備註說明','note']
]);

function normalizeHeaderLabel(label) {
  const raw = String(label || '').trim();
  // 取第一個關鍵詞（空白、全形空白、（、(、-、— 之前）
  const m = raw.match(/^[^\s（(－—-]+/);
  let key = (m ? m[0] : raw).toLowerCase();
  // 常見同義詞對應
  if (SYNONYMS.has(key)) key = SYNONYMS.get(key);
  return key;
}

function parseGvizDate(v) {
  // gviz 會給 "Date(2025,6,30)" -> 月份 0-based
  if (typeof v === 'string') {
    const m = v.match(/^Date\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (m) {
      const y = +m[1], mo = +m[2], d = +m[3];
      return new Date(y, mo, d);
    }
  }
  return v instanceof Date ? v : (v ? new Date(v) : null);
}

function gvizToObjects(resp) {
  const cols = resp.table.cols.map(c => ({
    raw: (c.label || c.id || '').trim(),
    key: normalizeHeaderLabel(c.label || c.id || '')
  }));
  const rows = (resp.table.rows || []).map(r => r.c.map(c => c ? c.v : ''));

  return rows.map(r => {
    const obj = {};
    cols.forEach((col, i) => {
      let val = r[i];
      if (col.key === 'updated_at') val = parseGvizDate(val);
      obj[col.key || col.raw || `col_${i}`] = val;
    });
    return obj;
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

  // 依 updated_at DESC 排序
  filtered.sort((a,b) => {
    const da = a.updated_at instanceof Date ? a.updated_at : null;
    const db = b.updated_at instanceof Date ? b.updated_at : null;
    return (db ? db.getTime() : 0) - (da ? da.getTime() : 0);
  });

  els.items.innerHTML = filtered.map(it => {
    const name = it.name || it.slug || '（未命名）';
    const tags = String(it.tags || '').split(',').map(s => s.trim()).filter(Boolean);
    const updated = it.updated_at instanceof Date ? it.updated_at.toLocaleDateString() : '';
    const demo = safeUrl(it.demo_url);
    const repo = safeUrl(it.repo_url);
    return `
      <div class="item">
        <h3>${escapeHtml_(name)}</h3>
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
    const items = gvizToObjects(resp);
    allItems = items;
    fillFilters(allItems);
    render();

    els.search.addEventListener('input', render);
    els.category.addEventListener('change', render);
    els.status.addEventListener('change', render);

    // 如需查看解析後的鍵名，可開啟：
    // console.table(allItems);
  } catch (e) {
    els.items.innerHTML = `<p class="error">載入發生錯誤：${e.message}</p>`;
  }
})();
