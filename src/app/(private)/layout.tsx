import { redirect } from "next/navigation";
import { snapshot } from "@/server/dal/football";
import { AppShell } from "@/components/app-shell";
import { HttpError } from "@/lib/security/validation";
export default async function PrivateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let data;
  try {
    data = await snapshot();
  } catch (e) {
    if (e instanceof HttpError && e.status === 401) redirect("/login");
    if (e instanceof HttpError && e.status === 503)
      redirect("/login?status=indisponivel");
    throw e;
  }
  return (
    <AppShell demo={data.demo} hideScores={data.hideScores}>
      {children}
    </AppShell>
  );
}
