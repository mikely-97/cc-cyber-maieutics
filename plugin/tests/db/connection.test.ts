import { describe, it, expect, afterEach } from "vitest";
import { getDatabase, closeDatabase } from "../../src/db/connection.js";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const TEST_DIR = join(tmpdir(), "maieutic-test-conn");

describe("connection", () => {
  afterEach(() => {
    closeDatabase();
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it("creates database file and returns a usable connection", () => {
    const db = getDatabase(TEST_DIR);
    expect(db).toBeDefined();
    expect(existsSync(join(TEST_DIR, "maieutic.db"))).toBe(true);
  });

  it("returns the same instance on subsequent calls", () => {
    const db1 = getDatabase(TEST_DIR);
    const db2 = getDatabase(TEST_DIR);
    expect(db1).toBe(db2);
  });

  it("enables WAL mode", () => {
    const db = getDatabase(TEST_DIR);
    const result = db.pragma("journal_mode") as { journal_mode: string }[];
    expect(result[0].journal_mode).toBe("wal");
  });

  it("can execute basic SQL", () => {
    const db = getDatabase(TEST_DIR);
    db.exec("CREATE TABLE test (id INTEGER PRIMARY KEY, val TEXT)");
    db.prepare("INSERT INTO test (val) VALUES (?)").run("hello");
    const row = db.prepare("SELECT val FROM test").get() as { val: string };
    expect(row.val).toBe("hello");
  });
});
