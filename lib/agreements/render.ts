import { createHash } from "crypto";
import PdfPrinter from "pdfmake";
import type { TDocumentDefinitions } from "pdfmake/interfaces";

import { TEMPLATE_TITLES, TEMPLATE_VERSIONS, type AgreementFields, type Signature, type SigningCertificate } from "./fields";
import { agreementContent, certificatePage } from "./templates";

// =============================================================================
// Renders a partner agreement to PDF bytes with pdfmake (pure JS: no browser,
// no LibreOffice, runs on Netlify's functions). Rendering is deterministic: the
// same fields and signatures give the same bytes, because the PDF's dates and
// file id come from the agreement's own date, never from "now". The unsigned
// PDF's SHA-256 is part of the signing evidence, so this matters.
// =============================================================================

// Roboto from pdfmake's bundled virtual file system, as buffers: nothing is read
// from disk at runtime, so bundling and file tracing can't lose a font file.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const vfs: Record<string, string> = require("pdfmake/build/vfs_fonts");
const font = (name: string) => Buffer.from(vfs[name], "base64");

let printer: PdfPrinter | null = null;
function getPrinter(): PdfPrinter {
  printer ??= new PdfPrinter({
    Roboto: {
      normal: font("Roboto-Regular.ttf"),
      bold: font("Roboto-Medium.ttf"),
      italics: font("Roboto-Italic.ttf"),
      bolditalics: font("Roboto-MediumItalic.ttf"),
    },
  });
  return printer;
}

// fontkit takes an object to switch features off; the types only know the array form.
const NO_LIGATURES = { liga: false, clig: false } as unknown as PDFKit.Mixins.OpenTypeFeatures[];

export type RenderOptions = {
  /** The agreement's id, printed in every page footer. */
  reference: string;
  company?: Signature;
  partner?: Signature;
  /** Executed copies only: adds the signing certificate as the last page. */
  certificate?: SigningCertificate;
};

export function agreementDocument(fields: AgreementFields, opts: RenderOptions): TDocumentDefinitions {
  const version = TEMPLATE_VERSIONS[fields.template];
  // Fixed metadata: the effective date at midnight UTC, whatever the time now.
  const stamp = new Date(`${fields.effectiveDate}T00:00:00Z`);
  return {
    pageSize: "A4",
    pageMargins: [56, 56, 56, 60],
    info: {
      title: TEMPLATE_TITLES[fields.template],
      author: fields.companyName,
      subject: `${TEMPLATE_TITLES[fields.template]} with ${fields.partnerName}`,
      creator: "Yellow Metal LeadDesk",
      producer: "Yellow Metal LeadDesk",
      creationDate: stamp,
      modDate: stamp,
    },
    content: [
      ...agreementContent(fields, opts.company, opts.partner),
      ...(opts.certificate ? certificatePage(opts.certificate) : []),
    ],
    footer: (page, pages) => ({
      columns: [
        { text: `Ref ${opts.reference} · ${version}`, style: "footer" },
        { text: `Page ${page} of ${pages}`, style: "footer", alignment: "right" },
      ],
      margin: [56, 24, 56, 0],
    }),
    // No ligatures: with them "fi" is one glyph and copied text reads "verifcation".
    defaultStyle: { font: "Roboto", fontSize: 10, lineHeight: 1.25, color: "#1A202C", fontFeatures: NO_LIGATURES },
    styles: {
      title: { fontSize: 16, bold: true, alignment: "center", color: "#1F3A5F", margin: [0, 0, 0, 4] },
      subtitle: { fontSize: 9.5, italics: true, alignment: "center", margin: [0, 0, 0, 12] },
      scope: { fontSize: 9.5 },
      heading: { fontSize: 11.5, bold: true, color: "#2F6DB5", margin: [0, 14, 0, 6] },
      body: { margin: [0, 0, 0, 8] },
      item: { margin: [12, 0, 0, 6] },
      annex: { fontSize: 13, bold: true, margin: [0, 18, 0, 8] },
      table: { fontSize: 9.5 },
      small: { fontSize: 8.5 },
      footer: { fontSize: 8, color: "#718096" },
    },
  };
}

/** The agreement as PDF bytes. */
export function renderAgreement(fields: AgreementFields, opts: RenderOptions): Promise<Buffer> {
  const doc = getPrinter().createPdfKitDocument(agreementDocument(fields, opts));
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}

export const sha256 = (bytes: Buffer | Uint8Array) => createHash("sha256").update(bytes).digest("hex");
