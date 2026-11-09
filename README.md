<div align="center">
  <img src="public/icon.svg" alt="Símbolo do TorcidaRadar" width="80" height="80" />

# TorcidaRadar

### Seus times. Seu futebol. Tudo no radar.

Uma agenda de futebol personalizada para acompanhar seus clubes favoritos, os próximos jogos e os resultados — com clareza e sem distrações.

![Next.js 16](https://img.shields.io/badge/Next.js-16-202b29?style=flat-square&logo=nextdotjs)
![React 19](https://img.shields.io/badge/React-19-202b29?style=flat-square&logo=react)
![TypeScript strict](https://img.shields.io/badge/TypeScript-strict-3178c6?style=flat-square&logo=typescript&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Auth%20%2B%20PostgreSQL-0f766e?style=flat-square&logo=supabase&logoColor=white)
![API-Football Free](https://img.shields.io/badge/API--Football-Free-0f766e?style=flat-square)

[O produto](#o-produto) · [Funcionalidades](#funcionalidades) · [Demonstração local](#demonstração-local) · [Dados reais](#configuração-para-dados-reais) · [Vercel](#hospedagem-na-vercel) · [Documentação](#documentação)

</div>

---

## O produto

O TorcidaRadar reúne o futebol dos times que você escolhe em uma única experiência. Em vez de consultar várias páginas, você monta seu radar e encontra a agenda, os adversários, os resultados e as competições dos seus clubes.

**Como funciona:**

1. **Escolha seus times.** Siga mais de um clube e ajuste seus favoritos quando quiser.
2. **Consulte seu radar.** Veja os jogos de hoje, os próximos encontros e os resultados recentes disponíveis.
3. **Organize sua agenda.** Filtre as partidas por período, clube ou competição.
4. **Acompanhe no seu tempo.** Ative o modo sem spoiler para ocultar placares e informações que revelem resultados.

A interface é responsiva, em português brasileiro, com horários apresentados por padrão no fuso de Brasília (`America/Sao_Paulo`).

> **Estado do projeto:** MVP implementado e validado localmente. O uso com contas e dados reais depende da configuração do Supabase, da API-Football e da validação da cobertura disponível. O agendador externo ainda precisa ser configurado. Consulte o [relatório técnico](docs/SPORTS_FREE_REPORT.md) antes de disponibilizar o serviço ao público.

## Funcionalidades

| Recurso                     | O que você encontra                                                                                          |
| --------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **Meu Futebol Hoje**        | Dashboard com favoritos, partidas do dia, próximos jogos e resultados recentes.                              |
| **Múltiplos favoritos**     | Pesquisa, seleção e remoção de clubes, com persistência por usuário quando o Supabase está configurado.      |
| **Calendário unificado**    | Filtros de hoje, próximos 7 dias e próximos 30 dias, além de clube e competição.                             |
| **Página do clube**         | Informações básicas, partidas e acesso à classificação por competição e temporada, conforme disponibilidade. |
| **Modo sem spoiler**        | Oculta placares, pênaltis, status reveladores, rodada e classificação nas telas correspondentes.             |
| **Conta e preferências**    | Cadastro, login, recuperação de senha, nome de exibição, fuso horário e logout.                              |
| **Solicitação de exclusão** | Pedido autenticado com confirmação de senha, acompanhado de status de atendimento.                           |
| **PWA**                     | Manifesto, ícones próprios e uma página offline genérica, sem guardar informações pessoais offline.          |
| **Transparência dos dados** | Última atualização, avisos de indisponibilidade e indicação de dados potencialmente desatualizados.          |

A cobertura prioritária é **Brasileirão Série A, Série B e Copa do Brasil**. A disponibilidade depende da competição, da temporada e das permissões reais do plano Free. Quando falta informação, o produto mostra indisponibilidade; não preenche lacunas com resultados inventados.

### O que este MVP não oferece

Não há placares ao vivo de alta frequência, apostas, pagamentos, publicidade, rede social, chat, notícias, scraping ou notificações push. Elencos e transferências ficam fora desta entrega.

## Demonstração local

Explore o produto **sem criar conta e sem precisar de chave esportiva**. A demonstração usa clubes e partidas fictícios, identificados na interface, e não grava esses dados no banco de produção.

### 1. Prepare o projeto

Requisitos: **Node.js 24 LTS recomendado** — também aceito Node 22.13+ na linha 22 —, npm e Git.

```sh
git clone https://github.com/LucasFRodriguez/torcidaradar.git
cd torcidaradar
npm ci
```

Se o projeto já estiver no seu computador, abra sua pasta e execute `npm ci`.

### 2. Configure o modo de demonstração

Crie uma cópia do arquivo de exemplo:

- **PowerShell / Windows:** `Copy-Item .env.example .env.local`
- **Linux / macOS:** `cp .env.example .env.local`

No arquivo `.env.local`, deixe:

```dotenv
APP_ORIGIN=http://localhost:3000
LOCAL_DEMO=true
```

As credenciais do arquivo de exemplo podem continuar vazias para explorar a demonstração. Não sobrescreva um `.env.local` existente sem preservar suas configurações.

### 3. Inicie e explore

```sh
npm run dev
```

Abra `http://localhost:3000/login` e escolha **Explorar demonstração local**. Selecione seus times e acesse o dashboard. Você pode testar favoritos, calendário, preferências e modo sem spoiler.

> `localhost` aponta para o computador em que o servidor foi iniciado. Se o projeto estiver rodando em um ambiente na nuvem, esse endereço não abre a máquina remota no navegador do seu Windows.
>
> A demonstração funciona somente em desenvolvimento/testes. **`LOCAL_DEMO=true` não habilita dados fictícios em builds de produção**, inclusive na Vercel. Sair da demonstração limpa seu estado local.

<details>
<summary><strong>Dicas para o ambiente de desenvolvimento</strong></summary>

- Mantenha o terminal aberto enquanto estiver usando a aplicação.
- No PowerShell, se a execução de `npm.ps1` for bloqueada, use `npm.cmd ci` e `npm.cmd run dev`, sem alterar a política de segurança do Windows.
- Se o cache padrão do npm não for gravável no ambiente Linux da nuvem, use `npm --cache /tmp/torcidaradar-npm ci`.
- Sem credenciais, a landing e as páginas públicas continuam disponíveis; o acesso real por conta fica indisponível.

</details>

## Configuração para dados reais

### Supabase: contas e banco de dados

1. Crie um projeto dedicado de desenvolvimento ou staging. Mantenha suas credenciais separadas das de produção.
2. Configure a URL HTTPS, a publishable key e a chave privilegiada do servidor nas variáveis de ambiente.
3. Aplique as migrations na ordem abaixo pelo Supabase CLI, em um projeto vinculado e revisado, ou pelo SQL Editor:

   ```text
   supabase/migrations/
   ├── 202611090001_foundation.sql
   ├── 202611090002_standings.sql
   └── 202611090003_free_integration.sql
   ```

4. Configure autenticação por e-mail/senha, confirmação de e-mail, SMTP, política de senha e proteção contra abuso. Ative proteção contra senhas comprometidas quando disponível no plano.
5. Defina a Site URL igual a `APP_ORIGIN` e autorize os callbacks exatos necessários em `/auth/callback`, incluindo os fluxos `?next=/onboarding` e `?next=/atualizar-senha`. Evite curingas abertos em produção.
6. Execute o [roteiro de validação](docs/VALIDATION.md), incluindo isolamento entre duas contas e acesso anônimo.

A autenticação usa o SDK SSR oficial com PKCE. Perfis, preferências e favoritos ficam sujeitos a **Row Level Security (RLS)**; o usuário não escolhe o proprietário de uma operação por um campo enviado no formulário.

### Variáveis principais

Use [.env.example](.env.example) como referência. Em desenvolvimento, preencha `.env.local`; na hospedagem, use o gerenciador de variáveis e segredos da plataforma.

| Variável                               | Finalidade                                                                                                       |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `APP_ORIGIN`                           | Origem exata da aplicação, sem barra final; HTTPS em produção.                                                   |
| `NEXT_PUBLIC_SUPABASE_URL`             | URL do projeto Supabase.                                                                                         |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Chave pública de acesso, nunca uma chave privilegiada.                                                           |
| `SUPABASE_SERVICE_ROLE_KEY`            | Infraestrutura de quota e sincronização, exclusivamente no servidor.                                             |
| `API_FOOTBALL_KEY`                     | Chave API-SPORTS, exclusivamente no servidor.                                                                    |
| `CRON_SECRET`                          | Segredo independente para autorizar jobs e monitoramento interno.                                                |
| `RECOVERY_SIGNING_SECRET`              | Chave dedicada de 32 bytes aleatórios, representados em 64 caracteres hexadecimais, para o fluxo de recuperação. |
| `SPORTS_SEASON`                        | Temporada escolhida explicitamente após conferir a disponibilidade no Free.                                      |
| `LOCAL_DEMO`                           | Habilita a demonstração somente em desenvolvimento/testes.                                                       |

**Nunca envie segredos ao GitHub, coloque valores reais no `.env.example` ou use `NEXT_PUBLIC_*` para chaves privadas.** As variáveis configuradas no ambiente do Codex não são transferidas automaticamente para a Vercel.

Os demais parâmetros e requisitos de rede estão no [guia de ambiente](docs/ENVIRONMENT.md).

## Dados esportivos e plano Free

O fornecedor exclusivo é **API-SPORTS / API-Football Free**. O navegador consulta os dados internos do TorcidaRadar; carregar uma página não dispara uma consulta esportiva para cada usuário.

```text
API-Football → Sincronizador autenticado → PostgreSQL → Dashboard e calendário
                         ↓
              Quota, tarefas e monitoramento
```

A integração descobre competições pelo endpoint `/leagues`, valida as respostas e usa operações idempotentes para evitar duplicação. Não presume IDs nem acesso à temporada atual.

| Controle                                  | Configuração inicial                                                          |
| ----------------------------------------- | ----------------------------------------------------------------------------- |
| Orçamento interno diário                  | **70 requisições**, via `API_FOOTBALL_DAILY_BUDGET`.                          |
| Orçamento interno por minuto              | **8 tentativas**, via `API_FOOTBALL_MINUTE_BUDGET`.                           |
| Reserva operacional no fornecedor         | **30 requisições**.                                                           |
| Reserva interna para tarefas prioritárias | **6 requisições**.                                                            |
| Proteções                                 | Reservas atômicas, limites remotos, retry limitado, circuit breaker e leases. |

Esses valores são parâmetros internos, não garantia de saldo ou cobertura do fornecedor. Respostas vazias, erros e paginação incompleta não apagam conjuntos válidos. Temporadas históricas têm uma cadência econômica de atualização.

### Operação manual

Com a aplicação iniciada e as variáveis necessárias exportadas de forma segura:

```sh
npm run sync                  # mostra estimativa; não faz chamadas externas
npm run sync -- --execute     # autoriza um ciclo real, sujeito à quota
npm run sports:status         # consulta o monitor protegido, sem chamar o fornecedor
```

A fila, os horários de elegibilidade e a recuperação de tarefas estão implementados no PostgreSQL. **O agendador externo precisa ser configurado e validado separadamente.** Não há promessa de sincronização automática só por instalar o projeto ou hospedá-lo na Vercel.

Leia o [guia API-Football Free](docs/API_FOOTBALL_FREE.md) para entender custos estimados, endpoints, cadências, respostas vazias e rotação de credenciais.

## Hospedagem na Vercel

1. Importe o repositório `LucasFRodriguez/torcidaradar` e selecione a branch `main`.
2. Use o preset **Next.js**, diretório raiz do repositório e Node.js **24.x**.
3. Mantenha os comandos do projeto: instalação `npm ci` e build `npm run build`.
4. Configure as variáveis necessárias na Vercel. Use `APP_ORIGIN` igual à origem HTTPS final da aplicação, sem barra final.
5. Ajuste as URLs permitidas do Supabase para essa origem. Separe configurações de Preview e Production.
6. Verifique as migrations, a autenticação e os dados reais antes de abrir o produto ao público.

A landing pode ser hospedada sem integração completa, mas **login, contas e dados esportivos precisam dos serviços configurados**. A demonstração fictícia não fica disponível no build de produção.

Para os jobs, confira o suporte a **POST autenticado** e ao tempo de execução necessário no host escolhido. Hospedar o site não configura esse agendamento. O [guia de implantação](docs/DEPLOYMENT.md) reúne os requisitos operacionais, de backup e de segurança.

## Tecnologia e arquitetura

| Camada                    | Tecnologias                                                       |
| ------------------------- | ----------------------------------------------------------------- |
| Aplicação                 | Next.js 16 App Router, React 19 e TypeScript strict.              |
| Interface                 | Tailwind CSS, componentes reutilizáveis e ícones Lucide.          |
| Identidade e persistência | Supabase Auth e PostgreSQL com RLS.                               |
| Integração esportiva      | Adaptador API-Football, schemas Zod e sincronizador server-side.  |
| Qualidade                 | Vitest, PostgreSQL embutido com PGlite, Playwright, Axe e ESLint. |
| Automação de qualidade    | GitHub Actions e Dependabot.                                      |

```text
src/
├── app/               Páginas, layouts e entradas HTTP
├── components/        Componentes visuais e interações
├── lib/
│   ├── security/      Validação e controles de segurança
│   ├── sports/        Contratos, fornecedor e modelos esportivos
│   └── supabase/      Clientes SSR e de infraestrutura
└── server/
    ├── dal/           Acesso a dados com identidade e autorização
    └── jobs/          Quota, sincronização e monitoramento
supabase/migrations/   Schema, integridade e políticas de acesso
tests/                 Testes unitários, integração e E2E
docs/                  Arquitetura, operação e evidências
```

## Segurança e privacidade

- **Isolamento de contas:** identidade validada no servidor e RLS no banco.
- **Entradas validadas:** schemas, limites de payload, proteção de origem e consultas parametrizadas.
- **Segredos no servidor:** sem chave esportiva ou service role no navegador.
- **Cache privado:** respostas pessoais com `no-store`; service worker sem cache de dados autenticados.
- **Defesa do navegador:** CSP com nonce, proteção contra framing e cabeçalhos de segurança.
- **Minimização de dados:** sem CPF, telefone, upload de imagens, rastreadores ou cookies publicitários.

A exclusão de conta é uma **solicitação autenticada com atendimento pendente**, não uma exclusão automática. As páginas legais são modelos que exigem revisão, identificação do responsável e canal de contato antes do lançamento.

As verificações locais não certificam ausência de vulnerabilidades. Consulte o [modelo de ameaças](docs/THREAT_MODEL.md) e o [checklist com evidências e pendências](docs/SECURITY_CHECKLIST.md).

## Testes e qualidade

```sh
npm run check                 # lint, tipos e testes unitários
npm run test:integration      # PostgreSQL/PGlite, RLS, quota e persistência
npm run build                 # build de produção
npm run test:boundary         # verifica limites de segredos nos assets públicos
npm run format:check          # formatação
npm audit --audit-level=high  # auditoria das dependências
```

Para os testes de navegador, encerre outro servidor que esteja usando a porta 3000:

```sh
npx playwright install --with-deps chromium
npm run test:e2e
```

A suíte de produção requer um build concluído. No Linux/macOS, execute `E2E_PRODUCTION=true npm run test:e2e`; no PowerShell, defina `$env:E2E_PRODUCTION="true"` antes de `npm.cmd run test:e2e`.

Se já houver Chromium no ambiente Linux, defina `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium` para usá-lo. Os testes automatizados não consultam a API-Football real nem consomem sua quota. PGlite executa as políticas e transações em PostgreSQL embutido; isso não substitui a validação do Supabase hospedado.

## Documentação

| Guia                                                  | Conteúdo                                                    |
| ----------------------------------------------------- | ----------------------------------------------------------- |
| [Arquitetura](docs/ARCHITECTURE.md)                   | Módulos, decisões e fluxos de dados.                        |
| [Ambiente](docs/ENVIRONMENT.md)                       | Variáveis, segredos e requisitos de rede.                   |
| [API](docs/API.md)                                    | Entradas HTTP e contratos internos.                         |
| [API-Football Free](docs/API_FOOTBALL_FREE.md)        | Quota, sincronização, monitoramento e diagnóstico.          |
| [Relatório da integração](docs/SPORTS_FREE_REPORT.md) | Alterações, testes, riscos e validações externas pendentes. |
| [Plano da integração](docs/SPORTS_FREE_PLAN.md)       | Auditoria e etapas da correção esportiva.                   |
| [Segurança](docs/SECURITY_CHECKLIST.md)               | Controles implementados e evidências.                       |
| [Modelo de ameaças](docs/THREAT_MODEL.md)             | Ameaças, mitigações e riscos residuais.                     |
| [Validação](docs/VALIDATION.md)                       | Roteiro de testes locais e de staging.                      |
| [Resultados do MVP](docs/VALIDATION_RESULTS.md)       | Registro da validação inicial e suas limitações.            |
| [Implantação](docs/DEPLOYMENT.md)                     | Checklist operacional, backups e rotação.                   |
| [Roadmap](docs/ROADMAP.md)                            | Escopo atual, P1 e evolução futura.                         |
| [Plano inicial](docs/IMPLEMENTATION_PLAN.md)          | Histórico das fases de implementação.                       |

---

<div align="center">
  <strong>Seu futebol, do seu jeito.</strong><br />
  TorcidaRadar · Clareza, personalização e respeito ao tempo da sua torcida.
</div>
