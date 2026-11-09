import { AuthForm } from "@/components/auth-form";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const p = await searchParams;
  return (
    <AuthForm
      mode="signup"
      status={typeof p.status === "string" ? p.status : undefined}
    />
  );
}
