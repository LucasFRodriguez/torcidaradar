# Resultado da implementação local — 2026-11-09

## Implementado e verificado

Produto local com landing, onboarding multi-time, favoritos idempotentes, painel, calendário com filtros de período/clube/competição, página de clube, preferências persistentes, sem spoiler, perfil, logout e PWA. Interface responsiva com monogramas próprios. Os E2E de produto usam demonstração explicitamente fictícia, exclusivamente local. Auth real e o cadastro não foram simulados como se fossem Supabase real.

| Comando                                                                                      | Resultado observado                                            |
| -------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `npm --cache /tmp/torcidaradar-npm ci`                                                       | Instalação reproduzível concluída                              |
| `npm run lint`                                                                               | Passou, sem warnings                                           |
| `npm run typecheck`                                                                          | Passou, TypeScript strict                                      |
| `npm test`                                                                                   | 18 testes unitários passaram                                   |
| `npm run test:integration`                                                                   | 21 testes SQL PostgreSQL/PGlite passaram                       |
| `npm run build`                                                                              | Build de produção concluído                                    |
| `npm run test:boundary`                                                                      | Sem nomes/valores privilegiados nos bundles estáticos e public |
| `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e`                     | 5 testes E2E de produto passaram                               |
| `E2E_PRODUCTION=true PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e` | 2 testes E2E de produção passaram                              |
| `npm --cache /tmp/torcidaradar-npm audit --audit-level=moderate`                             | Zero vulnerabilidades conhecidas na auditoria                  |
| `git diff --check`                                                                           | Sem erros de whitespace                                        |

Os 46 testes são unitários/contratuais (18), integração do banco (21) e browser (7). A matriz responsiva de seis rotas em 320/375/768/1024/1440px não apresentou overflow horizontal. Axe em oito telas não encontrou violações nas tags WCAG A/AA verificadas. Build de produção: CSP nonce dinâmico sem unsafe-eval/inline, sem violações de CSP observadas, no-store, nosniff, HSTS presente e PWA offline genérica. Cache Storage contém só offline.html e offline.css. Esses resultados não certificam WCAG completa nem performance em produção.

As primeiras tentativas identificaram erros de configuração/contraste, que foram corrigidos e reexecutados. O download padrão de Playwright foi negado pela rede; os testes efetivos usaram Chromium instalado no sistema. Uma tentativa de E2E encontrou a porta ocupada pelo servidor de inspeção; esse processo foi encerrado e ambas as suítes passaram com seus próprios servidores. Não houve relaxamento de assertions ou controles para obter aprovação.

## Implementado sem validação externa

Supabase SSR/PKCE, cadastro/confirmação, login real, refresh, recuperação e alteração de senha, persistência entre sessões reais e solicitação de exclusão com reautenticação. Adaptador API-Football e sincronizador com lease, orçamento diário UTC, retry/timeout e upserts. Migrations/RLS e contratos foram exercitados em PostgreSQL embutido, mas nenhum projeto remoto foi alterado.

## Pendente/bloqueado

Ausentes na máquina: URL/publishable key Supabase, credencial privilegiada, chave API-Football e segredo cron; chave de assinatura dedicada deve ser configurada antes de usar recuperação. Configurar de modo seguro conforme ENVIRONMENT.md, aplicar migrations em projeto dedicado e executar VALIDATION.md. Não enviar segredos em chat.

Sem execução possível de SMTP real, confirmação de e-mail, recuperação real, sessões A/B pelo Supabase hospedado, sincronização/cobertura/licença reais por temporada, cron hospedado ou atendimento administrativo de exclusão. CI foi escrito e revisado, mas não executado no GitHub. Não foram exercitados TLS/CDN/WAF, restauração de backups, alertas ou Core Web Vitals em host representativo. Contato, responsável e SLA das páginas legais precisam de configuração/revisão.

## Riscos remanescentes

As verificações locais não excluem vulnerabilidades em integrações e infraestrutura ainda não testadas. service_role continua amplo e isolado no servidor para infraestrutura; reavaliar role/worker dedicado antes de ampliar operação. Limite PostgreSQL não substitui defesa volumétrica de edge. O job depende de host com tempo de execução adequado e pode deixar atualização parcial em falha, com status e timestamp explícitos. Exclusão é uma solicitação pending que exige atendimento, nunca uma exclusão automática alegada. Textos legais são modelos a revisar.

Nenhum deploy, push, reset ou modificação de banco remoto de produção foi realizado. Lançamento requer validação de staging, revisão do checklist e autorização explícita do proprietário.
