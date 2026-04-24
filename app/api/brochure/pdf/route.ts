import { NextRequest, NextResponse } from "next/server";
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";

// Puppeteer needs the Node.js runtime (not Edge)
export const runtime = "nodejs";
// Give cold-starts room: chromium download + launch can take ~10s
export const maxDuration = 60;
// Don't cache the PDF on the edge — regenerate on each request
export const dynamic = "force-dynamic";

// Locally on Mac, @sparticuz/chromium has no binary — fall back to system Chrome.
const LOCAL_CHROME_PATHS = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
];

async function resolveExecutablePath(): Promise<string> {
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return await chromium.executablePath();
  }
  // Dev: try system Chrome
  const fs = await import("node:fs");
  for (const p of LOCAL_CHROME_PATHS) {
    if (fs.existsSync(p)) return p;
  }
  // Final fallback to @sparticuz (may not work locally but worth trying)
  return await chromium.executablePath();
}

export async function GET(req: NextRequest) {
  const isProd = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

  // Build the URL we want puppeteer to load. Use the incoming request's origin
  // so this works on any deployment (preview or prod) and locally.
  const origin = req.nextUrl.origin;
  const brochureUrl = `${origin}/brochure?print=1`;

  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;
  try {
    browser = await puppeteer.launch({
      args: isProd
        ? chromium.args
        : ["--no-sandbox", "--disable-setuid-sandbox"],
      defaultViewport: { width: 1920, height: 1080, deviceScaleFactor: 1 },
      executablePath: await resolveExecutablePath(),
      headless: true,
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });

    // Firebase auth keeps a long-lived connection, so networkidle0 never fires.
    // domcontentloaded + explicit font/frame waits is reliable.
    await page.goto(brochureUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForSelector(".brochure-slide-print", { timeout: 20000 });
    await page.evaluateHandle("document.fonts.ready");
    await new Promise((r) => setTimeout(r, 1200));

    const pdf = await page.pdf({
      width: "1920px",
      height: "1080px",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });

    return new NextResponse(pdf as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="DeskHive-Brochure.pdf"',
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[brochure/pdf] failed:", err);
    return NextResponse.json(
      { error: "Failed to generate PDF", detail: String(err) },
      { status: 500 }
    );
  } finally {
    if (browser) await browser.close();
  }
}
