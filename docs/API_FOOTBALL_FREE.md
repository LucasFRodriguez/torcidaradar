# Operação API-Football Free

## Configuração e requisitos

O único fornecedor de produção é API-SPORTS/API-Football, origem HTTPS fixa `https://v3.football.api-sports.io`. Não há scraping, fallback fictício, plano pago, elencos ou transferências nesta implementação. O MVP/autenticação existentes foram preservados. Dados de demonstração continuam isolados e sinalizados localmente, bloqueados em produção.

1. Configure Supabase de desenvolvimento dedicado e aplique as migrations **na ordem**, incluindo `202611090003_free_integration.sql`. A nova migration é aditiva; não altera UUIDs de clubes ou favoritos. Migra histórico do contador diário anterior e timestamps de registros válidos; não reseta a quota do dia.
2. Configure `API_FOOTBALL_KEY` somente no servidor e as variáveis abaixo. A aplicação inicia sem chave; o job retorna indisponibilidade, e o produto não cria dados substitutos.
3. Escolha `SPORTS_SEASON` explicitamente. Não há fallback para o ano atual: o Free pode permitir apenas temporadas históricas. É preciso conferir disponibilidade na conta e observar erros `plan`/`coverage` ao consultar cada recurso.
4. O primeiro ciclo autorizado consulta `/status`, exige assinatura ativa com nome Free, depois consulta `/leagues?country=Brazil`. Detecta Série A, Série B e Copa do Brasil por nome normalizado, país e tipo, usando os IDs retornados; nenhum ID é presumido. Ausência, ambiguidade e temporadas anunciadas são registradas separadamente de recursos efetivamente obtidos. Restrição de classificação não interrompe a atualização de partidas que continuem disponíveis.
5. Confirme direitos de exibição, redistribuição e retenção antes de disponibilizar ao público. Monogramas neutros continuam substituindo escudos/imagens não licenciados.

A documentação web oficial `https://www.api-football.com/documentation-v3` foi tentada e bloqueada pela política de rede desta sessão. A implementação segue os contratos da instrução oficial fornecida pelo proprietário, valida defensivamente as respostas e permanece sujeita à confirmação com a documentação/conta reais. Não houve chamada à API real nesta tarefa. O reset diário usa UTC conforme o contrato solicitado, mas sempre exige nova reconciliação `/status` ao mudar o dia; se o saldo remoto não tiver renovado, o cliente permanece bloqueado.

## Variáveis (sem valores secretos)

| Nome                             | Default / regra                                                                         |
| -------------------------------- | --------------------------------------------------------------------------------------- |
| API_FOOTBALL_KEY                 | segredo servidor; sem prefixo NEXT_PUBLIC                                               |
| SPORTS_SEASON                    | obrigatório apenas para executar sync; sem default                                      |
| API_FOOTBALL_DAILY_BUDGET        | 70 chamadas potencialmente cobradas por dia UTC                                         |
| API_FOOTBALL_MINUTE_BUDGET       | 8 tentativas por janela móvel de 60s, incluindo status                                  |
| API_FOOTBALL_DAILY_LIMIT         | 100, teto configurado para o contrato Free; limites remotos mais restritivos prevalecem |
| API_FOOTBALL_MINUTE_LIMIT        | 10, teto Free configurado; headers remotos prevalecem                                   |
| API_FOOTBALL_OPERATIONAL_RESERVE | 30 requisições remotas reservadas para outros usos                                      |
| API_FOOTBALL_PRIORITY_RESERVE    | 6 chamadas internas guardadas para tarefas de prioridade alta                           |
| CRON_SECRET                      | Bearer independente forte, >=32 caracteres aleatórios                                   |
| SUPABASE_SERVICE_ROLE_KEY        | somente infraestrutura/job no servidor                                                  |
| APP_ORIGIN                       | origem exata da aplicação, HTTPS fora de localhost                                      |

