import fs from "fs";
import path from "path";

import Database from "better-sqlite3";

import type { Order } from "@/types/orders";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE =
  process.env.SQLITE_PATH?.trim() || path.join(DATA_DIR, "orders.db");

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!db) {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    db = new Database(DB_FILE);
    db.pragma("journal_mode = WAL");
    db.exec(`
      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        json TEXT NOT NULL
      );
    `);
  }
  return db;
}

export function readOrdersSqlite(): Order[] {
  const rows = getDb()
    .prepare("SELECT json FROM orders")
    .all() as { json: string }[];
  return rows.map((r) => JSON.parse(r.json) as Order);
}

export function writeOrdersSqlite(orders: Order[]) {
  const d = getDb();
  const tx = d.transaction(() => {
    d.prepare("DELETE FROM orders").run();
    const ins = d.prepare("INSERT INTO orders (id, json) VALUES (?, ?)");
    for (const o of orders) {
      ins.run(o.id, JSON.stringify(o));
    }
  });
  tx();
}
