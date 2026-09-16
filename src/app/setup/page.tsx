import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import SetupScreen from "./SetupScreen";

export default async function SetupPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return <SetupScreen user={{ name: user.name, roleName: user.roleName }} />;
}
