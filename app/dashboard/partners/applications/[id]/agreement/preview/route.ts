import { staffWithPermission } from "@/lib/auth/session";
import { templateFor } from "@/lib/agreements/fields";
import { pdfResponse, textResponse } from "@/lib/agreements/http";
import { prisma } from "@/lib/prisma";
import { ApplicationError, RATE_FIELDS, parseRates, previewAgreement } from "@/lib/partners/applications";

// The agreement as it would be sent, with the payout rates in the query string
// (the Send agreement form's fields), for the admin to read before sending.
// Nothing is stored or sent; the footer says PREVIEW.
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  if (!(await staffWithPermission("partners.manage"))) return textResponse("Not found.", 404);
  const app = await prisma.partnerApplication.findUnique({ where: { id: params.id }, select: { applicantType: true } });
  if (!app) return textResponse("Application not found.", 404);
  const query = new URL(request.url).searchParams;
  try {
    const rates = parseRates(templateFor(app.applicantType), Object.fromEntries(RATE_FIELDS.map((k) => [k, query.get(k) ?? undefined])));
    const pdf = await previewAgreement(params.id, rates);
    return pdfResponse(pdf, `PREVIEW-Yellow-Metal-${templateFor(app.applicantType)}-Agreement.pdf`, false);
  } catch (err) {
    if (err instanceof ApplicationError) return textResponse(err.message, 400);
    throw err;
  }
}
