# Partner onboarding with a signed agreement

How a person or company becomes a LeadBridge partner: they apply, an admin sends
them an agreement, they sign it online, an admin countersigns, and their partner
login is created. Everything runs on free tiers: no e-sign service, no file
storage service, and no mail service until Yellow Metal's domain is set up.

The build plan, with the decisions and the questions still open for Rahul, is
`PARTNER-ONBOARDING-PLAN.md` in the workspace root. This page describes what is
built.

---

## 1. The flow

| Step | Who | Where | Status after |
|---|---|---|---|
| Apply: Individual (name, email, mobile, town, address, PAN) or Company (company name, contact person, email, mobile, town, registered office, optional GSTIN). An "application received" email goes out. | applicant | LeadBridge `/join` | `PENDING` |
| Send the agreement: individuals get the **Business Correspondent (BC)** agreement, companies the **Direct Selling Agent (DSA)** agreement. The admin enters the payout rates and can preview the PDF. Send stores that exact PDF and emails a single-use signing link. | admin | LeadDesk, application page | `AGREEMENT_SENT` |
| Sign: read the PDF, type their full name, tick "I agree". | applicant | LeadBridge `/agreement/<token>` | `SIGNED` |
| Countersign and approve: the executed PDF is made (both signatures plus a signing certificate page), the partner and login are created, and the partner is emailed the signed copy and a set-password link. | admin | LeadDesk, application page | `APPROVED` |
| Set a password and start sending leads, as today. | partner | LeadBridge `/invite/<token>` | |

- **Reject** works at any step before approval. A reason is required, the applicant is emailed it, and any signing link stops working.
- **Resend** (only before signing) cancels the old link and sends a new one, optionally with new rates.
- An **expired link** leaves the status at `AGREEMENT_SENT`; the admin resends.
- One open application per mobile and per email. Someone who is already a partner sees the same thank-you screen, and nothing is saved.
- The mobile number is stored but not verified: there is no free phone check.
- **Aadhaar numbers are never collected.** The BC agreement's "Govt ID / Aadhaar / PAN" line is filled with the PAN.

---

## 2. Where the code is

serverx owns the tables (migration `12_partner_agreements`). LeadDesk makes every
PDF. LeadBridge only shows the stored PDF and records the signature.

| Piece | Repo | Code |
|---|---|---|
| Tables: `partner_applications` (extended), `partner_agreements`, `agreement_files`, `email_messages`, `partner_application_events` | serverx | `prisma/migrations/12_partner_agreements` |
| Apply | leadbridge | `lib/applications.ts` (`submitApplication`), `lib/application-actions.ts` (`submitApplicationAction`) |
| Sign | leadbridge | `lib/agreements.ts` (`inspectSigningLink`, `noteLinkOpened`, `signAgreement`, `linkProblem`), `lib/agreement-actions.ts` (`signAgreementAction`), `app/api/agreement/[token]/pdf/route.ts` |
| Templates and PDF | dashboardx | `lib/agreements/` (`fields.ts`, `templates.ts`, `render.ts`, `files.ts`, `http.ts`) |
| Send, resend, reject, countersign and approve | dashboardx | `lib/partners/applications.ts`, actions in `lib/partners/actions.ts` |
| Staff PDFs | dashboardx | `app/dashboard/partners/applications/[id]/agreement/route.ts` and `.../preview/route.ts` |
| Email | both | `lib/email.ts` (kept the same in both apps), `lib/email-templates.ts`; dashboardx `lib/email-log.ts` for the Sent emails page |
| Demo data | dashboardx | `scripts/onboarding-demo.ts` |

### For the screens

| Use | Call |
|---|---|
| Applications list and tab counts | `listApplications(status)`, `countApplications()`, `APPLICATION_STATUS_LABELS`; menu badge `countPendingApplications()` (pending + signed) |
| Application page | `getApplication(id)`: details, current agreement (times, signature evidence), history. `defaultRates(template)` for the form. |
| Send / Resend / Reject | `sendAgreementAction`, `resendAgreementAction` (the `changeRates` checkbox sends new rates), `rejectApplicationAction` (`reason`). Fields: `applicationId`, plus the rate fields in `RATE_FIELDS`. |
| Countersign and approve | `countersignAndApproveAction`: fields `applicationId`, `confirmed` (checkbox) and optional `designation`. Show it only at `SIGNED`. It returns a message and the invite link, shown once. |
| Preview before sending | open `/dashboard/partners/applications/<id>/agreement/preview?<rate fields>` in a new tab |
| View or download a PDF | `/dashboard/partners/applications/<id>/agreement` (as sent), `?file=executed` (signed copy), `&download=1` |
| Sent emails page | `listEmails()`, `getEmail(id)`. Show the body in `<iframe sandbox srcDoc={bodyHtml}>`, never as HTML in the page. |
| Sign page | `inspectSigningLink(token)` → `noteLinkOpened(link)`; PDF from `/api/agreement/<token>/pdf` (`?download=1`); form to `signAgreementAction` with `token`, `typedName`, `agreed`; `linkProblem(state)` for expired, used, cancelled or invalid links |

