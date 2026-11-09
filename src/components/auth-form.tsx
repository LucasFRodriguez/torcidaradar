import Link from "next/link";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { Brand, Footer } from "./brand";
import { demoEnabled, supabaseConfig } from "@/lib/env";
const messages: Record<string, string> = {
  falha:
    "Não foi possível concluir. Verifique os dados ou tente novamente mais tarde.",
  verifique:
    "Se aplicável, você receberá um e-mail com os próximos passos. Confira sua caixa de entrada.",
  saiu: "Você saiu da sua conta.",
  senha: "Senha atualizada. Entre novamente.",
  limite: "Muitas tentativas. Aguarde um minuto e tente novamente.",
  indisponivel: "Integração de autenticação não configurada neste ambiente.",
};
export function AuthForm({
  mode,
  status,
}: {
  mode: "login" | "signup" | "recover" | "password";
  status?: string;
}) {
  const title = {
    login: "Bom ter você de volta.",
    signup: "Sua torcida começa aqui.",
    recover: "Vamos recuperar seu acesso.",
    password: "Uma nova senha para seu radar.",
  }[mode];
  const action = {
    login: "login",
    signup: "signup",
    recover: "recover",
    password: "password",
  }[mode];
  const configured = !!supabaseConfig();
  return (
    <>
      <header className="public-header">
        <Brand />
        <Link href="/">Voltar ao início</Link>
      </header>
      <main id="conteudo" className="auth-layout">
        <div className="auth-story">
          <span className="eyebrow">SEUS TIMES. SEU FUTEBOL.</span>
          <h1>
            Tudo que importa.
            <br />
            No seu radar.
          </h1>
          <p>
            Uma experiência simples para acompanhar uma paixão que não tem nada
            de simples.
          </p>
          <div className="auth-ornament" aria-hidden="true">
            <div />
            <div />
            <div />
            <span>TR</span>
          </div>
        </div>
        <section className="auth-card">
          <span className="feature-icon">
            <LockKeyhole size={23} />
          </span>
          <h2>{title}</h2>
          <p className="muted">
            {mode === "recover"
              ? "Enviaremos instruções para o e-mail da sua conta."
              : "Seus times favoritos esperam por você."}
          </p>
          {status && messages[status] && (
            <p role="status" className="notice">
              {messages[status]}
            </p>
          )}
          {!configured && (
            <p className="notice">
              Autenticação indisponível: configure o Supabase para criar e
              acessar contas reais.
            </p>
          )}
          <form action={"/auth/" + action} method="post" className="stack">
            {mode !== "password" && (
              <label>
                E-mail
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={254}
                  placeholder="voce@exemplo.com"
                />
              </label>
            )}
            {mode !== "recover" && (
              <label>
                {mode === "password" ? "Nova senha" : "Senha"}
                <input
                  name="password"
                  type="password"
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  required
                  minLength={mode === "login" ? 1 : 12}
                  maxLength={128}
                  aria-describedby={
                    mode === "login" ? undefined : "senha-ajuda"
                  }
                />
              </label>
            )}
            {(mode === "signup" || mode === "password") && (
              <p id="senha-ajuda" className="field-hint">
                Use pelo menos 12 caracteres. Prefira uma senha única, gerada
                por um gerenciador.
              </p>
            )}
            {mode === "password" && (
              <label>
                Senha atual (exceto após recuperação por e-mail)
                <input
                  type="password"
                  name="current_password"
                  maxLength={128}
                  autoComplete="current-password"
                />
              </label>
            )}
            {mode === "login" && (
              <Link className="text-link align-end" href="/recuperar-senha">
                Esqueci minha senha
              </Link>
            )}
            <button className="button full" disabled={!configured}>
              {mode === "login"
                ? "Entrar no meu radar"
                : mode === "signup"
                  ? "Criar minha conta"
                  : mode === "recover"
                    ? "Enviar instruções"
                    : "Atualizar senha"}
              <ArrowRight size={17} />
            </button>
          </form>
          {mode === "signup" ? (
            <p className="fine-print">
              Ao criar uma conta, você concorda com os{" "}
              <Link href="/termos">Termos</Link> e conhece nossa{" "}
              <Link href="/privacidade">Privacidade</Link>. Confirme seu e-mail
              se solicitado.
            </p>
          ) : (
            <p className="fine-print">
              Ainda não tem conta? <Link href="/cadastro">Crie seu radar</Link>
            </p>
          )}
          {demoEnabled() && mode === "login" && (
            <form action="/auth/demo" method="post">
              <button className="button secondary full">
                Explorar demonstração local
              </button>
              <p className="fine-print">Dados fictícios · sem cadastro</p>
            </form>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}
