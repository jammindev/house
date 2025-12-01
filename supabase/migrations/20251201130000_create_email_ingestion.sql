-- supabase/migrations/20251201130000_create_email_ingestion.sql
-- Add email ingestion functionality with MailerSend

-- 1) Add inbound email alias to households
ALTER TABLE households 
ADD COLUMN IF NOT EXISTS inbound_email_alias text UNIQUE;

-- Add index for fast lookup by email alias
CREATE INDEX IF NOT EXISTS idx_households_inbound_email_alias 
ON households(inbound_email_alias) 
WHERE inbound_email_alias IS NOT NULL;

-- 2) Create enum for email processing status
CREATE TYPE email_processing_status AS ENUM (
    'pending',     -- Just received, not processed yet
    'processing',  -- Currently being processed
    'completed',   -- Processed successfully into an interaction
    'failed',      -- Processing failed
    'ignored'      -- User chose to ignore this email
);

-- 3) Create table for incoming emails
CREATE TABLE incoming_emails (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    
    -- Email metadata from MailerSend
    message_id text NOT NULL UNIQUE,  -- Unique message ID from MailerSend
    from_email text NOT NULL,
    from_name text DEFAULT '',
    to_email text NOT NULL,           -- The household's inbound email
    subject text NOT NULL DEFAULT '',
    
    -- Email content
    body_text text DEFAULT '',
    body_html text DEFAULT '',
    
    -- Processing info
    processing_status email_processing_status NOT NULL DEFAULT 'pending',
    processing_error text,
    interaction_id uuid REFERENCES interactions(id) ON DELETE SET NULL,  -- Set when converted
    
    -- Metadata and timestamps
    metadata jsonb DEFAULT '{}',
    received_at timestamptz NOT NULL DEFAULT now(),
    processed_at timestamptz,
    
    -- Audit fields
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    created_by uuid REFERENCES auth.users(id),
    updated_by uuid REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE incoming_emails ENABLE ROW LEVEL SECURITY;

-- 4) Create table for email attachments
CREATE TABLE incoming_email_attachments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    incoming_email_id uuid NOT NULL REFERENCES incoming_emails(id) ON DELETE CASCADE,
    
    -- Attachment info from MailerSend
    filename text NOT NULL,
    content_type text,
    size_bytes bigint,
    content_base64 text,  -- Store the base64 content from MailerSend
    
    -- Document link (when converted)
    document_id uuid REFERENCES documents(id) ON DELETE SET NULL,
    
    -- Metadata
    metadata jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE incoming_email_attachments ENABLE ROW LEVEL SECURITY;

-- 5) Triggers for metadata updates
CREATE OR REPLACE FUNCTION update_incoming_email_metadata()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    NEW.updated_by = auth.uid();
    
    -- Set processed_at when status changes to completed, failed, or ignored
    IF OLD.processing_status != NEW.processing_status 
       AND NEW.processing_status IN ('completed', 'failed', 'ignored') THEN
        NEW.processed_at = now();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_update_incoming_email_metadata
    BEFORE UPDATE ON incoming_emails
    FOR EACH ROW
    EXECUTE FUNCTION update_incoming_email_metadata();

-- 6) RLS Policies for incoming_emails
CREATE POLICY "Members can read incoming emails of their household"
    ON incoming_emails FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM household_members hm
            WHERE hm.household_id = incoming_emails.household_id
            AND hm.user_id = auth.uid()
        )
    );

CREATE POLICY "Service role can insert incoming emails"
    ON incoming_emails FOR INSERT
    WITH CHECK (true);  -- Only service role should insert via webhook

CREATE POLICY "Members can update incoming emails of their household"
    ON incoming_emails FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM household_members hm
            WHERE hm.household_id = incoming_emails.household_id
            AND hm.user_id = auth.uid()
        )
    );

CREATE POLICY "Members can delete incoming emails of their household"
    ON incoming_emails FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM household_members hm
            WHERE hm.household_id = incoming_emails.household_id
            AND hm.user_id = auth.uid()
        )
    );

-- 7) RLS Policies for incoming_email_attachments
CREATE POLICY "Members can read attachments via household membership"
    ON incoming_email_attachments FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM incoming_emails ie
            JOIN household_members hm ON hm.household_id = ie.household_id
            WHERE ie.id = incoming_email_attachments.incoming_email_id
            AND hm.user_id = auth.uid()
        )
    );

CREATE POLICY "Service role can insert email attachments"
    ON incoming_email_attachments FOR INSERT
    WITH CHECK (true);  -- Only service role should insert via webhook

CREATE POLICY "Members can update attachments via household membership"
    ON incoming_email_attachments FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM incoming_emails ie
            JOIN household_members hm ON hm.household_id = ie.household_id
            WHERE ie.id = incoming_email_attachments.incoming_email_id
            AND hm.user_id = auth.uid()
        )
    );

CREATE POLICY "Members can delete attachments via household membership"
    ON incoming_email_attachments FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM incoming_emails ie
            JOIN household_members hm ON hm.household_id = ie.household_id
            WHERE ie.id = incoming_email_attachments.incoming_email_id
            AND hm.user_id = auth.uid()
        )
    );

-- 8) Function to generate a unique email alias for a household
CREATE OR REPLACE FUNCTION generate_household_email_alias(household_uuid uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    base_alias text;
    final_alias text;
    counter int := 1;
BEGIN
    -- Get first 8 characters of household id as base
    base_alias := substring(household_uuid::text from 1 for 8);
    final_alias := base_alias;
    
    -- Check for uniqueness and increment if needed
    WHILE EXISTS (SELECT 1 FROM households WHERE inbound_email_alias = final_alias) LOOP
        final_alias := base_alias || counter;
        counter := counter + 1;
    END LOOP;
    
    RETURN final_alias;
END;
$$;

-- 9) Function to ensure households have email aliases
CREATE OR REPLACE FUNCTION ensure_household_email_alias()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    household_record record;
BEGIN
    -- Update households without aliases
    FOR household_record IN 
        SELECT id FROM households WHERE inbound_email_alias IS NULL
    LOOP
        UPDATE households 
        SET inbound_email_alias = generate_household_email_alias(household_record.id)
        WHERE id = household_record.id;
    END LOOP;
END;
$$;

-- 10) Trigger to auto-generate alias for new households
CREATE OR REPLACE FUNCTION auto_generate_household_email_alias()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.inbound_email_alias IS NULL THEN
        NEW.inbound_email_alias := generate_household_email_alias(NEW.id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_auto_generate_household_email_alias
    BEFORE INSERT ON households
    FOR EACH ROW
    EXECUTE FUNCTION auto_generate_household_email_alias();

-- 11) Generate aliases for existing households
SELECT ensure_household_email_alias();

-- 12) Add index for faster document metadata queries (for email-sourced documents)
CREATE INDEX IF NOT EXISTS idx_documents_metadata_upload_source 
ON documents USING gin((metadata->>'uploadSource')) 
WHERE metadata->>'uploadSource' IS NOT NULL;

-- Grant necessary permissions
GRANT USAGE ON TYPE email_processing_status TO authenticated;
GRANT EXECUTE ON FUNCTION generate_household_email_alias(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION ensure_household_email_alias() TO authenticated;