const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
fs.mkdirSync(path.join(__dirname,'..','data'), { recursive:true });
const db = new Database(path.join(__dirname,'..','data','panel.sqlite'));
db.pragma('journal_mode = WAL');
db.exec(`
CREATE TABLE IF NOT EXISTS users (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 email TEXT NOT NULL UNIQUE,
 password_hash TEXT NOT NULL,
 role TEXT NOT NULL DEFAULT 'user',
 balance REAL NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS services (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL,
 category TEXT NOT NULL,
 description TEXT DEFAULT '',
 provider_service_id TEXT,
 price_per_1000 REAL NOT NULL,
 min_qty INTEGER NOT NULL DEFAULT 10,
 max_qty INTEGER NOT NULL DEFAULT 10000,
 active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS orders (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER NOT NULL,
 service_id INTEGER NOT NULL,
 provider_order_id TEXT,
 link TEXT NOT NULL,
 quantity INTEGER NOT NULL,
 total REAL NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(user_id) REFERENCES users(id),
 FOREIGN KEY(service_id) REFERENCES services(id)
);
CREATE TABLE IF NOT EXISTS wallet_transactions (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER NOT NULL,
 amount REAL NOT NULL,
 type TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending',
 reference TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(user_id) REFERENCES users(id)
);
`);
const count = db.prepare('SELECT COUNT(*) n FROM services').get().n;
if (!count) {
 const insert = db.prepare('INSERT INTO services(name,category,description,price_per_1000,min_qty,max_qty) VALUES(?,?,?,?,?,?)');
 const seed = db.transaction(() => {
  insert.run('Social media campaign consultation','Marketing','Legitimate campaign planning and optimization support',120,1,20);
  insert.run('Content promotion strategy','Marketing','Content strategy and audience development guidance',80,1,50);
 });
 seed();
}
module.exports = db;
