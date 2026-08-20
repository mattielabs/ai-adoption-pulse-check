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
  RESPONSE_EXPORT_COLUMN_NAMES,
  RESPONSE_EXPORT_QUESTION_IDS,
  buildAggregateExport,
  buildFreeTextExport,
  buildFreeTextExportFromTexts,
  buildResponseExport,
  escapeCsvValue,
  safeFilenameSlug,
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
    for (const id of ['q1', 'q2', 'q3', 'q27'] as const) {
      expect(exported.headers, `${id} must not be a column`).not.toContain(
        RESPONSE_EXPORT_COLUMN_NAMES[id],
      );
    }
    expect(exported.headers.some((h) => h.startsWith('q1_'))).toBe(false);
    expect(exported.headers.some((h) => h.startsWith('q27_'))).toBe(false);
    expect([...EXCLUDED_EXPORT_QUESTION_IDS].sort()).toEqual(['q1', 'q2', 'q27', 'q3']);
  });

  it('excludes work-context and free-text VALUES from the CSV text', () => {
    expect(exported.csv).not.toContain('legal_compliance');
    expect(exported.csv).not.toContain('executive_owner');
    expect(exported.csv).not.toContain('people_customers');
    expect(exported.csv).not.toContain('Secret note about my manager');
  });

  it('includes the scored and diagnostic answers, under readable column names', () => {
    for (const id of ['q5', 'q7', 'q12', 'q16', 'q19', 'q19b', 'q26', 'q28'] as const) {
      expect(exported.headers).toContain(RESPONSE_EXPORT_COLUMN_NAMES[id]);
    }
    expect(exported.headers).toContain('q19_approved_tool_clarity');
    expect(exported.headers).toContain('q19b_unmanaged_tool_use');
    expect(RESPONSE_EXPORT_QUESTION_IDS).toHaveLength(25);
    // Every answer column carries its question id as a prefix, so a spreadsheet
    // can always be traced back to the survey.
    for (const header of exported.headers.slice(1)) {
      expect(header, header).toMatch(/^q[0-9]+b?_[a-z_]+$/);
    }
  });

  it('never includes a row id or any identifier column', () => {
    for (const forbidden of ['id', 'response_id', 'ip', 'device', 'user_agent', 'email', 'name']) {
      expect(exported.headers, forbidden).not.toContain(forbidden);
    }
    expect(exported.csv).not.toContain('test-0');
  });

  it('carries no date column at all', () => {
    expect(exported.headers).not.toContain('submitted_on');
    expect(exported.headers.some((h) => /date|submitted|time/.test(h))).toBe(false);
    // Neither a day-level date nor a time component appears anywhere. V1 is not
    // a timeline tool, so a date would only add a correlation handle.
    expect(exported.csv).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(exported.csv).not.toMatch(/\d{2}:\d{2}:\d{2}/);
  });

  it('records the survey version so the rows stay interpretable', () => {
    expect(exported.headers).toContain('survey_version');
  });

  it('shuffles rows so export order carries no submission-order signal', () => {
    // Rows are distinguished by their Q5 answer: with no date column, that is
    // what makes ordering observable at all.
    const frequencies = [
      'never', 'less_than_monthly', 'few_times_month',
      'few_times_week', 'most_workdays', 'multiple_times_day',
    ] as const;
    const ordered = Array.from({ length: 40 }, (_, i) =>
      response({ q27: undefined, q5: frequencies[i % frequencies.length] }, { id: `ordered-${i}` }),
    );
    const a = buildResponseExport(ordered, { random: seededRandom(1) });
    const b = buildResponseExport(ordered, { random: seededRandom(2) });
    const q5Index = a.headers.indexOf('q5_work_ai_frequency');
    const column = (e: typeof a) => e.rows.map((r) => r[q5Index]).join(',');

    expect(column(a)).not.toBe(ordered.map((r) => r.answers.q5).join(','));
    expect(column(a)).not.toBe(column(b));
    expect(a.rows).toHaveLength(ordered.length);
  });

  it('adds organization-specific select answers as extra columns', () => {
    const withCustom = [
      { ...response(), customAnswers: { c1: 'hq', c2: ['a', 'b'] } },
      ...Array.from({ length: 4 }, () => response()),
    ];
    const custom = buildResponseExport(withCustom, {
      random: fixed(),
      customColumns: [
        { key: 'c1', header: 'c1_office' },
        { key: 'c2', header: 'c2_systems' },
      ],
    });

    expect(custom.headers.slice(-2)).toEqual(['c1_office', 'c2_systems']);
    expect(custom.csv).toContain('"hq"');
    // Multi-selects use the documented pipe separator, not a nested comma.
    expect(custom.csv).toContain('"a|b"');
    // A response without custom answers gets empty cells, not a ragged row.
    for (const row of custom.rows) {
      expect(row).toHaveLength(custom.headers.length);
    }
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

describe('free-text export from raw text', () => {
  it('produces the same shape as the response-based builder', () => {
    const fromTexts = buildFreeTextExportFromTexts(
      ['  Monthly report assembly is painful  ', '', '   ', 'Scheduling across three time zones'],
      { random: fixed() },
    );

    expect(fromTexts.headers).toEqual(['row_token', 'response_text']);
    expect(fromTexts.rows).toHaveLength(2);
    expect(fromTexts.rows.map((r) => r[1])).toContain('Monthly report assembly is painful');
  });

  it('randomises order, so file position says nothing about submission order', () => {
    const texts = Array.from({ length: 30 }, (_, i) => `entry ${i}`);
    const a = buildFreeTextExportFromTexts(texts, { random: seededRandom(7) });
    const b = buildFreeTextExportFromTexts(texts, { random: seededRandom(8) });
    const column = (e: typeof a) => e.rows.map((r) => r[1]).join(',');

    expect(column(a)).not.toBe(texts.join(','));
    expect(column(a)).not.toBe(column(b));
  });

  it('escapes a formula in the produced file', () => {
    const exported = buildFreeTextExportFromTexts(['=1+1'], { random: fixed() });
    expect(exported.csv).toContain('"\'=1+1"');
  });
});

describe('download filenames', () => {
  it('reduces an administrator-supplied name to a safe slug', () => {
    expect(safeFilenameSlug('Q3 Pulse', 'pulse')).toBe('q3-pulse');
    expect(safeFilenameSlug('Northwind Trading Co.', 'pulse')).toBe('northwind-trading-co');
  });

  it('strips everything that could break a Content-Disposition header', () => {
    const hostile = [
      'a"; filename="evil.exe',
      '../../etc/passwd',
      'name\r\nX-Injected: 1',
      'name;with;semicolons',
      'na\u00efve r\u00e9sum\u00e9 2026',
    ];
    for (const value of hostile) {
      expect(safeFilenameSlug(value, 'pulse'), value).toMatch(/^[a-z0-9][a-z0-9-]*$/);
    }
  });

  it('falls back when nothing survives the allowlist', () => {
    expect(safeFilenameSlug('....', 'pulse-7')).toBe('pulse-7');
    expect(safeFilenameSlug('', 'pulse-7')).toBe('pulse-7');
  });

  it('caps the length so a long name cannot produce an unusable filename', () => {
    expect(safeFilenameSlug('x'.repeat(200), 'pulse').length).toBeLessThanOrEqual(48);
  });
});
