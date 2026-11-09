import { beforeAll, afterAll, beforeEach, it, expect, describe } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
const db = new PGlite();
const owner = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";
const config = {
  daily: 70,
  minute: 8,
  dailyLimit: 100,
  minuteLimit: 10,
  operationalReserve: 30,
  priorityReserve: 6,
  season: 2024,
};
beforeAll(async () => {
  await db.exec(
    `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select '{}'::jsonb$$;grant usage on schema public,auth to anon,authenticated,service_role;`,
  );
  for (const file of readdirSync("supabase/migrations").sort())
    await db.exec(readFileSync("supabase/migrations/" + file, "utf8"));
});
afterAll(() => db.close());
beforeEach(async () => {
  await db.exec(
    `reset role;delete from sports_data_freshness;delete from standings;delete from fixtures;delete from team_competitions;delete from user_favorite_teams;delete from teams;delete from competition_seasons;delete from competitions;delete from sports_competition_coverage;delete from sports_request_reservations;delete from sports_sync_tasks;delete from job_leases;delete from sports_provider_state;insert into sports_provider_state(provider,day,plan,active,last_status_at,provider_remaining,provider_daily_limit) values('api-football',(now() at time zone 'UTC')::date,'Free',true,now(),100,100);`,
  );
  await db.query("select acquire_sync_lease($1)", [owner]);
});
async function reserve(endpoint = "fixtures", priority = "high", cost = 1) {
  return (
    await db.query<{
      r: { allowed: boolean; reason?: string; reservation?: string };
    }>("select reserve_sports_request($1,$2,$3,$4,$5) r", [
      owner,
      endpoint,
      priority,
      JSON.stringify(config),
      cost,
    ])
  ).rows[0].r;
}
async function settle(id: string, obs: Record<string, unknown>) {
  await db.query("select settle_sports_request($1,$2)", [
    id,
    JSON.stringify(obs),
  ]);
}
async function state() {
  return (
    await db.query<Record<string, unknown>>(
      "select * from sports_provider_state",
    )
  ).rows[0];
}
describe("quota persistente Free PostgreSQL", () => {
  it("limite diário, reserva de prioridade e saldo mínimo para lote", async () => {
    await db.exec(
      "update sports_provider_state set daily_used=68,provider_remaining=32",
    );
    expect(await reserve("fixtures", "high", 3)).toMatchObject({
      allowed: false,
      reason: "budget",
    });
    expect((await reserve()).allowed).toBe(true);
    expect((await reserve()).allowed).toBe(true);
    expect(await reserve()).toMatchObject({ allowed: false, reason: "budget" });
    await db.exec(
      "update sports_provider_state set daily_used=63,provider_remaining=37",
    );
    expect((await reserve("teams", "medium")).allowed).toBe(true);
    expect(await reserve("teams", "medium")).toMatchObject({
      allowed: false,
      reason: "budget",
    });
    expect((await reserve("fixtures", "high")).allowed).toBe(true);
  });
  it("8 por minuto inclui status e bloqueia nona tentativa concorrente", async () => {
    const result = await Promise.all(
      Array.from({ length: 9 }, () => reserve()),
    );
    expect(result.filter((r) => r.allowed)).toHaveLength(8);
    expect(result.at(-1)).toMatchObject({ reason: "minute_budget" });
    expect((await state()).daily_used).toBe(8);
  });
  it("limite real mais restritivo por header prevalece", async () => {
    const first = await reserve();
    await settle(first.reservation!, {
      code: "success",
      dailyRemaining: 32,
      minuteLimit: 2,
      minuteRemaining: 1,
    });
    expect((await reserve()).allowed).toBe(true);
    expect(await reserve()).toMatchObject({ reason: "minute_budget" });
    await db.exec(
      "update sports_request_reservations set reserved_at=now()-interval '61 seconds';update sports_provider_state set minute_observed_at=now()-interval '61 seconds'",
    );
    expect((await reserve()).allowed).toBe(true);
    expect(await reserve()).toMatchObject({ reason: "budget" });
  });
  it("timeouts não reembolsam reservas e settlement é idempotente", async () => {
    const r = await reserve();
    await settle(r.reservation!, { code: "timeout" });
    await settle(r.reservation!, { code: "success", dailyRemaining: 100 });
    expect((await state()).daily_used).toBe(1);
    expect((await state()).last_error).toBe("timeout");
    expect((await state()).provider_remaining).toBe(99);
  });
  it("reconcilia status sem cobrar dia, não aumenta saldo com resposta atrasada", async () => {
    const r = await reserve("status");
    await settle(r.reservation!, {
      code: "success",
      account: {
        subscription: { plan: "Free", active: true },
        requests: { current: 68, limit_day: 100 },
      },
    });
    expect((await state()).daily_used).toBe(0);
    expect((await state()).provider_remaining).toBe(32);
    const n = await reserve();
    await settle(n.reservation!, { code: "success", dailyRemaining: 80 });
    expect((await state()).provider_remaining).toBe(31);
    expect((await reserve("status")).allowed).toBe(false);
  });
  it("renova à meia-noite UTC mas exige novo status antes de cobrar dia", async () => {
    await db.exec(
      "update sports_provider_state set day=(now() at time zone 'UTC')::date-1,daily_used=70,provider_remaining=0,blocked_until=now()+interval '1 hour'",
    );
    expect(await reserve()).toMatchObject({ reason: "status_required" });
    const status = await reserve("status");
    await settle(status.reservation!, {
      code: "success",
      account: {
        subscription: { plan: "Free", active: true },
        requests: { current: 0, limit_day: 100 },
      },
    });
    expect((await reserve()).allowed).toBe(true);
    expect((await state()).daily_used).toBe(1);
  });
  it("falhas sucessivas abrem circuit breaker persistido; auth abre imediatamente", async () => {
    for (let i = 0; i < 3; i++) {
      const r = await reserve();
      await settle(r.reservation!, { code: "network" });
    }
    expect(await reserve()).toMatchObject({ reason: "circuit_open" });
    await db.exec(
      "update sports_provider_state set blocked_until=now()-interval '1 second'",
    );
    const r = await reserve();
    await settle(r.reservation!, { code: "authentication" });
    expect(await reserve()).toMatchObject({ reason: "circuit_open" });
  });
  it("leases impedem dois sincronizadores e worker expirado não consome", async () => {
    expect(
      (
        await db.query<{ ok: boolean }>("select acquire_sync_lease($1) ok", [
          other,
        ])
      ).rows[0].ok,
    ).toBe(false);
    await db.exec("update job_leases set expires_at=now()-interval '1 second'");
    expect(await reserve()).toMatchObject({ reason: "lease_lost" });
    expect(
      (
        await db.query<{ ok: boolean }>("select acquire_sync_lease($1) ok", [
          other,
        ])
      ).rows[0].ok,
    ).toBe(true);
  });
  it("anon e usuário comum não leem quota/credenciais/tarefas nem escrevem esportes", async () => {
    for (const role of ["anon", "authenticated"]) {
      await db.exec("set role " + role);
      try {
        for (const table of [
          "sports_provider_state",
          "sports_request_reservations",
          "sports_sync_tasks",
          "sports_competition_coverage",
        ])
          await expect(db.exec("select * from " + table)).rejects.toThrow(
            /permission denied/,
          );
        await expect(
          db.query("select reserve_sports_request($1,'fixtures','high',$2,1)", [
            owner,
            JSON.stringify(config),
          ]),
        ).rejects.toThrow(/permission denied/);
        await expect(db.exec("update teams set name='Ataque'")).rejects.toThrow(
          /permission denied/,
        );
      } finally {
        await db.exec("reset role");
      }
    }
  });
  it("scheduler retoma tarefa interrompida, respeita dependência e custo máximo", async () => {
    await db.exec(
      "insert into sports_competition_coverage(target,season,provider_id,state) values('serie-a',2024,987,'advertised') on conflict(target,season) do update set state='advertised',provider_id=987",
    );
    await db.query(
      "insert into sports_sync_tasks(task_key,kind,priority,season,league_id,state,owner,lease_until) values('t','teams',2,2024,987,'running',$1,now()-interval '1 second')",
      [other],
    );
    await db.exec(
      "insert into sports_sync_tasks(task_key,kind,priority,season,league_id) values('f','fixtures',1,2024,987)",
    );
    const claim = async () =>
      (
        await db.query<{ r: { id: string; kind: string } | null }>(
          "select claim_sports_task($1,$2) r",
          [owner, JSON.stringify(config)],
        )
      ).rows[0].r;
    const task = await claim();
    expect(task?.kind).toBe("teams");
    await db.query("select finish_sports_task($1,$2,null,86400)", [
      owner,
      task!.id,
    ]);
    expect((await claim())?.kind).toBe("fixtures");
    await db.exec(
      "update sports_provider_state set daily_used=69;update sports_sync_tasks set state='pending',next_run_at=now()",
    );
    expect(await claim()).toBeNull();
  });
});

