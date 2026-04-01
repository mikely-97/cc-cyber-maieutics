import { describe, it, expect, afterEach } from "vitest";
import { getDatabase, closeDatabase } from "../../src/db/connection.js";
import { applySchema, TABLES } from "../../src/db/schema.js";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const TEST_DIR = join(tmpdir(), "maieutic-test-schema");

describe("schema", () => {
  afterEach(() => {
    closeDatabase();
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it("creates all required tables", () => {
    const db = getDatabase(TEST_DIR);
    applySchema(db);
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as { name: string }[];
    const tableNames = tables.map((t) => t.name);
    for (const table of TABLES) {
      expect(tableNames).toContain(table);
    }
  });

  it("creates the FTS5 virtual table", () => {
    const db = getDatabase(TEST_DIR);
    applySchema(db);
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='qa_fts'")
      .all() as { name: string }[];
    expect(tables.length).toBe(1);
  });

  it("is idempotent — running twice does not error", () => {
    const db = getDatabase(TEST_DIR);
    applySchema(db);
    expect(() => applySchema(db)).not.toThrow();
  });

  it("enforces foreign keys", () => {
    const db = getDatabase(TEST_DIR);
    applySchema(db);
    expect(() => {
      db.prepare(
        "INSERT INTO questions (id, inquiry_id, round, element, question, created_at) VALUES (?, ?, ?, ?, ?, ?)"
      ).run("q1", "nonexistent", 0, "purpose", "test?", new Date().toISOString());
    }).toThrow();
  });
});
