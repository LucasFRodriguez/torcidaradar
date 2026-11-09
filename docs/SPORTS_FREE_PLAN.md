# API-Football Free: auditoria e plano de correção

## Auditoria antes das alterações

O projeto existente usa Next 16/React/TypeScript, Supabase SSR com RLS e PostgreSQL. Todo o MVP permanece sem commit; alterações anteriores serão preservadas. Não há outro fornecedor antigo: o adaptador API-Football inicial é a integração substituída. HTTP centralizado em provider.ts, job POST autenticado, DAL lê só banco. Demonstração isolada em demo.ts e bloqueada em produção; nenhum fallback esportivo fictício de produção encontrado.

Problemas identificados: IDs 71/72/73 presumidos; orçamento só diário 80, sem cabeçalhos/status/minuto; envelope sem results; ausência de circuit breaker; substituição vazia de classificação; ciclo completo sem cadência; múltiplos writes fora de transação e monitoramento insuficiente. Agendamento externo ainda não provisionado.

## Etapas e critérios

1. Auditoria e plano (este registro), documentação e dependências inspecionadas.
2. Cliente Free tipado, schemas de envelope/status, erros sanitizados, allowlist e quota obrigatória antes de HTTP.
3. Migration aditiva: estado/reservas/tarefas/cobertura, transações cercadas por lease, sem alterar migrations anteriores nem favoritos.
4. Quota persistente diária/minuto, reservas sem reembolso em timeout, reconciliação conservadora, reserva operacional e circuit breaker.
5. Scheduler persistente com prioridades, estimativa de pior caso, retries/cadência, recuperação de tarefas interrompidas; invocação externa permanece pendente.
6. DAL e interface distinguem ausência, indisponibilidade e desatualização, sem enfraquecer sem spoiler.
7. Testes determinísticos de contrato/SQL/orquestração, regressão HTTP/browser/build e limites de segurança.
8. Documentação de setup, monitoramento protegido, operação Free e relatório de evidências.

## Limites de validação

API_FOOTBALL_KEY e Supabase ausentes; nenhuma chamada real será executada automaticamente. Rede bloqueou https://www.api-football.com/documentation-v3 em 2026-11-09. Contratos seguem a especificação oficial fornecida pelo usuário e schemas defensivos; consulta integral da documentação e validação na conta permanecem gates explícitos. Nenhum ID/temporada será declarado validado sem resposta real. Next Route Handlers consultados no guia instalado node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md. Sem deploy, push, scraping ou infraestrutura paga.

## Registro das etapas

1. Auditoria concluída antes das alterações; preservado estado Git não commitado.
2. Cliente/contratos/normalização implementados; testes sem API real.
   3–4. Migration aditiva e quota executadas em PostgreSQL embutido; rollback, unicidade, favoritos, limite diário/minuto, reconciliação, circuit breaker e renovação verificados.
3. Pipeline completo testado com HTTP simulado e PostgreSQL real; agendamento externo identificado como pendente, não declarado operacional.
4. Interface preservada, dados de banco com freshness por recurso, classificação/rodada protegidas pelo modo sem spoiler.
5. 45 unitários +37 integração +7 E2E aprovados; build, boundary e audit aprovados.
6. README/arquitetura/operação/relatório atualizados; credenciais/rede/conta/cobertura real e operação hospedada seguem gates externos. Ver SPORTS_FREE_REPORT.md.
