import { Brand, Footer } from "@/components/brand";
export default function Page() {
  return (
    <>
      <header className="public-header">
        <Brand />
      </header>
      <main id="conteudo" className="legal">
        <span className="eyebrow">TRANSPARÊNCIA</span>
        <h1>Contato e origem dos dados</h1>
        <p className="notice">
          Projeto em preparação. Canal oficial de atendimento ainda não
          configurado; este é um bloqueador de lançamento público.
        </p>
        <h2>Solicitações de conta</h2>
        <p>
          Se autenticado, use Perfil e preferências para registrar uma
          solicitação de exclusão com senha atual e confirmação explícita. O
          status indica atendimento pendente; não significa exclusão concluída.
        </p>
        <h2>Origem dos dados</h2>
        <p>
          Integração preparada para API-Football / API-Sports. Brasileirão Série
          A, Série B e Copa do Brasil são as prioridades, com cobertura validada
          por competição e temporada na sincronização. Sem configuração ou
          cobertura, exibimos Informação indisponível. A atualização é
          periódica, não um serviço de placar ao vivo.
        </p>
        <p>
          Direitos de exibição, redistribuição e retenção devem ser confirmados
          contratualmente antes de produção. Nenhum escudo oficial é utilizado.
        </p>
      </main>
      <Footer />
    </>
  );
}
