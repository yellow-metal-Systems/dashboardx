# TODO — LeadDesk

Rewritten 2026-09-27. The previous version pointed at `todobackend.md` "in the
`yellow_metal_ondc` repo", which no longer exists, and listed several items that have
since shipped. Backend items now live in `serverx`'s own `README.md` checklist and
`QUESTIONS.md`.

Nothing below is broken. These are gaps and unmade decisions.

---

## Needs a decision, not code

- **Stat card size.** The Total/New/Flagged/Disbursed tiles use `HeadingXLarge`, which
  the design doc specifies for "big numbers, dashboard". They match the spec exactly, so
  shrinking them is a preference call. Just needs a yes/no.
- **Lead detail: slide-over or modal?** The detail view is a right-side sheet; the LMS
  doc specifies a centred modal. A `Dialog` primitive now exists
  (`components/ui/dialog.tsx`, added for the disbursement form), so switching is cheap if
  wanted. Note the full page at `/dashboard/leads/[id]` already exists and is richer than
  the sheet either way.
- **Filters: dropdowns or chips?** Currently `Select`/`Input` fields; the doc specifies
  `FilterPill` chips.
- **Should lead expiry notify AarthikLabs?** Currently silent, deliberately. Their call
  as much as ours — it is in the handover guide's open questions.

## Real gaps

- **No pagination on the leads table.** `listLeads()` caps at 1000 rows and the table
  renders all of them client-side. Fine at current volume; the cap is the thing that
  will bite first.
- **The detail sheet has no Activity section.** The full lead page has the timeline and
  the webhook history; the sheet doesn't. Anything added to one is invisible in the
  other — worth resolving alongside the sheet/modal decision above.
- **Only the leads list live-refreshes.** `hooks/use-live-refresh.ts` polls every 30s
  and on tab refocus. The lead detail and overview pages update on navigation only. The
  hook is reusable if that matters.
- **Partners page is read-only.** No invite, no disable, no edit — the v1 spec asks for
  all three.

## Not built, and the v1 spec requires it

The entire partner-facing side. `/partner` is a static mock whose submit button toggles
a banner and writes nothing; it is unlinked from the sidebar so it no longer implies
otherwise, but it is still reachable by URL and sits outside the auth middleware.

Missing, per the v1 platform spec §6.1 / §11:

- `PartnerUser` and `Invite` models
- Invitation tokens (single-use, expiring), and the admin flow to send them
- Partner self-signup
- Real lead submission from `/partner`, with the duplicate-flag rule applied
- Two transactional emails: partner invitation, and the ops new-lead alert the
  Production Build Plan lists under its Phase 3

This is a coherent chunk of work rather than a list of fixes, and none of it is started.

## Operational, not code

- **Ops must verify the 11 branch coordinates** in `serverx`. They are town-centre
  approximations flagged `coords_verified: false` — good enough to rank branches by
  distance, not good enough to quote as a location. `npm run verify:branch-coords` in
  `serverx` prints the checklist.
- **Integration tests need Docker running.** 49 tests in `serverx` are written and
  skip cleanly without `TEST_DATABASE_URL`. They have not yet been run against a
  database.

## Shipped since the last version of this file

Kept briefly so nobody re-opens them: the LMS design system, the sidebar overflow and
stat-card alignment fixes, the 13-place `CardContent` padding regression, loading
skeletons, removal of the replaying count-up animations that caused the reported "lag",
staff authentication, the disbursement capture form, both LTV figures on the lead page,
webhook delivery history, and the shared-database unification that deleted the manual
sync script. See `changelog.md`.
