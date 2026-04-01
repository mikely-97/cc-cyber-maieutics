import type DatabaseConstructor from "better-sqlite3";
import type { Database as DatabaseInstance } from "better-sqlite3";
import { createRequire } from "node:module";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

let _Database: typeof DatabaseConstructor | null = null;
let _db: DatabaseInstance | null = null;

function loadDatabase(): typeof DatabaseConstructor {
  if (!_Database) {
    const require = createRequire(import.meta.url);
    _Database = require("better-sqlite3") as typeof DatabaseConstructor;
  }
  return _Database;
}

export function getDatabase(dbDir: string): DatabaseInstance {
  if (_db) return _db;

  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true });
  }

  const dbPath = join(dbDir, "maieutic.db");
  const Database = loadDatabase();
  _db = new Database(dbPath);

  _db.pragma("journal_mode = WAL");
  _db.pragma("synchronous = NORMAL");
  _db.pragma("foreign_keys = ON");

  return _db;
}

export function closeDatabase(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}

export function resolveDbDir(): string {
  const envDir = process.env.MAIEUTIC_DB_DIR;
  if (envDir) {
    return envDir.startsWith("/") ? envDir : join(process.cwd(), envDir);
  }
  return join(process.cwd(), ".maieutic");
}
