import { NextResponse } from "next/server";
import { versionService } from "@/services/versionService";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const force = searchParams.get("force") === "true";

  const versionData = await versionService.checkUpdate(force);
  return NextResponse.json(versionData);
}
