import { Brand, Footer } from "@/components/brand";
export default function Page() {
  return (
    <>
      <header className="public-header">
        <Brand />
      </header>
      <main id="conteudo" className="legal">
        <span className="eyebrow">TRANSPARÊNCIA</span>
        <h1>Termos de uso</h1>
        <p className="notice">
          Texto base sujeito a revisão jurídica. Operador e contato devem ser
          definidos antes do lançamento.
        </p>
        <h2>A experiência TorcidaRadar</h2>
        <p>
          Organizamos informações esportivas conforme disponibilidade e
          cobertura da fonte. Datas, resultados e classificações podem ter
          atraso, correção ou ausência. Não garantimos cobertura integral nem
          placares ao vivo.
        </p>
        <h2>Uso responsável</h2>
        <p>
          Proteja suas credenciais. Não tente acessar dados de outras pessoas,
          burlar limites ou interferir no serviço. O produto não oferece
          apostas, pagamentos, conteúdo social ou aconselhamento de qualquer
          natureza.
        </p>
        <h2>Fontes e propriedade</h2>
        <p>
          Dados de produção dependem de autorização contratual com a
          fornecedora. Monogramas são identificadores textuais próprios, sem
          escudos, fotografias ou endosso oficial dos clubes. A demonstração
          local usa somente nomes e partidas fictícios.
        </p>
        <h2>Disponibilidade</h2>
        <p>
          A instalação como PWA facilita o acesso. O modo offline oferece
          somente uma página pública genérica; não disponibiliza dados pessoais
          ou agenda offline.
        </p>
      </main>
      <Footer />
    </>
  );
}
