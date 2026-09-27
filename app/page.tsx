import { redirect } from "next/navigation";

import { currentStaff } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function Home() {
  // Send signed-out visitors to the login page rather than bouncing them through
  // /dashboard and back out via middleware.
  redirect((await currentStaff()) ? "/dashboard" : "/login");
}
