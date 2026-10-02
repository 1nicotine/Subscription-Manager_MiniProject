const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');
const BILLINGS = ['monthly', 'yearly'];
const CATEGORIES = ['entertainment', 'music', 'cloud', 'education', 'other'];

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// ---------- data helpers ----------
function loadData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return [];
  }
}
function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(subs, null, 2));
}
let subs = loadData();
let nextId = subs.reduce((max, s) => Math.max(max, s.id), 0) + 1;

const isText = (v) => typeof v === 'string' && v.trim() !== '';
const isPrice = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0;

// ---------- routes ----------
// GET /api/subscriptions?billing=monthly&category=music&active=true
app.get('/api/subscriptions', (req, res) => {
  const { billing, category, active } = req.query;
  let result = subs;
  if (billing) result = result.filter((s) => s.billing === billing);
  if (category) result = result.filter((s) => s.category === category);
  if (active !== undefined) result = result.filter((s) => s.active === (active === 'true'));
  res.json(result);
});

// GET /api/subscriptions/:id
app.get('/api/subscriptions/:id', (req, res) => {
  const sub = subs.find((s) => s.id === Number(req.params.id));
  if (!sub) return res.status(404).json({ error: 'ไม่พบรายการนี้' });
  res.json(sub);
});

// POST /api/subscriptions
app.post('/api/subscriptions', (req, res) => {
  const { name, price, billing, category = 'other', nextPayment = '' } = req.body || {};
  if (!isText(name) || price === undefined || !isText(billing)) {
    return res.status(400).json({ error: 'ต้องระบุ name, price และ billing' });
  }
  if (!isPrice(price)) return res.status(400).json({ error: 'price ต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป' });
  if (!BILLINGS.includes(billing)) {
    return res.status(400).json({ error: `billing ต้องเป็น ${BILLINGS.join(' หรือ ')}` });
  }
  if (!CATEGORIES.includes(category)) {
    return res.status(400).json({ error: `category ต้องเป็นหนึ่งใน: ${CATEGORIES.join(', ')}` });
  }
  const sub = {
    id: nextId++,
    name: name.trim(),
    price,
    billing,
    category,
    nextPayment,
    active: true,
    createdAt: new Date().toISOString(),
  };
  subs.push(sub);
  saveData();
  res.status(201).json(sub);
});

// PATCH /api/subscriptions/:id
app.patch('/api/subscriptions/:id', (req, res) => {
  const sub = subs.find((s) => s.id === Number(req.params.id));
  if (!sub) return res.status(404).json({ error: 'ไม่พบรายการนี้' });

  const body = req.body || {};
  if ('name' in body && !isText(body.name)) return res.status(400).json({ error: 'name ห้ามว่าง' });
  if ('price' in body && !isPrice(body.price)) return res.status(400).json({ error: 'price ไม่ถูกต้อง' });
  if ('billing' in body && !BILLINGS.includes(body.billing)) return res.status(400).json({ error: 'billing ไม่ถูกต้อง' });
  if ('category' in body && !CATEGORIES.includes(body.category)) return res.status(400).json({ error: 'category ไม่ถูกต้อง' });
  if ('active' in body && typeof body.active !== 'boolean') return res.status(400).json({ error: 'active ต้องเป็น true หรือ false' });

  for (const key of ['name', 'price', 'billing', 'category', 'nextPayment', 'active']) {
    if (key in body) sub[key] = typeof body[key] === 'string' ? body[key].trim() : body[key];
  }
  saveData();
  res.json(sub);
});

// DELETE /api/subscriptions/:id
app.delete('/api/subscriptions/:id', (req, res) => {
  const index = subs.findIndex((s) => s.id === Number(req.params.id));
  if (index === -1) return res.status(404).json({ error: 'ไม่พบรายการนี้' });
  subs.splice(index, 1);
  saveData();
  res.status(204).end();
});

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
