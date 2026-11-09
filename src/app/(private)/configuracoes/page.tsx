import { snapshot } from "@/server/dal/football";
import { Settings } from "@/components/settings";
export default async function Page() {
  const d = await snapshot();
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">DO SEU JEITO</span>
          <h1>Perfil e preferências</h1>
          <p>Seu radar, suas escolhas. Você está no controle.</p>
        </div>
      </div>
      <Settings
        name={d.displayName}
        hideScores={d.hideScores}
        timezone={d.timezone}
        demo={d.demo}
        deletionStatus={d.deletionStatus}
      />
    </>
  );
}
