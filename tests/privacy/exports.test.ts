/**
 * Export shaping. Spec 35, 59, 60.4.
 *
 * The exports are the easiest way to accidentally undo every other privacy
 * control, so these assertions are written against the produced CSV text
 * rather than against intermediate objects.
 */

import { describe, expect, it } from 'vitest';
import {
  EXCLUDED_EXPORT_QUESTION_IDS,
  RESPONSE_EXPORT_QUESTION_IDS,
  buildAggregateExport,
  buildFreeTextExport,
  buildResponseExport,
  escapeCsvValue,
  toCsv,
} from '../../src/core/privacy/exports.js';
import { seededRandom } from '../../src/core/util/random.js';
import { response } from '../helpers.js';

const fixed = () => seededRandom(42);

describe('default response export', () => {
  const responses = [
    response({ q1: 'legal_compliance', q2: 'executive_owner', q3: 'people_customers', q27: 'Secret note about my manager' }),
    ...Array.from({ length: 9 }, () => response()),
  ];
  const exported = buildResponseExport(responses, { random: fixed() });

  it('excludes Q1, Q2, Q3 and Q27 from the columns', () => {
    for (const id of ['q1', 'q2', 'q3', 'q27']) {
      expect(exported.headers, `${id} must not be a column`).not.toContain(id);
    }
    expect([...EXCLUDED_EXPORT_QUESTION_IDS].sort()).toEqual(['q1', 'q2', 'q27', 'q3']);
  });

  it('excludes work-context and free-text VALUES from the CSV text', () => {
    expect(exported.csv).not.toContain('legal_compliance');
    expect(exported.csv).not.toContain('executive_owner');
    expect(exported.csv).not.toContain('people_customers');
    expect(exported.csv).not.toContain('Secret note about my manager');
  });

  it('includes the scored and diagnostic answers', () => {
    for (const id of ['q5', 'q7', 'q12', 'q16', 'q19', 'q19b', 'q26', 'q28']) {
      expect(exported.headers).toContain(id);
    }
    expect(RESPONSE_EXPORT_QUESTION_IDS).toHaveLength(25);
  });

  it('never includes a row id or any identifier column', () => {
    for (const forbidden of ['id', 'response_id', 'ip', 'device', 'user_agent', 'email', 'name']) {
      expect(exported.headers, forbidden).not.toContain(forbidden);
    }
    expect(exported.csv).not.toContain('test-0');
  });

  it('keeps dates at day granularity only', () => {
    expect(exported.headers).toContain('submitted_on');
    for (const row of exported.rows) {
      expect(row[0]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    // No time component anywhere in the file.
    expect(exported.csv).not.toMatch(/\d{2}:\d{2}:\d{2}/);
  });

  it('records the survey version so the rows stay interpretable', () => {
    expect(exported.headers).toContain('survey_version');
  });

  it('shuffles rows so export order carries no submission-order signal', () => {
    const ordered = Array.from({ length: 40 }, (_, i) =>
      response({ q27: undefined }, { id: `ordered-${i}`, submittedOn: `2026-06-${String((i % 28) + 1).padStart(2, '0')}` }),
    );
    const a = buildResponseExport(ordered, { random: seededRandom(1) });
    const b = buildResponseExport(ordered, { random: seededRandom(2) });
    const dateColumn = (e: typeof a) => e.rows.map((r) => r[0]).join(',');

    expect(dateColumn(a)).not.toBe(ordered.map((r) => r.submittedOn).join(','));
    expect(dateColumn(a)).not.toBe(dateColumn(b));
    expect(a.rows).toHaveLength(ordered.length);
  });

  it('is labelled as limited rather than fully anonymous', () => {
    expect(exported.disclosureLabel).toMatch(/not fully anonymous/i);
  });
});

describe('free-text export', () => {
  const responses = [
    response({ q1: 'legal_compliance', q2: 'executive_owner', q5: 'multiple_times_day', q27: 'Monthly report assembly is painful' }),
    response({ q27: '   ' }),
    response({ q27: undefined }),
    response({ q27: 'Scheduling across three time zones' }),
  ];
  const exported = buildFreeTextExport(responses, { random: fixed() });

  it('contains only the free-text column and a row token', () => {
    expect(exported.headers).toEqual(['row_token', 'response_text']);
  });

  it('carries no contextual columns or values whatsoever', () => {
    for (const leak of ['legal_compliance', 'executive_owner', 'multiple_times_day', '2026-06-01']) {
      expect(exported.csv, leak).not.toContain(leak);
    }
  });

  it('includes only responses with actual text', () => {
    expect(exported.rows).toHaveLength(2);
    const texts = exported.rows.map((r) => r[1]);
    expect(texts).toContain('Monthly report assembly is painful');
    expect(texts).toContain('Scheduling across three time zones');
  });

  it('uses row tokens that cannot be linked back to a response', () => {
    for (const row of exported.rows) {
      expect(row[0]).toMatch(/^t\d{4}$/);
      expect(row[0]).not.toContain('test-');
    }
  });

  it('carries the re-identification warning', () => {
    expect(exported.warning).toMatch(/may contain identifying information/i);
  });
});

describe('CSV formula injection protection', () => {
  it('guards every dangerous leading character', () => {
    for (const trigger of ['=', '+', '-', '@']) {
      const value = `${trigger}cmd|' /C calc'!A0`;
      const escaped = escapeCsvValue(value);
      expect(escaped.startsWith(`"'${trigger}`), trigger).toBe(true);
    }
  });

  it('guards leading tab and carriage return', () => {
    expect(escapeCsvValue('\t=1+1').startsWith('"\'\t')).toBe(true);
    expect(escapeCsvValue('\r=1+1').startsWith('"\'\r')).toBe(true);
  });

  it('does not alter safe values', () => {
    expect(escapeCsvValue('few_times_week')).toBe('"few_times_week"');
    expect(escapeCsvValue('')).toBe('""');
    expect(escapeCsvValue('a-b')).toBe('"a-b"');
  });

  it('escapes embedded quotes per RFC 4180', () => {
    expect(escapeCsvValue('say "hi"')).toBe('"say ""hi"""');
  });

  it('keeps values containing commas and newlines inside one field', () => {
    expect(escapeCsvValue('one, two\nthree')).toBe('"one, two\nthree"');
  });

  it('applies to free-text content in the produced file', () => {
    const exported = buildFreeTextExport(
      [response({ q27: '=HYPERLINK("http://evil.example","click")' })],
      { random: fixed() },
    );
    expect(exported.csv).toContain(`"'=HYPERLINK(""http://evil.example"",""click"")"`);
    expect(exported.csv).not.toMatch(/,"=HYPERLINK/);
  });

  it('quotes every field in every row', () => {
    const csv = toCsv([['a', 'b'], ['c', 'd']]);
    expect(csv).toBe('"a","b"\r\n"c","d"');
  });
});

describe('aggregate export envelope', () => {
  it('stamps all three engine versions', () => {
    const envelope = buildAggregateExport({ adoption: 62 });
    expect(envelope.generated).toEqual({
      surveyVersion: '1.1.0',
      scoringVersion: '1.1.0',
      recommendationEngineVersion: '1.1.0',
    });
    expect(envelope.segment).toBeNull();
  });

  it('records which segment the aggregate describes', () => {
    const envelope = buildAggregateExport({ adoption: 62 }, { dimension: 'department', value: 'it_technology' });
    expect(envelope.segment).toEqual({ dimension: 'department', value: 'it_technology' });
  });

  it('takes an already-checked aggregate rather than raw responses', () => {
    // There is deliberately no code path from raw responses to an aggregate
    // export that skips the segmentation check.
    expect(buildAggregateExport.length).toBeLessThanOrEqual(2);
  });
});
