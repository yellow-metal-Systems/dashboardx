import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { closeStaleLeads } from "@/lib/leads-repo";

function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const expected = process.env.CRON_SECRET;

  if (!auth || !expected || !safeCompare(auth, `Bearer ${expected}`)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const closed = await closeStaleLeads();
  return NextResponse.json({ closed });
}
