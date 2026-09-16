import { redirect } from "next/navigation";

/**
 * The domain always opens on the sign-in screen. Sending a visitor straight
 * into the company picker made it impossible to tell, from the address alone,
 * whether you were about to land in someone else's session — which matters on
 * the shared machines this is used from.
 */
export default function RootPage() {
  redirect("/login");
}
