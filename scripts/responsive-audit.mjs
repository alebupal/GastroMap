/**
 * Auditoría visual y de overflow horizontal en móvil con Playwright.
 * Uso: BASE_URL=http://localhost:3000 node scripts/responsive-audit.mjs
 */
import fs from "node:fs";
import path from "node:path";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const VIEWPORTS = [
  { name: "mobile-360", width: 360, height: 800 },
  { name: "mobile-390", width: 390, height: 844 },
  { name: "tablet-768", width: 768, height: 1024 },
];
const ROUTES = ["/login", "/docs", "/"];

async function run() {
  let playwright;
  try {
    playwright = await import("playwright");
  } catch {
    console.error("Playwright no está instalado. Ejecuta: npm i -D playwright");
    process.exit(1);
  }

  const outDir = path.resolve(process.cwd(), "tmp-audit");
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await playwright.chromium.launch();
  let hasOverflow = false;

  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
    });
    const page = await context.newPage();

    for (const route of ROUTES) {
      await page.goto(`${BASE_URL}${route}`, { waitUntil: "networkidle" });
      const overflowPx = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth
      );
      const slug = route === "/" ? "home" : route.replace(/\//g, "-").replace(/^-/, "");
      await page.screenshot({
        path: path.join(outDir, `${vp.name}_${slug}.png`),
        fullPage: false,
      });

      const status = overflowPx > 1 ? `FAIL (+${overflowPx}px overflow)` : "OK";
      console.log(`[${vp.name}] ${route} -> ${status}`);
      if (overflowPx > 1) hasOverflow = true;
    }

    await context.close();
  }

  await browser.close();
  if (hasOverflow) process.exit(1);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
