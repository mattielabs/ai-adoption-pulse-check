/**
 * Mandatory privacy tests. Spec 33, 60.4.
 *
 * The three cases the spec names explicitly:
 *   segment n = 4                        -> suppressed
 *   segment n = 5 and complement >= 5    -> allowed
 *   segment n = 5 and complement = 4     -> suppressed
 */

import { describe, expect, it } from 'vitest';
import {
  applySegmentation,
  listReportableSegments,
} from '../../src/core/privacy/segmentation.js';
import { MIN_REPORTING_GROUP } from '../../src/core/privacy/thresholds.js';
import { runAnalysis } from '../../src/core/analysis/runAnalysis.js';
import { response } from '../helpers.js';
import type { SurveyResponse } from '../../src/core/survey/answers.js';

type Department = 'it_technology' | 'finance_accounting' | 'marketing_communications';

function group(count: number, department: Department): SurveyResponse[] {
  return Array.from({ length: count }, () => response({ q1: department }));
}

describe('minimum reporting group', () => {
  it('is five', () => {
    expect(MIN_REPORTING_GROUP).toBe(5);
  });
});

describe('segment and complement suppression', () => {
  it('suppresses a segment of four', () => {
    const responses = [...group(4, 'it_technology'), ...group(20, 'finance_accounting')];
    const result = applySegmentation(responses, [{ dimension: 'department', value: 'it_technology' }]);
    expect(result.suppressed).toBe(true);
    if (!result.suppressed) return;
    expect(result.reason).toBe('minimum_group_or_complement_size');
  });

  it('allows a segment of five with a complement of five', () => {
    const responses = [...group(5, 'it_technology'), ...group(5, 'finance_accounting')];
    const result = applySegmentation(responses, [{ dimension: 'department', value: 'it_technology' }]);
    expect(result.suppressed).toBe(false);
    if (result.suppressed) return;
    expect(result.segmentCount).toBe(5);
    expect(result.complementCount).toBe(5);
    expect(result.responses).toHaveLength(5);
  });

  it('suppresses a segment of five when the complement is four', () => {
    const responses = [...group(5, 'it_technology'), ...group(4, 'finance_accounting')];
    const result = applySegmentation(responses, [{ dimension: 'department', value: 'it_technology' }]);
    expect(result.suppressed).toBe(true);
    if (!result.suppressed) return;
    expect(result.reason).toBe('minimum_group_or_complement_size');
  });

  it('suppresses a large segment whose complement is tiny', () => {
    // The spec's worked example: 20 respondents, 18 managers, 2 non-managers.
    const responses = [
      ...Array.from({ length: 18 }, () => response({ q2: 'manager' })),
      ...Array.from({ length: 2 }, () => response({ q2: 'individual_contributor' })),
    ];
    const result = applySegmentation(responses, [{ dimension: 'role_level', value: 'manager' }]);
    expect(result.suppressed).toBe(true);
  });
});

describe('what a suppressed result may contain', () => {
  it('returns no counts and no aggregate', () => {
    const responses = [...group(4, 'it_technology'), ...group(20, 'finance_accounting')];
    const result = applySegmentation(responses, [{ dimension: 'department', value: 'it_technology' }]);
    expect(result).toEqual({ suppressed: true, reason: 'minimum_group_or_complement_size' });
    expect(result).not.toHaveProperty('segmentCount');
    expect(result).not.toHaveProperty('complementCount');
    expect(result).not.toHaveProperty('responses');
  });

  it('returns no aggregate through the full analysis pipeline either', () => {
    const responses = [...group(4, 'it_technology'), ...group(20, 'finance_accounting')];
    const analysis = runAnalysis(responses, {
      filters: [{ dimension: 'department', value: 'it_technology' }],
    });
    expect(analysis.suppressed).toBe(true);
    expect(analysis).not.toHaveProperty('aggregate');
    expect(analysis).not.toHaveProperty('recommendations');
    expect(analysis).not.toHaveProperty('opportunities');
    // Nothing about the hidden group may leak into the serialized response.
    expect(JSON.stringify(analysis)).toBe(
      JSON.stringify({ suppressed: true, reason: 'minimum_group_or_complement_size' }),
    );
  });
});

describe('one filter dimension at a time', () => {
  it('rejects two simultaneous segmentation dimensions', () => {
    const responses = [...group(20, 'it_technology'), ...group(20, 'finance_accounting')];
    const result = applySegmentation(responses, [
      { dimension: 'department', value: 'it_technology' },
      { dimension: 'role_level', value: 'individual_contributor' },
    ]);
    expect(result.suppressed).toBe(true);
    if (!result.suppressed) return;
    expect(result.reason).toBe('multiple_segmentation_dimensions');
  });

  it('rejects rather than silently applying only the first filter', () => {
    const responses = [...group(20, 'it_technology'), ...group(20, 'finance_accounting')];
    const stacked = runAnalysis(responses, {
      filters: [
        { dimension: 'department', value: 'it_technology' },
        { dimension: 'work_type', value: 'documents_information_data' },
      ],
    });
    expect(stacked.suppressed).toBe(true);
    if (!stacked.suppressed) return;
    expect(stacked.reason).toBe('multiple_segmentation_dimensions');
  });

  it('rejects an unknown segmentation dimension', () => {
    const responses = group(20, 'it_technology');
    const result = applySegmentation(responses, [
      { dimension: 'salary_band' as never, value: 'high' },
    ]);
    expect(result.suppressed).toBe(true);
    if (!result.suppressed) return;
    expect(result.reason).toBe('unknown_segmentation_dimension');
  });
});

describe('minimum total sample', () => {
  it('suppresses everything below five total responses', () => {
    const result = applySegmentation(group(4, 'it_technology'), []);
    expect(result.suppressed).toBe(true);
    if (!result.suppressed) return;
    expect(result.reason).toBe('insufficient_total_responses');
  });

  it('allows the unsegmented view at five responses', () => {
    const result = applySegmentation(group(5, 'it_technology'), []);
    expect(result.suppressed).toBe(false);
    if (result.suppressed) return;
    expect(result.dimension).toBeNull();
    expect(result.responses).toHaveLength(5);
  });
});

describe('segment availability listing', () => {
  it('reports reportability without revealing group sizes', () => {
    // 12 IT (complement 13), 3 finance (below the minimum group), 10 marketing.
    const responses = [
      ...group(12, 'it_technology'),
      ...group(3, 'finance_accounting'),
      ...group(10, 'marketing_communications'),
    ];
    const available = listReportableSegments(responses, 'department');

    const it = available.find((s) => s.value === 'it_technology');
    const finance = available.find((s) => s.value === 'finance_accounting');

    expect(it?.reportable).toBe(true);
    expect(finance?.reportable).toBe(false);

    // The listing must not carry counts, or it becomes the leak it prevents.
    for (const entry of available) {
      expect(Object.keys(entry).sort()).toEqual(['dimension', 'reportable', 'value']);
    }
  });

  it('marks a large segment with a small complement as not reportable', () => {
    const responses = [...group(18, 'it_technology'), ...group(2, 'finance_accounting')];
    const available = listReportableSegments(responses, 'department');
    expect(available.find((s) => s.value === 'it_technology')?.reportable).toBe(false);
  });
});
