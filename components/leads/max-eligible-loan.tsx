import { fetchGoldInsights } from "@/lib/server-bridge";
import { formatInr } from "@/lib/leads";

type Field = { label: string; children: React.ReactNode };

function Field({ label, children }: Field) {
  return (
    <div className="flex flex-col gap-0">
      <dt className="text-paragraph-md text-info-label">{label}</dt>
      <dd className="text-[18px] font-bold leading-6 text-on-surface">{children}</dd>
    </div>
  );
}

// Split out of the lead detail page so it can stream in behind <Suspense>.
// fetchGoldInsights calls serverx with the same 4s-timeout pattern that caused
// the integration-health banner delay — previously awaited inline, it blocked
// the ENTIRE page (borrower details, status, activity) behind one slow call
// to a figure that already degrades to "unavailable" on its own.
export async function MaxEligibleLoan({
  leadId,
  goldGrams,
}: {
  leadId: string;
  goldGrams: number;
}) {
  const gold = await fetchGoldInsights(leadId);

  return (
    <div className="mt-2 rounded-lg bg-surface-container-low p-4">
      <p className="text-label-sm uppercase tracking-widest text-label">
        Maximum eligible loan
      </p>
      {gold && (gold.maxEligibleBullet68 !== null || gold.maxEligibleMonthly75 !== null) ? (
        <>
          <dl className="mt-3 grid gap-4 sm:grid-cols-2">
            {gold.maxEligibleBullet68 !== null && (
              <Field label="Bullet plan, 68% LTV">
                <span className="text-lg font-semibold">
                  {formatInr(gold.maxEligibleBullet68)}
                </span>
              </Field>
            )}
            {gold.maxEligibleMonthly75 !== null && (
              <Field label="Monthly plan, 75% LTV">
                <span className="text-lg font-semibold">
                  {formatInr(gold.maxEligibleMonthly75)}
                </span>
              </Field>
            )}
          </dl>
          <p className="mt-3 text-xs text-on-surface-variant">
            On {goldGrams} g
            {gold.rateUsed !== null ? ` at ${formatInr(gold.rateUsed)}/g (22K)` : " at the 22K rate"}
            {gold.rateSource === "fallback" ? " — fallback rate, live rate unavailable." : "."}{" "}
            Both plans are shown because the branch manager selects the plan in person,
            after assessing the actual gold.
          </p>
        </>
      ) : (
        <p className="mt-2 text-sm text-on-surface-variant">
          Unavailable — could not reach the rate service. Reload to try again.
        </p>
      )}
    </div>
  );
}

export function MaxEligibleLoanSkeleton() {
  return (
    <div className="mt-2 animate-pulse rounded-lg bg-surface-container-low p-4">
      <p className="text-label-sm uppercase tracking-widest text-label">
        Maximum eligible loan
      </p>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <div className="h-6 w-32 rounded bg-primary/10" />
        <div className="h-6 w-32 rounded bg-primary/10" />
      </div>
    </div>
  );
}