describe("persistência transacional e integridade", () => {
  const teamRows = [
    {
      provider_id: 111,
      name: "Time de Teste",
      slug: "time-teste-111",
      country: "Brazil",
    },
    {
      provider_id: 222,
      name: "Adversário Teste",
      slug: "adversario-teste-222",
      country: "Brazil",
    },
  ];
  const discovery = [
    {
      target: "serie-a",
      provider_id: 987,
      name: "Serie A",
      type: "League",
      available_seasons: [2024],
      standings: true,
      state: "advertised",
    },
    {
      target: "serie-b",
      provider_id: null,
      name: null,
      type: "League",
      available_seasons: [],
      standings: false,
      state: "unavailable",
    },
    {
      target: "copa-brasil",
      provider_id: null,
      name: null,
      type: "Cup",
      available_seasons: [],
      standings: false,
      state: "unavailable",
    },
  ];
  async function commit(kind: string, rows: unknown[]) {
    return db.query("select commit_sports_resource($1,$2,987,2024,$3)", [
      owner,
      kind,
      JSON.stringify(rows),
    ]);
  }
  async function prepare() {
    await db.query("select commit_sports_discovery($1,2024,$2)", [
      owner,
      JSON.stringify(discovery),
    ]);
    await commit("teams", teamRows);
  }
  it("descoberta idempotente cria tarefas, mas não declara Free verificado", async () => {
    await db.query("select commit_sports_discovery($1,2024,$2)", [
      owner,
      JSON.stringify(discovery),
    ]);
    await db.query("select commit_sports_discovery($1,2024,$2)", [
      owner,
      JSON.stringify(discovery),
    ]);
    expect(
      (await db.query("select * from sports_sync_tasks where league_id=987"))
        .rows,
    ).toHaveLength(3);
    expect(
      (
        await db.query<{ state: string }>(
          "select state from sports_competition_coverage where target='serie-a' and season=2024",
        )
      ).rows[0].state,
    ).not.toBe("unavailable");
  });
  it("upsert de clube preserva UUID e favoritos; falha parcial desfaz o recurso inteiro", async () => {
    await prepare();
    const id = (
      await db.query<{ id: string }>(
        "select id from teams where provider_id=111",
      )
    ).rows[0].id;
    await db.query(
      "insert into auth.users(id) values($1) on conflict do nothing",
      [owner],
    );
    await db.query(
      "insert into user_favorite_teams(user_id,team_id) values($1,$2) on conflict do nothing",
      [owner, id],
    );
    await commit("teams", [
      { ...teamRows[0], name: "Nome corrigido", slug: "nome-corrigido-111" },
    ]);
    expect(
      (
        await db.query<{ team_id: string }>(
          "select team_id from user_favorite_teams where user_id=$1",
          [owner],
        )
      ).rows[0].team_id,
    ).toBe(id);
    await expect(
      commit("teams", [
        { ...teamRows[0], name: "Não deve persistir" },
        { ...teamRows[1], slug: "INVALIDO" },
      ]),
    ).rejects.toThrow();
    expect(
      (
        await db.query<{ name: string }>("select name from teams where id=$1", [
          id,
        ])
      ).rows[0].name,
    ).toBe("Nome corrigido");
  });
  it("fixture não duplica, corrige resultados, mantém null diferente de zero e recusa adversário ausente", async () => {
    await prepare();
    const f = {
      provider_id: 333,
      home_id: 111,
      away_id: 222,
      kickoff_at: null,
      status: "TBD",
      home_score: null,
      away_score: null,
      home_penalties: null,
      away_penalties: null,
      round: "Rodada 1",
    };
    await commit("fixtures", [f]);
    await commit("fixtures", [
      { ...f, status: "FT", home_score: 0, away_score: 2 },
    ]);
    const row = (
      await db.query<{
        home_score: number;
        away_score: number;
        kickoff_at: null;
      }>("select * from fixtures where provider_id=333")
    ).rows;
    expect(row).toHaveLength(1);
    expect(row[0]).toMatchObject({
      home_score: 0,
      away_score: 2,
      kickoff_at: null,
    });
    await expect(
      commit("fixtures", [
        { ...f, home_score: 5 },
        { ...f, provider_id: 334, away_id: 999 },
      ]),
    ).rejects.toThrow(/missing opponent/);
    expect(
      (
        await db.query<{ home_score: number }>(
          "select home_score from fixtures where provider_id=333",
        )
      ).rows[0].home_score,
    ).toBe(0);
  });
  it("classificação vazia e inválida preserva conjunto anterior; rollback inclui freshness", async () => {
    await prepare();
    const s = {
      team_id: 111,
      group_name: "Grupo",
      rank: 1,
      points: 3,
      played: 1,
      wins: 1,
      draws: 0,
      losses: 0,
    };
    await commit("standings", [s]);
    const stamp = (
      await db.query<{ last_success_at: Date }>(
        "select last_success_at from sports_data_freshness where resource='standings'",
      )
    ).rows[0].last_success_at;
    await expect(commit("standings", [])).rejects.toThrow(/empty/);
    await expect(
      commit("standings", [
        { ...s, points: 8 },
        { ...s, team_id: 999 },
      ]),
    ).rejects.toThrow(/missing team/);
    expect(
      (await db.query<{ points: number }>("select points from standings"))
        .rows[0].points,
    ).toBe(3);
    expect(
      (
        await db.query<{ last_success_at: Date }>(
          "select last_success_at from sports_data_freshness where resource='standings'",
        )
      ).rows[0].last_success_at,
    ).toEqual(stamp);
  });
  it("worker vencido não grava dados nem renova timestamps", async () => {
    await prepare();
    await db.exec("update job_leases set expires_at=now()-interval '1 second'");
    await expect(commit("teams", teamRows)).rejects.toThrow(/lease lost/);
  });
});
