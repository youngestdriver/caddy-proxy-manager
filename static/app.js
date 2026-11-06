const S = {
  entries: [], upstreams: [], version: '', drift: false,
  site_hosts: '', suffixes: [], global: '', last_apply: {}, view: 'dashboard', filter: '',
  groupFilter: '__all'
};

const root = document.getElementById('root');
const toastBox = document.getElementById('toast');

/* ---------- icons ---------- */

const ICONS = {
  dashboard: '<path d="M5 12l-2 0l9 -9l9 9l-2 0"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-7"/><path d="M9 21v-6a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v6"/>',
  server: '<rect x="3" y="4" width="18" height="8" rx="2"/><rect x="3" y="12" width="18" height="8" rx="2"/><path d="M7 8h.01"/><path d="M7 16h.01"/>',
  sliders: '<line x1="4" y1="6" x2="7" y2="6"/><circle cx="10" cy="6" r="2.5"/><line x1="12.5" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="13" y2="12"/><circle cx="16" cy="12" r="2.5"/><line x1="18.5" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="5" y2="18"/><circle cx="8" cy="18" r="2.5"/><line x1="10.5" y1="18" x2="20" y2="18"/>',
  moon: '<path d="M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446a9 9 0 1 1 -8.313 -12.454z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M3 12h1M12 3v1M20 12h1M12 20v1M5.6 5.6l.7.7M18.4 5.6l-.7.7M5.6 18.4l.7-.7M18.4 18.4l-.7-.7"/>',
  bolt: '<path d="M13 3l0 7l6 0l-8 11l0 -7l-6 0l8 -11"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="M9 12l2 2l4 -4"/>',
  alert: '<path d="M12 9v4"/><path d="M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.875h16.214a1.914 1.914 0 0 0 1.636 -2.875l-8.106 -13.534a1.914 1.914 0 0 0 -3.274 0z"/><path d="M12 16h.01"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  search: '<circle cx="10" cy="10" r="7"/><path d="M21 21l-6 -6"/>',
  dots: '<circle cx="12" cy="5" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="19" r="1.6" fill="currentColor" stroke="none"/>',
  x: '<path d="M18 6l-12 12"/><path d="M6 6l12 12"/>',
  pencil: '<path d="M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4"/><path d="M13.5 6.5l4 4"/>',
  trash: '<path d="M4 7h16"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12"/><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3"/>',
  download: '<path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2"/><path d="M7 11l5 5l5 -5"/><path d="M12 4l0 12"/>',
  refresh: '<path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4"/><path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4"/>',
  logout: '<path d="M14 8v-2a2 2 0 0 0 -2 -2h-7a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h7a2 2 0 0 0 2 -2v-2"/><path d="M9 12h12l-3 -3"/><path d="M18 15l3 -3"/>'
};

