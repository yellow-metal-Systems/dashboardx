import { NextResponse } from "next/server";

// Responses for agreement PDFs: they carry a person's PAN and address, so they
// are never cached or indexed, and the URL is not passed on as a referrer.

export const PRIVATE_HEADERS = {
  "Cache-Control": "no-store, private",
  "X-Robots-Tag": "noindex, nofollow",
  "Referrer-Policy": "no-referrer",
};

export function pdfResponse(bytes: Buffer, fileName: string, download: boolean): NextResponse {
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      ...PRIVATE_HEADERS,
      "Content-Type": "application/pdf",
      "Content-Length": String(bytes.length),
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${fileName.replace(/[^A-Za-z0-9._-]/g, "-")}"`,
    },
  });
}

export function textResponse(message: string, status: number): NextResponse {
  return new NextResponse(message, { status, headers: { ...PRIVATE_HEADERS, "Content-Type": "text/plain; charset=utf-8" } });
}
