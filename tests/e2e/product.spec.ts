import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
async function demo(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page
    .getByRole("button", { name: "Explorar demonstração local", exact: true })
    .click();
  await expect(page).toHaveURL(/onboarding/);
}
test("visitante: páginas privadas protegidas, API sem identidade, cron e CSRF", async ({
  page,
  request,
}) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/login/);
  expect((await request.get("/api/internal/sports-status")).status()).toBe(401);
  const privateResponse = await request.get("/api/me/favorites");
  expect([401, 503]).toContain(privateResponse.status());
  expect(await privateResponse.text()).not.toContain("stack");
  for (const authorization of [undefined, "Bearer errado"]) {
    const r = await request.post("/api/internal/sync", {
      headers: authorization ? { authorization } : {},
    });
    expect(r.status()).toBe(401);
  }
  const origin = await request.post("/api/me/favorites", {
    headers: { origin: "https://evil.test" },
    data: { teamId: "10000000-0000-4000-8000-000000000001" },
  });
  expect(origin.status()).toBe(403);
  const login = await request.post("/auth/login", {
    headers: {
      origin: "https://evil.test",
      "content-type": "application/x-www-form-urlencoded",
    },
    data: "email=x%40example.com&password=invalid",
    maxRedirects: 0,
  });
  expect(login.status()).toBe(303);
  expect(login.headers().location).toContain("status=falha");
  const callback = await request.get("/auth/callback?next=https://evil.test", {
    maxRedirects: 0,
  });
  expect(callback.headers().location).toMatch(
    /^http:\/\/localhost:3000\/login/,
  );
});
test("produto: vários favoritos, persistência, agenda, sem spoiler, perfil, remoção e logout", async ({
  page,
  context,
}) => {
  await demo(page);
  await page
    .getByRole("button", { name: "Adicionar Aurora FC", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Remover Aurora FC" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Adicionar Porto Verde", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Remover Porto Verde" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Remover Aurora FC" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Meu radar está pronto" }).click();
  await expect(
    page.getByRole("heading", { name: "Meu Futebol Hoje." }),
  ).toBeVisible();
  await expect(page.locator(".fixture-card").first()).toBeVisible();
  await page.goto("/calendario");
  await page.getByLabel("Período").selectOption("mes");
  await page.getByRole("button", { name: "Filtrar", exact: true }).click();
  expect(await page.locator(".fixture-card").count()).toBeGreaterThan(1);
  await page
    .getByRole("combobox", { name: "Time", exact: true })
    .selectOption("10000000-0000-4000-8000-000000000001");
  await page.getByRole("button", { name: "Filtrar", exact: true }).click();
  for (const card of await page.locator(".fixture-card").all())
    await expect(card).toContainText("Aurora FC");
  await page.goto("/configuracoes");
  await page.getByLabel("Nome de exibição").fill("Torcedor");
  await page.getByRole("button", { name: "Salvar perfil" }).click();
  await expect(page.getByRole("status")).toContainText("Alterações salvas.");
  await page.getByRole("checkbox", { name: /Modo sem spoiler/ }).check();
  await page.getByRole("button", { name: "Salvar preferências" }).click();
  await expect(
    page.getByText("Sem spoiler ativado", { exact: true }),
  ).toBeVisible();
  await page.goto("/dashboard");
  await expect(
    page.getByRole("img", { name: "Placar oculto" }).first(),
  ).toBeVisible();
  const response = await context.request.get("/api/dashboard");
  const data = await response.json();
  expect(data.hideScores).toBe(true);
  for (const f of data.fixtures) {
    expect(f.home_score).toBeNull();
    expect(f.away_score).toBeNull();
    expect(f.home_penalties).toBeNull();
    expect(f.status).toBe("HIDDEN");
  }
  await page.goto("/times/aurora-fc");
  await expect(
    page.getByText(
      "Classificação oculta no modo sem spoiler, pois pode revelar resultados.",
    ),
  ).toBeVisible();
  await page.goto("/meus-times");
  await page
    .getByRole("button", { name: "Remover Porto Verde", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Adicionar Porto Verde", exact: true }),
  ).toBeVisible();
  await page.goto("/configuracoes");
  await page
    .getByRole("button", { name: "Sair da conta", exact: true })
    .click();
  await expect(page).toHaveURL(/login/);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/login/);
  expect(
    (await context.cookies()).find((c) => c.name === "tr-demo"),
  ).toBeUndefined();
});
test("API: entrada inválida, autoridade falsa e nenhum write via GET", async ({
  page,
  context,
}) => {
  await demo(page);
  const id = "10000000-0000-4000-8000-000000000001";
  const write = () =>
    context.request.post("/api/me/favorites", {
      headers: { origin: "http://localhost:3000" },
      data: { teamId: id, user_id: "forjado" },
    });
  expect((await write()).status()).toBe(400);
  for (const url of [
    "/api/teams?search=" + encodeURIComponent("<script>alert(1)</script>"),
    "/api/teams?page=0",
    "/api/teams?page=1&page=2",
    "/api/calendar?range=ano",
  ])
    expect((await context.request.get(url)).status()).toBe(400);
  const xss = await context.request.post("/api/me/profile", {
    headers: { origin: "http://localhost:3000" },
    data: { display_name: "<img src=x onerror=alert(1)>" },
  });
  expect(xss.status()).toBe(400);
  const huge = await context.request.post("/api/me/profile", {
    headers: {
      origin: "http://localhost:3000",
      "content-type": "application/json",
    },
    data: "x".repeat(5000),
  });
  expect(huge.status()).toBe(413);
  const badOrigin = await context.request.post("/api/me/favorites", {
    headers: { origin: "https://evil.test" },
    data: { teamId: id },
  });
  expect(badOrigin.status()).toBe(403);
  expect((await context.request.get("/api/me/favorites/" + id)).status()).toBe(
    404,
  );
  const f = await context.request.get("/api/me/favorites");
  expect((await f.json()).teams).toHaveLength(0);
  expect(f.headers()["cache-control"]).toContain("no-store");
});
test("busca, estado vazio, teclado e layouts sem overflow", async ({
  page,
}) => {
  await demo(page);
  await page.getByLabel("Pesquisar times").fill("Inexistente");
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Nenhum time encontrado." }),
  ).toBeVisible();
  for (const width of [320, 375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const url of [
      "/",
      "/onboarding",
      "/dashboard",
      "/calendario",
      "/configuracoes",
      "/times/aurora-fc",
    ]) {
      await page.goto(url);
      const over = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      expect(over, `${url} em ${width}px`).toBe(false);
    }
  }
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Pular para o conteúdo" }),
  ).toBeFocused();
});
test("acessibilidade automatizada das telas principais", async ({ page }) => {
  await demo(page);
  for (const url of [
    "/",
    "/login",
    "/onboarding",
    "/dashboard",
    "/calendario",
    "/configuracoes",
    "/times/aurora-fc",
    "/privacidade",
  ]) {
    await page.goto(url);
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(
      result.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
      url,
    ).toEqual([]);
  }
});