---

## 3. The agreement

- **Templates are code**, transcribed word for word from the DSA .docx and the BC PDF, under a version id (`dsa-v1`, `bc-v1`) in `lib/agreements/templates.ts`. The values filled in (date, both parties, PAN, rates) are stored on `partner_agreements.fields`.
- **pdfmake** renders them: pure JavaScript, so it runs on Netlify functions. It is a server-external package (`next.config.mjs`), and the Roboto fonts come from its bundled `vfs_fonts`, so nothing is read from disk.
- **Rendering is deterministic.** The same fields give the same bytes (the PDF dates come from the effective date, never from "now"). This is tested, and it matters: the unsigned PDF's SHA-256 is part of the evidence.
- **Every stored PDF has a fingerprint.** The bytes live in `agreement_files` with their SHA-256. Nothing is shown, signed, countersigned or downloaded from a file whose bytes no longer match.
- **The executed copy** is the same agreement rendered again with both signature blocks filled ("Signed electronically by … on … IST"), plus a **signing certificate** page: reference, template version, the unsigned PDF's SHA-256, who sent it and when, the typed name, email, time, IP and device of the signer, and the countersigner.
- **Before countersigning**, LeadDesk renders the unsigned copy again from the stored fields and checks it matches the signed file byte for byte. If the wording or pdfmake has changed since sending, countersigning is refused: reject the application and ask the applicant to apply again.

### Changing the wording

1. Edit `templates.ts` and bump the version in `fields.ts` (`dsa-v2`). Never change a version's text in place.
2. Run `npm run agreements:samples -- <folder>` and send the PDFs for approval.
3. Agreements sent but not yet countersigned can no longer be countersigned (see above). Approve them before deploying, or reject them and have the applicants apply again.

### Payout rates

Annexure A (DSA): per qualified lead in rupees, and a disbursal payout as a percentage **or** a flat amount, not both. Schedule B (BC): per verified application, disbursal percentage, per active loan per month, collection percentage. A blank rate prints the template's blank line. `defaultRates` returns blanks until Rahul confirms defaults.

These rates are what the agreement says. Today's reward calculation (`lib/partners/rewards.ts`) is separate and unchanged.

---

## 4. Signing and approval rules

- **Signing link**: 32 random bytes; only its SHA-256 is stored. It works once, for `AGREEMENT_LINK_TTL_DAYS` (14), and stops working on resend or reject. An unknown link reveals nothing.
- **Signing** needs the agree box ticked and the applicant's name typed. Case, extra spaces and full stops don't matter. For a company, the contact person signs in their own name. 10 attempts an hour per link. The agreement and application move to `SIGNED` together, so a link signs exactly once even if submitted twice at once.
- **Evidence recorded**: typed name, time, IP (first `x-forwarded-for` hop), device (user agent), and the first time the link was opened.
- **Countersign and approve** needs the `agreements.countersign` permission (admins) and a `SIGNED` application, both checked on the server. The countersigner's name comes from their LeadDesk account.
  - In one transaction: the executed PDF is stored, the agreement becomes `EXECUTED`, the application `APPROVED`, and the partner, login and invite are created. If anything fails (for example the mobile already has a login), all of it rolls back and the application stays `SIGNED`.
  - A company becomes an `ORGANISATION` partner named after the company, with the application email as contact. An individual becomes an `INDIVIDUAL` partner.
  - The welcome email carries the executed PDF and the set-password link (7 days). The link is also shown to the admin once, to share on WhatsApp if the email doesn't arrive.
- **Every step claims the row with a conditional update**, so two admins acting at once can't both send, resend, reject or approve.
- **History**: each step writes a `partner_application_events` row (applied, agreement_sent, agreement_resent, link_opened, signed, approved, rejected, email_failed).

---

## 5. Email

| Email | Sent by | When |
|---|---|---|
| Application received | LeadBridge | apply |
| Please sign your agreement (and the resent version) | LeadDesk | send, resend |
| Welcome, with the signed agreement attached and the set-password link | LeadDesk | countersign and approve |
| About your application, with the reason | LeadDesk | reject |

