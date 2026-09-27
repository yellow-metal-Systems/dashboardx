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

export type DisbursementInput = {
  loanId?: string;
  amount?: number;
  date?: string;
  tenure?: number;
};

type Props = {
  open: boolean;
  leadName: string;
  onCancel: () => void;
  onConfirm: (details: DisbursementInput) => void;
};

function todayIso(): string {
  // Local date, because the branch manager is recording what happened today in
  // their own timezone, not a UTC instant.
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/**
 * Captures the disbursement figures that go to AarthikLabs.
 *
 * These fields have always existed on the status-update contract and in the
 * webhook payload, but nothing in the UI ever collected them — so every DISBURSED
 * webhook shipped nulls for the amount, date, loan id and tenure.
 */
export function DisbursementDialog({ open, leadName, onCancel, onConfirm }: Props) {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayIso());
  const [loanId, setLoanId] = useState("");
  const [tenure, setTenure] = useState("12");
  const [error, setError] = useState<string | null>(null);

  function submit(event: React.FormEvent) {
    event.preventDefault();

    const parsedAmount = Number(amount.replace(/[,\s₹]/g, ""));
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("Enter the amount actually disbursed.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError("Enter the disbursement date.");
      return;
    }

    const parsedTenure = tenure.trim() === "" ? undefined : Number(tenure);
    if (parsedTenure !== undefined && (!Number.isInteger(parsedTenure) || parsedTenure <= 0)) {
      setError("Tenure must be a whole number of months.");
      return;
    }

    setError(null);
    onConfirm({
      amount: parsedAmount,
      date,
      loanId: loanId.trim() === "" ? undefined : loanId.trim(),
      tenure: parsedTenure,
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record disbursement</DialogTitle>
          <DialogDescription>
            These figures are sent to AarthikLabs with the status update, and cannot
            be changed afterwards — {leadName} becomes final once disbursed.
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
            <p role="alert" className="mt-4 text-sm font-medium text-error">
              {error}
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
