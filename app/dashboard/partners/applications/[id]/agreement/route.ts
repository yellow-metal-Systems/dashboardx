import { staffWithPermission } from "@/lib/auth/session";
import { AgreementFileError } from "@/lib/agreements/files";
import { pdfResponse, textResponse } from "@/lib/agreements/http";
import { agreementPdf } from "@/lib/partners/applications";

// The application's agreement PDF for staff: ?file=sent (the copy sent for
// signing, the default) or ?file=executed (the countersigned copy), shown
// inline, or downloaded with ?download=1. Staff who may not see partners get
// a plain 404.
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  if (!(await staffWithPermission("partners.manage"))) return textResponse("Not found.", 404);
  const query = new URL(request.url).searchParams;
  const kind = query.get("file") === "executed" ? "executed" : "sent";
  try {
    const pdf = await agreementPdf(params.id, kind);
    if (!pdf) return textResponse(kind === "executed" ? "This agreement hasn't been countersigned yet." : "No agreement has been sent for this application.", 404);
    return pdfResponse(pdf.bytes, pdf.fileName, query.get("download") === "1");
  } catch (err) {
    if (err instanceof AgreementFileError) return textResponse(err.message, 409);
    throw err;
  }
}
