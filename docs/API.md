# Contratos HTTP

Todas as rotas `/api/*` usam JSON, `private, no-store`, erro `{error: CODIGO}`. GET health público só expõe liveness. Leituras privadas retornam 401 sem sessão (503 sem integração). Mutações exigem Origin igual a APP_ORIGIN, JSON e no máximo 4096 bytes; schemas strict rejeitam `user_id` enviado. Identidade vem de getUser e RLS.

| Método / caminho                 | Entrada / resultado                                                         |
| -------------------------------- | --------------------------------------------------------------------------- |
| GET /api/teams                   | search até 80 caracteres, page 1–100, 20 itens/página                       |
| GET /api/me/favorites            | times favoritos da sessão                                                   |
| POST /api/me/favorites           | {teamId:UUID}, idempotente                                                  |
| DELETE /api/me/favorites/:teamId | remove apenas favorito da sessão                                            |
| GET /api/dashboard               | snapshot mínimo, scores/status removidos se preferência ativa               |
| GET /api/calendar                | range=hoje/semana/mes, team=UUID, competition=UUID                          |
| POST /api/me/profile             | {display_name:string até 60}                                                |
| POST /api/me/preferences         | {hide_scores:boolean,timezone:enum}                                         |
| POST /api/me/deletion-request    | {password,confirmation:"EXCLUIR MINHA CONTA"}; reauth e solicitação pending |
| POST /api/internal/sync          | Bearer segredo >=32 caracteres, somente servidor, sem cookie auth           |
| GET /api/health                  | {status:ok}                                                                 |

Clube e classificação usam Server Components e DAL em `/times/[slug]?season=UUID`; não há chamadas API redundantes. Agenda usa dia civil do fuso escolhido; intervalos de hoje/7/30 dias são inclusivos. Clubes são consultados por slug validado, parâmetros de filtro estritos.

Auth por formulários POST `/auth/login`, `/auth/signup`, `/auth/recover`, `/auth/password`, `/auth/logout`; nenhum write de domínio via GET. `/auth/callback` é a exceção necessária ao retorno PKCE do provedor, com destino de navegação em allowlist exata. Password exige senha atual ou ticket HttpOnly assinado, de 10 minutos, emitido após troca PKCE. Após mudar senha, logout global. Recuperação/cadastro têm resposta genérica para minimizar enumeração. Os formulários não refletem senha na URL ou HTML.

Limites distribuídos PostgreSQL: leitura API 90/min, mutação 30/min, buscas 30/min, renderizações privadas 180/min por identidade. Auth tem teto global conservador e teto por hash de e-mail. Resposta API 429 com Retry-After; auth redireciona para mensagem de limite. Sem backend de limite, fail closed. Rate limiting local demo não representa segurança de produção.

## Integração Free / rotas internas

POST `/api/internal/sync`: Bearer de serviço, sem autorização por sessão comum; 503 para falhas/parcialidade/adiamento, com métricas sanitizadas. GET `/api/internal/sports-status`: mesmo Bearer, somente projeção interna de banco (plano, quota, tarefas, cobertura e runs); no-store, sem credenciais, sem consumo de fornecedor. Não há rota de consulta arbitrária/URL externa. Endpoints do fornecedor usados exclusivamente no servidor: GET /status, /leagues, /teams, /fixtures, /standings. Sem players/squads/transfers nesta fase. Contratos e limites em API_FOOTBALL_FREE.md.
