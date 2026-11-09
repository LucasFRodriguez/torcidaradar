import Link from "next/link";
import {
  Home,
  Heart,
  CalendarDays,
  UserRound,
  ArrowUpRight,
  EyeOff,
} from "lucide-react";
import { Brand, Footer } from "./brand";
export function AppShell({
  children,
  demo,
  hideScores,
}: {
  children: React.ReactNode;
  demo: boolean;
  hideScores: boolean;
}) {
  return (
    <>
      <header className="app-header">
        <Brand />
        <nav aria-label="Navegação principal">
          <Link href="/dashboard">
            <Home size={17} /> Início
          </Link>
          <Link href="/meus-times">
            <Heart size={17} /> Times
          </Link>
          <Link href="/calendario">
            <CalendarDays size={17} /> Jogos
          </Link>
          <Link href="/configuracoes">
            <UserRound size={17} /> Perfil
          </Link>
        </nav>
        <Link
          className="avatar"
          href="/configuracoes"
          aria-label="Abrir configurações"
        >
          <UserRound size={19} />
        </Link>
      </header>
      {demo && (
        <div className="demo-banner">
          DEMONSTRAÇÃO LOCAL{" "}
          <span>Clubes e jogos fictícios. Nenhum dado esportivo real.</span>
          <Link href="/">
            Sobre <ArrowUpRight size={13} />
          </Link>
        </div>
      )}
      <div className="workspace">
        <div className="workspace-label">
          <span className="eyebrow">SEU RADAR PESSOAL</span>
          {hideScores && (
            <span className="tag">
              <EyeOff size={13} /> Sem spoiler ativado
            </span>
          )}
        </div>
        <main id="conteudo">{children}</main>
      </div>
      <Footer />
      <nav className="mobile-nav" aria-label="Navegação móvel">
        <Link href="/dashboard">
          <Home size={20} />
          Início
        </Link>
        <Link href="/meus-times">
          <Heart size={20} />
          Times
        </Link>
        <Link href="/calendario">
          <CalendarDays size={20} />
          Jogos
        </Link>
        <Link href="/configuracoes">
          <UserRound size={20} />
          Perfil
        </Link>
      </nav>
    </>
  );
}
