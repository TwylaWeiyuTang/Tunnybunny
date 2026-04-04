import Database from 'better-sqlite3';
import path from 'path';

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(path.join(__dirname, '../../data.db'));
    db.pragma('journal_mode = WAL');
  }
  return db;
}

export function initDb(): void {
  const database = getDb();

  database.exec(`
    CREATE TABLE IF NOT EXISTS groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      creator TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS group_members (
      group_id TEXT NOT NULL,
      address TEXT NOT NULL,
      display_name TEXT,
      PRIMARY KEY (group_id, address),
      FOREIGN KEY (group_id) REFERENCES groups(id)
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL,
      amount INTEGER NOT NULL,
      description TEXT NOT NULL,
      paid_by TEXT NOT NULL,
      split_type TEXT NOT NULL DEFAULT 'equal',
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (group_id) REFERENCES groups(id)
    );

    CREATE TABLE IF NOT EXISTS expense_splits (
      expense_id TEXT NOT NULL,
      address TEXT NOT NULL,
      amount INTEGER NOT NULL,
      PRIMARY KEY (expense_id, address),
      FOREIGN KEY (expense_id) REFERENCES expenses(id)
    );

    CREATE TABLE IF NOT EXISTS settlements (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL,
      from_address TEXT NOT NULL,
      to_address TEXT NOT NULL,
      amount INTEGER NOT NULL,
      tx_hash TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (group_id) REFERENCES groups(id)
    );
  `);
}
