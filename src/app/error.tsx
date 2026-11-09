"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="conteudo" className="error-page">
      <h1>Seu radar precisa de um instante.</h1>
      <p>Não foi possível carregar esta página. Tente novamente em breve.</p>
      <button className="button" onClick={reset}>
        Tentar novamente
      </button>
    </main>
  );
}
