"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field, FieldContent, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type DisbursementInput = {
  loanId?: string;
  amount?: number;
  date?: string;
  tenure?: number;
  plan?: "BULLET" | "MONTHLY";
  /** Left out, the server fills it in from the rate table. */
  roiPercentPa?: number;
};

type Props = {
  open: boolean;
  leadName: string;
  /** Only AarthikLabs leads have their status (and these figures) sent to AarthikLabs. */
  isAarthik: boolean;
  onCancel: () => void;
  onConfirm: (details: DisbursementInput) => void;
};

type FieldKey = "amount" | "date" | "tenure" | "plan" | "rate";

function todayIso(): string {
  // Local date, because the branch manager is recording what happened today in
  // their own timezone, not a UTC instant.
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/**
 * Captures the disbursement figures: sent to AarthikLabs for their leads, and
 * the base of the partner's reward for partner leads.
 *
 * These fields have always existed on the status-update contract and in the
 * webhook payload, but nothing in the UI ever collected them — so every DISBURSED
 * webhook shipped nulls for the amount, date, loan id and tenure.
 */
export function DisbursementDialog({ open, leadName, isAarthik, onCancel, onConfirm }: Props) {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayIso());
  const [loanId, setLoanId] = useState("");
  const [tenure, setTenure] = useState("12");
  const [plan, setPlan] = useState<"BULLET" | "MONTHLY" | "">("");
  const [rate, setRate] = useState("");
  // Which field the error is about, so that field is marked invalid and focused.
  const [error, setError] = useState<{ field: FieldKey; message: string } | null>(null);

  function fail(field: FieldKey, message: string) {
    setError({ field, message });
    document.getElementById(`disbursed-${field}`)?.focus();
  }

  // aria-invalid + aria-describedby for the field the error is about.
  const invalid = (field: FieldKey) =>
    error?.field === field ? ({ "aria-invalid": true, "aria-describedby": "disbursed-error" } as const) : {};

  function submit(event: React.FormEvent) {
    event.preventDefault();

    const parsedAmount = Number(amount.replace(/[,\s₹]/g, ""));
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      fail("amount", "Enter the amount actually disbursed.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      fail("date", "Enter the disbursement date.");
      return;
    }

    const parsedTenure = tenure.trim() === "" ? undefined : Number(tenure);
    if (parsedTenure !== undefined && (!Number.isInteger(parsedTenure) || parsedTenure <= 0)) {
      fail("tenure", "Tenure must be a whole number of months.");
      return;
    }

    if (!plan) {
      fail("plan", "Choose the plan the loan was given on.");
      return;
    }
    const parsedRate = rate.trim() === "" ? undefined : Number(rate);
    if (parsedRate !== undefined && (!Number.isFinite(parsedRate) || parsedRate <= 0 || parsedRate > 100)) {
      fail("rate", "Rate must be a percentage per year, e.g. 18.96.");
      return;
    }

    setError(null);
    onConfirm({
      amount: parsedAmount,
      date,
      loanId: loanId.trim() === "" ? undefined : loanId.trim(),
      tenure: parsedTenure,
      plan,
      roiPercentPa: parsedRate,
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record disbursement</DialogTitle>
          <DialogDescription>
            {isAarthik
              ? "These figures are sent to AarthikLabs with the status update"
              : "The partner's reward is worked out from this amount"}
            , and cannot be changed afterwards — {leadName} becomes final once disbursed.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="disbursed-amount">Amount disbursed</FieldLabel>
              <FieldContent>
                <Input
                  id="disbursed-amount"
                  inputMode="decimal"
                  placeholder="200000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  autoFocus
                  required
                  {...invalid("amount")}
                />
              </FieldContent>
            </Field>

            <Field>
              <FieldLabel htmlFor="disbursed-plan">Plan</FieldLabel>
              <FieldContent>
                <Select value={plan} onValueChange={(v) => setPlan(v as "BULLET" | "MONTHLY")}>
                  <SelectTrigger id="disbursed-plan" {...invalid("plan")}>
                    <SelectValue placeholder="Choose a plan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BULLET">Bullet</SelectItem>
                    <SelectItem value="MONTHLY">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </FieldContent>
            </Field>

            <Field>
              <FieldLabel htmlFor="disbursed-rate">Rate, % per year (optional)</FieldLabel>
              <FieldContent>
                <Input
                  id="disbursed-rate"
                  inputMode="decimal"
                  placeholder="From the rate table"
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  {...invalid("rate")}
                />
              </FieldContent>
            </Field>

            <Field>
              <FieldLabel htmlFor="disbursed-date">Disbursement date</FieldLabel>
              <FieldContent>
                <Input
                  id="disbursed-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  {...invalid("date")}
                />
              </FieldContent>
            </Field>

            <Field>
              <FieldLabel htmlFor="disbursed-tenure">Tenure (months)</FieldLabel>
              <FieldContent>
                <Input
                  id="disbursed-tenure"
                  inputMode="numeric"
                  value={tenure}
                  onChange={(e) => setTenure(e.target.value)}
                  {...invalid("tenure")}
                />
              </FieldContent>
            </Field>

            <Field>
              <FieldLabel htmlFor="disbursed-loan-id">Loan ID (optional)</FieldLabel>
              <FieldContent>
                <Input
                  id="disbursed-loan-id"
                  placeholder="YMLOAN0087412300"
                  value={loanId}
                  onChange={(e) => setLoanId(e.target.value)}
                />
              </FieldContent>
            </Field>
          </FieldGroup>

          {error && (
            <p id="disbursed-error" role="alert" className="mt-4 text-sm font-medium text-error">
              {error.message}
            </p>
          )}

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit">Mark disbursed</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
