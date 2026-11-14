require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const db = require('./src/db');
const { auth, adminOnly, signToken } = require('./src/auth');
const provider = require('./src/provider');

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
if (!process.env.JWT_SECRET) {
  console.error('Set JWT_SECRET in .env before starting.');
  process.exit(1);
}

const adminEmail = process.env.ADMIN_EMAIL;
const adminPassword = process.env.ADMIN_PASSWORD;
if (adminEmail && adminPassword) {
  const exists = db.prepare('SELECT id FROM users WHERE email=?').get(adminEmail.toLowerCase());
  if (!exists) {
    const hash = bcrypt.hashSync(adminPassword, 12);
    db.prepare('INSERT INTO users(email,password_hash,role,balance) VALUES(?,?,?,0)')
      .run(adminEmail.toLowerCase(), hash, 'admin');
    console.log('Created initial admin account:', adminEmail);
  }
}

app.post('/api/register', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !password || password.length < 10)
    return res.status(400).json({ error: 'Valid email and password (10+ characters) required.' });
  try {
    const hash = bcrypt.hashSync(password, 12);
    const info = db.prepare('INSERT INTO users(email,password_hash) VALUES(?,?)').run(email.toLowerCase(), hash);
    const user = db.prepare('SELECT id,email,role,balance FROM users WHERE id=?').get(info.lastInsertRowid);
    res.cookie('token', signToken(user), { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', maxAge: 7*86400000 });
    res.json({ user });
  } catch {
    res.status(409).json({ error: 'This email is already registered.' });
  }
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE email=?').get(String(email || '').toLowerCase());
  if (!user || !bcrypt.compareSync(password || '', user.password_hash))
    return res.status(401).json({ error: 'Email or password is incorrect.' });
  const safe = { id:user.id, email:user.email, role:user.role, balance:user.balance };
  res.cookie('token', signToken(safe), { httpOnly:true, sameSite:'strict', secure:process.env.NODE_ENV==='production', maxAge:7*86400000 });
  res.json({ user:safe });
});

app.post('/api/logout', (req,res) => {
  res.clearCookie('token'); res.json({ ok:true });
});
app.get('/api/me', auth, (req,res) => {
  const user = db.prepare('SELECT id,email,role,balance FROM users WHERE id=?').get(req.user.id);
  res.json({ user });
});
app.get('/api/services', auth, (req,res) => {
  res.json({ services: db.prepare('SELECT id,name,category,description,price_per_1000,min_qty,max_qty,active FROM services WHERE active=1 ORDER BY category,name').all() });
});
app.get('/api/orders', auth, (req,res) => {
  const rows = req.user.role === 'admin'
    ? db.prepare('SELECT o.*,u.email FROM orders o JOIN users u ON u.id=o.user_id ORDER BY o.id DESC LIMIT 200').all()
    : db.prepare('SELECT * FROM orders WHERE user_id=? ORDER BY id DESC LIMIT 100').all(req.user.id);
  res.json({ orders: rows });
});
app.post('/api/orders', auth, (req,res) => {
  const { serviceId, link, quantity } = req.body || {};
  const service = db.prepare('SELECT * FROM services WHERE id=? AND active=1').get(Number(serviceId));
  const qty = Number(quantity);
  if (!service || !link || !/^https:\/\/\S+/i.test(link) || !Number.isInteger(qty) || qty < service.min_qty || qty > service.max_qty)
    return res.status(400).json({ error:'Choose a valid service, HTTPS link and quantity within the allowed range.' });
  const total = Math.round((service.price_per_1000 * qty / 1000) * 100) / 100;
  const user = db.prepare('SELECT balance FROM users WHERE id=?').get(req.user.id);
  if (user.balance < total) return res.status(400).json({ error:'Insufficient wallet balance. Add funds first.' });
  const transaction = db.transaction(() => {
    db.prepare('UPDATE users SET balance=balance-? WHERE id=?').run(total, req.user.id);
    const info = db.prepare('INSERT INTO orders(user_id,service_id,link,quantity,total,status) VALUES(?,?,?,?,?,?)')
      .run(req.user.id, service.id, link, qty, total, 'pending');
    return info.lastInsertRowid;
  });
  const orderId = transaction();
  // Provider submission is deliberately opt-in; verify provider service mapping and platform rules first.
  res.json({ ok:true, orderId, message:'Order created as pending. Admin/provider processing is required.' });
});

