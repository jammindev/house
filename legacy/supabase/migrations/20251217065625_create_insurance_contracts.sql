-- Create insurance_contracts table
CREATE TABLE IF NOT EXISTS "public"."insurance_contracts" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "household_id" uuid NOT NULL,
    "name" text NOT NULL,
    "provider" text DEFAULT ''::text NOT NULL,
    "contract_number" text DEFAULT ''::text,
    "type" text DEFAULT 'other'::text NOT NULL,
    "insured_item" text DEFAULT ''::text,
    "start_date" date,
    "end_date" date,
    "renewal_date" date,
    "status" text DEFAULT 'active'::text NOT NULL,
    "payment_frequency" text DEFAULT 'monthly'::text NOT NULL,
    "monthly_cost" numeric(12,2) DEFAULT 0 NOT NULL,
    "yearly_cost" numeric(12,2) DEFAULT 0 NOT NULL,
    "coverage_summary" text DEFAULT ''::text NOT NULL,
    "notes" text DEFAULT ''::text NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    "created_by" uuid,
    "updated_by" uuid,
    CONSTRAINT "insurance_contracts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "insurance_contracts_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE CASCADE,
    CONSTRAINT "insurance_contracts_type_check" CHECK ("type" = ANY (ARRAY['health'::text, 'home'::text, 'car'::text, 'life'::text, 'liability'::text, 'other'::text])),
    CONSTRAINT "insurance_contracts_status_check" CHECK ("status" = ANY (ARRAY['active'::text, 'suspended'::text, 'terminated'::text])),
    CONSTRAINT "insurance_contracts_payment_frequency_check" CHECK ("payment_frequency" = ANY (ARRAY['monthly'::text, 'quarterly'::text, 'yearly'::text])),
    CONSTRAINT "insurance_contracts_costs_non_negative" CHECK ("monthly_cost" >= 0::numeric AND "yearly_cost" >= 0::numeric),
    CONSTRAINT "insurance_contracts_dates_consistent" CHECK ("start_date" IS NULL OR "end_date" IS NULL OR "end_date" >= "start_date")
);

ALTER TABLE "public"."insurance_contracts" OWNER TO "postgres";

-- Create indexes
CREATE INDEX "insurance_contracts_household_id_idx" ON "public"."insurance_contracts" USING btree ("household_id");
CREATE INDEX "insurance_contracts_type_idx" ON "public"."insurance_contracts" USING btree ("type");
CREATE INDEX "insurance_contracts_status_idx" ON "public"."insurance_contracts" USING btree ("status");
CREATE INDEX "insurance_contracts_renewal_date_idx" ON "public"."insurance_contracts" USING btree ("renewal_date");

-- Enable Row Level Security
ALTER TABLE "public"."insurance_contracts" ENABLE ROW LEVEL SECURITY;

-- RLS Policies for insurance_contracts
CREATE POLICY "Members can select insurance contracts in their household" 
ON "public"."insurance_contracts" FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM "public"."household_members" "hm"
        WHERE "hm"."household_id" = "insurance_contracts"."household_id"
        AND "hm"."user_id" = auth.uid()
    )
);

CREATE POLICY "Members can insert insurance contracts in their household" 
ON "public"."insurance_contracts" FOR INSERT 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM "public"."household_members" "hm"
        WHERE "hm"."household_id" = "insurance_contracts"."household_id"
        AND "hm"."user_id" = auth.uid()
    )
);

CREATE POLICY "Members can update insurance contracts in their household" 
ON "public"."insurance_contracts" FOR UPDATE 
USING (
    EXISTS (
        SELECT 1 FROM "public"."household_members" "hm"
        WHERE "hm"."household_id" = "insurance_contracts"."household_id"
        AND "hm"."user_id" = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM "public"."household_members" "hm"
        WHERE "hm"."household_id" = "insurance_contracts"."household_id"
        AND "hm"."user_id" = auth.uid()
    )
);

CREATE POLICY "Members can delete insurance contracts in their household" 
ON "public"."insurance_contracts" FOR DELETE 
USING (
    EXISTS (
        SELECT 1 FROM "public"."household_members" "hm"
        WHERE "hm"."household_id" = "insurance_contracts"."household_id"
        AND "hm"."user_id" = auth.uid()
    )
);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_insurance_contracts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_insurance_contracts_updated_at_trigger
    BEFORE UPDATE ON "public"."insurance_contracts"
    FOR EACH ROW
    EXECUTE FUNCTION update_insurance_contracts_updated_at();
