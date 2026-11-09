import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("build real: CSP nonce, cache privado, sem eval, sem demo e sem violações CSP", async ({
  page,
  request,
}) => {
  const violations: string[] = [];
  page.on("console", (m) => {
    if (/Content Security Policy|Refused to/.test(m.text()))
      violations.push(m.text());
  });
  const r = await page.goto("/");
  expect(r?.status()).toBe(200);
  const html = await r!.text();
  for (const fictitious of ["Aurora FC", "Porto Verde", "Liga de Demonstração"])
    expect(html).not.toContain(fictitious);
  const csp = r!.headers()["content-security-policy"];
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).not.toContain("unsafe-eval");
  expect(csp).not.toContain("unsafe-inline");
  expect(csp).toContain("nonce-");
  expect(r!.headers()["cache-control"]).toContain("no-store");
  expect(r!.headers()["x-content-type-options"]).toBe("nosniff");
  expect(r!.headers()["strict-transport-security"]).toContain("max-age=");
  await expect(
    page.getByRole("heading", { name: /A paixão é sua/ }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /demonstração/ })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("link", { name: "Criar conta", exact: true }),
  ).toBeVisible();
  expect(violations).toEqual([]);
  const second = await request.get("/");
  expect(second.headers()["content-security-policy"]).not.toBe(csp);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});
test("PWA: somente shell público em cache, fallback genérico offline", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  const urls = await page.evaluate(async () => {
    const keys = await caches.keys();
    const urls: string[] = [];
    for (const k of keys) {
      const cache = await caches.open(k);
      for (const r of await cache.keys()) urls.push(new URL(r.url).pathname);
    }
    return urls.sort();
  });
  expect(urls).toEqual(["/offline.css", "/offline.html"]);
  await context.setOffline(true);
  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: "Seu radar está sem conexão." }),
  ).toBeVisible();
  await expect(
    page.getByText("Nenhum dado pessoal é armazenado offline.", {
      exact: false,
    }),
  ).toBeVisible();
  await context.setOffline(false);
});
