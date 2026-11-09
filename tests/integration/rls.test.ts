import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
const db = new PGlite();
const A = "00000000-0000-4000-8000-000000000001",
  B = "00000000-0000-4000-8000-000000000002",
  T = "00000000-0000-4000-8000-000000000010";
beforeAll(async () => {
  await db.exec(
    `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;grant usage on schema auth,public to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated;`,
  );
  await db.exec(
    readFileSync("supabase/migrations/202611090001_foundation.sql", "utf8"),
  );
  await db.exec(
    readFileSync("supabase/migrations/202611090002_standings.sql", "utf8"),
  );
  await db.query("insert into auth.users values($1),($2)", [A, B]);
  await db.query(
    "insert into public.teams(id,provider_id,name,slug) values($1,1,'Teste','teste')",
    [T],
  );
  for (const u of [A, B]) {
    await db.query("insert into profiles(id,display_name) values($1,$2)", [
      u,
      u === A ? "Pessoa A" : "Pessoa B",
    ]);
    await db.query("insert into user_preferences(user_id) values($1)", [u]);
    await db.query(
      "insert into user_favorite_teams(user_id,team_id) values($1,$2)",
      [u, T],
    );
  }
});
afterAll(() => db.close());
async function asUser<T>(user: string, fn: () => Promise<T>) {
  await db.exec("set role authenticated");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
  await db.query("select set_config('request.jwt.claims',$1,false)", [
    JSON.stringify({
      sub: user,
      amr: [{ method: "password", timestamp: Math.floor(Date.now() / 1000) }],
    }),
  ]);
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
  }
}
describe("RLS real PostgreSQL — CRUD A/B/anônimo", () => {
  for (const [table, key] of [
    ["profiles", "id"],
    ["user_preferences", "user_id"],
    ["user_favorite_teams", "user_id"],
  ]) {
    it(`${table}: A lê somente A; B somente B`, async () => {
      for (const u of [A, B])
        await asUser(u, async () => {
          const r = await db.query<Record<string, string>>(
            `select * from ${table}`,
          );
          expect(r.rows).toHaveLength(1);
          expect(r.rows[0][key]).toBe(u);
        });
    });
    it(`${table}: UPDATE e DELETE cruzados não alteram linhas`, async () => {
      await asUser(A, async () => {
        expect(
          (
            await db.query(
              `update ${table} set ${key}=${key} where ${key}=$1 returning *`,
              [B],
            )
          ).rows,
        ).toHaveLength(0);
        expect(
          (
            await db.query(`delete from ${table} where ${key}=$1 returning *`, [
              B,
            ])
          ).rows,
        ).toHaveLength(0);
      });
    });
    it(`${table}: INSERT e troca do dono negados`, async () => {
      await asUser(A, async () => {
        const insert =
          table === "profiles"
            ? `insert into profiles(id) values('${B}')`
            : table === "user_preferences"
              ? `insert into user_preferences(user_id) values('${B}')`
              : `insert into user_favorite_teams(user_id,team_id) values('${B}','${T}')`;
        await expect(db.exec(insert)).rejects.toThrow();
        await expect(
          db.query(`update ${table} set ${key}=$1 where ${key}=$2`, [B, A]),
        ).rejects.toThrow();
      });
    });
    it(`${table}: anônimo não tem CRUD`, async () => {
      await db.exec("set role anon");
      try {
        for (const sql of [
          `select * from ${table}`,
          `delete from ${table}`,
          `update ${table} set ${key}=${key}`,
          `insert into ${table}(${key}) values('${A}')`,
        ])
          await expect(db.exec(sql)).rejects.toThrow(/permission denied/);
      } finally {
        await db.exec("reset role");
      }
    });
    it(`${table}: dono consegue inserir/atualizar/remover`, async () => {
      await asUser(A, async () => {
        await db.exec("begin");
        try {
          expect(
            (
              await db.query(
                `update ${table} set ${key}=${key} where ${key}=$1 returning *`,
                [A],
              )
            ).rows,
          ).toHaveLength(1);
          expect(
            (
              await db.query(
                `delete from ${table} where ${key}=$1 returning *`,
                [A],
              )
            ).rows,
          ).toHaveLength(1);
          const insert =
            table === "profiles"
              ? `insert into profiles(id) values('${A}')`
              : table === "user_preferences"
                ? `insert into user_preferences(user_id) values('${A}')`
                : `insert into user_favorite_teams(user_id,team_id) values('${A}','${T}')`;
          await db.exec(insert);
        } finally {
          await db.exec("rollback");
        }
      });
    });
  }
  it("sessão nula é negada mesmo com role authenticated", async () => {
    await asUser("", async () => {
      expect((await db.query("select * from profiles")).rows).toHaveLength(0);
      await expect(
        db.query("insert into profiles(id) values($1)", [A]),
      ).rejects.toThrow();
    });
  });
  it("referências esportivas e infraestrutura não podem ser escritas pelo usuário", async () => {
    await asUser(A, async () => {
      await expect(
        db.exec(
          "insert into teams(provider_id,name,slug) values(2,'Falso','falso')",
        ),
      ).rejects.toThrow(/permission denied/);
      await expect(db.exec("select * from sync_runs")).rejects.toThrow(
        /permission denied/,
      );
      await expect(
        db.exec("select consume_rate_limit('x',1,60)"),
      ).rejects.toThrow(/permission denied/);
    });
  });
  it("solicitação de exclusão tem dono e status imutável", async () => {
    await asUser(A, async () => {
      await expect(
        db.query("insert into account_deletion_requests(user_id) values($1)", [
          B,
        ]),
      ).rejects.toThrow();
      await db.query(
        "insert into account_deletion_requests(user_id) values($1)",
        [A],
      );
      await expect(
        db.exec("update account_deletion_requests set status='completed'"),
      ).rejects.toThrow();
    });
  });
  it("fixtures: upsert corrige sem duplicar e preserva estados excepcionais", async () => {
    const U = "00000000-0000-4000-8000-000000000011";
    await db.query(
      "insert into teams(id,provider_id,name,slug) values($1,2,'Outro','outro')",
      [U],
    );
    const c = await db.query<{ id: string }>(
      "insert into competitions(provider_id,name,type) values(71,'Liga','League') returning id",
    );
    const season = await db.query<{ id: string }>(
      "insert into competition_seasons(competition_id,year) values($1,2026) returning id",
      [c.rows[0].id],
    );
    const sid = season.rows[0].id;
    await db.query(
      "insert into fixtures(provider_id,season_id,home_team_id,away_team_id,status) values(11,$1,$2,$3,'TBD')",
      [sid, T, U],
    );
    for (const status of ["PST", "SUSP", "CANC", "AET", "PEN"])
      await db.query(
        "insert into fixtures(provider_id,season_id,home_team_id,away_team_id,status,home_score,away_score) values(11,$1,$2,$3,$4,2,1) on conflict(provider,provider_id) do update set status=excluded.status,home_score=excluded.home_score,away_score=excluded.away_score",
        [sid, T, U, status],
      );
    const r = await db.query<{
      status: string;
      kickoff_at: null;
      home_score: number;
    }>("select * from fixtures where provider_id=11");
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]).toMatchObject({
      status: "PEN",
      kickoff_at: null,
      home_score: 2,
    });
    const row = {
      season_id: sid,
      team_id: T,
      group_name: "Liga",
      rank: 1,
      points: 3,
      played: 1,
      wins: 1,
      draws: 0,
      losses: 0,
      updated_at: new Date().toISOString(),
    };
    await db.query("select replace_standings($1,$2)", [
      sid,
      JSON.stringify([row]),
    ]);
    await db.query("select replace_standings($1,$2)", [
      sid,
      JSON.stringify([{ ...row, group_name: "Novo", points: 4 }]),
    ]);
    expect(
      (await db.query("select * from standings where season_id=$1", [sid]))
        .rows,
    ).toHaveLength(1);
    await expect(
      db.query("select replace_standings($1,$2)", [
        sid,
        JSON.stringify([{ ...row, rank: -1 }]),
      ]),
    ).rejects.toThrow();
    expect(
      (
        await db.query<{ points: number }>(
          "select points from standings where season_id=$1",
          [sid],
        )
      ).rows[0].points,
    ).toBe(4);
  });
  it("solicitação de exclusão requer senha autenticada recentemente também no banco", async () => {
    await asUser(B, async () => {
      for (const amr of [
        [],
        [{ method: "password", timestamp: 0 }],
        [{ method: "otp", timestamp: Math.floor(Date.now() / 1000) }],
      ]) {
        await db.query("select set_config('request.jwt.claims',$1,false)", [
          JSON.stringify({ sub: B, amr }),
        ]);
        await expect(
          db.query(
            "insert into account_deletion_requests(user_id) values($1)",
            [B],
          ),
        ).rejects.toThrow(/row-level security/);
      }
    });
  });
  it("limite atômico, lease exclusivo, orçamento e idempotência", async () => {
    await db.exec("set role service_role");
    try {
      for (const expected of [true, true, false])
        expect(
          (
            await db.query<{ ok: boolean }>(
              "select consume_rate_limit('abc',2,60) ok",
            )
          ).rows[0].ok,
        ).toBe(expected);
      expect(
        (
          await db.query<{ ok: boolean }>("select acquire_sync_lease($1) ok", [
            A,
          ])
        ).rows[0].ok,
      ).toBe(true);
      expect(
        (
          await db.query<{ ok: boolean }>("select acquire_sync_lease($1) ok", [
            B,
          ])
        ).rows[0].ok,
      ).toBe(false);
      for (const expected of [true, true, false])
        expect(
          (
            await db.query<{ ok: boolean }>(
              "select reserve_api_request($1,2) ok",
              [A],
            )
          ).rows[0].ok,
        ).toBe(expected);
      await db.query(
        "insert into user_favorite_teams(user_id,team_id) values($1,$2) on conflict do nothing",
        [A, T],
      );
      expect(
        (
          await db.query("select * from user_favorite_teams where user_id=$1", [
            A,
          ])
        ).rows,
      ).toHaveLength(1);
    } finally {
      await db.exec("reset role");
    }
  });
});
