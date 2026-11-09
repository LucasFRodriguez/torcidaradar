"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { EyeOff, ShieldCheck, LogOut } from "lucide-react";
export function Settings({
  name,
  hideScores,
  timezone,
  demo,
  deletionStatus,
}: {
  name: string;
  hideScores: boolean;
  timezone: string;
  demo: boolean;
  deletionStatus: string | null;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function send(path: string, payload: unknown) {
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/me/" + path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error();
      setMessage(
        path === "deletion-request"
          ? "Solicitação registrada. A conta ainda não foi excluída; aguarda atendimento seguro."
          : "Alterações salvas.",
      );
      router.refresh();
    } catch {
      setMessage(
        "Não foi possível concluir. Verifique os campos e a senha, ou tente novamente.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div role="status" aria-live="polite">
        {message && <p className="notice">{message}</p>}
      </div>
      <div className="settings-grid">
        <section className="panel">
          <h2>Seu perfil</h2>
          <p className="muted">Como você prefere ser chamado?</p>
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void send("profile", { display_name: f.get("display_name") });
            }}
          >
            <label>
              Nome de exibição
              <input
                name="display_name"
                defaultValue={name}
                maxLength={60}
                placeholder="Seu nome (opcional)"
              />
            </label>
            <button className="button" disabled={busy}>
              Salvar perfil
            </button>
          </form>
        </section>
        <section className="panel">
          <h2>
            <EyeOff size={19} /> Sua experiência
          </h2>
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void send("preferences", {
                hide_scores: f.get("hide_scores") === "on",
                timezone: f.get("timezone"),
              });
            }}
          >
            <label className="checkbox-label">
              <input
                type="checkbox"
                name="hide_scores"
                defaultChecked={hideScores}
              />
              <span>
                <strong>Modo sem spoiler</strong>
                <small>
                  Oculta placares, status reveladores e classificação em todas
                  as telas.
                </small>
              </span>
            </label>
            <label>
              Fuso horário
              <select name="timezone" defaultValue={timezone}>
                <option value="America/Sao_Paulo">Brasília</option>
                <option value="America/Manaus">Manaus</option>
                <option value="America/Recife">Recife</option>
                <option value="UTC">UTC</option>
              </select>
            </label>
            <button className="button" disabled={busy}>
              Salvar preferências
            </button>
          </form>
        </section>
        <section className="panel">
          <h2>
            <ShieldCheck size={19} /> Acesso e segurança
          </h2>
          <p className="muted">
            Use uma senha única e mantenha seu e-mail protegido.
          </p>
          <Link className="text-link" href="/atualizar-senha">
            Alterar senha
          </Link>
          <form action="/auth/logout" method="post">
            <button className="button secondary spaced">
              <LogOut size={16} /> Sair da conta
            </button>
          </form>
        </section>
        <section className="panel danger-panel">
          <h2>Exclusão de conta</h2>
          <p>
            Solicite a exclusão dos seus dados e da identidade Auth. O pedido é
            atendido manualmente; enviar o formulário não exclui a conta
            imediatamente.
          </p>
          {deletionStatus && (
            <p className="notice">
              Status da solicitação:{" "}
              {deletionStatus === "pending"
                ? "aguardando atendimento"
                : deletionStatus === "processing"
                  ? "em atendimento"
                  : "concluída"}
              .
            </p>
          )}
          {demo ? (
            <p className="fine-print">
              A demonstração não possui uma conta real. Use “Sair da conta” para
              limpar os dados locais.
            </p>
          ) : (
            <form
              className="stack"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void send("deletion-request", {
                  password: f.get("password"),
                  confirmation: f.get("confirmation"),
                });
                e.currentTarget.reset();
              }}
            >
              <label>
                Confirme sua senha
                <input
                  name="password"
                  type="password"
                  required
                  maxLength={128}
                  autoComplete="current-password"
                />
              </label>
              <label>
                Digite EXCLUIR MINHA CONTA
                <input
                  name="confirmation"
                  required
                  pattern="EXCLUIR MINHA CONTA"
                  maxLength={30}
                />
              </label>
              <button
                disabled={busy || !!deletionStatus}
                className="button danger"
              >
                Solicitar exclusão
              </button>
            </form>
          )}
        </section>
      </div>
    </>
  );
}
