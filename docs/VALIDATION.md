# Roteiro de validação

## Sem credenciais

`npm ci`, `npm run check`, `npm run test:integration`, `npm run build`, `npm run test:e2e`, `E2E_PRODUCTION=true npm run test:e2e`, audit. O teste de integração carrega SQL real em PostgreSQL embutido, cria roles A/B/anônimo e prova CRUD, proprietário e grants; não mocka o mecanismo de RLS. O E2E de produto usa somente demo local sinalizada; E2E produção não aceita demo.

## Staging obrigatório (não executado sem infraestrutura)

1. Aplicar migrations em Supabase dedicado, configurar SMTP/redirect URLs e limites. Criar contas A e B com e-mails de teste próprios; verificar confirmação, login, logout e refresh/expiração de cookies.
2. A selecionar vários clubes, fechar navegador, entrar em outra sessão e comprovar persistência; B deve ver apenas seus próprios favoritos/preferências/perfil.
3. Com clientes Supabase autenticados A e B (publishable key, jamais service_role), tentar SELECT/INSERT/UPDATE/DELETE cruzados nas três tabelas; resultado de leitura/update/delete deve ser vazio, INSERT/troca de dono deve falhar. Repetir como anon e sem JWT. Guardar evidência sanitizada, sem tokens.
4. Repetir por HTTP com sessões A/B: corpo contendo user_id deve retornar 400; sem Origin/Origin externa deve retornar 403; GET não modifica; busca gigante e paginação malformada 400. Repetir limite até 429 e conferir compartilhamento entre duas instâncias.
5. Recuperar senha pelo e-mail; confirmar PKCE exige navegador que iniciou o fluxo, callback não aceita open redirect, senha nova exige ticket válido/expiração ou senha atual, login anterior deixa de funcionar. Não logar URL do e-mail/tokens.
6. Conta: nome XSS rejeitado; preferências sobrevivem a novo login; sem spoiler não aparece em JSON/RSC/HTML, status e classificação protegidos. Senha incorreta não registra exclusão; senha correta + confirmação cria pending, operador atende e verifica cascades/Auth. Nunca afirmar exclusão antes de atender.
7. Rodar sync com chave real de dev e temporada: validar cobertura de times, partidas e classificação de Série A/B/Copa; repetir sem duplicar registros, simular job concorrente/429/quota. Confirmar correções, adiamentos e ausência de data sem inventar placares.
8. Conferir headers, CSP sem violações, HTML/DTO privado no-store no host/CDN, nenhum segredo no bundle/HTML/SW/log; offline e retorno pelo botão Voltar não mostram usuário anterior.
9. Revisão humana de teclado, leitor de tela, contraste, 320/375/768/1024/desktop e Core Web Vitals em ambiente representativo. Axe é evidência parcial, não certificação WCAG.
