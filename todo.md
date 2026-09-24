TODO

Right now the focus is the frontend only (LeadDesk). Backend items live in todobackend.md (in the yellow_metal_ondc repo) — not being worked on until we come back to them.

FRONTEND — active

Done so far: applied the Yellow Metal LMS design system (colors, Manrope font, spacing, button/card/badge shapes), fixed the sidebar horizontal overflow bug, fixed the stat card label misalignment, fixed the filter card's missing top padding on desktop (this was actually broken in 13 places across the app, all fixed), moved a couple of misplaced npm packages, turned off demo mode so it reads the real local Postgres data, and added loading skeletons so clicking Leads/Partners/Overview feels instant instead of freezing while the page fetches.

Still open:
- Decide if the Total leads/New/Flagged duplicates/Converted stat cards should be smaller. They currently match the design doc's spec exactly (HeadingXLarge is literally meant for "big numbers, dashboard"), so this is a preference call, not a bug — just need a yes/no.
- Structural stuff we deliberately skipped when applying the design system: no real pagination on the leads table yet (it renders everything client-side), the filters are still dropdown/input fields rather than the doc's FilterPill chips, and the lead detail view is still a right-side slide-over instead of the doc's centered Modal. None of these are broken, they just don't match the LMS tool's exact component choices yet.
- General pass for anything still visually off now that the redesign has settled — worth another look end to end.