- **`EMAIL_MODE=log`** (the default): nothing is sent. Each email is saved in `email_messages` with its body, and LeadDesk's Sent emails page shows it. This is the demo mailbox, so the whole flow works without a mail service. The body contains live signing and password links, so log mode is for local and demo databases.
- **`EMAIL_MODE=resend`**: sent through Resend's HTTP API (free: 3,000 a month) from `EMAIL_FROM`. The body is **not** stored, so links never sit in the database.
- A failed email never fails the action. The row says `FAILED` with the error, the application history gets `email_failed`, and the admin can resend.

### Going live with real email

1. In Resend, add Yellow Metal's domain and put its DNS records (SPF, DKIM) in the domain's DNS. This needs the DNS access we don't have yet.
2. Set in **both** apps: `EMAIL_MODE=resend`, `RESEND_API_KEY`, `EMAIL_FROM="Yellow Metal <onboarding@<domain>>"`.
3. Send one application through to yourself and check the attachment arrives.

---

## 6. Environment

| Variable | App | Notes |
|---|---|---|
| `EMAIL_MODE`, `RESEND_API_KEY`, `EMAIL_FROM` | both | see section 5 |
| `LEADBRIDGE_URL` | LeadDesk | builds signing, invite and install links. Must be LeadBridge's public URL in production. |
| `COMPANY_LEGAL_NAME`, `COMPANY_REGISTERED_OFFICE` | LeadDesk | printed on every agreement. **Required in production**: sending refuses without them. Elsewhere a visible placeholder is printed. |
| `AGREEMENT_LINK_TTL_DAYS` | LeadDesk | default 14 |

---

## 7. Operations

### Local demo

1. Start the database (`docker start tests-db-1`) and the three apps (`start-all.js`: serverx 4100, LeadDesk 3000, LeadBridge 3200). `ym_local` must be migrated by serverx (`npx prisma migrate deploy` in serverx).
2. A local admin: `ADMIN_EMAIL=… ADMIN_PASSWORD=… npm run db:create-admin`.
3. Demo applications, one at each step: `npm run onboarding:demo -- seed`. It refuses to run against Supabase. It prints the signing link for the "agreement sent" one.
4. Afterwards: `npm run onboarding:demo -- clean --yes`.

### Removing test rows

`npm run onboarding:demo -- clean` lists every application whose applicant or
company name starts with `TEST `, with its agreements, PDFs, emails, and the
partners approved from it. With `--yes` it deletes them in one transaction. A
partner that already has leads or rewards is kept and reported. Nothing else is
touched: the AarthikLabs test leads stay. It is safe to point at Supabase, because it
deletes only with `--yes`. Use `TEST …` names for any test application on a shared
database.

### Troubleshooting

| Message | Meaning |
|---|---|
| "This application is missing details the agreement needs" | It came in before the new join form (no email or address). Reject it and ask them to apply again. |
| "Set COMPANY_LEGAL_NAME and COMPANY_REGISTERED_OFFICE" | Production without the company details. Set them in Netlify. |
| "The stored agreement does not match its fingerprint" | The PDF bytes in the database changed. Nothing will use that file. Investigate, then reject and re-run the application. |
| "The agreement wording has changed since this was signed" | The template or pdfmake changed after sending (section 3). Reject, and have the applicant apply again. |
| "A user with that mobile number already exists" on approve | That mobile already has a partner login. Nothing changed; the application is still `SIGNED`. |
| Email shows `FAILED` | See the error on the Sent emails row (missing key, unverified domain). Fix it, then resend the agreement. For a welcome email, share the invite link shown on approval. |

---

## 8. Demo script (about 10 minutes)

Before: `seed` the local database, sign in to LeadDesk as an admin, and open
LeadBridge in a phone-sized window.

1. **Apply** (LeadBridge `/join`): apply as an individual with your own details and a name starting `TEST`. Show the thank-you screen, then the "application received" email in LeadDesk → Sent emails.
2. **Review** (LeadDesk → Partners → Applications): the new application is in Pending next to the seeded ones. Open it.
3. **Send**: enter the payout rates, open the preview, then Send. Show the email in Sent emails.
4. **Sign** (LeadBridge): open the signing link from that email. Read the PDF on the phone, type the name, tick, Sign. Try a wrong name first to show it is refused.
5. **Countersign** (LeadDesk): the application is now Signed and shows the signature evidence. Tick the confirmation and press Countersign and approve. Open the signed copy and scroll to the certificate page.
6. **Welcome**: the welcome email in Sent emails has the signed PDF attached and the set-password link. Open the link, set a password, and sign in to LeadBridge as the new partner.
7. **Other cases**, using the seeded rows: the company application gets the DSA agreement; resend Kavya's link and show the old one no longer works; reject one with a reason and show the email.

After: `clean --yes`.
