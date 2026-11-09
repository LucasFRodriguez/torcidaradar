import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  EyeOff,
  Heart,
  Check,
  Compass,
} from "lucide-react";
import { Brand, Footer } from "@/components/brand";
import { demoEnabled } from "@/lib/env";
export default function Landing() {
  return (
    <>
      <header className="public-header">
        <Brand />
        <nav>
          <Link href="/login">Entrar</Link>
          <Link className="button small" href="/cadastro">
            Criar conta <ArrowRight size={15} />
          </Link>
        </nav>
      </header>
      <main id="conteudo" className="landing">
        <section className="hero">
          <div className="hero-copy">
            <span className="eyebrow">
              <span className="dot" /> SEU FUTEBOL, MAIS PERTO
            </span>
            <h1>
              A paixão é sua.
              <br />O radar também.
            </h1>
            <p>
              Acompanhe seus times, organize os próximos jogos e encontre o que
              importa. Tudo no seu ritmo, em um só lugar.
            </p>
            <div className="hero-actions">
              <Link href="/cadastro" className="button">
                Monte seu radar <ArrowRight size={18} />
              </Link>
              <Link href="/login" className="text-link">
                Já tenho uma conta
              </Link>
            </div>
            <div className="hero-note">
              <Check size={15} /> Vários times. Uma agenda. Sem distrações.
            </div>
          </div>
          <div
            className="hero-preview"
            aria-label="Exemplo ilustrativo do painel"
          >
            <div className="preview-label">
              <Compass size={17} /> UM OLHAR PARA O SEU DIA{" "}
              <span className="tag">Ilustração</span>
            </div>
            <div className="preview-title">
              <span>Meu Futebol Hoje</span>
              <span className="muted">Seu dia, organizado</span>
            </div>
            <div className="preview-teams">
              <span className="monogram">01</span>
              <span className="monogram light">02</span>
              <span className="monogram dark">03</span>
              <span className="muted">Seus favoritos, juntos.</span>
            </div>
            <div className="preview-match">
              <div className="eyebrow muted">SUA AGENDA · PRÓXIMA PARTIDA</div>
              <div className="match-line">
                <span>Seu time</span>
                <span className="time-chip">—:—</span>
                <span>Adversário</span>
              </div>
              <div className="preview-bottom">
                <span>Data e horário da sua agenda</span>
                <span className="dot" />
              </div>
            </div>
            <div className="preview-privacy">
              <EyeOff size={19} />
              <div>
                <strong>O resultado pode esperar.</strong>
                <p>Ative o modo sem spoiler e acompanhe no seu tempo.</p>
              </div>
            </div>
          </div>
        </section>
        <section className="feature-section">
          <div className="section-top">
            <span className="eyebrow">MENOS RUÍDO. MAIS FUTEBOL.</span>
            <h2>Feito para a sua torcida.</h2>
          </div>
          <div className="feature-grid">
            {[
              {
                icon: Heart,
                title: "Seu time. E o outro também.",
                text: "Siga mais de um clube e tenha uma visão que faz sentido para você.",
              },
              {
                icon: CalendarDays,
                title: "Toda a agenda, organizada.",
                text: "Hoje, na semana ou no mês. Encontre o próximo jogo sem procurar em vários lugares.",
              },
              {
                icon: EyeOff,
                title: "Futebol no seu tempo.",
                text: "O modo sem spoiler oculta os resultados até você decidir vê-los.",
              },
            ].map((f) => (
              <article key={f.title}>
                <span className="feature-icon">
                  <f.icon size={22} />
                </span>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </article>
            ))}
          </div>
        </section>
        {demoEnabled() && (
          <section className="demo-callout">
            <div>
              <h2>Conheça a experiência.</h2>
              <p>
                Demonstração local com clubes e partidas fictícios. Nenhuma
                conta é criada.
              </p>
            </div>
            <form method="post" action="/auth/demo">
              <button className="button secondary">
                Explorar demonstração <ArrowRight size={17} />
              </button>
            </form>
          </section>
        )}
      </main>
      <Footer />
    </>
  );
}
