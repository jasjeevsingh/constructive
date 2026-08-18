#!/usr/bin/env node
/**
 * Apply a .sql file to the Supabase Postgres provisioned through the Vercel
 * Marketplace. Reads POSTGRES_URL_NON_POOLING from .env.local (the direct
 * connection — the pooled URL rejects some DDL).
 *
 *   node scripts/apply-sql.mjs supabase/migrations/0001_feedback.sql
 *
 * Env comes from .env.local, which is gitignored. Nothing here prints a
 * credential.
 */
import { readFileSync } from "node:fs";
import pg from "pg";

function loadEnvLocal() {
  let raw = "";
  try {
    raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  } catch {
    return;
  }
  for (const line of raw.split("\n")) {
    const m = /^([A-Z0-9_]+)="?([^"]*)"?$/.exec(line.trim());
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const file = process.argv[2];
if (!file) {
  console.error("usage: node scripts/apply-sql.mjs <file.sql>");
  process.exit(1);
}

loadEnvLocal();
const url = process.env.POSTGRES_URL_NON_POOLING ?? process.env.POSTGRES_URL;
if (!url) {
  console.error("POSTGRES_URL_NON_POOLING is not set — run `vercel env pull` first.");
  process.exit(1);
}

// Supabase presents a self-signed cert in its chain. Newer pg treats an
// `sslmode=require` in the URL as `verify-full`, which then overrides the
// client `ssl` option — so strip it and configure TLS explicitly instead.
const parsed = new URL(url);
parsed.searchParams.delete("sslmode");

const sql = readFileSync(file, "utf8");
const client = new pg.Client({
  connectionString: parsed.toString(),
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  await client.query(sql);
  console.log(`applied ${file}`);
} catch (err) {
  console.error(`failed to apply ${file}:`, err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await client.end();
}
