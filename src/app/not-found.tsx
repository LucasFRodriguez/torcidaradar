import Link from "next/link";
export default function NotFound() {
  return (
    <main id="conteudo" className="error-page">
      <h1>Fora do radar.</h1>
      <p>Esta página não foi encontrada.</p>
      <Link className="button" href="/">
        Voltar ao início
      </Link>
    </main>
  );
}
