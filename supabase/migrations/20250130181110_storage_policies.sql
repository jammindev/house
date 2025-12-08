-- Create storage policies (idempotent)
DO $$
BEGIN
    -- Delete policy
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname = 'Give users access to own folder 1m0cqf_0'
    ) THEN
        CREATE POLICY "Give users access to own folder 1m0cqf_0"
        ON "storage"."objects"
        AS permissive
        FOR delete
        TO public
        USING (((bucket_id = 'files'::text) AND authenticative.is_user_authenticated() AND (name ~ (('^'::text || (auth.uid())::text) || '/'::text))));
    END IF;

    -- Update policy
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname = 'Give users access to own folder 1m0cqf_1'
    ) THEN
        CREATE POLICY "Give users access to own folder 1m0cqf_1"
        ON "storage"."objects"
        AS permissive
        FOR update
        TO public
        USING (((bucket_id = 'files'::text) AND authenticative.is_user_authenticated() AND (name ~ (('^'::text || (auth.uid())::text) || '/'::text))));
    END IF;

    -- Insert policy
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname = 'Give users access to own folder 1m0cqf_2'
    ) THEN
        CREATE POLICY "Give users access to own folder 1m0cqf_2"
        ON "storage"."objects"
        AS permissive
        FOR insert
        TO public
        WITH CHECK (((bucket_id = 'files'::text) AND authenticative.is_user_authenticated() AND (name ~ (('^'::text || (auth.uid())::text) || '/'::text))));
    END IF;

    -- Select policy
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname = 'Give users access to own folder 1m0cqf_3'
    ) THEN
        CREATE POLICY "Give users access to own folder 1m0cqf_3"
        ON "storage"."objects"
        AS permissive
        FOR select
        TO public
        USING (((bucket_id = 'files'::text) AND authenticative.is_user_authenticated() AND (name ~ (('^'::text || (auth.uid())::text) || '/'::text))));
    END IF;
END $$;



