const API = '/api/subscriptions';
const BILLING = { monthly: 'รายเดือน', yearly: 'รายปี' };
const CATS = { entertainment: 'บันเทิง', music: 'เพลง', cloud: 'คลาวด์', education: 'การเรียน', other: 'อื่น ๆ' };

const $ = (id) => document.getElementById(id);
const form = $('sub-form');
let editingId = null;
let firstRender = true;
const lastNum = {};
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const baht = (n) => '฿' + Math.round(n).toLocaleString('th-TH');

// ---------- API calls (fetch) ----------
async function load() {
  const params = new URLSearchParams();
  for (const [key, id] of [['billing', 'f-billing'], ['category', 'f-category'], ['active', 'f-active']]) {
    if ($(id).value) params.set(key, $(id).value);
  }
  if ($('q').value.trim()) params.set('q', $('q').value.trim());
  if ($('sort').value) {
    const [field, order] = $('sort').value.split(':');
    params.set('sort', field);
    params.set('order', order);
  }
  const [shown, all] = await Promise.all([
    fetch(`${API}?${params}`).then((r) => r.json()),
    fetch(API).then((r) => r.json()),
  ]);
  renderSummary(all);
  renderBreakdown(all);
  renderList(shown);
}

async function send(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return { ok: true };
  return { ok: res.ok, data: await res.json() };
}

// ---------- render ----------
function el(tag, text, cls) {
  const e = document.createElement(tag);
  if (text !== undefined && text !== '') e.textContent = text;
  if (cls) e.className = cls;
  return e;
}

function renderSummary(all) {
  const active = all.filter((s) => s.active);
  const perMonth = active.reduce((sum, s) => sum + (s.billing === 'yearly' ? s.price / 12 : s.price), 0);
  const box = $('summary');
  box.replaceChildren();
  for (const [value, label, num] of [
    [baht(perMonth), 'ค่าใช้จ่ายต่อเดือน', perMonth],
    [baht(perMonth * 12), 'ค่าใช้จ่ายต่อปี', perMonth * 12],
    [`${active.length} จาก ${all.length}`, 'บริการที่ใช้งานอยู่'],
  ]) {
    const s = el('div', '', 'stat');
    const b = el('b', value);
    s.append(b, el('span', label));
    if (num !== undefined) countUp(b, label, num);
    box.appendChild(s);
  }
}

function renderList(subs) {
  const list = $('list');
  list.replaceChildren();
  if (!subs.length) {
    list.appendChild(emptyState());
    return;
  }
  subs.forEach((s, i) => {
    const c = item(s);
    if (firstRender) { c.classList.add('enter'); c.style.setProperty('--i', i); }
    list.appendChild(c);
  });
  firstRender = false;
}

function item(s) {
  const c = el('article', '', `item c-${s.category}` + (s.active ? '' : ' off'));
  const ttl = el('div', '', 'ttl');
  ttl.append(catIcon(s.category), el('h3', s.name));
  c.append(ttl, el('div', `${baht(s.price)} / ${s.billing === 'yearly' ? 'ปี' : 'เดือน'}`, 'price'));
  const meta = [CATS[s.category] || s.category, BILLING[s.billing]];
  if (s.nextPayment) meta.push(`ชำระถัดไป ${new Date(s.nextPayment).toLocaleDateString('th-TH')}`);
  const metaBox = el('div', meta.join(' | ') + ' ', 'meta');
  const badge = dueBadge(s);
  if (badge) metaBox.appendChild(badge);
  c.appendChild(metaBox);

  const actions = el('div', '', 'actions');
  const label = document.createElement('label');
  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.checked = s.active;
  cb.onchange = async () => { await send('PATCH', `${API}/${s.id}`, { active: cb.checked }); toast(`${s.name}: ${cb.checked ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}`); load(); };
  label.append(cb, 'ใช้งานอยู่');

  const edit = el('button', 'แก้ไข', 'ghost');
  edit.onclick = () => startEdit(s);
  const del = el('button', 'ลบ', 'danger');
  del.onclick = async () => {
    if (!confirm(`ลบ "${s.name}" ?`)) return;
    await send('DELETE', `${API}/${s.id}`);
    if (editingId === s.id) resetForm();
    toast(`ลบ ${s.name} แล้ว`);
    load();
  };
  actions.append(label, edit, del);
  c.appendChild(actions);
  return c;
}

// ---------- form ----------
function startEdit(s) {
  editingId = s.id;
  $('name').value = s.name;
  $('price').value = s.price;
  $('billing').value = s.billing;
  $('category').value = s.category;
  $('nextPayment').value = s.nextPayment;
  $('form-title').textContent = 'แก้ไขบริการ';
  $('submit-btn').textContent = 'บันทึกการแก้ไข';
  $('cancel-btn').hidden = false;
  $('name').focus();
}

function resetForm() {
  editingId = null;
  form.reset();
  $('error').textContent = '';
  $('form-title').textContent = 'เพิ่มบริการ';
  $('submit-btn').textContent = 'เพิ่มบริการ';
  $('cancel-btn').hidden = true;
}
$('cancel-btn').onclick = resetForm;

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = {
    name: $('name').value,
    price: $('price').value === '' ? undefined : Number($('price').value),
    billing: $('billing').value,
    category: $('category').value,
    nextPayment: $('nextPayment').value,
  };
  const { ok, data } = editingId
    ? await send('PATCH', `${API}/${editingId}`, body)
    : await send('POST', API, body);
  if (!ok) { $('error').textContent = data.error; return; }
  toast(editingId ? 'บันทึกการแก้ไขแล้ว' : `เพิ่ม ${data.name} แล้ว`);
  resetForm();
  load();
});

