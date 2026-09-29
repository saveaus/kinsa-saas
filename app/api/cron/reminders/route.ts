import { NextResponse } from "next/server"

import { hasAdminClient } from "@/lib/supabase/admin"
import { runReminderSweep } from "@/modules/reminders/run"

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  const auth = request.headers.get("authorization")
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!hasAdminClient()) {
    return NextResponse.json({
      error: "SUPABASE_SECRET_KEY is required for the reminder sweep",
    }, { status: 501 })
  }

  const result = await runReminderSweep()
  return NextResponse.json(result)
}
