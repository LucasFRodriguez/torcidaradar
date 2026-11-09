# Plano e registro de execução

## Premissas

Repositório inicial: apenas README. Next 16 App Router, SSR server-only, SDK Supabase oficial, PostgreSQL com RLS. Sem credenciais externas na máquina. Demonstração exclusivamente local com entidades explicitamente fictícias. Sem implantação/push.

## Fases e critérios

A. Diagnóstico, fontes oficiais e ameaça: registrar decisões e superfícies antes de implementar.
B. Fundação: build estrito, SSR PKCE, autenticação por getUser, migrations e testes SQL A/B/anônimo de CRUD, origem e schemas.
C. Esportes: adaptador validado, timeout/retry limitado, job autenticado, lease/orçamento persistidos e upserts idempotentes.
D. Produto: favoritos, painel, filtros, clube/classificação, preferências, conta e PWA; smoke funcional local.
E. Qualidade: lint, tipos, unidade, integração SQL, E2E/acessibilidade/responsividade, build e audit; documentação de limitações.

## Registro

- A: especificação integral lida; checkout limpo, somente README. Política de rede impede sites de documentação; fontes oficiais consultadas via raw.githubusercontent.com. Sem Supabase/API-Football configurados. Nenhuma alteração de produção.

## Fontes consultadas em 2026-11-09

- Next CSP e proxy: https://github.com/vercel/next.js/blob/canary/docs/01-app/02-guides/content-security-policy.mdx (nonce, renderização dinâmica, sem unsafe-eval em produção).
- Supabase SSR: https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/auth/server-side/creating-a-client.mdx (cookies getAll/setAll, cache headers, getClaims/getUser).
- Supabase senhas: https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/auth/password-security.mdx (reauth, proteção contra senhas vazadas dependente do plano).
- API-Football documentação web e OWASP web bloqueados pela rede; formatos serão validados por schemas e testes contratuais; integração real e cobertura permanecem gates externos.

## Evidências intermediárias por fase

- B: migrations iniciais + testes de isolamento PostgreSQL: 19/19; schemas e fronteiras: 4/4. Typecheck/lint corrigidos antes de continuar. SSR/Auth implementado; Auth/SMTP real bloqueado por ausência de projeto/credenciais.
- C: adaptador + fronteiras: 11/11 unitários; integração SQL ampliada a 20/20 com upsert de fixture corrigido sem duplicar, estados excepcionais e substituição transacional de classificação. Fornecedor real não consultado sem chave.
- D: 5/5 E2E de produto passaram em Chromium do sistema: favoritos múltiplos persistidos no demo, remoção, filtros, sem spoiler nos DTOs, perfil e logout. Sem overflow em 320/375/768/1024/1440px nas seis telas verificadas. Axe sem violações nas oito telas verificadas.
- Correções após E2E: Referrer-Policy same-origin preserva Origin de formulários sem relaxar CSRF; contraste do texto “vs” corrigido. Seleção em teste usa role/nome acessível.
- Dependências: override restrito de versões vulneráveis de minimatch para 11.0.1 no tooling para GHSA-g3hv-75wg-m249; lint/typecheck/unitários passaram e audit retornou zero vulnerabilidades após correção. Reavaliar override quando upstream atualizar.

- E: produção local: 2/2 E2E passaram (CSP nonce sem violações, cache privado, demo ausente, cache PWA só offline.html/css e navegação offline genérica). npm ci reexecutado com lockfile; audit sem vulnerabilidades conhecidas; boundary de bundles públicos passou. Testes expandidos: 18 unitários + 21 SQL, incluindo reautenticação recente na política de solicitação de exclusão.
- ASVS: catálogo oficial v5.0.0 obtido via GitHub (345 requisitos); seleção relevante consultada e mapeada no checklist, sem alegação de certificação.
- Zod 4: APIs de formato atuais conferidas nas declarações oficiais do pacote instalado (z.uuid, z.email, z.url, z.iso.datetime), sem os aliases depreciados.
- Inspeção visual: capturas desktop e 375px de landing/dashboard revisadas localmente, monogramas próprios e design sóbrio.

- Tooling final: ESLint 10 com plugins oficiais Next/TypeScript/hooks compatíveis, evitando ESLint 9 fora de suporte e peers incompatíveis do pacote agregado. Lockfile reinstalado por npm ci; audit sem vulnerabilidades após override das versões afetadas de minimatch. GitHub Actions oficiais consultadas em refs v7 e fixadas por SHA; execução remota de CI ainda não ocorreu.
