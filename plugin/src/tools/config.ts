import type { Database as DatabaseInstance } from "better-sqlite3";

interface ConfigInput {
  action: "get" | "set";
  key?: string;
  value?: string;
  scope?: "project" | "global";
}

interface ConfigResult {
  config: Record<string, string>;
}

export function handleConfig(db: DatabaseInstance, input: ConfigInput): ConfigResult {
  if (input.action === "set") {
    if (!input.key || !input.value) throw new Error("key and value are required for set action");
    const scope = input.scope ?? "project";
    db.prepare(
      `INSERT INTO config (key, value, scope) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, scope = excluded.scope`
    ).run(input.key, input.value, scope);
    return { config: { [input.key]: input.value } };
  }

  if (input.key) {
    const row = db.prepare("SELECT value FROM config WHERE key = ?").get(input.key) as { value: string } | undefined;
    return { config: row ? { [input.key]: row.value } : {} };
  }

  const rows = db.prepare("SELECT key, value FROM config").all() as { key: string; value: string }[];
  const config: Record<string, string> = {};
  for (const row of rows) config[row.key] = row.value;
  return { config };
}
