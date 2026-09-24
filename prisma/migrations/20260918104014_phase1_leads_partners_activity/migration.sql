-- CreateEnum
CREATE TYPE "PartnerStatus" AS ENUM ('invited', 'active', 'disabled');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('New', 'Contacted', 'Converted', 'Rejected');

-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('PARTNER', 'AARTHIKLABS');

-- CreateEnum
CREATE TYPE "AcceptanceState" AS ENUM ('NA', 'ACCEPTED', 'EXPIRED_UNACCEPTED');

-- CreateEnum
CREATE TYPE "BranchManagerStatus" AS ENUM ('NOT_SENT', 'SENT', 'CONFIRMED', 'DECLINED');

-- CreateEnum
CREATE TYPE "ActivityKind" AS ENUM ('SUBMITTED', 'STATUS_CHANGED');

-- CreateTable
CREATE TABLE "partners" (
    "id" TEXT NOT NULL,
    "org_name" TEXT NOT NULL,
    "contact_email" TEXT NOT NULL,
    "status" "PartnerStatus" NOT NULL DEFAULT 'invited',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "lead_no" SERIAL NOT NULL,
    "partner_id" TEXT,
    "source" "LeadSource" NOT NULL DEFAULT 'PARTNER',
    "name" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "pin_code" TEXT NOT NULL,
    "loan_amount" DECIMAL(12,2),
    "dob" TIMESTAMP(3),
    "gold_grams" DECIMAL(10,3),
    "offer_amount" DECIMAL(12,2),
    "ltv_percent" DECIMAL(5,2),
    "kfs_reference" TEXT,
    "acceptance_state" "AcceptanceState" NOT NULL DEFAULT 'NA',
    "status" "LeadStatus" NOT NULL DEFAULT 'New',
    "duplicate_flag" BOOLEAN NOT NULL DEFAULT false,
    "branch_manager_status" "BranchManagerStatus" NOT NULL DEFAULT 'NOT_SENT',
    "loan_confirmed_amount" DECIMAL(12,2),
    "loan_confirmed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_activities" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "kind" "ActivityKind" NOT NULL,
    "from_status" "LeadStatus",
    "to_status" "LeadStatus",
    "message" TEXT NOT NULL,
    "actor" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "partners_contact_email_idx" ON "partners"("contact_email");

-- CreateIndex
CREATE UNIQUE INDEX "leads_lead_no_key" ON "leads"("lead_no");

-- CreateIndex
CREATE INDEX "leads_mobile_idx" ON "leads"("mobile");

-- CreateIndex
CREATE INDEX "leads_pin_code_idx" ON "leads"("pin_code");

-- CreateIndex
CREATE INDEX "leads_loan_amount_idx" ON "leads"("loan_amount");

-- CreateIndex
CREATE INDEX "leads_offer_amount_idx" ON "leads"("offer_amount");

-- CreateIndex
CREATE INDEX "leads_created_at_idx" ON "leads"("created_at");

-- CreateIndex
CREATE INDEX "leads_status_idx" ON "leads"("status");

-- CreateIndex
CREATE INDEX "leads_source_idx" ON "leads"("source");

-- CreateIndex
CREATE INDEX "leads_partner_id_idx" ON "leads"("partner_id");

-- CreateIndex
CREATE INDEX "lead_activities_lead_id_created_at_idx" ON "lead_activities"("lead_id", "created_at");

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
