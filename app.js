// ★ 換成你的 Apps Script Web App URL（/exec）
const API_BASE = 'https://script.google.com/macros/s/AKfycby8mn_2I-eaVC27j8YmVKhaLOf9nwMW-SCOqbTPmHZGXJYMUV_UJeWyOMleUZyqM5EK/exec';

// 狀態
const els = {
  authSection: document.getElementById('auth-section'),
  listSection: document.getElementById('list-section'),
  pwd: document.getElementById('password'),
  loginBtn: document.getElementById('loginBtn'),
  logoutBtn: document.getElementById('logoutBtn'),
  authError: document.getElementById('authError'),
  items: document.getElementById('items'),
  search: document.getElementById('search')
};

function getToken() { return sessionStorage.getItem('token') || ''; }
function setToken(t) { sessionStorage.setItem('token', t); }
function clearToken() { sessionStorage.removeItem('token'); }

function showListUI() {
  els.authSection.classList.add('hidden');
  els.listSection.classList.remove('hidden');
}
function showAuthUI() {
  els.listSection.classList.add('hidden');
  els.authSection.classList.remove('hidden');
}

async function login() {
  els.authError.style.display = 'none';
  const password = els.pwd.value.trim();
  if (!password) return;
  try {
    const res = await fetch(`${API_BASE}?path=auth`, {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ password })
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || '登入失敗');
    setToken(data.token);
    els.pwd.value = '';
    showListUI();
    await loadList();
  } catch (err) {
    els.authError.textContent = '登入錯誤：' + err.message;
    els.authError.style.display = 'block';
  }
}

async function loadList() {
  els.items.innerHTML = '載入中…';
  const token = getToken();
  try {
    const res = await fetch(`${API_BASE}?path=list&token=${encodeURIComponent(token)}`);
    const data = await res.json();
    if (!data.ok) {
      if (data.error === 'UNAUTHORIZED') {
        clearToken();
        showAuthUI();
        return;
      }
      throw new Error(data.error || '載入失敗');
    }
    renderItems(data.items || []);
  } catch (err) {
    els.items.innerHTML = `<p class="error">載入發生錯誤：${err.message}</p>`;
  }
}

function renderItems(items) {
  const keyword = els.search.value.trim().toLowerCase();
  const filtered = items.filter(it => {
    const hay = [
      it.name, it.slug, it.category, it.tags, it.description
    ].map(x => (x || '').toString().toLowerCase()).join(' ');
    return !keyword || hay.includes(keyword);
  });

  if (filtered.length === 0) {
    els.items.innerHTML = '<p>沒有符合條件的項目。</p>';
    return;
  }

  els.items.innerHTML = filtered.map(it => {
    const tags = (it.tags || '').toString().split(',').map(s => s.trim()).filter(Boolean);
    const updated = it.updated_at ? new Date(it.updated_at).toLocaleDateString() : '';
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
          ${it.demo_url ? `<a href="${it.demo_url}" target="_blank" rel="noopener">Demo</a>` : ''}
          ${it.repo_url ? `<a href="${it.repo_url}" target="_blank" rel="noopener">Repo</a>` : ''}
        </div>
      </div>`;
  }).join('');
}

function escapeHtml_(s) {
  return (s || '').toString()
    .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
    .replaceAll('"','&quot;').replaceAll("'","&#039;");
}

els.loginBtn.addEventListener('click', login);
els.logoutBtn.addEventListener('click', () => { clearToken(); showAuthUI(); });
els.pwd.addEventListener('keydown', e => { if (e.key === 'Enter') login(); });
els.search.addEventListener('input', () => loadList());

// 自動嘗試用 token 載入
(async () => {
  if (getToken()) { showListUI(); await loadList(); }
})();
