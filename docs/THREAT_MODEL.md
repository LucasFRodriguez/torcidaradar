# Modelo de ameaças

Ativos: identidade Supabase, favoritos, preferências, credenciais servidor, orçamento esportivo. Fronteiras: navegador → Next SSR → Supabase RLS; job → fornecedor fixo. Não há upload, HTML externo, tracking ou proxy arbitrário.

| Ameaça                    | Controle                                                               | Residual / verificação                                                         |
| ------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| IDOR entre usuários       | getUser por operação, dono pela sessão, RLS default deny e WITH CHECK  | SQL CRUD A/B/anônimo; integração Auth remota depende de staging                |
| CSRF                      | mutações POST/DELETE, Origin exata, SameSite, formulários same-origin  | host deve preservar Origin; XSS ainda exige defesa                             |
| XSS                       | escape React, nome sem markup, CSP nonce, sem eval produção            | testar CSP no build real e browser                                             |
| SSRF / resposta maliciosa | host API fixo, schemas Zod, timeout, limite de bytes, sem redirects    | dependência da fornecedora/licença                                             |
| Abuso / corrida           | limite atômico PostgreSQL, lease e orçamento diário persistidos        | DDoS volumétrico exige edge/WAF e limites Supabase                             |
| Vazamento cache/offline   | private no-store, DTO sem scores em sem spoiler, SW só offline público | conferir CDN do host e bfcache em staging                                      |
| Roubo de chave            | server-only, env sem valores, scan de bundle                           | rotação e permissões operacionais necessárias                                  |
| Exclusão indevida         | senha atual validada, confirmação literal, solicitação RLS própria     | atendimento manual deve remover Auth e dados e confirmar, não simular exclusão |
| Falha de fornecedor       | retry restrito, dados com updated_at, indisponibilidade explícita      | cobertura real não validada sem chave                                          |

Referência de revisão: OWASP ASVS 5.0 V1–V16 e Top 10; não equivale a certificação ou auditoria completa. Logs somente códigos/contagens, retenção recomendada 14 dias. Nenhum deploy autorizado.