Os orçamentos são configuráveis dentro dos tetos Free. A validação exige `daily + operationalReserve <= dailyLimit`, `minute <= minuteLimit` e reserva de prioridade menor que o orçamento diário. Configuração inválida impede chamadas, não relaxa limites. `SPORTS_DAILY_BUDGET` foi aposentada e não é mais lida. A mesma chave utilizada por ferramentas externas pode consumir saldo entre duas observações: reserve capacidade e coordene esses usos; o TorcidaRadar não controla ferramentas que não usam seu banco.

## Fluxo e segurança

```
Agendador / operador com Bearer
  → POST /api/internal/sync
  → lease global + sync_runs
  → /status (cache operacional >=15min) → catálogo /leagues
  → tarefas persistentes por recurso/competição/temporada
  → QuotaManager: reserva atômica PostgreSQL ANTES de cada tentativa
  → cliente HTTPS central com timeout/allowlist/schema
  → reconciliação de headers e status, sem reembolso automático
  → mapper interno → RPC transacional cercada pelo lease
  → tabelas esportivas + freshness
Usuário → Next DAL autenticada/RLS → PostgreSQL (nenhuma chamada ao fornecedor)
Operador → GET /api/internal/sports-status (mesmo Bearer, sem segredos)
```

Todos os RPCs de quota, scheduler e persistência usam SECURITY INVOKER, search_path vazio e grants somente a service_role; tabelas de infraestrutura têm RLS sem políticas para anon/usuários. A app comum mantém publishable + JWT e as políticas de propriedade existentes. Sessão de usuário, inclusive autenticada, não autoriza job nem monitor. Não há painel administrativo público. O monitor só projeta campos de operação, nunca credenciais; não dispara `/status` externo.

## Quota e retries

- Reserva em transação curta, sem HTTP dentro do banco. Verifica lease, estado Free, dia UTC, uso próprio, saldo remoto, reserva operacional, prioridade, janela móvel e circuit breaker.
- Cada tentativa cria uma reserva persistente única. DNS, conexão e timeout são potencialmente cobrados; não são reembolsados por falta de resposta. Settlement é idempotente.
- Reconcilia `x-ratelimit-requests-limit`, `x-ratelimit-requests-remaining`, `X-RateLimit-Limit`, `X-RateLimit-Remaining` e `/status.requests`. Nunca aumenta saldo do mesmo dia com respostas fora de ordem. Contador local e observado permanecem distintos.
- `/status` só é solicitado quando há tarefas vencidas e capacidade local potencial, ou reconciliação necessária na renovação; ciclos idle não consultam o fornecedor. `/status` não desconta do orçamento diário conforme o contrato informado, mas conta no limite por minuto e é limitado a uma tentativa de reconciliação por janela de 15 minutos. Limites/account/erros retornados ainda podem bloquear a integração.
- Tarefa só é admitida com saldo para até **3 tentativas**; chamadas reais são reservadas individualmente. Não há promessa de conclusão quando dependências ou saldo faltam. O global lease serializa ciclos e reservas são atômicas mesmo entre instâncias.
- Backoff exponencial com jitter e até 3 tentativas somente em 429/5xx/rede/timeout. Retry-After numérico ou HTTP-date é respeitado; esperas longas são delegadas ao próximo ciclo, sem dormir indefinidamente. Cada retry passa novamente pelo banco.
- Auth/assinatura/plano inválidos abrem circuito de 15 minutos; 3 falhas consecutivas abrem 5 minutos; 429 bloqueia por ao menos 60s ou Retry-After. Não há retry automático para autenticação, parâmetros, cobertura, JSON/schema ou paginação inválidos.
- Sem serviço de quota ou migrations, fail closed: nenhuma chamada é autorizada. O RPC diário antigo perdeu permissão de execução para impedir uso paralelo pelo cliente anterior.

Quando acabar a quota: mantenha dados anteriores, consulte o monitor, aguarde renovação e **não zere contadores nem troque/crie chaves para contornar limites**. No próximo dia UTC, `/status` precisa confirmar saldo; os limites mais conservadores prevalecem. Se o Free não oferecer a temporada, selecione uma anunciada e valide os recursos; não faça upgrade automático para plano pago.

