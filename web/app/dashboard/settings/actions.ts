"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { pool } from "@/lib/db";

// Persist the email-alerts preference. The Phase 5 dispatcher reads
// `email_alerts_enabled`, so turning this off suppresses the next email.
export async function setEmailAlerts(enabled: boolean): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");

  await pool.query(`UPDATE users SET email_alerts_enabled = $1 WHERE id = $2`, [
    enabled,
    user.id,
  ]);
  revalidatePath("/dashboard/settings");
}
