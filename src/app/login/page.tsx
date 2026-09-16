import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import LoginScreen from "./LoginScreen";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect("/perusahaan");

  const { next } = await searchParams;
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/perusahaan";

  return <LoginScreen nextPath={safeNext} />;
}