app.get('/api/wallet', auth, (req,res) => {
  res.json({ transactions: db.prepare('SELECT * FROM wallet_transactions WHERE user_id=? ORDER BY id DESC LIMIT 100').all(req.user.id), upiId: process.env.UPI_ID || '' });
});
app.post('/api/wallet/request', auth, (req,res) => {
  const amount = Number(req.body?.amount);
  const reference = String(req.body?.reference || '').trim().slice(0,100);
  if (!Number.isFinite(amount) || amount < 10 || amount > 50000 || !reference)
    return res.status(400).json({ error:'Enter amount ₹10–₹50,000 and a payment reference.' });
  const info = db.prepare('INSERT INTO wallet_transactions(user_id,amount,type,status,reference) VALUES(?,?,?,?,?)')
    .run(req.user.id, amount, 'credit', 'pending', reference);
  res.json({ ok:true, transactionId:info.lastInsertRowid, message:'Payment request sent for admin verification.' });
});

app.get('/api/admin/users', auth, adminOnly, (req,res) => {
  res.json({ users: db.prepare('SELECT id,email,role,balance,created_at FROM users ORDER BY id DESC LIMIT 300').all() });
});
app.post('/api/admin/services', auth, adminOnly, (req,res) => {
  const { id,name,category,description,price_per_1000,min_qty,max_qty,active } = req.body || {};
  if (!name || !category || !(Number(price_per_1000)>=0) || !(Number(min_qty)>0) || !(Number(max_qty)>=Number(min_qty)))
    return res.status(400).json({ error:'Invalid service fields.' });
  if (id) db.prepare('UPDATE services SET name=?,category=?,description=?,price_per_1000=?,min_qty=?,max_qty=?,active=? WHERE id=?')
    .run(name,category,description||'',Number(price_per_1000),Number(min_qty),Number(max_qty),active?1:0,Number(id));
  else db.prepare('INSERT INTO services(name,category,description,price_per_1000,min_qty,max_qty) VALUES(?,?,?,?,?,?)')
    .run(name,category,description||'',Number(price_per_1000),Number(min_qty),Number(max_qty));
  res.json({ ok:true });
});
app.post('/api/admin/wallet/:id/approve', auth, adminOnly, (req,res) => {
  const txId = Number(req.params.id);
  const tx = db.prepare("SELECT * FROM wallet_transactions WHERE id=? AND status='pending' AND type='credit'").get(txId);
  if (!tx) return res.status(404).json({ error:'Pending payment request not found.' });
  const run = db.transaction(() => {
    db.prepare("UPDATE wallet_transactions SET status='approved' WHERE id=?").run(txId);
    db.prepare('UPDATE users SET balance=balance+? WHERE id=?').run(tx.amount, tx.user_id);
  });
  run(); res.json({ ok:true });
});
app.get('/api/admin/payment-requests', auth, adminOnly, (req,res) => {
  res.json({ requests: db.prepare("SELECT t.*,u.email FROM wallet_transactions t JOIN users u ON u.id=t.user_id WHERE t.status='pending' ORDER BY t.id").all() });
});
app.post('/api/admin/orders/:id/status', auth, adminOnly, (req,res) => {
  const allowed = ['pending','processing','completed','partial','cancelled','failed'];
  const status = req.body?.status;
  if (!allowed.includes(status)) return res.status(400).json({error:'Invalid status'});
  db.prepare('UPDATE orders SET status=? WHERE id=?').run(status, Number(req.params.id));
  res.json({ok:true});
});

// Provider diagnostics only; never return API key to browser.
app.get('/api/admin/provider', auth, adminOnly, async (req,res) => {
  try { res.json(await provider.getBalance()); }
  catch (e) { res.status(502).json({ error:e.message }); }
});

app.get('*', (req,res) => res.sendFile(path.join(__dirname,'public','index.html')));
app.listen(PORT, () => console.log(`SOHEL MEDIA PANEL running on http://localhost:${PORT}`));
