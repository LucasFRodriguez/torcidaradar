import { Brand, Footer } from "@/components/brand";
export default function Page() {
  return (
    <>
      <header className="public-header">
        <Brand />
      </header>
      <main id="conteudo" className="legal">
        <span className="eyebrow">TRANSPARÊNCIA</span>
        <h1>Privacidade e seus dados</h1>
        <p className="notice">
          Modelo inicial para revisão jurídica e operacional antes de
          disponibilizar o serviço ao público. Não constitui declaração de
          conformidade legal.
        </p>
        <h2>O que tratamos e por quê</h2>
        <p>
          E-mail para autenticação, nome de exibição opcional, clubes favoritos
          e preferências para personalizar sua agenda. Senhas são administradas
          pelo Supabase Auth. Não exigimos CPF, telefone, endereço ou data de
          nascimento.
        </p>
        <h2>Compartilhamento e armazenamento</h2>
        <p>
          Supabase processa autenticação e banco. A fornecedora esportiva recebe
          consultas de competições pelo servidor, sem o perfil ou os favoritos
          de cada pessoa. Não usamos analytics, publicidade ou rastreadores.
          Cookies de sessão são necessários para acesso.
        </p>
        <h2>Retenção e direitos</h2>
        <p>
          Dados de conta são mantidos enquanto necessários ao serviço.
          Solicitações de exclusão ficam pendentes até atendimento seguro,
          incluindo a camada Auth. O operador deverá definir e publicar prazo de
          atendimento, base legal, encarregado, transferências internacionais e
          canal de contato válido antes da abertura pública. Política
          operacional proposta: logs técnicos sem payloads sensíveis por até 14
          dias, acesso restrito.
        </p>
        <p>
          Você pode ajustar favoritos, perfil e preferências ou solicitar
          exclusão nas configurações. O operador deverá atender os demais
          direitos aplicáveis sob a LGPD por seu canal oficial.
        </p>
      </main>
      <Footer />
    </>
  );
}