function icon(name, cls) {
  return `<svg class="i ${cls || ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}

const LOGO = `<svg viewBox="0 0 40 40" aria-hidden="true">
  <defs>
    <linearGradient id="brandGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f6b544"/>
      <stop offset=".45" stop-color="#e2454d"/>
      <stop offset="1" stop-color="#8a3cbe"/>
    </linearGradient>
  </defs>
  <path d="M20 2.6 34.9 11.3v17.4L20 37.4 5.1 28.7V11.3z" fill="none" stroke="url(#brandGrad)" stroke-width="2.8" stroke-linejoin="round"/>
  <path d="M20 10.4 27.7 14.9v9L20 28.4l-7.7 -4.5v-9z" fill="url(#brandGrad)" opacity=".16"/>
  <path d="M23.6 16.6a4.8 4.8 0 1 0 0 6.8" fill="none" stroke="url(#brandGrad)" stroke-width="2.8" stroke-linecap="round"/>
</svg>`;

function brandInner() {
  return `<span class="brand-mark">${LOGO}</span>
    <span class="brand-text"><b>CADDY</b><i>PROXY MANAGER</i></span>`;
}

/* ---------- theme ---------- */

function isDark() { return document.documentElement.dataset.theme === 'dark'; }

function themeIcon() { return icon(isDark() ? 'sun' : 'moon'); }

function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  document.documentElement.style.colorScheme = t;
  try { localStorage.setItem('caddy-theme', t); } catch (e) {}
  document.querySelectorAll('[data-theme-toggle]').forEach(b => { b.innerHTML = themeIcon(); });
}

function bindThemeToggles() {
  document.querySelectorAll('[data-theme-toggle]').forEach(b => {
    if (b.dataset.bound) return;
    b.dataset.bound = '1';
    b.addEventListener('click', () => applyTheme(isDark() ? 'light' : 'dark'));
  });
}

/* ---------- helpers ---------- */

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function toast(msg, type) {
  const el = document.createElement('div');
  el.className = 'item ' + (type || '');
  el.textContent = msg;
  toastBox.appendChild(el);
  setTimeout(() => el.remove(), type === 'err' ? 6000 : 2600);
}

async function api(path, method, body) {
  const opt = { method: method || 'GET', headers: {} };
  if (body !== undefined) {
    opt.headers['Content-Type'] = 'application/json';
    opt.body = JSON.stringify(body);
  }
  const res = await fetch(path, opt);
  let data = null;
  try { data = await res.json(); } catch (e) { /* not json */ }
  if (res.status === 401) {
    renderLogin();
    throw new Error('未登录');
  }
  if (!res.ok) throw new Error((data && data.error) || ('HTTP ' + res.status));
  return data;
}

function absorb(data) {
  Object.assign(S, data);
  S.entries = S.entries || [];
  S.upstreams = S.upstreams || [];
  S.suffixes = S.suffixes || [];
}

// expandHostList mirrors the server: a bare label becomes one host per
// configured suffix, anything with a dot is used as-is.
function expandHostList(list) {
  const suffixes = S.suffixes || [];
  if (!suffixes.length) return list.slice();
  const out = [];
  const seen = new Set();
  const add = h => { if (h && !seen.has(h)) { seen.add(h); out.push(h); } };
  for (const h of list) {
    if (h.includes('.')) { add(h); continue; }
    for (const s of suffixes) add(h + '.' + s);
  }
  return out;
}

function avatar(seed) {
  let h = 7;
  const s = String(seed || 'x');
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  const a = h % 360;
  const b = (a + 58) % 360;
  return `<svg viewBox="0 0 40 40" aria-hidden="true">
    <defs><radialGradient id="av${h}" cx=".3" cy=".28" r=".95">
      <stop offset="0" stop-color="hsl(${a} 72% 74%)"/>
      <stop offset=".62" stop-color="hsl(${b} 52% 60%)"/>
      <stop offset="1" stop-color="hsl(${b} 45% 46%)"/>
    </radialGradient></defs>
    <circle cx="20" cy="20" r="20" fill="url(#av${h})"/>
    <circle cx="13" cy="14" r="9" fill="hsl(${b} 82% 76%)" opacity=".45"/>
    <circle cx="27" cy="28" r="7" fill="hsl(${a} 82% 82%)" opacity=".35"/>
  </svg>`;
}

function fmtTime(t) {
  const d = new Date(t);
  if (isNaN(d)) return t;
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function hostChips(hosts) {
  return (hosts || []).map(h =>
    `<a class="chip" href="https://${esc(h)}" target="_blank" rel="noopener" title="打开 https://${esc(h)}">${esc(h)}</a>`
  ).join('');
}

function healthOf(e) {
  const up = S.upstreams.find(u => u.address === e.upstream);
  if (!up) return { cls: 'idle', text: '无数据' };
  if (up.fails > 0) return { cls: 'bad', text: `${up.num_requests} 活跃 · ${up.fails} 失败` };
  return { cls: 'ok', text: `${up.num_requests} 活跃` };
}

function lastApplyText() {
  if (!S.last_apply || !S.last_apply.at) return '尚未应用';
  return `${S.last_apply.ok ? '成功' : '失败'} · ${fmtTime(S.last_apply.at)}`;
}

/* ---------- menus ---------- */

function closeMenus() {
  document.querySelectorAll('.menu-wrap.open').forEach(w => w.classList.remove('open'));
}

function bindMenus(scope) {
  scope.querySelectorAll('.menu-wrap').forEach(w => {
    const btn = w.querySelector('[data-menu-btn]');
    if (!btn || btn.dataset.bound) return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', ev => {
      ev.stopPropagation();
      const open = w.classList.contains('open');
      closeMenus();
      if (open) return;
      w.classList.add('open');
      placeMenu(btn, w.querySelector('.menu'));
    });
  });
}

function placeMenu(btn, menu) {
  if (!menu) return;
  const r = btn.getBoundingClientRect();
  const mw = menu.offsetWidth;
  const mh = menu.offsetHeight;
  let top = r.bottom + 4;
  if (top + mh > innerHeight - 8) top = Math.max(8, r.top - mh - 4);
  let left = Math.min(r.right - mw, innerWidth - mw - 8);
  left = Math.max(8, left);
  menu.style.position = 'fixed';
  menu.style.right = 'auto';
  menu.style.top = top + 'px';
  menu.style.left = left + 'px';
}

document.addEventListener('click', closeMenus);
window.addEventListener('resize', closeMenus);
window.addEventListener('scroll', closeMenus, true);

/* ---------- login ---------- */

function renderLogin() {
  root.innerHTML = `
    <div class="login-page">
      <div class="login-box">
        <div class="login-brand">
          ${brandInner()}
          <button class="icon-btn login-theme" data-theme-toggle title="切换主题">${themeIcon()}</button>
        </div>
        <form class="login-card" id="login-form">
          <h2>登录管理面板</h2>
          <div class="err" id="login-err"></div>
          <label class="field-label" for="login-pass">管理口令</label>
          <input class="input" type="password" id="login-pass" autocomplete="current-password" autofocus>
          <button class="btn primary block" type="submit">登录</button>
        </form>
        <div class="login-version">Caddy Proxy Manager</div>
      </div>
    </div>`;
  bindThemeToggles();
  document.getElementById('login-form').addEventListener('submit', async ev => {
    ev.preventDefault();
    const err = document.getElementById('login-err');
    err.textContent = '';
    try {
      await api('/api/login', 'POST', { password: document.getElementById('login-pass').value });
      await boot();
    } catch (e) {
      err.textContent = e.message;
    }
  });
}

/* ---------- shell ---------- */

function renderShell() {
  root.innerHTML = `
    <header class="topbar">
      <div class="topbar-in">
        <a class="brand" href="#" data-nav="dashboard">${brandInner()}</a>
        <div class="topbar-right">
          <button class="icon-btn" data-theme-toggle title="切换主题">${themeIcon()}</button>
          <div class="menu-wrap user-menu">
            <button class="user" data-menu-btn>
              <span class="avatar">${avatar('admin')}</span>
              <span class="user-text"><b>admin</b><i>管理员</i></span>
            </button>
            <div class="menu">
              <button data-act="logout">${icon('logout')}退出登录</button>
            </div>
          </div>
        </div>
      </div>
    </header>
    <nav class="tabbar">
      <div class="tabbar-in">
        <a class="tab" href="#" data-nav="dashboard">${icon('dashboard')}<span>概览</span></a>
        <a class="tab" href="#" data-nav="hosts">${icon('server')}<span>代理主机</span></a>
        <a class="tab" href="#" data-nav="settings">${icon('sliders')}<span>设置</span></a>
      </div>
    </nav>
    <main class="page" id="view"></main>`;

  bindThemeToggles();
  bindMenus(root);

  document.querySelectorAll('[data-nav]').forEach(a => {
    a.addEventListener('click', ev => {
      ev.preventDefault();
      S.view = a.dataset.nav;
      renderView();
    });
  });
  root.querySelector('[data-act="logout"]').addEventListener('click', async () => {
    closeMenus();
    try { await api('/api/logout', 'POST', {}); } catch (e) { /* ignore */ }
    renderLogin();
  });
}

function syncNav() {
  document.querySelectorAll('[data-nav]').forEach(a => {
    a.classList.toggle('active', a.dataset.nav === S.view);
  });
}

/* ---------- views ---------- */

function renderView() {
  syncNav();
  if (S.groupFilter !== '__all' && S.groupFilter !== '__none'
      && !S.entries.some(e => (e.group || '').trim() === S.groupFilter)) {
    S.groupFilter = '__all';
  }
  const view = document.getElementById('view');
  if (S.view === 'dashboard') view.innerHTML = dashboardHtml();
  else if (S.view === 'hosts') view.innerHTML = hostsHtml();
  else view.innerHTML = settingsHtml();

  if (S.view === 'hosts') {
    const input = document.getElementById('host-search');
    const body = document.getElementById('hosts-table');
    if (input && body) {
      input.value = S.filter;
      input.addEventListener('input', () => {
        S.filter = input.value;
        body.innerHTML = hostsRows();
        bindHostsTable();
      });
    }
    const add = document.getElementById('btn-add');
    if (add) add.addEventListener('click', () => openEditor(null));
    document.querySelectorAll('.group-bar [data-group]').forEach(b => {
      b.addEventListener('click', () => {
        S.groupFilter = b.dataset.group;
        renderView();
      });
    });
    bindHostsTable();
  }

  if (S.view === 'settings') {
    const re = document.getElementById('btn-reimport');
    if (re) re.addEventListener('click', reimport);
    const sfx = document.getElementById('btn-save-suffixes');
    if (sfx) sfx.addEventListener('click', saveSuffixes);
  }
}

function alertHtml() {
  if (!S.drift) return '';
  return `<div class="alert">${icon('alert')}<div>Caddyfile 被面板以外的操作修改过。可以到「设置」里重新导入以文件为准，或继续编辑覆盖它。</div></div>`;
}

function dashboardHtml() {
  const total = S.entries.length;
  const enabled = S.entries.filter(e => e.enabled).length;
  const upstreams = new Set(S.entries.map(e => e.upstream)).size;
  const failing = S.entries.filter(e => {
    const up = S.upstreams.find(u => u.address === e.upstream);
    return up && up.fails > 0;
  }).length;

  return `
    <h1 class="page-title">概览</h1>
    <div class="stat-grid">
      <div class="stat"><span class="stat-ico green">${icon('bolt')}</span><span class="stat-text"><b>${total}</b> 个代理主机</span></div>
      <div class="stat"><span class="stat-ico orange">${icon('server')}</span><span class="stat-text"><b>${upstreams}</b> 个上游目标</span></div>
      <div class="stat"><span class="stat-ico blue">${icon('check')}</span><span class="stat-text"><b>${enabled}</b> 个已启用</span></div>
      <div class="stat"><span class="stat-ico red">${icon('alert')}</span><span class="stat-text"><b>${failing}</b> 个上游异常</span></div>
    </div>
    ${alertHtml()}`;
}

function hostsHtml() {
  return `
    ${alertHtml()}
    <div class="card accent-lime">
      <div class="card-head">
        <h2>代理主机</h2>
        <div class="head-tools">
          <div class="search">${icon('search')}<input id="host-search" placeholder="搜索域名、上游、分组或名称"></div>
          <button class="btn green" id="btn-add">${icon('plus')}添加代理主机</button>
        </div>
      </div>
      ${groupBarHtml()}
      <div class="table-wrap">
        <table class="table host-table">
          <colgroup>
            <col class="col-owner"><col class="col-src"><col class="col-dest">
            <col class="col-tls"><col class="col-switch"><col class="col-status"><col class="col-actions">
          </colgroup>
          <thead><tr>
            <th></th><th>源站</th><th>目标</th><th>TLS</th><th>启用</th><th>状态</th><th></th>
          </tr></thead>
          <tbody id="hosts-table">${hostsRows()}</tbody>
        </table>
      </div>
    </div>`;
}

function groupCounts() {
  const m = new Map();
  for (const e of S.entries) {
    const g = (e.group || '').trim();
    m.set(g, (m.get(g) || 0) + 1);
  }
  return m;
}

function groupBarHtml() {
  const counts = groupCounts();
  const named = [...counts.keys()].filter(Boolean).sort((a, b) => a.localeCompare(b, 'zh'));
  if (!named.length && S.groupFilter === '__all') return '';
  const pill = (key, label, n) =>
    `<button class="group-pill ${S.groupFilter === key ? 'active' : ''}" data-group="${esc(key)}">${esc(label)}<b>${n}</b></button>`;
  const parts = [pill('__all', '全部', S.entries.length)];
  if (named.length && counts.get('')) parts.push(pill('__none', '未分组', counts.get('')));
  for (const g of named) parts.push(pill(g, g, counts.get(g)));
  return `<div class="group-bar">${parts.join('')}</div>`;
}

function hostsRows() {
  const q = S.filter.trim().toLowerCase();
  const gf = S.groupFilter || '__all';
  const list = S.entries.filter(e => {
    const group = (e.group || '').trim();
    if (gf === '__none' && group) return false;
    if (gf !== '__all' && gf !== '__none' && group !== gf) return false;
    if (!q) return true;
    return e.name.toLowerCase().includes(q)
      || e.upstream.toLowerCase().includes(q)
      || group.toLowerCase().includes(q)
      || e.hosts.some(h => h.toLowerCase().includes(q));
  });
  if (!list.length) {
    return `<tr><td colspan="7" class="empty">${S.entries.length ? '没有匹配的条目' : '还没有代理主机，点右上角添加'}</td></tr>`;
  }
  return list.map(e => {
    const h = healthOf(e);
    const st = e.enabled ? h : { cls: 'idle', text: '已停用' };
    const group = (e.group || '').trim();
    return `<tr data-row="${esc(e.id)}">
      <td class="col-owner"><span class="avatar sm drag-handle" draggable="true" data-drag="${esc(e.id)}" title="拖动排序">${avatar(e.id)}</span></td>
      <td class="col-src">
        <div class="src-name">
          <span class="src-label" title="${esc(e.name)}">${esc(e.name)}</span>
          ${group ? `<span class="badge group" title="分组：${esc(group)}">${esc(group)}</span>` : ''}
          ${e.system ? '<span class="badge">系统</span>' : ''}
        </div>
        <div class="chips">${hostChips(e.hosts)}</div>
      </td>
      <td class="col-dest">
        <div class="dest" title="${esc(e.scheme + '://' + e.upstream)}">
          <span class="scheme">${esc(e.scheme || 'http')}://</span>${esc(e.upstream)}
        </div>
      </td>
      <td class="col-tls">${e.skip_verify
        ? '<span class="chip warn">跳过证书校验</span>'
        : '<span class="tls-ok">自动 HTTPS</span>'}</td>
      <td class="col-switch">
        <label class="switch"><input type="checkbox" ${e.enabled ? 'checked' : ''} data-toggle="${esc(e.id)}"><span></span></label>
      </td>
      <td class="col-status"><span class="pill ${st.cls}"><span class="dot"></span>${esc(st.text)}</span></td>
      <td class="col-actions">
        <div class="menu-wrap">
          <button class="icon-btn dots" data-menu-btn title="操作">${icon('dots')}</button>
          <div class="menu">
            <button data-edit="${esc(e.id)}">${icon('pencil')}编辑</button>
            ${e.system ? '' : `<button class="danger" data-del="${esc(e.id)}">${icon('trash')}删除</button>`}
          </div>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function bindHostsTable() {
  const body = document.getElementById('hosts-table');
  if (!body) return;
  body.querySelectorAll('[data-toggle]').forEach(c => {
    c.addEventListener('change', () => toggleEntry(c.dataset.toggle, c.checked));
  });
  body.querySelectorAll('[data-edit]').forEach(b => {
    b.addEventListener('click', () => { closeMenus(); openEditor(b.dataset.edit); });
  });
  body.querySelectorAll('[data-del]').forEach(b => {
    b.addEventListener('click', () => { closeMenus(); removeEntry(b.dataset.del); });
  });
  bindMenus(body);
  bindDrag(body);
}

let dragId = null;

function clearDragMarks(body) {
  body.querySelectorAll('tr.dragging, tr.drop-before, tr.drop-after')
    .forEach(tr => tr.classList.remove('dragging', 'drop-before', 'drop-after'));
}

function bindDrag(body) {
  if (body.dataset.dragBound) return;
  body.dataset.dragBound = '1';

  body.addEventListener('dragstart', ev => {
    const handle = ev.target.closest('[data-drag]');
    if (!handle) return;
    dragId = handle.dataset.drag;
    const tr = handle.closest('tr');
    if (tr) tr.classList.add('dragging');
    ev.dataTransfer.effectAllowed = 'move';
    try { ev.dataTransfer.setData('text/plain', dragId); } catch (e) { /* ignore */ }
  });

  body.addEventListener('dragover', ev => {
    if (!dragId) return;
    const tr = ev.target.closest('tr[data-row]');
    if (!tr) return;
    ev.preventDefault();
    ev.dataTransfer.dropEffect = 'move';
    const after = ev.clientY > tr.getBoundingClientRect().top + tr.offsetHeight / 2;
    body.querySelectorAll('tr[data-row]').forEach(x => x.classList.remove('drop-before', 'drop-after'));
    tr.classList.add(after ? 'drop-after' : 'drop-before');
  });

  body.addEventListener('drop', ev => {
    if (!dragId) return;
    const tr = ev.target.closest('tr[data-row]');
    if (!tr) return;
    ev.preventDefault();
    const after = ev.clientY > tr.getBoundingClientRect().top + tr.offsetHeight / 2;
    const targetId = tr.dataset.row;
    const moving = dragId;
    clearDragMarks(body);
    dragId = null;
    if (targetId === moving) return;

    const ids = S.entries.map(e => e.id);
    const from = ids.indexOf(moving);
    if (from < 0) return;
    ids.splice(from, 1);
    const to = ids.indexOf(targetId);
    if (to < 0) return;
    ids.splice(after ? to + 1 : to, 0, moving);
    reorder(ids);
  });

  body.addEventListener('dragend', () => {
    dragId = null;
    clearDragMarks(body);
  });
}

function settingsHtml() {
  const siteHosts = (S.site_hosts || '').split(/\s+/).filter(Boolean);
  return `
    <h1 class="page-title">设置</h1>
    <div class="card accent-blue">
      <div class="card-head"><h2>配置文件</h2></div>
      <div class="card-body">
        <div class="kv">
          <span>站点域名</span>
          <span>${siteHosts.length ? siteHosts.map(h => `<span class="chip">${esc(h)}</span>`).join(' ') : '—'}</span>
        </div>
        <div class="kv"><span>最近应用</span><span>${esc(lastApplyText())}</span></div>
        <div class="kv">
          <span>配置状态</span>
          <span>${S.drift
            ? '<span class="pill bad"><span class="dot"></span>有外部改动</span>'
            : '<span class="pill ok"><span class="dot"></span>与面板一致</span>'}</span>
        </div>
        <div style="margin-top:16px">
          <a class="btn ghost" href="/api/caddyfile">${icon('download')}下载 Caddyfile</a>
          <button class="btn ghost" id="btn-reimport">${icon('refresh')}从 Caddyfile 重新导入</button>
        </div>
        <div class="hint">重新导入会用磁盘上的 Caddyfile 覆盖面板数据，未应用的手动改动会丢失。</div>
      </div>
    </div>

    <div class="card accent-lime">
      <div class="card-head"><h2>域名后缀</h2><span class="card-sub">填短名时自动展开</span></div>
      <div class="card-body">
        <div class="field">
          <label>后缀列表（每行一个）</label>
          <textarea id="s-suffixes" placeholder="example.com&#10;example.net">${esc((S.suffixes || []).join('\n'))}</textarea>
          <div class="hint">在「添加代理主机」里只填 abc 时，会生成 abc.后缀1、abc.后缀2……；填带点的完整域名则原样使用。留空即关闭短名展开。</div>
        </div>
        <button class="btn primary" id="btn-save-suffixes">保存后缀</button>
      </div>
    </div>

    <div class="card accent-violet">
      <div class="card-head"><h2>全局配置（只读）</h2><span class="card-sub">Caddyfile 顶部的 global 块</span></div>
      <div class="card-body"><pre class="code">${esc(S.global || '（无）')}</pre></div>
    </div>

    <div class="card accent-green">
      <div class="card-head"><h2>运行状态</h2></div>
      <div class="card-body">
        <div class="kv"><span>Caddy 版本</span><span class="mono">${esc(S.version || '未知')}</span></div>
        <div class="kv"><span>面板地址</span><span class="mono">${esc(location.host)}</span></div>
        <div class="kv"><span>代理条目</span><span>${S.entries.length} 条，${S.entries.filter(e => e.enabled).length} 条已启用</span></div>
      </div>
    </div>`;
}

/* ---------- actions ---------- */

async function refresh() {
  const data = await api('/api/state');
  absorb(data);
  renderView();
}

async function toggleEntry(id, on) {
  const e = S.entries.find(x => x.id === id);
  if (!e) return;
  try {
    await api('/api/entries/' + encodeURIComponent(id), 'PUT', Object.assign({}, e, { enabled: on }));
    toast(`已${on ? '启用' : '停用'} ${e.name}`, 'ok');
    await refresh();
  } catch (err) {
    toast(err.message, 'err');
    await refresh();
  }
}

async function reorder(ids) {
  try {
    await api('/api/reorder', 'POST', { ids });
    toast('顺序已保存', 'ok');
    await refresh();
  } catch (err) {
    toast(err.message, 'err');
    await refresh();
  }
}

async function removeEntry(id) {
  const e = S.entries.find(x => x.id === id);
  if (!e) return;
  if (!confirm(`删除「${e.name}」并立即生效？`)) return;
  try {
    await api('/api/entries/' + encodeURIComponent(id), 'DELETE');
    toast('已删除', 'ok');
    await refresh();
  } catch (err) {
    toast(err.message, 'err');
  }
}

async function saveSuffixes() {
  const list = document.getElementById('s-suffixes').value
    .split(/[\n,]/).map(s => s.trim()).filter(Boolean);
  try {
    await api('/api/settings', 'PUT', { suffixes: list });
    toast('后缀已保存', 'ok');
    await refresh();
  } catch (err) {
    toast(err.message, 'err');
  }
}

async function reimport() {
  if (!confirm('用磁盘上的 Caddyfile 覆盖面板数据？')) return;
  try {
    const r = await api('/api/import', 'POST', {});
    toast(`导入完成，共 ${r.count} 条`, 'ok');
    await refresh();
  } catch (err) {
    toast(err.message, 'err');
  }
}

/* ---------- editor ---------- */

let draft = null;
let activeTab = 'details';

function openEditor(id) {
  const existing = id ? S.entries.find(e => e.id === id) : null;
  const presetGroup = (S.groupFilter !== '__all' && S.groupFilter !== '__none') ? S.groupFilter : '';
  draft = existing ? JSON.parse(JSON.stringify(existing)) : {
    id: '', name: '', group: presetGroup, hosts: [], scheme: 'http', upstream: '',
    skip_verify: false, read_timeout: '', write_timeout: '', extra: '', enabled: true
  };
  activeTab = 'details';
  renderModal();
}

function renderModal() {
  const old = document.getElementById('overlay');
  if (old) old.remove();

  const el = document.createElement('div');
  el.className = 'overlay';
  el.id = 'overlay';
  el.innerHTML = `
    <div class="dialog">
      <div class="dialog-head">
        <h3>${draft.id ? '编辑代理主机' : '添加代理主机'}</h3>
        <button class="x" data-close title="关闭">${icon('x')}</button>
      </div>
      <div class="tabs">
        <button data-tab="details" class="${activeTab === 'details' ? 'active' : ''}">详情</button>
        <button data-tab="forward" class="${activeTab === 'forward' ? 'active' : ''}">转发</button>
        <button data-tab="advanced" class="${activeTab === 'advanced' ? 'active' : ''}">高级</button>
      </div>
      <div class="dialog-body">
        <div id="pane-details" style="display:${activeTab === 'details' ? 'block' : 'none'}">
          <div class="field">
            <label>名称</label>
            <input type="text" id="f-name" value="${esc(draft.name)}" placeholder="例如 comic">
            <div class="hint">仅用于面板显示和生成匹配器，改成英文短名最稳。</div>
          </div>
          <div class="field">
            <label>域名</label>
            <textarea id="f-hosts" placeholder="comic&#10;comic.example.com">${esc((draft.hosts || []).join('\n'))}</textarea>
            <div id="host-preview" class="chips host-preview"></div>
            <div class="hint">每行一个，也支持逗号分隔。${S.suffixes.length
              ? '只填短名（如 comic）会按设置里的后缀展开。'
              : '想少打字，可以到「设置 → 域名后缀」配一组后缀。'}</div>
          </div>
          <div class="field">
            <label>分组</label>
            <select id="f-group">
              <option value="" ${!draft.group ? 'selected' : ''}>无分组</option>
              ${groupOptionsHtml()}
              <option value="__new">＋ 新建分组…</option>
            </select>
            <input type="text" id="f-group-new" style="display:none;margin-top:8px" placeholder="输入新分组名，例如 监控" maxlength="40">
            <div class="hint">分组只用于面板整理和筛选，不会写进 Caddyfile。</div>
          </div>
          <div class="field"><label class="check"><input type="checkbox" id="f-enabled" ${draft.enabled ? 'checked' : ''}> 启用</label></div>
        </div>

        <div id="pane-forward" style="display:${activeTab === 'forward' ? 'block' : 'none'}">
          <div class="field row">
            <div style="max-width:150px">
              <label>协议</label>
              <select id="f-scheme">
                <option value="http" ${draft.scheme === 'http' ? 'selected' : ''}>HTTP</option>
                <option value="https" ${draft.scheme === 'https' ? 'selected' : ''}>HTTPS</option>
              </select>
            </div>
            <div>
              <label>上游地址</label>
              <input type="text" id="f-upstream" value="${esc(draft.upstream)}" placeholder="192.0.2.30:13001">
            </div>
          </div>
          <div class="field"><label class="check"><input type="checkbox" id="f-skip" ${draft.skip_verify ? 'checked' : ''}> 跳过上游 TLS 证书校验</label></div>
          <div class="field row">
            <div><label>读超时</label><input type="text" id="f-read" value="${esc(draft.read_timeout)}" placeholder="例如 3600s"></div>
            <div><label>写超时</label><input type="text" id="f-write" value="${esc(draft.write_timeout)}" placeholder="例如 3600s"></div>
          </div>
        </div>

        <div id="pane-advanced" style="display:${activeTab === 'advanced' ? 'block' : 'none'}">
          <div class="field">
            <label>自定义指令</label>
            <textarea id="f-extra" style="min-height:160px" placeholder="# 原样写进 handle 块，例如&#10;header / Strict-Transport-Security max-age=31536000">${esc(draft.extra)}</textarea>
            <div class="hint">内容会原样插到 handle 内，可用于 header、encode、basicauth 等。</div>
          </div>
        </div>
      </div>
      <div class="dialog-foot">
        <button class="btn ghost" data-close>取消</button>
        <button class="btn primary" id="btn-save">保存并应用</button>
      </div>
    </div>`;
  document.body.appendChild(el);

  el.addEventListener('click', ev => { if (ev.target === el) closeEditor(); });
  el.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', closeEditor));
  el.querySelectorAll('[data-tab]').forEach(b => {
    b.addEventListener('click', () => {
      collectDraft();
      activeTab = b.dataset.tab;
      renderModal();
    });
  });

  const gsel = el.querySelector('#f-group');
  if (gsel) {
    const gnew = el.querySelector('#f-group-new');
    const sync = () => {
      const isNew = gsel.value === '__new';
      gnew.style.display = isNew ? 'block' : 'none';
      if (isNew) gnew.focus();
    };
    gsel.addEventListener('change', sync);
    if (gsel.value === '__new') gnew.style.display = 'block';
  }

  const hosts = el.querySelector('#f-hosts');
  if (hosts) {
    const box = el.querySelector('#host-preview');
    const sync = () => renderHostPreview(hosts.value, box);
    hosts.addEventListener('input', sync);
    sync();
  }

  el.querySelector('#btn-save').addEventListener('click', saveDraft);
}

function renderHostPreview(value, box) {
  if (!box) return;
  const raw = value.split(/[\n,]/).map(s => s.trim()).filter(Boolean);
  const list = expandHostList(raw);
  box.innerHTML = list.map(h => `<span class="chip">${esc(h)}</span>`).join('');
}

function groupOptionsHtml() {
  const groups = [...new Set(S.entries.map(e => (e.group || '').trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'zh'));
  const cur = (draft.group || '').trim();
  if (cur && !groups.includes(cur)) groups.push(cur);
  return groups.map(g =>
    `<option value="${esc(g)}"${g === cur ? ' selected' : ''}>${esc(g)}</option>`
  ).join('');
}

function collectDraft() {
  if (!document.getElementById('pane-details')) return;
  draft.name = document.getElementById('f-name').value.trim();
  const gsel = document.getElementById('f-group');
  if (gsel) {
    draft.group = gsel.value === '__new'
      ? (document.getElementById('f-group-new').value || '').trim()
      : gsel.value;
  }
  draft.hosts = document.getElementById('f-hosts').value
    .split(/[\n,]/).map(s => s.trim()).filter(Boolean);
  draft.enabled = document.getElementById('f-enabled').checked;
  draft.scheme = document.getElementById('f-scheme').value;
  draft.upstream = document.getElementById('f-upstream').value.trim();
  draft.skip_verify = document.getElementById('f-skip').checked;
  draft.read_timeout = document.getElementById('f-read').value.trim();
  draft.write_timeout = document.getElementById('f-write').value.trim();
  draft.extra = document.getElementById('f-extra').value;
}

function closeEditor() {
  const el = document.getElementById('overlay');
  if (el) el.remove();
  draft = null;
}

async function saveDraft() {
  collectDraft();
  if (!draft.hosts.length) { toast('至少填一个域名', 'err'); activeTab = 'details'; renderModal(); return; }
  if (!draft.upstream) { toast('上游地址不能为空', 'err'); activeTab = 'forward'; renderModal(); return; }
  const btn = document.getElementById('btn-save');
  const idleText = btn.textContent;
  btn.disabled = true;
  btn.textContent = '检测上游…';
  let chk = null;
  try {
    chk = await api('/api/check-upstream', 'POST', { scheme: draft.scheme, upstream: draft.upstream });
  } catch (e) { /* check is best-effort */ }
  if (chk && !chk.ok) {
    btn.disabled = false;
    btn.textContent = idleText;
    if (!confirm(`上游 ${draft.upstream} 连不上：\n${chk.error}\n\n仍要保存并应用吗？`)) return;
    btn.disabled = true;
  }
  btn.textContent = '应用中…';
  let secs = 0;
  const timer = setInterval(() => { secs += 1; btn.textContent = `应用中… ${secs}s`; }, 1000);
  try {
    if (draft.id) {
      await api('/api/entries/' + encodeURIComponent(draft.id), 'PUT', draft);
    } else {
      await api('/api/entries', 'POST', draft);
    }
    closeEditor();
    toast('已保存并应用', 'ok');
    await refresh();
  } catch (err) {
    btn.disabled = false;
    btn.textContent = '保存并应用';
    toast(err.message, 'err');
  } finally {
    clearInterval(timer);
  }
}

/* ---------- boot ---------- */

async function boot() {
  const data = await api('/api/state');
  absorb(data);
  if (!document.querySelector('.topbar')) renderShell();
  renderView();
}

(async function init() {
  try {
    const data = await api('/api/state');
    absorb(data);
    renderShell();
    renderView();
  } catch (e) {
    if (e.message !== '未登录') renderLogin();
  }
})();
