// ── State ────────────────────────────────────────────────────────────
let shortUrl = '';
let togState = {};
let openCode = null;

// ── Auth ─────────────────────────────────────────────────────────────
function getToken() {
  const token = localStorage.getItem('token');
  if (!token) {
    globalThis.location.href = '/';
    return null;
  }
  return token;
}

function logout() {
  localStorage.removeItem('token');
  globalThis.location.href = '/';
}

// API helper with JWT
async function apiCall(endpoint, method = 'GET', body = null) {
  const token = getToken();
  if (!token) return;
  
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  const response = await fetch(endpoint, options);
  
  if (response.status === 401) {
    logout();
    throw new Error('Authentication failed');
  }
  
  return response;
}

// Initialize - check auth on load
(function() {
  getToken();
})();

// ── Tabs ─────────────────────────────────────────────────────────────
const TABS = ['shorten','dashboard'];
function tab(name) {
  document.querySelectorAll('.tab').forEach((t,i)=>t.classList.toggle('active',TABS[i]===name));
  TABS.forEach(n=>{
    const p=document.getElementById('p-'+n);
    if(p)p.classList.toggle('active',n===name);
    }
  );
  if (name==='dashboard') loadStats();
}

// ── Toggles ───────────────────────────────────────────────────────────
function tog(id, gid) {
  togState[id] = !togState[id];
  document.getElementById(id).classList.toggle('on', togState[id]);
  document.getElementById(gid).classList.toggle('open', togState[id]);
  if (!togState[id]) {
    if (gid==='g-custom') document.getElementById('customCode').value='';
    if (gid==='g-exp')    document.getElementById('expiresAt').value='';
  }
}

// ── Shorten ───────────────────────────────────────────────────────────
async function shorten() {
  const originalUrl = document.getElementById('longUrl').value.trim();
  const customCode  = togState['t-custom'] ? document.getElementById('customCode').value.trim() : undefined;
  const expiresAt   = togState['t-exp']    ? document.getElementById('expiresAt').value || undefined : undefined;
  const btn = document.getElementById('snipBtn');
  const res = document.getElementById('result');

  if (!originalUrl) return flash('err','✕ Missing URL','Please paste a URL.','','');
  btn.disabled=true;
  document.getElementById('btnLabel').innerHTML='<span class="spin"></span>';
  res.classList.remove('show');

  try {
    const r = await apiCall('/api/links', 'POST', {originalUrl, customCode, expiresAt});
    const j = await r.json();
    if (!r.ok) { flash('err','✕ Error',j.error||'Something went wrong.','',''); return; }
    const d = j.data;
    shortUrl = d.shortUrl;
    const expLine = d.expiresAt ? `<br>Expires: <span>${new Date(d.expiresAt).toLocaleString()}</span>` : '';
    flash('ok',
      d.existing ? '↩ Already shortened' : '✓ Shortened',
      d.shortUrl,
      `→ <span>${trunc(d.originalUrl,60)}</span><br>Clicks: <span>${d.clicks}</span>${expLine}`,
      `<button class="btn-sm" id="cpBtn" onclick="cp()">Copy link</button>
       <button class="btn-sm" onclick="openUrl('${d.shortUrl}')">Open ↗</button>
       <button class="btn-sm" onclick="resetForm()">Shorten another</button>`
    );
  } catch { flash('err','✕ Network error','Could not reach server.','',''); }
  finally { btn.disabled=false; document.getElementById('btnLabel').textContent='SHORTEN'; }
}

function flash(type, tag, url, meta, acts) {
  const el = document.getElementById('result');
  el.className = 'result show' + (type==='ok'?'':' '+type);
  document.getElementById('r-tag').textContent = tag;
  document.getElementById('r-url').textContent = type==='ok' ? url : '';
  document.getElementById('r-meta').innerHTML  = type==='ok' ? meta : `<span style="color:var(--red)">${url}</span>`;
  document.getElementById('r-acts').innerHTML  = acts;
}

function cp() {
  navigator.clipboard.writeText(shortUrl).then(()=>{
    const b=document.getElementById('cpBtn'); if(!b)return;
    b.textContent='✓ Copied!'; b.classList.add('ok');
    setTimeout(()=>{b.textContent='Copy link';b.classList.remove('ok');},2000);
  });
}

