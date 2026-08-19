-- Development / E2E seed data for the LOCAL D1 database only.
--
--   npm run db:seed:local
--
-- Entirely synthetic: no real people, no real employer. The fixed `dev-*`
-- public ids exist so Playwright can address each availability state
-- deterministically. Real Pulses get >=128-bit cryptographically random
-- public ids (Phase 2 creation flow); these fixed ids must never be used
-- outside local development.
--
-- Idempotent: every run deletes the dev organization's data and re-creates it.
-- It touches ONLY rows belonging to the dev organization / dev-* pulses, so
-- it cannot destroy anything else even if run against a database that has
-- other local data.

DELETE FROM responses WHERE pulse_id IN (SELECT id FROM pulses WHERE public_id LIKE 'dev-%');
DELETE FROM custom_questions WHERE pulse_id IN (SELECT id FROM pulses WHERE public_id LIKE 'dev-%');
DELETE FROM pulses WHERE public_id LIKE 'dev-%';
DELETE FROM organizations WHERE name = 'Northwind Dev Organization';

INSERT INTO organizations (name, logo_url, accent_color, survey_intro)
VALUES ('Northwind Dev Organization', NULL, '#0f766e', NULL);

-- 1. Active Pulse, personal results enabled, three custom questions (one of
--    each supported type). The primary E2E flow target.
INSERT INTO pulses (organization_id, public_id, name, description, status,
                    survey_version, scoring_version, recommendation_version,
                    opens_on, closes_on, personal_results_enabled)
SELECT id, 'dev-active-4f8a2c9e1b7d3a5f6e0c8b2d4a9f1e3c', 'Q3 AI Adoption Pulse',
       'Help us understand how AI fits into everyday work.', 'open',
       '1.1.0', '1.1.0', '1.1.0', NULL, NULL, 1
FROM organizations WHERE name = 'Northwind Dev Organization';

INSERT INTO custom_questions (pulse_id, type, question_text, options_json, position)
SELECT id, 'single_select', 'Which location do you mostly work from?',
       '[{"id":"hq","label":"Headquarters"},{"id":"regional","label":"Regional office"},{"id":"remote","label":"Mostly remote"}]', 1
FROM pulses WHERE public_id = 'dev-active-4f8a2c9e1b7d3a5f6e0c8b2d4a9f1e3c';

INSERT INTO custom_questions (pulse_id, type, question_text, options_json, position)
SELECT id, 'multi_select', 'Which internal systems do you use most weeks?',
       '[{"id":"crm","label":"CRM"},{"id":"erp","label":"ERP"},{"id":"wiki","label":"Internal wiki"},{"id":"helpdesk","label":"Helpdesk"}]', 2
FROM pulses WHERE public_id = 'dev-active-4f8a2c9e1b7d3a5f6e0c8b2d4a9f1e3c';

INSERT INTO custom_questions (pulse_id, type, question_text, options_json, position)
SELECT id, 'free_text', 'Is there anything about our tools you want to flag?', NULL, 3
FROM pulses WHERE public_id = 'dev-active-4f8a2c9e1b7d3a5f6e0c8b2d4a9f1e3c';

-- 2. Active Pulse, personal results enabled, no custom questions.
--    Used for draft-restore and duplicate-warning flows.
INSERT INTO pulses (organization_id, public_id, name, description, status,
                    survey_version, scoring_version, recommendation_version,
                    opens_on, closes_on, personal_results_enabled)
SELECT id, 'dev-plain-8c1d5e9f2a6b4c7d0e3f8a1b5c9d2e6f', 'Plain Dev Pulse',
       NULL, 'open', '1.1.0', '1.1.0', '1.1.0', NULL, NULL, 1
FROM organizations WHERE name = 'Northwind Dev Organization';

-- 3. Active Pulse with personal results DISABLED.
INSERT INTO pulses (organization_id, public_id, name, description, status,
                    survey_version, scoring_version, recommendation_version,
                    opens_on, closes_on, personal_results_enabled)
SELECT id, 'dev-noresult-3b7e1f5a9c2d6e0f4a8b1c5d9e2f6a0b', 'No-Result Dev Pulse',
       NULL, 'open', '1.1.0', '1.1.0', '1.1.0', NULL, NULL, 0
FROM organizations WHERE name = 'Northwind Dev Organization';

-- 4. Closed Pulse.
INSERT INTO pulses (organization_id, public_id, name, description, status,
                    survey_version, scoring_version, recommendation_version,
                    opens_on, closes_on, personal_results_enabled, closed_at)
SELECT id, 'dev-closed-6d2a8f4b0c5e9a1d7f3b6c0e4a8d2f5b', 'Closed Dev Pulse',
       NULL, 'closed', '1.1.0', '1.1.0', '1.1.0', NULL, NULL, 1, datetime('now')
FROM organizations WHERE name = 'Northwind Dev Organization';

-- 5. Future Pulse: open status, but opens far in the future.
INSERT INTO pulses (organization_id, public_id, name, description, status,
                    survey_version, scoring_version, recommendation_version,
                    opens_on, closes_on, personal_results_enabled)
SELECT id, 'dev-future-9a5c1e7d3f8b2a6c0d4e8f1a5b9c3d7e', 'Future Dev Pulse',
       NULL, 'open', '1.1.0', '1.1.0', '1.1.0', '2100-01-01', NULL, 1
FROM organizations WHERE name = 'Northwind Dev Organization';
