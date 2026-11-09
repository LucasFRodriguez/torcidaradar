// Test-only PostgREST-shaped adapter backed by the real PGlite PostgreSQL engine.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import type { SupabaseClient } from "@supabase/supabase-js";
export async function sportsDatabase() {
  const pg = new PGlite();
  await pg.exec(
    `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select '{}'::jsonb$$;grant usage on schema public,auth to anon,authenticated,service_role;`,
  );
  for (const f of readdirSync("supabase/migrations").sort())
    await pg.exec(readFileSync("supabase/migrations/" + f, "utf8"));
  return pg;
}
const functions: Record<string, string[]> = {
  reserve_sports_request: [
    "p_owner",
    "p_endpoint",
    "p_priority",
    "p_config",
    "p_cost",
  ],
  settle_sports_request: ["p_reservation", "p_observation"],
  claim_sports_task: ["p_owner", "p_config"],
  finish_sports_task: ["p_owner", "p_task", "p_error", "p_delay"],
  commit_sports_discovery: ["p_owner", "p_season", "p_rows"],
  commit_sports_resource: [
    "p_owner",
    "p_kind",
    "p_league",
    "p_season",
    "p_rows",
  ],
  mark_sports_failure: [
    "p_owner",
    "p_league",
    "p_season",
    "p_resource",
    "p_state",
  ],
};
const encode = (v: unknown) =>
  v !== null && typeof v === "object" ? JSON.stringify(v) : v;
const identifier = (v: string) => {
  if (!/^[a-z_]+$/.test(v)) throw new Error("Invalid test identifier");
  return '"' + v + '"';
};
export function sportsClient(pg: PGlite, fail?: () => boolean): SupabaseClient {
  return {
    rpc: async (name: string, args: Record<string, unknown>) => {
      if (!functions[name]) throw new Error("Unknown test RPC");
      if (name === "commit_sports_resource" && fail?.())
        return { data: null, error: { code: "test_write_failure" } };
      try {
        const params = functions[name].map((k) => encode(args[k]));
        const r = await pg.query<{ value: unknown }>(
          `select ${identifier(name)}(${params.map((_, i) => "$" + (i + 1)).join(",")}) value`,
          params,
        );
        return { data: r.rows[0].value, error: null };
      } catch {
        return { data: null, error: { code: "test_database_failure" } };
      }
    },
    from: (table: string) => {
      if (
        !["sync_runs", "sports_provider_state", "sports_sync_tasks"].includes(
          table,
        )
      )
        throw new Error("Unknown test table");
      let op = "read",
        values: Record<string, unknown> = {},
        single = false,
        head = false;
      let ordering = "",
        rowLimit = "";
      const filters: { col: string; operator: string; value: unknown }[] = [];
      const execute = async () => {
        try {
          const params: unknown[] = [];
          const bind = (v: unknown) => {
            params.push(encode(v));
            return "$" + params.length;
          };
          let sql: string;
          if (op === "insert" || op === "upsert") {
            const keys = Object.keys(values);
            sql = `insert into ${identifier(table)}(${keys.map(identifier).join(",")}) values(${keys.map((k) => bind(values[k])).join(",")})${op === "upsert" ? " on conflict(task_key) do nothing" : ""} returning to_jsonb(${identifier(table)}) value`;
          } else {
            const assignments =
              op === "update"
                ? Object.keys(values)
                    .map((k) => identifier(k) + "=" + bind(values[k]))
                    .join(",")
                : "";
            const where = filters.map(
              (f) => identifier(f.col) + f.operator + bind(f.value),
            );
            sql =
              op === "update"
                ? `update ${identifier(table)} set ${assignments}`
                : `select to_jsonb(t) value from ${identifier(table)} t`;
            if (where.length) sql += " where " + where.join(" and ");
            if (op === "read") sql += ordering + rowLimit;
            if (op === "update")
              sql += " returning to_jsonb(" + identifier(table) + ") value";
          }
          const r = await pg.query<{ value: unknown }>(sql, params);
          const rows = r.rows.map((r) => r.value);
          return {
            data: head ? null : single ? (rows[0] ?? null) : rows,
            error: null,
            count: rows.length,
          };
        } catch {
          return { data: null, error: { code: "test_database_failure" } };
        }
      };
      const b = {
        insert: (v: Record<string, unknown>) => {
          op = "insert";
          values = v;
          return b;
        },
        upsert: (v: Record<string, unknown>) => {
          op = "upsert";
          values = v;
          return b;
        },
        update: (v: Record<string, unknown>) => {
          op = "update";
          values = v;
          return b;
        },
        select: (_cols?: string, opts?: { head?: boolean }) => {
          void _cols;
          head = opts?.head ?? false;
          return b;
        },
        eq: (col: string, value: unknown) => {
          filters.push({ col, operator: "=", value });
          return b;
        },
        gte: (col: string, value: unknown) => {
          filters.push({ col, operator: ">=", value });
          return b;
        },
        order: (col: string, opts: { ascending: boolean }) => {
          ordering =
            " order by " +
            identifier(col) +
            (opts.ascending ? " asc" : " desc");
          return b;
        },
        limit: (n: number) => {
          if (!Number.isSafeInteger(n) || n < 1)
            throw new Error("Invalid limit");
          rowLimit = " limit " + n;
          return b;
        },
        maybeSingle: () => {
          single = true;
          return execute();
        },
        lt: (col: string, value: unknown) => {
          filters.push({ col, operator: "<", value });
          return b;
        },
        lte: (col: string, value: unknown) => {
          filters.push({ col, operator: "<=", value });
          return b;
        },
        single: () => {
          single = true;
          return execute();
        },
        then: (
          resolve: (value: unknown) => unknown,
          reject?: (error: unknown) => unknown,
        ) => execute().then(resolve, reject),
      };
      return b;
    },
  } as unknown as SupabaseClient;
}
