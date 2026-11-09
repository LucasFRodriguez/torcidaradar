# Relatório de correção API-Football Free

## Alterações e preservação

O projeto existente não foi reiniciado. Autenticação, cookies, RLS de usuário, favoritos e identidade visual foram preservados, incluindo arquivos ainda não commitados. Não foi identificado outro fornecedor antigo: foi substituído o adaptador inicial API-Football, que presumia IDs e não tinha controle Free completo. Mocks existentes permanecem só na demonstração local explícita e nos testes; nenhum fallback fictício de produção foi encontrado ou introduzido.

Arquivos principais:

- `src/lib/sports/provider.ts`: transporte GET HTTPS fixo, interface FootballDataProvider, status/Free, validação de envelope, erros sanitizados, retry e quota obrigatória.
- Novos `schemas.ts`, `errors.ts`, `config.ts`, `mappers.ts`, `freshness.ts`: contratos validados, normalização, limites Free e disponibilidade.
- `src/server/jobs/sync.ts` substituído; novos `quota.ts` e `monitor.ts`: execução persistente, prioridade, estimativa, recuperação, circuit breaker, monitor seguro.
- Migration **aditiva** `supabase/migrations/202611090003_free_integration.sql`: quota/reservas/tarefas/cobertura/freshness/rodada, RPCs atômicos, restrições e RLS; migrations anteriores não foram reescritas. Upsert mantém UUID e favoritos. O antigo RPC de quota perdeu execute para service_role.
- `src/server/dal/football.ts`, `domain.ts`, `src/components/football.tsx` e páginas dashboard/calendário/clube: fontes internas, timestamp real por recurso, competições relevantes, rodada/temporada quando disponíveis, estados honestos e proteção de classificação no modo sem spoiler.
- `src/app/api/internal/sync/route.ts`: erros/parcialidade/adiamento retornam status apropriado; nova `api/internal/sports-status/route.ts` protegida pelo segredo de serviço.
- `scripts/sync.ts`: prévia sem rede por default, execução real somente `--execute`; novo `scripts/sports-status.ts` lê monitor interno sem consultar fornecedor.
- `.env.example`, `package.json`, README e documentação de ambiente, API, arquitetura e segurança atualizados. Sem novas dependências ou infraestrutura paga.
- Novos testes `free-provider`, `free-sync`, `freshness`, `sports-ui`, `free-quota`, `free-pipeline` e helper PostgreSQL de testes; regressões anteriores preservadas e atualizadas para o contrato obrigatório de quota.

## Endpoints

Somente o backend usa GET `/status`, `/leagues?country=Brazil`, `/teams?league=&season=`, `/fixtures?league=&season=` e `/standings?league=&season=` na origem fixa API-SPORTS, com `x-apisports-key`. Não há base URL fornecida pelo usuário, proxy genérico, players/squads ou transfers.

Operação: POST `/api/internal/sync` e GET `/api/internal/sports-status`, ambos com Bearer CRON_SECRET e no-store. Sessão comum não autoriza essas rotas. O frontend segue consultando Supabase via DAL autenticada/RLS.

## Dados e cobertura reais

**Nenhum dado real foi obtido nesta tarefa; nenhuma competição/temporada foi validada na conta.** API_FOOTBALL_KEY e configuração Supabase não estão presentes na máquina. A documentação oficial foi solicitada, mas www.api-football.com foi bloqueado pela rede. A política atual também não anuncia v3.football.api-sports.io e requer configuração antes da validação real. Os contratos implementados seguem a especificação fornecida e validação defensiva; não equivalem a confirmação de comportamento do plano.

Não se presume disponibilidade de 2026 ou outro ano. `SPORTS_SEASON` fica vazio no exemplo. `/leagues` descobre IDs e anos anunciados; o monitor distingue advertised/available/unavailable/ambiguous e a disponibilidade de cada recurso pela fila/freshness. Um catálogo anunciado não prova autorização dos endpoints Free.

## Sincronização e orçamento

Default interno 70/dia UTC, 8/min em janela móvel, reserva operacional 30 e reserva de prioridade 6. Tetos configurados Free 100/dia e 10/min são limites de configuração, não promessas: status/headers mais restritivos vencem. Reservas são persistidas antes de cada tentativa; timeout é potencialmente consumido e não é reembolsado. Reconciliation conservadora não aumenta saldo com resposta atrasada. /status é reconciliado a cada >=15min, não cobrado no dia segundo o contrato fornecido, mas conta no minuto. Ao renovar o dia, exige novo status e respeita o saldo remoto mesmo se ainda não renovou.

