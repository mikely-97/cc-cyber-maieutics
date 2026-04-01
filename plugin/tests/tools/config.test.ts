import { describe, it, expect, afterEach } from "vitest";
import { getDatabase, closeDatabase } from "../../src/db/connection.js";
import { applySchema } from "../../src/db/schema.js";
import { handleConfig } from "../../src/tools/config.js";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const TEST_DIR = join(tmpdir(), "maieutic-test-config");

function setup() {
  const db = getDatabase(TEST_DIR);
  applySchema(db);
  return db;
}

describe("maieutic_config", () => {
  afterEach(() => {
    closeDatabase();
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it("sets and gets a config value", () => {
    const db = setup();
    handleConfig(db, { action: "set", key: "depth", value: "deep", scope: "project" });
    const result = handleConfig(db, { action: "get", key: "depth" });
    expect(result.config.depth).toBe("deep");
  });

  it("returns all config when no key specified", () => {
    const db = setup();
    handleConfig(db, { action: "set", key: "depth", value: "deep" });
    handleConfig(db, { action: "set", key: "visibility", value: "verbose" });
    const result = handleConfig(db, { action: "get" });
    expect(result.config.depth).toBe("deep");
    expect(result.config.visibility).toBe("verbose");
  });

  it("upserts on set — updates existing keys", () => {
    const db = setup();
    handleConfig(db, { action: "set", key: "depth", value: "shallow" });
    handleConfig(db, { action: "set", key: "depth", value: "deep" });
    const result = handleConfig(db, { action: "get", key: "depth" });
    expect(result.config.depth).toBe("deep");
  });

  it("returns empty config for missing keys", () => {
    const db = setup();
    const result = handleConfig(db, { action: "get", key: "nonexistent" });
    expect(result.config).toEqual({});
  });
});
