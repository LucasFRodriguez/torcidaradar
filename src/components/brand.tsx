import Link from "next/link";
import { Radar } from "lucide-react";
export function Brand() {
  return (
    <Link className="brand" href="/" aria-label="TorcidaRadar, página inicial">
      <span className="brand-symbol">
        <Radar size={23} strokeWidth={1.8} />
      </span>
      <span>
        Torcida<span className="brand-accent">Radar</span>
      </span>
    </Link>
  );
}
export function Footer() {
  return (
    <footer className="footer">
      <span>
        TorcidaRadar <span className="muted">· Futebol com clareza.</span>
      </span>
      <nav aria-label="Informações">
        <Link href="/privacidade">Privacidade</Link>
        <Link href="/termos">Termos</Link>
        <Link href="/contato">Contato e dados</Link>
      </nav>
    </footer>
  );
}
