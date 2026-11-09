export default function Loading() {
  return (
    <div
      role="status"
      aria-label="Carregando seu radar"
      className="skeleton-group"
    >
      <div />
      <div />
      <div />
      <span className="sr-only">Carregando…</span>
    </div>
  );
}
