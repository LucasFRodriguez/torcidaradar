# Ambiente

| Nome                                 | Uso                                                                                  | Segredo? |
| ------------------------------------ | ------------------------------------------------------------------------------------ | -------- |
| APP_ORIGIN                           | origem exata sem barra final, HTTPS em produção                                      | não      |
| NEXT_PUBLIC_SUPABASE_URL             | URL HTTPS do projeto                                                                 | não      |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | publishable, nunca privileged                                                        | não      |
| SUPABASE_SERVICE_ROLE_KEY            | RPC de limite e job somente servidor                                                 | SIM      |
| API_FOOTBALL_KEY                     | HTTPS v3.football.api-sports.io, só job                                              | SIM      |
| CRON_SECRET                          | Bearer independente >=32 caracteres aleatórios                                       | SIM      |
| RECOVERY_SIGNING_SECRET              | 32 bytes aleatórios em 64 caracteres hex; assina somente ticket de recuperação local | SIM      |
| SPORTS_SEASON                        | temporada explícita, sem default; validar disponibilidade no Free                    | não      |
| API_FOOTBALL_DAILY_BUDGET            | orçamento interno, default 70/dia UTC                                                | não      |
| API_FOOTBALL_MINUTE_BUDGET           | default 8 tentativas por janela de 60s                                               | não      |
| LOCAL_DEMO                           | true apenas next dev/test; inoperante produção                                       | não      |

Não exponha segredos no prefixo NEXT_PUBLIC nem em logs, source maps, CI ou argumentos de shell. Use secret manager do host; placeholders de proxy só funcionam em destinos HTTPS configurados, não como segredo HMAC local. RECOVERY_SIGNING_SECRET/CRON_SECRET precisam de binding real no runtime para as operações locais respectivas. Não invente credenciais. `.env.example` não contém valores reais. Rotação exige reinício de processos; ticket de recuperação é invalidado ao trocar RECOVERY_SIGNING_SECRET.

Rede necessária: registry.npmjs.org e fontes oficiais GitHub; seu domínio `<project-ref>.supabase.co` para Auth/PostgREST; `v3.football.api-sports.io` para sync. Documentação web: nextjs.org, supabase.com, owasp.org, www.api-football.com. Playwright: cdn.playwright.dev e destinos de download oficiais redirecionados, ou Chromium do sistema. Não substitua uma allowlist desconhecida por essa lista parcial.

Gere RECOVERY_SIGNING_SECRET com gerador criptográfico (32 bytes), salve apenas no secret manager/runtime e não envie seu valor em chat ou logs. A validação exige 64 caracteres hex; placeholders HTTP não substituem uma chave de assinatura local. Não reutilize API keys para assinatura.

A configuração esportiva atual está em [API_FOOTBALL_FREE.md](API_FOOTBALL_FREE.md), incluindo tetos configurados 100/dia e 10/min, reserva operacional 30 e reserva interna prioritária 6. SPORTS_DAILY_BUDGET foi aposentada. SPORTS_SEASON não pode presumir acesso ao ano atual.

Nesta sessão, a política permite os presets de dependências, mas não anuncia v3.football.api-sports.io nem www.api-football.com. Acesso ao site de documentação foi negado. Configure esses destinos e o host Supabase do projeto nas definições de rede antes de validar a conta real, preservando as regras existentes. Não houve probe ao endpoint esportivo com credencial.
