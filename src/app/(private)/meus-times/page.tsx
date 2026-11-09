import { snapshot, findTeams } from "@/server/dal/football";
import { searchSchema } from "@/lib/security/validation";
import { TeamSearch } from "@/components/team-search";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const p = searchSchema.safeParse(raw);
  const data = await snapshot();
  const teams = p.success ? await findTeams(p.data.search, p.data.page) : [];
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">A SUA SELEÇÃO</span>
          <h1>Meus times</h1>
          <p>Escolha seus clubes favoritos. O futebol deles vem até você.</p>
        </div>
      </div>
      {!p.success && (
        <p role="alert" className="notice">
          Busca inválida. Use até 80 caracteres e uma página entre 1 e 100.
        </p>
      )}
      <TeamSearch
        initialTeams={teams}
        favorites={data.favorites}
        onboarding={false}
        search={p.success ? p.data.search : ""}
        page={p.success ? p.data.page : 1}
      />
    </>
  );
}
