# TorcidaRadar

Seus times. Seu futebol. Tudo no radar.

MVP Next.js App Router, React, TypeScript strict, Tailwind, Supabase Auth/PostgreSQL e adaptador API-Football. Interface em português, datas UTC com apresentação America/Sao_Paulo. Sem escudos de terceiros, analytics, apostas ou deploy automático.

## Requisitos e instalação

Node 22.13+ ou 24+ (validado em 24), npm e Chromium para E2E. Use ambientes e credenciais separados para desenvolvimento, staging e produção.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Se o cache padrão não for gravável no ambiente cloud, use `npm --cache /tmp/torcidaradar-npm ci`. Abra a aplicação no endereço indicado pelo Next localmente.

Sem credenciais, a landing, páginas legais e telas de autenticação funcionam; o acesso real permanece indisponível, sem dados inventados. Para explorar o produto localmente, configure `LOCAL_DEMO=true` em `.env.local`, rode **npm run dev**, acesse `/login` e clique em **Explorar demonstração local**. Aurora FC e demais entidades são fictícios. Favoritos/preferências da demonstração ficam em cookie HttpOnly local; sair limpa esse estado. A flag é ignorada em produção e não substitui Auth. Não existe usuário/senha de teste de produção ou seed de placares reais.

## Supabase

1. Crie um projeto de desenvolvimento dedicado. Defina URL HTTPS e publishable key em `.env.local`; a chave privilegiada fica SOMENTE no servidor.
2. Aplique, na ordem, `supabase/migrations/202611090001_foundation.sql` `202611090002_standings.sql` e `202611090003_free_integration.sql` com Supabase CLI (`supabase db push` em projeto vinculado de desenvolvimento) ou pelo SQL editor. Revise a operação antes de executar; não há banco remoto criado por esta implementação.
3. Auth: habilite e-mail/senha e confirmação de e-mail, configure SMTP, senha mínima de 12 caracteres, proteção contra senhas comprometidas se disponível no plano, rate limits e CAPTCHA conforme risco. Não habilite OAuth automaticamente.
4. Defina Site URL igual a `APP_ORIGIN` e redirect allowlist exata: `APP_ORIGIN/auth/callback`, incluindo os fluxos `?next=/onboarding` e `?next=/atualizar-senha` conforme a configuração do provedor. Nunca use wildcard aberto em produção.
5. Cadastre duas contas próprias de staging e execute o roteiro de `docs/VALIDATION.md`. O fluxo usa PKCE e cookies administrados pelo SDK; não armazena senha fora do provedor. Clientes são exclusivamente servidor, portanto os cookies são HttpOnly, SameSite=Lax e Secure em produção.

Perfis e preferências são criados por upsert autenticado ao salvar; valores ausentes têm defaults seguros. Favoritos usam chave composta e RLS. A aplicação não usa service_role nas operações de domínio do usuário.

## Variáveis

Veja [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md). Nunca versione `.env.local`. Nunca coloque API-Football, service_role ou segredo do job em `NEXT_PUBLIC_*`.

## Sincronização esportiva — API-Football Free

Fornecedor exclusivo API-SPORTS Free, chave somente no servidor. A descoberta usa `/leagues?country=Brazil`, sem IDs presumidos e sem assumir temporada atual disponível. Aplique também `supabase/migrations/202611090003_free_integration.sql` em projeto de desenvolvimento dedicado. Defina `SPORTS_SEASON` explicitamente após conferir a conta; orçamentos iniciais **70/dia e 8/min**, reserva operacional 30, com controle atômico, cabeçalhos, circuit breaker e fila persistente. Sem credenciais ou cobertura: indisponibilidade honesta, sem placares fictícios.

```sh
npm run sync                  # prévia de custo; não faz rede
npm run sync -- --execute     # ciclo real explicitamente autorizado
npm run sports:status         # monitor interno protegido, sem consultar fornecedor
```

A aplicação deve estar iniciada e variáveis exportadas de modo seguro. Jobs usam POST com Bearer CRON_SECRET; o monitor GET exige a mesma autenticação de serviço. Usuário comum não tem acesso. Há tarefas/cadências/recuperação implementadas no banco, mas **agendador externo permanece pendente**. Não há sincronização automática provisionada nesta máquina nem consumo da API real nos testes.

Leia [operação Free, custos, quota, cobertura, endpoints e diagnóstico](docs/API_FOOTBALL_FREE.md) o [plano de correção](docs/SPORTS_FREE_PLAN.md) e o [relatório com evidências](docs/SPORTS_FREE_REPORT.md). A documentação atual substitui os defaults anteriores de budget/IDs fixos. Integração externa continua sem validação até configurar a conta e observar respostas reais; não se promete cobertura de temporada por mocks.

## Qualidade

```sh
npm run lint
npm run typecheck
npm test
npm run test:integration
npm run build
npm run test:boundary
npx playwright install --with-deps chromium
npm run test:e2e
E2E_PRODUCTION=true npm run test:e2e
npm audit --audit-level=high
```

Se já houver Chromium, substitua o download por `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e` (também para a rodada `E2E_PRODUCTION=true`). Não deixe outro servidor ocupando a porta 3000. Integração usa PostgreSQL real embutido (PGlite), roles e migrations reais para RLS, sem precisar de credenciais; não substitui validação de Supabase Auth/SMTP/infra remota. E2E padrão testa demonstração e fronteiras HTTP; a rodada de produção testa CSP e PWA do build, sem dados fictícios.

## Documentação e limites

- [Resultados de validação e pendências](docs/VALIDATION_RESULTS.md)
- [Plano e registro por fase](docs/IMPLEMENTATION_PLAN.md)
- [Arquitetura](docs/ARCHITECTURE.md), [API](docs/API.md), [ameaças](docs/THREAT_MODEL.md)
- [Checklist com evidências](docs/SECURITY_CHECKLIST.md), [validação](docs/VALIDATION.md)
- [Operação/deploy](docs/DEPLOYMENT.md), [roadmap](docs/ROADMAP.md)

A exclusão implementa solicitação autenticada pendente, com senha atual e confirmação. Um operador deve remover dados e usuário Auth em ambiente administrativo restrito e confirmar o atendimento. Não há promessa de exclusão automática. Textos legais são modelos; contato, responsável e prazos devem ser preenchidos após revisão. Nenhum deploy/push foi realizado. Produção depende dos gates operacionais e das integrações reais, não apenas do build.
