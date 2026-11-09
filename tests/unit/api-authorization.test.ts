import { beforeEach, describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { HttpError } from "@/lib/security/validation";
const mocks = vi.hoisted(() => ({
  identity: vi.fn(),
  limit: vi.fn(),
  from: vi.fn(),
  eq: vi.fn(),
  upsert: vi.fn(),
  demoState: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ identity: mocks.identity }));
vi.mock("@/server/dal/demo", () => ({
  demoState: mocks.demoState,
  writeDemo: vi.fn(),
  demoTeams: [],
}));
vi.mock("@/lib/security/http", async (original) => ({
  ...(await original<typeof import("@/lib/security/http")>()),
  limit: mocks.limit,
}));
import { POST, DELETE, GET } from "@/app/api/[...path]/route";
const A = "10000000-0000-4000-8000-000000000001";
const T = "10000000-0000-4000-8000-000000000010";
const context = (path: string) => ({
  params: Promise.resolve({ path: path.split("/") }),
});
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("APP_ORIGIN", "http://localhost:3000");
  mocks.demoState.mockResolvedValue(null);
  mocks.limit.mockResolvedValue(undefined);
  const builder = {
    delete: vi.fn(() => builder),
    eq: mocks.eq,
    upsert: mocks.upsert,
  };
  mocks.eq.mockReturnValue(builder);
  mocks.upsert.mockResolvedValue({ error: null });
  mocks.from.mockReturnValue(builder);
  mocks.identity.mockResolvedValue({
    user: { id: A },
    db: { from: mocks.from },
  });
});
describe("autorização na entrada HTTP", () => {
  it("sessão é obrigatória antes de consultar dados", async () => {
    mocks.identity.mockRejectedValue(
      new HttpError(401, "AUTENTICACAO_NECESSARIA"),
    );
    const r = await GET(
      new NextRequest("http://localhost:3000/api/me/favorites"),
      context("me/favorites"),
    );
    expect(r.status).toBe(401);
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("criação usa exclusivamente o dono da sessão", async () => {
    const r = await POST(
      new NextRequest("http://localhost:3000/api/me/favorites", {
        method: "POST",
        headers: {
          origin: "http://localhost:3000",
          "content-type": "application/json",
        },
        body: JSON.stringify({ teamId: T }),
      }),
      context("me/favorites"),
    );
    expect(r.status).toBe(200);
    expect(mocks.upsert).toHaveBeenCalledWith(
      { user_id: A, team_id: T },
      expect.objectContaining({ ignoreDuplicates: true }),
    );
  });
  it("autoridade user_id forjada é rejeitada antes de write", async () => {
    const r = await POST(
      new NextRequest("http://localhost:3000/api/me/favorites", {
        method: "POST",
        headers: {
          origin: "http://localhost:3000",
          "content-type": "application/json",
        },
        body: JSON.stringify({ teamId: T, user_id: "pessoa-b" }),
      }),
      context("me/favorites"),
    );
    expect(r.status).toBe(400);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it("remoção sempre filtra o proprietário, além do time", async () => {
    await DELETE(
      new NextRequest("http://localhost:3000/api/me/favorites/" + T, {
        method: "DELETE",
        headers: { origin: "http://localhost:3000" },
      }),
      context("me/favorites/" + T),
    );
    expect(mocks.eq).toHaveBeenCalledWith("user_id", A);
    expect(mocks.eq).toHaveBeenCalledWith("team_id", T);
  });
  it("origem ausente rejeita antes de autenticar; limite efetivo retorna 429", async () => {
    const r = await POST(
      new NextRequest("http://localhost:3000/api/me/favorites", {
        method: "POST",
      }),
      context("me/favorites"),
    );
    expect(r.status).toBe(403);
    expect(mocks.identity).not.toHaveBeenCalled();
    mocks.limit.mockRejectedValue(new HttpError(429, "LIMITE_DE_REQUISICOES"));
    const limited = await GET(
      new NextRequest("http://localhost:3000/api/me/favorites"),
      context("me/favorites"),
    );
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("60");
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
