# Arquitetura

```
Browser → Next proxy (nonce CSP + refresh de cookie)
        → Server Components / Route Handlers (validação + getUser + Origin + limiter)
        → DAL com SDK publishable + JWT usuário → PostgreSQL RLS
Agendador autenticado → POST sync → service_role → lease + orçamento + upsert
                                 → SportsProvider → API-Football fixa
```

Monólito modular. `src/lib/security`: schemas, origem, limites, tickets de recuperação com chave dedicada e comparação cron; `src/lib/supabase`: SSR e infraestrutura privilegiada isolados; `src/server/dal`: projeção de dados e filtro sem spoiler; `src/lib/sports`: domínio e adaptador; `src/server/jobs`: sincronização. UI reutilizável em `src/components`, rotas em `src/app`. Dados esportivos consultados apenas no banco por usuários.

Decisões: não há cliente Supabase no browser; cookies podem ser HttpOnly sem quebrar refresh. `getClaims` no proxy atualiza sessão e `getUser` na DAL confirma identidade em cada entrada (inclui revogação/estado remoto). Não confiar em getSession. Server handlers e SDK setam cookies; proxy preserva cookies e cache headers de refresh. `React.cache` apenas deduplica snapshot dentro da renderização, sem cache compartilhado entre usuários. Todas as respostas dinâmicas são privadas/no-store, inclusive públicas com nonce; assets estáticos não contêm dados pessoais.

CSP nonce obriga renderização dinâmica. Não há unsafe-inline/eval em produção. Dev permite eval e style inline para tooling, sem estender exceção à produção. Fontes system-ui/Arial evitam download remoto e mantêm rendimento; tokens e CSS próprios, componentes com HTML semântico, sem biblioteca headless desnecessária.

Sem spoiler é redução de DTO no servidor: placares, pênaltis e status removidos antes de RSC/JSON; classificação também não é enviada. Horário e nomes não são spoilers. SW cacheia somente `/offline.html` e `/offline.css`, nunca HTML privado, APIs, RSC ou assets com usuário. Listener pageshow força recarga em retorno de bfcache; logout limpa cache/storage e cookie demo.

Job tem visibilidade de falhas por sync_runs com código sanitizado e contagens. Falha de sincronização retorna 503; erro público não inclui stack/config. Integração parcial mantém dados anteriores e timestamps explícitos. Não há cache de sessão em CDN. A observabilidade não coleta e-mail, cookie, chave ou payload. Healthcheck expõe apenas `{status:ok}`, é liveness e não atesta readiness de integrações.

Exclusão usa solicitação pendente com RLS (amr password dos últimos 5 minutos) e reautenticação com senha atual no servidor; atendimento administrativo fora do app é explícito. O produto só deve abrir após canal e SLA definidos.

## Revisão Free da integração esportiva

A integração anterior foi substituída por FootballDataProvider → ApiFootball + schemas/mappers, QuotaManager PostgreSQL e scheduler persistente. RPCs SECURITY INVOKER só service_role, novas tabelas com RLS default deny. Cada tentativa reserva antes de HTTP e reconcilia depois; status/header reduzem saldo conservadoramente; timeout não devolve quota. Commit por recurso transacional e cercado por lease preserva favoritos e dados anteriores. DAL lê somente banco; a única projeção operacional visível a usuários é freshness por recurso, sem plano/quota/chaves. Monitor completo é uma ferramenta GET autenticada por segredo de serviço. Agendador externo não provisionado. Ver API_FOOTBALL_FREE.md para cadências/custos/limites e SPORTS_FREE_PLAN.md para auditoria.
