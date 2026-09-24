"use client";

import { useState } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Field,
  FieldContent,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export default function PartnerPage() {
  const [customer, setCustomer] = useState("Lakshmi Narayanan");
  const [mobile, setMobile] = useState("9741023458");
  const [address, setAddress] = useState(
    "4th Cross, Jayanagar 4th Block, Bengaluru"
  );
  const [pincode, setPincode] = useState("560011");
  const [loanAmount, setLoanAmount] = useState("85,000");
  const [showDuplicateBanner, setShowDuplicateBanner] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setShowDuplicateBanner((prev) => !prev);
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6 md:pt-9">
          <p className="text-xs font-medium uppercase tracking-wide text-on-surface-variant">
            Partner
          </p>
          <h1 className="mt-1 text-heading-lg text-on-surface">
            Submit a lead
          </h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            Consumer details go straight to YellowMetal&apos;s loan managers.
          </p>

          <form className="mt-6" onSubmit={handleSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="customer-name">Customer name</FieldLabel>
                <FieldContent>
                  <Input
                    id="customer-name"
                    value={customer}
                    onChange={(e) => setCustomer(e.target.value)}
                  />
                </FieldContent>
              </Field>

              <Field>
                <FieldLabel htmlFor="mobile-number">Mobile number</FieldLabel>
                <FieldContent>
                  <Input
                    id="mobile-number"
                    type="tel"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                  />
                </FieldContent>
              </Field>

              <Field>
                <FieldLabel htmlFor="address">Address</FieldLabel>
                <FieldContent>
                  <Textarea
                    id="address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </FieldContent>
              </Field>

              <Field>
                <FieldLabel htmlFor="pincode">Pincode</FieldLabel>
                <FieldContent>
                  <Input
                    id="pincode"
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value)}
                  />
                </FieldContent>
              </Field>

              <Field>
                <FieldLabel htmlFor="loan-amount">
                  Required loan amount
                </FieldLabel>
                <FieldContent>
                  <div className="flex items-center gap-2 rounded border border-input px-3 focus-within:ring-1 focus-within:ring-ring">
                    <span className="text-on-surface-variant">₹</span>
                    <input
                      id="loan-amount"
                      value={loanAmount}
                      onChange={(e) => setLoanAmount(e.target.value)}
                      className="h-9 w-full bg-transparent py-1 text-base outline-none md:text-sm"
                    />
                  </div>
                </FieldContent>
              </Field>

              <Button type="submit" className="w-full">
                Submit lead
              </Button>
            </FieldGroup>
          </form>

          {showDuplicateBanner && (
            <div
              role="status"
              aria-live="polite"
              className="mt-4 rounded bg-secondary px-4 py-3 text-sm text-on-secondary"
            >
              Flagged as possible duplicate — this mobile number is already
              on file from another submission. Saved anyway; a loan manager
              will review it.
            </div>
          )}

          <p className="mt-4 text-xs text-on-surface-variant">
            Example data shown — this form does not submit anywhere.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