## Scheduler e custos

Não existe agendador externo instalado/ativado nesta máquina. Há uma fila persistente e um executor testável. `next_run_at` é elegibilidade da tarefa, **não confirmação de execução automática**. O monitor expõe `nextScheduledExecution: null` e `external_invocation_required`.

Cadências de temporadas correntes: descoberta/clubes 24h; partidas 8h, encurtadas a 2h em dias com partidas no fuso de São Paulo; classificação 6h e antecipada quando resultados mudam. Temporadas históricas: dados por recurso a cada 7 dias. Novos clubes são pré-requisito para fixtures/classificação; não se busca adversário individual por usuário. Dados são obtidos por competição/temporada em consulta agregada, evitando muitas consultas por time. Recursos opcionais não consomem reserva.

Estimativas para três competições com todos os recursos autorizados, sem retries: bootstrap até **10 chamadas cobradas**, mais `/status` sem débito diário; rotina corrente sem dias de jogos cerca de **25/dia** (4 metadados +9 fixtures +12 standings); em dia movimentado, cerca de **52/dia**, antes de antecipações de classificação. Histórico estável cerca de 9/semana +1 descoberta/dia. São projeções de planejamento, não consumo observado: orçamento 70, reserva e cabeçalhos podem adiar tarefas. Até 12 tarefas por ciclo, prazo interno 220s, retries limitados; chamadas de status contam no teto por minuto. Com 8/min, bootstrap pode necessitar mais de um ciclo. Sem chave, consumo real nesta tarefa: **nenhuma chamada**.

Workers interrompidos: lease expira em 10 min; próxima invocação recupera tarefas vencidas e marca runs antigas interrompidas. Toda persistência valida novamente o lease para impedir gravação de worker vencido. Falhas recebem backoff persistente; quota/limite de minuto pausam o ciclo. HTTP 503 identifica falhas/parcialidade/adiamento, com métricas sem dados sensíveis; ciclo sem tarefas é idle.

Para automatizar, configure fora da aplicação um cron confiável que envie **POST com Bearer**, por exemplo a cada 15 minutos. Invocações não implicam consulta externa se não houver tarefas vencidas; status no máximo a cada 15 min. Host deve suportar até 300s; reexecução/alertas devem observar status HTTP. Não há infraestrutura paga introduzida. Em hosts sem suporte, execute o worker em ambiente adequado antes de prometer sincronização automática. Credencial deve vir de secret manager, nunca URL/query ou log de comando.

## Execução manual e monitoramento

Exporte variáveis com mecanismo seguro do seu ambiente, com a aplicação iniciada. O script não carrega/avalia arquivos shell arbitrários:

```sh
npm run sync                   # apenas estimativa, sem rede ou quota
npm run sync -- --execute      # autorização explícita para ciclo real
npm run sports:status          # consulta protegida só ao banco interno
```

O monitor retorna plano detectado, uso local/observado, saldo conhecido/orçamento, bloqueios, tarefas (próxima elegibilidade, último sucesso, contagem e erros sanitizados), runs e cobertura por temporada. Sem schema/credenciais, retorna indisponibilidade, nunca uma falsa confirmação de plano Free. A chave não aparece na saída. Não copie segredos ou logs HTTP de autenticação para tickets. Configure retenção de runs/reservas, alertas e manutenção em infraestrutura; não há sink/cron de retenção instalado automaticamente.

## Dados vazios, integridade e paginação

Validam-se `errors`, `results`, `paging`, `response`, identidades, status, datas, scores e referências antes de persistir. HTTP 200 com errors não é sucesso. Listas vazias podem ser legítimas, mas não comprovam ausência de partidas/standings: são registradas como `empty_unverified`, preservando o conjunto anterior. É uma política deliberadamente conservadora; não se atualiza timestamp de sucesso ao receber vazio. Verifique parâmetros/temporada/assinatura/cobertura no monitor e documentação oficial, sem repetir consultas descontroladamente.

