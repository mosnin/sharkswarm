import { redirect } from "next/navigation";

// Root page redirects into the authenticated shell.
// Clerk middleware handles auth gating — unauthenticated users
// are redirected to /sign-in before they can reach (authenticated)/.
export default function RootPage() {
  redirect("/dashboard");
}