Tarefas com prazo/backoff persistidos e lease de 10min; fixtures/classificação têm prioridade, mas dependem do catálogo/clubes. Commit por recurso transacional e cercado pelo lease. Resposta vazia ou paginação incompleta não apaga conjunto válido nem renova sucesso. Classificação antecipada quando resultados mudam, sem depender de acesso de usuários. Temporadas históricas usam cadência semanal. Dados correntes: clubes/cobertura diária, fixtures 8h ou 2h em dias de partidas, standings 6h ou após correção relevante. Não é live.

Estimativas sem retries para 3 competições plenamente acessíveis: bootstrap até 10 chamadas cobradas; rotina corrente ~25/dia, dia movimentado ~52/dia antes de antecipações; histórico ~9/semana +1 descoberta/dia. Reserva/cabeçalhos podem reduzir ou adiar esse volume. Consumo observado real: **zero chamadas à API-Football**. Todos os testes usam HTTP determinístico simulado. Invocação manual em prévia foi executada sem rede.

**Não há agendador externo operacional.** A fila/scheduler no banco e o executor estão implementados/testados; next_run_at é elegibilidade. Monitor mostra próxima execução externa nula. Configure um cron autenticado em host adequado, com timeout/alertas, antes de prometer atualização automática. O script executável manual já está implementado e documentado.

## Testes executados

- `npm run check`: lint sem warnings, TypeScript strict e **45 testes unitários aprovados**.
- `npm run test:integration`: **37 aprovados**, incluindo migrations reais em PostgreSQL/PGlite, quota, RLS, isolamento A/B/anônimo, concorrência/lease, dia/minuto, resets UTC, divergência com fornecedor, reservas sem reembolso, circuit breaker, dependências/prioridade, rollback/idempotência/FKs e preservação de favoritos.
- `free-pipeline`: ciclo completo de cliente HTTP simulado → QuotaManager/SQL → scheduler → persistência; repetição idle sem novo consumo e falha de escrita mantendo dados válidos.
- Playwright: **5 E2E de produto +2 de produção aprovados**, com Chromium do sistema; inclusão do monitor negado sem credencial, sem spoiler, responsividade 320/375/768/1024/1440, Axe, CSP e offline seguro.
- `npm run build`, `npm run test:boundary`: aprovados; nenhum nome/valor de chave privilegiada em bundles estáticos/public.
- `npm audit --audit-level=moderate`: zero vulnerabilidades conhecidas na rodada local.
- `npm run sync`: prévia informativa sem acesso de rede, sem custo real.

Não foram executados testes automáticos contra fornecedor real, SMTP/Auth remoto, ambiente de staging/produção, cron hospedado ou medição real de quota. Não há alegação de validação externa por mocks. O helper de testes simula somente a forma PostgREST do cliente; regras, transações e quota são executadas no PostgreSQL real embutido.

## Riscos corrigidos e residuais

Corrigidos: IDs presumidos; reserva apenas diária; concorrência/custo de retries sem reconciliação; minuto sem controle; ausência de circuit breaker; envelopes incompletamente verificados; risco de apagar standings em vazio; writes relacionados não transacionais; falsa indicação de dado atualizado quando apenas uma parte tinha sucesso; monitor sem ferramenta protegida e execução manual sem prévia.

Residuais: chaves/conta/cobertura real e comportamento exato da API ainda não validados; documentação oficial completa bloqueada; infraestrutura pode impor limites de execução menores que 300s; ferramentas externas usando a mesma chave não são controladas pelo contador local; service_role é ampla e permanece confinada ao servidor; agendamento/alertas/retenção de logs ainda precisam ser provisionados. Respostas paginadas inesperadas são rejeitadas em vez de truncadas; suporte a paginação real exige contrato oficial confirmado. Textos legais/canal/licença/backups/edge e gates anteriores de staging continuam necessários.

## Configuração e passos antes de abrir ao público

1. Configurar de modo seguro URL/publishable/service_role Supabase, API_FOOTBALL_KEY, CRON_SECRET, APP_ORIGIN e SPORTS_SEASON validada. Manter as chaves de Auth/recuperação anteriores separadas. Ver `.env.example` e API_FOOTBALL_FREE.md para todos os knobs de orçamento.
2. Liberar os destinos necessários na rede, preservar regras existentes e confirmar documentação oficial/contrato Free/termos de exibição.
3. Aplicar a migration aditiva em projeto de desenvolvimento/staging, rodar testes remotos RLS, observar status/catálogo e validar cada recurso/temporada em execução manual **explicitamente autorizada**, após a estimativa. Não enviar segredos em chat ou código.
4. Configurar e verificar cron POST autenticado, disponibilidade/alertas/recuperação, retenção e rotação. Conferir o saldo observado e o timestamp real de cada recurso.
5. Revisar os gates de segurança/jurídico/backup do MVP e obter autorização explícita antes de deploy de produção.

Nenhum deploy, push, scraping, contratação paga, criação de conta alternativa ou reset de quota/banco remoto foi realizado.