function openUrl(url) {
  window.open(url, '_blank');
}

function resetForm() {
  document.getElementById('longUrl').value='';
  document.getElementById('result').classList.remove('show');
  shortUrl='';
}

// ── Stats ─────────────────────────────────────────────────────────────
async function loadStats() {
  const el=document.getElementById('statsEl');
  el.innerHTML='<div class="empty"><span class="empty-icon">···</span>Loading…</div>';
  openCode=null;
  try {
    const r=await apiCall('/api/links'); 
    const j=await r.json();
    render(j.data?.links||[]);
  } catch { el.innerHTML='<div class="empty">Failed to load.</div>'; }
}

function render(links) {
  const el=document.getElementById('statsEl');
  if (!links.length) { el.innerHTML='<div class="empty"><span class="empty-icon">∅</span>No links yet. Snip something!</div>'; return; }
  const max=Math.max(...links.map(l=>l.clicks),1);
  el.innerHTML=`<table>
    <thead><tr>
      <th>Code</th><th>Destination</th><th>Status</th><th>Created</th>
      <th style="text-align:right">Clicks</th><th style="text-align:right">Actions</th>
    </tr></thead>
    <tbody>
    ${links.map(l=>{
      const pct=Math.max(3,(l.clicks/max)*100);
      return `<tr>
        <td class="td-code">${x(l.shortCode)}</td>
        <td class="td-url"><a href="${xa(l.originalUrl)}" target="_blank" title="${xa(l.originalUrl)}">${x(trunc(l.originalUrl,38))}</a></td>
        <td>${badge(l)}</td>
        <td style="color:var(--muted);font-size:11px">${fmtDate(l.createdAt)}</td>
        <td class="td-clicks">${l.clicks}<div class="bar"><div class="bar-fill" style="width:${pct}%"></div></div></td>
        <td style="text-align:right;white-space:nowrap">
          <button class="btn-icon" onclick="toggleDrawer('${xa(l.shortCode)}')">📊</button>
          <button class="btn-icon" style="margin-left:4px" onclick="copyCode('${xa(l.shortUrl)}',this)">⎘</button>
          <button class="btn-icon del" style="margin-left:4px" onclick="del('${xa(l.shortCode)}')">🗑</button>
        </td>
      </tr>
      <tr id="dr-${x(l.shortCode)}" class="drawer-row">
        <td colspan="6" style="padding:0">
          <div class="drawer">
            <div class="drawer-hd">
              <span class="drawer-title">📊 Click log — ${x(l.shortCode)}</span>
              <button class="btn-icon" onclick="toggleDrawer('${xa(l.shortCode)}')">✕</button>
            </div>
            <div class="log" id="log-${x(l.shortCode)}"><div class="no-clicks">Loading…</div></div>
          </div>
        </td>
      </tr>`;
    }).join('')}
    </tbody></table>`;
}

function badge(l) {
  if (l.isExpired) return `<span class="badge b-expired">Expired</span>`;
  if (!l.expiresAt) return `<span class="badge b-active">Active</span>`;
  const h=(new Date(l.expiresAt)-Date.now())/36e5;
  return h<24 ? `<span class="badge b-soon">Expires soon</span>` : `<span class="badge b-active">Active</span>`;
}

async function toggleDrawer(code) {
  const row=document.getElementById(`dr-${code}`);
  const log=document.getElementById(`log-${code}`);
  if (row.style.display==='table-row' && openCode===code) { row.style.display='none'; openCode=null; return; }
  if (openCode) { const r=document.getElementById(`dr-${openCode}`); if(r) r.style.display='none'; }
  row.style.display='table-row'; openCode=code;
  log.innerHTML='<div class="no-clicks">Loading…</div>';
  try {
    const r=await apiCall(`/api/links/${encodeURIComponent(code)}/analytics`); const j=await r.json();
    const events=j.data?.clickEvents||[];
    if (!events.length) { log.innerHTML='<div class="no-clicks">No clicks yet.</div>'; return; }
    log.innerHTML=events.map(e=>`<div class="ce">
      <span class="ce-time">${fmtFull(e.timestamp)}</span>
      <span class="ce-ua">${x(parseUA(e.userAgent))}</span>
      <span class="ce-ip">${x(e.ip||'?')}</span>
    </div>`).join('');
  } catch { log.innerHTML='<div class="no-clicks">Failed to load.</div>'; }
}

