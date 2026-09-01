-- V021: Add AI engine signal columns to translation_versions
-- 
-- P1-2 fix: The engine computes sense, resolved_by, and risk for every translation
-- but previously discarded them before persistence. These are the most valuable outputs
-- in the system — sense lets reviewers approve in one second, resolved_by is improvement
-- telemetry, and risk drives the triage queue.
--
-- P1-3 fix: Drop the hardcoded 0.90 confidence pattern. Instead of a fabricated number,
-- we store the model's own risk assessment as an enum.

ALTER TABLE translation.translation_versions
    ADD COLUMN IF NOT EXISTS sense TEXT NULL;

ALTER TABLE translation.translation_versions
    ADD COLUMN IF NOT EXISTS resolved_by VARCHAR(30) NULL;

ALTER TABLE translation.translation_versions
    ADD COLUMN IF NOT EXISTS risk VARCHAR(10) NULL;

ALTER TABLE translation.translation_versions
    ADD COLUMN IF NOT EXISTS model_used VARCHAR(100) NULL;

-- Add CHECK constraint for resolved_by valid values
ALTER TABLE translation.translation_versions
    ADD CONSTRAINT translation_versions_resolved_by_check
    CHECK (resolved_by IS NULL OR resolved_by IN ('siblings', 'tag_id', 'page', 'domain', 'unambiguous', 'guessed'));

-- Add CHECK constraint for risk valid values
ALTER TABLE translation.translation_versions
    ADD CONSTRAINT translation_versions_risk_check
    CHECK (risk IS NULL OR risk IN ('low', 'medium', 'high'));

COMMENT ON COLUMN translation.translation_versions.sense IS 'Model interpretation of the source string, e.g. "Gender option for a customer record"';
COMMENT ON COLUMN translation.translation_versions.resolved_by IS 'How the model resolved ambiguity: siblings, tag_id, page, domain, unambiguous, or guessed';
COMMENT ON COLUMN translation.translation_versions.risk IS 'Model self-assessed translation risk: low, medium, or high';
COMMENT ON COLUMN translation.translation_versions.model_used IS 'Which AI model produced this translation, e.g. gemini-2.5-flash';
