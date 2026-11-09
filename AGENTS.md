# TorcidaRadar

- Leia docs/IMPLEMENTATION_PLAN.md e docs/SECURITY_CHECKLIST.md antes de modificar fluxos privados.
- TypeScript strict; valide entradas com Zod; autentique novamente em toda entrada servidor.
- DAL do usuário usa cliente SSR sujeito a RLS. Clientes privilegiados só em infraestrutura de limite/job.
- Nunca logue credenciais, cookies, e-mails ou payloads. Não use dados fictícios em produção.
- Execute npm run check, npm run test:integration, npm run build e npm run test:e2e após mudanças relevantes.
- Cada tarefa cloud já é isolada; use o checkout existente, sem criar worktree salvo pedido explícito.
- Sem push, deploy ou operação destrutiva de produção sem autorização.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
