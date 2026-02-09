-- Migration: No longer needed
-- 
-- We're using a different approach:
-- - New templates created in the Next.js app will have a tag in variables: created_in_new_app = true
-- - The API routes filter to only show templates with this tag
-- - Old templates won't have this tag, so they won't appear in the new app
--
-- No migration needed - old templates will simply not show up because they don't have the tag.
dawadasdawdadawda