// ---------- v2: toast, breakdown, due badge ----------
let toastTimer;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

function renderBreakdown(all) {
  const box = $('breakdown');
  box.replaceChildren();
  const totals = {};
  for (const s of all.filter((x) => x.active)) {
    totals[s.category] = (totals[s.category] || 0) + (s.billing === 'yearly' ? s.price / 12 : s.price);
  }
  const sum = Object.values(totals).reduce((a, b) => a + b, 0);
  if (!sum) return;
  const bar = el('div', '', 'bar');
  const legend = el('div', '', 'legend');
  for (const [cat, value] of Object.entries(totals).sort((a, b) => b[1] - a[1])) {
    const seg = document.createElement('span');
    seg.style.width = (value / sum) * 100 + '%';
    seg.style.background = `var(--c-${cat})`;
    seg.title = `${CATS[cat]} ${baht(value)}`;
    bar.appendChild(seg);
    const li = el('span', ` ${CATS[cat]} ${baht(value)}`);
    const dot = document.createElement('i');
    dot.style.background = `var(--c-${cat})`;
    li.prepend(dot);
    legend.appendChild(li);
  }
  box.append(bar, legend);
}

function dueBadge(s) {
  if (!s.active || !s.nextPayment) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const days = Math.round((new Date(s.nextPayment) - today) / 86400000);
  if (days < 0) return el('span', `เลยกำหนด ${-days} วัน`, 'due late');
  if (days === 0) return el('span', 'ครบกำหนดวันนี้', 'due late');
  return el('span', `อีก ${days} วัน`, 'due' + (days <= 7 ? ' soon' : ''));
}

let searchTimer;
$('q').oninput = () => { clearTimeout(searchTimer); searchTimer = setTimeout(load, 250); };
$('sort').onchange = load;

// ---------- v4: count-up numbers + mouse spotlight ----------
function countUp(node, key, target) {
  const from = lastNum[key] ?? 0;
  lastNum[key] = target;
  if (reduceMotion || from === target) { node.textContent = baht(target); return; }
  const t0 = performance.now();
  const step = (now) => {
    const p = Math.min((now - t0) / 700, 1);
    node.textContent = baht(from + (target - from) * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

document.addEventListener('pointermove', (e) => {
  const card = e.target.closest && e.target.closest('.item, .stat, #sub-form');
  if (!card) return;
  const r = card.getBoundingClientRect();
  card.style.setProperty('--mx', e.clientX - r.left + 'px');
  card.style.setProperty('--my', e.clientY - r.top + 'px');
});

// ---------- v5: category icons, empty state, scroll helpers ----------
const ICONS = {
  entertainment: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10 9.5v5l4.5-2.5z"/>',
  music: '<path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
  cloud: '<path d="M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 10a4 4 0 0 1 0 8z"/>',
  education: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11.5V16c0 1.5 3 3 6 3s6-1.5 6-3v-4.5"/>',
  other: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>',
};
function catIcon(cat) {
  const box = el('span', '', 'cat-icon');
  box.setAttribute('aria-hidden', 'true');
  box.innerHTML = `<svg viewBox="0 0 24 24">${ICONS[cat] || ICONS.other}</svg>`; // constant strings only
  return box;
}

function hasFilters() {
  return ['f-billing', 'f-category', 'f-active', 'q'].some((id) => $(id).value.trim());
}

function emptyState() {
  const box = el('div', '', 'empty');
  const filtered = hasFilters();
  const q = $('q').value.trim();
  box.innerHTML = filtered
    ? '<svg class="empty-icon" viewBox="0 0 96 96" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="42" cy="42" r="22"/><path d="M58 58l22 22"/><path d="M34 50c2.5-3.5 5-5 8-5s5.5 1.5 8 5"/><circle cx="35" cy="37" r="1.5" fill="currentColor"/><circle cx="49" cy="37" r="1.5" fill="currentColor"/></svg>'
    : '<svg class="empty-icon" viewBox="0 0 96 96" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="16" y="24" width="64" height="48" rx="10"/><path d="M48 38v20M38 48h20"/></svg>';
  box.append(
    el('h3', filtered ? 'ไม่พบบริการที่ตรงกัน' : 'ยังไม่มีบริการ'),
    el('p', filtered
      ? 'ลองเปลี่ยนคำค้นหา หรือล้างตัวกรองเพื่อดูทุกบริการ'
      : 'เพิ่มบริการแรกของคุณ แล้วระบบจะคำนวณค่าใช้จ่ายให้ทันที'),
  );
  const row = el('div', '', 'row');
  if (filtered) {
    const clear = el('button', 'ล้างตัวกรอง', 'ghost');
    clear.type = 'button';
    clear.onclick = () => {
      for (const id of ['f-billing', 'f-category', 'f-active', 'q', 'sort']) $(id).value = '';
      load();
    };
    row.appendChild(clear);
  }
  const add = el('button', q ? `เพิ่ม "${q}" เป็นบริการใหม่` : 'เพิ่มบริการ');
  add.type = 'button';
  add.onclick = () => { if (q && !editingId) $('name').value = q; goToForm(); };
  row.appendChild(add);
  box.appendChild(row);
  return box;
}

function scrollToEl(node) {
  node.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
}
function goToForm() {
  scrollToEl(form);
  $('name').focus({ preventScroll: true });
}
$('cta').onclick = goToForm;
document.querySelectorAll('#topnav a').forEach((a) => a.addEventListener('click', (e) => {
  e.preventDefault();
  const id = a.getAttribute('href').slice(1);
  id === 'sub-form' ? goToForm() : scrollToEl($(id));
}));

for (const id of ['f-billing', 'f-category', 'f-active']) $(id).onchange = load;
load();
