import type { Team } from "@/lib/sports/domain";
export function Monogram({ team }: { team: Team }) {
  return (
    <span className="monogram" aria-hidden="true">
      {team.name
        .split(" ")
        .filter(
          (s) => !["do", "da", "de", "dos", "das"].includes(s.toLowerCase()),
        )
        .slice(0, 2)
        .map((s) => s[0].toLocaleUpperCase("pt-BR"))
        .join("")}
    </span>
  );
}
