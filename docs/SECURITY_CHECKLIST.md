# Checklist de segurança e evidências

Estado: implementação local validada; **produção não aprovada**. Este documento não atesta conformidade completa com ASVS nem ausência de vulnerabilidades. Falta integração remota e configuração operacional.

| Controle                                       | Estado                                                           | Evidência                                                                                                                                                                                                            |
| ---------------------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identidade servidor, sem confiar em getSession | Implementado; Auth remoto não verificado                         | `src/lib/supabase/server.ts` getUser, proxy getClaims; E2E visitante e testes de autorização HTTP                                                                                                                    |
| PKCE/cookies SSR oficiais                      | Implementado; refresh/SMTP remoto pendentes                      | SDK SSR 0.12.7, cookies HttpOnly/Lax/Secure produção, `src/proxy.ts` preserva setAll/cache headers                                                                                                                   |
| Reautenticação sensível                        | Implementado; provedor real pendente                             | senha atual antes de alteração/solicitação; ticket HMAC com chave dedicada (sem reaproveitar service_role) de recuperação 10min após PKCE, dono/prazo/assinatura testados; RLS de exclusão exige amr password <=5min |
| RLS default deny                               | Verificado em PostgreSQL embutido                                | `tests/integration/rls.test.ts`: CRUD A/B/anônimo, troca de dono, sessão nula, grants e solicitação recente; migrations reais                                                                                        |
| Dono pela sessão / IDOR na API                 | Verificado nas fronteiras e banco; host remoto pendente          | `tests/unit/api-authorization.test.ts`: sessão, user_id forjado, upsert dono e delete com dono; E2E rejeita autoridade falsa; SQL nega cruzamento                                                                    |
| Validação / XSS / SQLi                         | Verificado no escopo dos testes                                  | Zod strict, nome sem markup, paginação/payload limitados, query builder parametrizado, escape React; testes unitários/E2E, sem dangerouslySetInnerHTML                                                               |
| CSRF e métodos                                 | Verificado HTTP local                                            | Origin exata obrigatória, POST/DELETE, GET não altera domínio, SameSite Lax; E2E origem falsa/ausente e testes unitários. Referrer-Policy same-origin preserva Origin de formulários                                 |
| Redirecionamento auth                          | Verificado no helper e callback sem código; troca real pendente  | allowlist exata safeNext e teste E2E sem open redirect                                                                                                                                                               |
| Rate limiting distribuído                      | Núcleo SQL e HTTP verificados; duas instâncias remotas pendentes | consume_rate_limit atômico, buckets SHA-256, Auth global + por e-mail, fail closed, HTTP 429 + Retry-After; teste SQL. Edge/provedor ainda devem ser configurados                                                    |
| Segredos fora do cliente                       | Verificado estruturalmente no build local                        | server-only; publishable config rejeita secret/service_role; `npm run test:boundary` examina `.next/static` e `public`; sem valores reais fornecidos para teste de injeção de segredo                                |
| CSP / cache / HTTPS                            | Headers de build local verificados; TLS/CDN final pendentes      | E2E produção: nonce varia por request, sem unsafe-eval/inline, frame-ancestors none, no-store, nosniff, HSTS e console sem violações                                                                                 |
| Sem spoiler                                    | Verificado em demonstração + domínio                             | placares, pênaltis e status removidos do DTO; tabela removida do retorno de clube; E2E JSON/tela e unidade. Não há notificações/push                                                                                 |
| PWA privada                                    | Verificado em build produção local                               | E2E inspeciona Cache Storage (somente offline.html/css), navega offline para página genérica; SW nunca grava resposta autenticada                                                                                    |
| Fornecedor / SSRF                              | Adaptador testado; API real pendente                             | host/endpoints fixos, redirect error, timeout 12s, <=3 tentativas, orçamento por tentativa, limite 8MB, schemas; testes 429/5xx/timeout/incompleto/vazio                                                             |
| Sync / integridade                             | SQL e contrato verificados; rodada real pendente                 | lease exclusivo, orçamento UTC persistido, upsert fixture corrige sem duplicar, statuses extraordinários, classificação transacional; job inválido rejeitado no E2E                                                  |
| Privacidade/exclusão                           | Fluxo implementado; atendimento e jurídico pendentes             | pedido autenticado RLS pending, senha atual + confirmação literal. Não há alegação de exclusão automática; canal/SLA/responsável não configurados                                                                    |
| Dependências                                   | Audit local sem alertas conhecidos                               | versões exatas/lockfile, override limitado a versões vulneráveis de minimatch, atualizado para 11.0.1 corrige GHSA-g3hv-75wg-m249; lint/tipos/testes passam com override. Reavaliar quando upstream corrigir         |
| Acessibilidade/responsividade                  | Automação e inspeção visual local concluídas                     | Axe em oito telas sem violações; seis telas sem overflow em 320/375/768/1024/1440; navegação por teclado testada. Auditoria humana/AT/CWV pendentes                                                                  |
| CI                                             | Workflow escrito; GitHub não executado                           | install reprodutível, checks, integração, build, boundary, E2E dev/prod, audit. Sem secrets de produção. Dependabot configurado                                                                                      |
| Backups/rotação/monitoramento                  | Documentado; não exercitado em infraestrutura                    | docs/DEPLOYMENT.md. Sync registra apenas códigos/contagens; health só liveness. Não há sink/alerta remoto configurado                                                                                                |

## ASVS 5.0: referências selecionadas

Fonte oficial consultada: [ASVS v5.0.0 CSV](https://github.com/OWASP/ASVS/blob/v5.0.0/5.0/docs_en/OWASP_Application_Security_Verification_Standard_5.0.0_en.csv). O catálogo tem 345 requisitos; a revisão deste MVP é parcial, sem alegação de nível/certificação.

- v5.0.0-1.2.4: consultas parametrizadas/SDK e testes de entrada.
- v5.0.0-1.3.6: origem/path fixos da fornecedora e redirects recusados.
- v5.0.0-3.3.2: SameSite configurado segundo o fluxo PKCE.
- v5.0.0-3.5.1: mutações exigem Origin exata.
- v5.0.0-8.4.1: isolamento usuário/usuário por RLS e entradas HTTP.

## Bloqueadores de lançamento

1. Credenciais/infra Supabase de staging, migrations, Auth/SMTP e testes remotos A/B/anon; confirmar política de senhas e abuso no provedor.
2. API-Football real, licença de exibição/retensão, cobertura por temporada e agendador POST autenticado.
3. Canal de contato, responsável, SLA de exclusão e revisão jurídica dos modelos.
4. HTTPS/CDN/edge, backups/restauração, rotação e alertas revisados no host final.
5. Autorização explícita do proprietário para qualquer deploy de produção.

Não há falha crítica/alta conhecida detectada nas verificações locais. Isso não permite afirmar que riscos críticos/altos foram excluídos: integrações, ambiente final e auditoria independente permanecem sem validação.

## Revisão da integração Free

O adaptador e job antigos foram substituídos. Novos controles: reserva atômica diária/minuto por tentativa, reconciliação conservadora de cabeçalhos/status, exclusividade de plano Free, circuit breaker persistido, admissão pelo pior custo, filas/leases e transações por recurso. RLS bloqueia quota/reservas/tarefas/cobertura para usuário e anônimo; freshness expõe só estado de disponibilidade e timestamps. Respostas vazias/paginação incompleta não substituem dados válidos. O monitor completo exige segredo de serviço. Testes novos estão em free-provider, free-sync, freshness, sports-ui e free-quota; ver relatório Free para resultados finais. Sem validação real de conta/cobertura nem agendamento externo.