Os endpoints P0 implementados são agregados sem paginação documentada na especificação disponível. Um envelope com `paging.total > 1`, `current != 1` ou results divergente é recusado (`pagination`/`invalid_data`), **não truncado silenciosamente**. Não enviamos `page` não autorizado pelo contrato; suporte real à paginação é um gate se aparecer em respostas da conta. Endpoints P1 paginados não foram adicionados.

Um recurso completo é gravado por RPC numa transação: upsert de clubes preserva UUID/favoritos; fixtures preservam desconhecido/null e zero, corrigem scores e estados sem duplicar; classificação só substitui por conjunto não vazio validado. Falha em qualquer linha desfaz o recurso e seu freshness. Recursos já confirmados em outras tarefas continuam válidos se outro recurso falhar. Faltas de adversário/temporada não são preenchidas com clubes inventados.

O produto mostra carimbo real por recurso; falhas mantêm timestamp anterior e sinalizam indisponibilidade/desatualização. Sem spoiler continua removendo placares/status e classificação do DTO/UI; não há mensagens de “ao vivo” ou inferência de vitória/derrota com base em vazio. Para qualidade: confira origem/IDs/temporada, FK/unicidade, null versus zero, cobertura efetiva e última atualização antes de declarar o serviço atual.

## Testes e rotação

`npm test`, `npm run test:integration`, `npm run test:e2e`, `E2E_PRODUCTION=true npm run test:e2e`, build e `npm run test:boundary` não consomem quota real. Fixtures determinísticas de testes, banco PostgreSQL embutido e demonstração local são isolados do banco remoto. Testes da API real não rodam automaticamente; execução manual depende de `--execute` após a estimativa de custo e configuração de dev.

Em vazamento: revogue a chave API-Football na conta, substitua o binding no secret manager e reinicie workers; confirme que logs/bundles não a contêm, revise consumo inesperado e reconcilie `/status` na próxima janela. Não zere as reservas do dia para aparentar saldo. Rotacione separadamente CRON_SECRET/service_role caso tenham sido expostos; não reutilize segredos entre serviços. Restrinja egress ao host API fixo e ao Supabase do projeto, além dos destinos normais de dependências. Não exponha a rota administrativa para “facilitar o cron”.

Para adicionar competições, amplie os alvos/nome/tipo em `mappers.ts` e a constraint `target` em migration aditiva, valide `/leagues` e os recursos da temporada, recalcule custo e execute testes de quota/persistência. Nunca cadastre um ID presumido nem aceite URL de fornecedor enviada por usuário.

## Descoberta inicial sem SPORTS_SEASON

`POST /api/internal/sports-catalogue` permite consultar o catálogo antes de escolher o ano. Exige `Authorization: Bearer <CRON_SECRET>` e JSON estrito `{"confirmCost":true}`. Não chame automaticamente no onboarding de usuários ou no navegador. Somente o operador deve ativá-lo, após aprovar o custo.

Custo máximo por consulta sem cache: uma chamada a `/leagues?country=Brazil`, debitada do orçamento diário, e até uma chamada a `/status` quando necessário (não debitada do dia conforme contrato, mas contabilizada no limite por minuto). Cada endpoint usa uma única tentativa, sem retry automático. Respostas bem-sucedidas são reutilizadas por 24 horas com o carimbo original; o cache não prova que o serviço esteja disponível no momento.

Usa a mesma lease exclusiva, reservas SQL, circuit breaker e reconciliação do sincronizador. O resultado e erros sanitizados são auditados em `sync_runs`, recurso `free:catalogue`. Não exige nova migration e não importa times ou partidas. O campo `seasonAccess: "not_verified"` é deliberado: `advertised_seasons` indica anos anunciados no catálogo, sem confirmar permissão da conta Free. Escolha uma temporada explicitamente, configure `SPORTS_SEASON` e valide recursos/cobertura no ciclo real autorizado antes de anunciar dados disponíveis. A sincronização normal continua recusando um ano ausente.
