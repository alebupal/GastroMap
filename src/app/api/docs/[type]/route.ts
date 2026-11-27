import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ type: string }> }
) {
  try {
    const { type } = await context.params;
    const { searchParams } = new URL(request.url);
    const lang = searchParams.get("lang") === "en" ? "en" : "es";

    let filename: string;
    if (type === "readme") {
      filename = lang === "en" ? "README.MD" : "README_ES.MD";
    } else if (type === "docs" || type === "documentation") {
      filename = lang === "en" ? "DOCUMENTATION.MD" : "DOCUMENTACION.MD";
    } else {
      filename = lang === "en" ? "CHANGELOG.MD" : "CHANGELOG_ES.MD";
    }

    const candidatePaths = [
      path.join(/*turbopackIgnore: true*/ process.cwd(), filename),
      path.join(/*turbopackIgnore: true*/ process.cwd(), "GastroMap", filename),
      path.join(/*turbopackIgnore: true*/ process.cwd(), "..", filename),
      path.join(/*turbopackIgnore: true*/ "/app", filename),
    ];

    let filePath: string | null = null;
    for (const p of candidatePaths) {
      if (fs.existsSync(/*turbopackIgnore: true*/ p)) {
        filePath = p;
        break;
      }
    }

    if (filePath) {
      const content = fs.readFileSync(/*turbopackIgnore: true*/ filePath, "utf-8");
      return NextResponse.json(
        { filename, content },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    // Fallback a GitHub Raw si no está en disco local
    const fallbackUrl = `https://raw.githubusercontent.com/alebupal/GastroMap/main/${filename}`;
    const res = await fetch(fallbackUrl);
    if (!res.ok) {
      return NextResponse.json(
        { error: `Archivo ${filename} no encontrado` },
        { status: 404 }
      );
    }

    const content = await res.text();
    return NextResponse.json({ filename, content });
  } catch {
    return NextResponse.json(
      { error: "Error al leer la documentación" },
      { status: 500 }
    );
  }
}
