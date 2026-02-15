-- Create storage bucket for files (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'files') THEN
        INSERT INTO storage.buckets (id, name, public)
        VALUES ('files', 'files', false);
    END IF;
END $$;