async function del(code) {
  if (!confirm(`Delete "${code}"?`)) return;
  try {
    const r=await apiCall(`/api/links/${encodeURIComponent(code)}`, 'DELETE'); const j=await r.json();
    if (r.ok) loadStats(); else alert(j.error||'Delete failed.');
  } catch { alert('Network error.'); }
}

function copyCode(url, btn) {
  navigator.clipboard.writeText(url).then(()=>{const o=btn.textContent;btn.textContent='✓';setTimeout(()=>btn.textContent=o,1500);});
}

// ── API Docs ──────────────────────────────────────────────────────────
async function loadApiDocs() {
  try {
    const r=await fetch('/api'); const j=await r.json();
    document.getElementById('apiPre').textContent=`${j.name}  —  v${j.version}
${'─'.repeat(52)}

ENDPOINTS
${Object.entries(j.endpoints).map(([ep,d])=>`  ${ep.padEnd(38)}${d}`).join('\n')}

${'─'.repeat(52)}

EXAMPLE — Shorten a URL
  POST /api/links
  Content-Type: application/json

  {
    "originalUrl": "https://example.com/very/long/path",
    "customCode":  "my-slug",           // optional
    "expiresAt":   "2025-12-31T23:59"   // optional ISO datetime
  }

  → 201 Created
  {
    "success": true,
    "data": {
      "shortCode":   "my-slug",
      "shortUrl":    "http://localhost:3000/my-slug",
      "originalUrl": "https://example.com/...",
      "clicks":      0,
      "expiresAt":   "2025-12-31T23:59:00.000Z",
      "createdAt":   "2024-01-01T12:00:00.000Z"
    }
  }

EXAMPLE — Analytics
  GET /api/links/my-slug/analytics

  → 200 OK
  {
    "success": true,
    "data": {
      "shortCode":   "my-slug",
      "totalClicks": 42,
      "clickEvents": [
        { "timestamp": "...", "ip": "127.0.0.1", "userAgent": "Chrome/125", "referer": null }
      ]
    }
  }

${'─'.repeat(52)}

ERROR FORMAT
  { "success": false, "error": "Human-readable message" }

STATUS CODES
  201  Created          — new link
  200  OK               — existing link (dedup) or successful read
  400  Bad Request      — invalid URL / bad custom code / past expiry
  404  Not Found        — code doesn't exist
  409  Conflict         — custom code already taken
  410  Gone             — link has expired
  429  Too Many Requests — rate limit hit
  500  Internal Error`;
  } catch { document.getElementById('apiPre').textContent='Could not load. Is the server running?'; }
}

// ── Utils ─────────────────────────────────────────────────────────────
function x(s){
  return String(s)
  .replaceAll('&','&amp;')
  .replaceAll('<','&lt;')
  .replaceAll('>','&gt;');
}
function xa(s){
  return x(s)
  .replaceAll('"','&quot;');
}
function trunc(s,n){
  return s.length>n?s.slice(0,n)+'…':s;
}
function fmtDate(iso){
  if(iso) return new Date(iso)
   .toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});
  return'—';
  }
function fmtFull(iso){
  if(iso){
    const d=new Date(iso);
    return d.toLocaleDateString(undefined,{month:'short',day:'numeric'})+' '+d.toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'});
  }
  return'—';
}
function parseUA(ua){
  if(!ua||ua==='unknown')return'Unknown';
  if(/curl/i.test(ua))return'curl';
  if(/Postman/i.test(ua))return'Postman';
  const m=ua.match(/(Chrome|Firefox|Safari|Edge|OPR)[/\s]([\d.]+)/i);
  return m?`${m[1]} ${m[2].split('.')[0]}`:trunc(ua,42);
}

// Enter key on url field
document.addEventListener('DOMContentLoaded',()=>{
  document.getElementById('longUrl').addEventListener('keydown',e=>{if(e.key==='Enter')shorten();});
  const dt=document.getElementById('expiresAt');
  dt.min=new Date().toISOString().slice(0,16);
  dt.value=new Date(Date.now()+3600000).toISOString().slice(0,16);
});
