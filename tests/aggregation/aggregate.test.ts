import { describe, expect, it } from 'vitest';
import { aggregateResponses } from '../../src/core/aggregation/aggregate.js';
import { bandForScore, sampleCaveat } from '../../src/core/aggregation/bands.js';
import { summarizeChampionSignal } from '../../src/core/classification/championSignal.js';
import { response, responses } from '../helpers.js';

describe('bands', () => {
  it('maps the V1.1 band boundaries', () => {
    const cases: [number, string][] = [
      [0, 'low'], [24, 'low'],
      [25, 'emerging'], [49, 'emerging'],
      [50, 'developing'], [69, 'developing'],
      [70, 'established'], [84, 'established'],
      [85, 'strong'], [100, 'strong'],
    ];
    for (const [score, band] of cases) {
      expect(bandForScore(score), `score ${score}`).toBe(band);
    }
  });

  // Bands come from the raw score. Rounding first would shift every boundary
  // down by half a point and disagree with the thresholds the recommendation
  // engine compares against.
  it('assigns bands from the raw score at every boundary', () => {
    const cases: [number, string][] = [
      [0, 'low'],
      [24.49, 'low'], [24.5, 'low'], [24.87, 'low'], [24.99, 'low'],
      [25, 'emerging'], [25.01, 'emerging'],
      [49.99, 'emerging'], [50, 'developing'], [50.01, 'developing'],
      [69.99, 'developing'], [70, 'established'], [70.01, 'established'],
      [84.99, 'established'], [85, 'strong'], [85.01, 'strong'],
      [99.99, 'strong'], [100, 'strong'],
    ];
    for (const [score, band] of cases) {
      expect(bandForScore(score), `score ${score}`).toBe(band);
    }
  });

  it('never lets a rounded display value pull a score into the next band', () => {
    // 24.87 displays as "24.9" and is Low; only 25 and above is Emerging.
    expect(bandForScore(24.87)).toBe('low');
    expect(bandForScore(49.96)).toBe('emerging');
    expect(bandForScore(69.5)).toBe('developing');
    expect(bandForScore(84.5)).toBe('established');
  });

  it('rejects scores outside the 0-100 range', () => {
    expect(() => bandForScore(-0.01)).toThrow(/0-100/);
    expect(() => bandForScore(100.01)).toThrow(/0-100/);
    expect(() => bandForScore(Number.NaN)).toThrow(/0-100/);
  });

  it('produces a sample caveat only where the spec calls for one', () => {
    expect(sampleCaveat(4)).toMatch(/minimum reporting threshold/);
    expect(sampleCaveat(7)).toMatch(/Early directional/);
    expect(sampleCaveat(20)).toMatch(/small score differences/);
    expect(sampleCaveat(30)).toBeNull();
  });
});

describe('aggregation order', () => {
  it('averages respondent scores rather than pooling raw answer points', () => {
    // Respondent A: Adoption assessable from Q5 alone (Q7 missing) -> 100.
    // Respondent B: full answers -> 0.
    // Respondent-first mean is 50. Pooling raw points first would let A's
    // single answered question count less than B's two, producing something else.
    const a = response({ q5: 'multiple_times_day' });
    const withoutQ7 = { ...a, answers: { ...a.answers, q7: undefined } };
    const b = response({ q5: 'never', q7: ['no_work_ai_use'] });

    const aggregate = aggregateResponses([withoutQ7, b]);
    expect(aggregate.dimensions.adoption.mean).toBe(50);
    expect(aggregate.dimensions.adoption.scoredCount).toBe(2);
  });

  it('counts not-assessed respondents separately from scored ones', () => {
    const assessable = responses(3);
    const unassessable = responses(2, { q8: 'not_done_this', q9: 'not_done_this', q10: 'not_done_this', q11: 'not_done_this' });
    const aggregate = aggregateResponses([...assessable, ...unassessable]);

    expect(aggregate.dimensions.confidence.scoredCount).toBe(3);
    expect(aggregate.dimensions.confidence.notAssessedCount).toBe(2);
    expect(aggregate.responseCount).toBe(5);
  });

  it('reports a median alongside the mean', () => {
    const aggregate = aggregateResponses([
      response({ q5: 'never', q7: ['no_work_ai_use'] }),
      response({ q5: 'few_times_month', q7: ['email_communication'] }),
      response({ q5: 'multiple_times_day', q7: ['email_communication', 'presentations', 'creating_content', 'writing_documents', 'meetings_followup', 'research_information'] }),
    ]);
    expect(aggregate.dimensions.adoption.median).toBe(35.5); // 40*0.7 + 25*0.3
  });

  it('distributes scored respondents across the bands', () => {
    const aggregate = aggregateResponses(responses(4));
    const distribution = aggregate.dimensions.adoption.distribution;
    const total = Object.values(distribution).reduce((a, b) => a + b, 0);
    expect(total).toBe(aggregate.dimensions.adoption.scoredCount);
  });
});

describe('Unsure / unclear rates', () => {
  it('reports the Q18 Unsure rate for Safety', () => {
    const aggregate = aggregateResponses([
      ...responses(3, { q18: 'unsure' }),
      ...responses(1, { q18: 'very_confident' }),
    ]);
    expect(aggregate.dimensions.safety.unsureRate).toBe(0.75);
    expect(aggregate.dimensions.safety.unsureRateBasis).toMatch(/Q18/);
  });

  it('reports the Enablement unclear rate across Q19-Q22', () => {
    const aggregate = aggregateResponses([
      ...responses(1, { q19: 'unsure' }),
      ...responses(1, { q19: 'not_defined' }),
      ...responses(1, { q20: 'unsure' }),
      ...responses(1, { q19: 'yes_clearly', q20: 'agree', q21: 'agree', q22: 'agree' }),
    ]);
    expect(aggregate.dimensions.enablement.unsureRate).toBe(0.75);
  });

  it('reports the Q14 Unsure rate for Workflow', () => {
    const aggregate = aggregateResponses([...responses(1, { q14: 'unsure' }), ...responses(3)]);
    expect(aggregate.dimensions.workflow.unsureRate).toBe(0.25);
  });

  it('reports the "I have not done this" rate for Confidence', () => {
    const aggregate = aggregateResponses([...responses(1, { q11: 'not_done_this' }), ...responses(1)]);
    expect(aggregate.dimensions.confidence.unsureRate).toBe(0.5);
  });

  it('has no Unsure rate for Adoption, which has no such option', () => {
    const aggregate = aggregateResponses(responses(3));
    expect(aggregate.dimensions.adoption.unsureRate).toBeNull();
    expect(aggregate.dimensions.adoption.unsureRateBasis).toBeNull();
  });
});

describe('Interest', () => {
  it('is aggregated separately from the five dimensions', () => {
    const aggregate = aggregateResponses([
      ...responses(2, { q28: 'extremely_interested' }),
      ...responses(1, { q28: 'unsure' }),
    ]);
    expect(aggregate.interest.mean).toBe(100);
    expect(aggregate.interest.assessedCount).toBe(2);
    expect(aggregate.interest.notAssessedCount).toBe(1);
    expect(Object.keys(aggregate.dimensions)).not.toContain('interest');
  });
});

describe('per-question organization scores', () => {
  it('excludes Not Assessed answers from a question mean', () => {
    const aggregate = aggregateResponses([
      ...responses(2, { q16: 'always' }),
      ...responses(2, { q16: 'not_applicable' }),
    ]);
    expect(aggregate.questionScores.q16.mean).toBe(100);
    expect(aggregate.questionScores.q16.scoredCount).toBe(2);
    expect(aggregate.questionScores.q16.notAssessedCount).toBe(2);
  });

  it('includes Unsure-as-zero answers in a question mean', () => {
    const aggregate = aggregateResponses([
      ...responses(1, { q20: 'strongly_agree' }),
      ...responses(1, { q20: 'unsure' }),
    ]);
    expect(aggregate.questionScores.q20.mean).toBe(50);
    expect(aggregate.questionScores.q20.scoredCount).toBe(2);
  });
});

describe('diagnostics', () => {
  it('reports the general-versus-work AI usage split', () => {
    const aggregate = aggregateResponses([
      ...responses(2, { q4: 'multiple_times_day', q5: 'never' }),
      ...responses(2, { q4: 'never', q5: 'never' }),
    ]);
    expect(aggregate.diagnostics.generalAiFrequency.counts.multiple_times_day).toBe(2);
    expect(aggregate.diagnostics.workAiFrequency.counts.never).toBe(4);
  });

  it('counts multi-select diagnostics at the respondent level', () => {
    const aggregate = aggregateResponses([
      ...responses(3, { q23: ['not_enough_time', 'accuracy_concern'] }),
      ...responses(1, { q23: ['nothing_preventing'] }),
    ]);
    const barriers = aggregate.diagnostics.barriers;
    expect(barriers.answeredCount).toBe(4);
    expect(barriers.counts.not_enough_time).toBe(3);
    expect(barriers.rates.not_enough_time).toBe(0.75);
  });

  it('excludes only "prefer not to say" from the Q19b rate denominator', () => {
    const aggregate = aggregateResponses([
      ...responses(3, { q19b: 'often' }),
      ...responses(2, { q19b: 'never' }),
      ...responses(1, { q19b: 'no_org_provided_access' }),
      ...responses(4, { q19b: 'prefer_not_to_say' }),
    ]);
    const unmanaged = aggregate.diagnostics.unmanagedTools;
    expect(unmanaged.validCount).toBe(6);
    expect(unmanaged.preferNotToSayCount).toBe(4);
    expect(unmanaged.sometimesOrOftenCount).toBe(3);
    expect(unmanaged.sometimesOrOftenRate).toBe(0.5);
    expect(unmanaged.noOrgProvidedAccessCount).toBe(1);
  });

  it('reports Q15 artifact frequencies without scoring them', () => {
    const aggregate = aggregateResponses(responses(2, { q15: ['ai_agent', 'automated_workflow'] }));
    expect(aggregate.diagnostics.workflowArtifacts.counts.ai_agent).toBe(2);
  });
});

describe('classification distribution', () => {
  it('counts respondents by level and rates them against the classified total', () => {
    const aggregate = aggregateResponses([
      ...responses(2, { q5: 'never', q12: 'no_work_ai_use', q15: ['none_of_these'] }),
      ...responses(2, { q5: 'few_times_week', q12: 'regular_individual_tasks', q15: ['none_of_these'] }),
    ]);
    expect(aggregate.classification.counts[0]).toBe(2);
    expect(aggregate.classification.counts[2]).toBe(2);
    expect(aggregate.classification.rates[0]).toBe(0.5);
    expect(aggregate.classification.classifiedCount).toBe(4);
    expect(aggregate.classification.unclassifiedCount).toBe(0);
  });
});

describe('champion signal', () => {
  it('produces no signal below three qualifying respondents', () => {
    expect(summarizeChampionSignal(2)).toEqual({
      qualifyingCount: 2, signalPresent: false, displayCount: null,
    });
  });

  it('hides the exact count between three and four qualifying respondents', () => {
    expect(summarizeChampionSignal(3).displayCount).toBe('3+ potential champions');
    expect(summarizeChampionSignal(4).displayCount).toBe('3+ potential champions');
  });

  it('shows an exact count from five upward', () => {
    expect(summarizeChampionSignal(5).displayCount).toBe('5 potential champions');
  });

  it('identifies champions from scores plus Q12/Q15 corroboration', () => {
    const qualifying = responses(3, {
      q5: 'multiple_times_day',
      q8: 'very_confident', q9: 'very_confident', q10: 'very_confident', q11: 'very_confident',
      q12: 'built_workflows_tools', q13: 'almost_always', q14: 'recurring_workflows',
      q15: ['ai_agent'],
      q16: 'always', q17: 'always', q18: 'very_confident',
    });
    const aggregate = aggregateResponses(qualifying);
    expect(aggregate.championSignal.qualifyingCount).toBe(3);
    expect(aggregate.championSignal.signalPresent).toBe(true);
  });

  it('does not count high scores without Q12/Q15 corroboration', () => {
    const uncorroborated = responses(3, {
      q8: 'very_confident', q9: 'very_confident', q10: 'very_confident', q11: 'very_confident',
      q12: 'reuse_prompts_approaches', q13: 'almost_always', q14: 'recurring_workflows',
      q15: ['none_of_these'],
      q16: 'always', q17: 'always', q18: 'very_confident',
    });
    const aggregate = aggregateResponses(uncorroborated);
    expect(aggregate.championSignal.qualifyingCount).toBe(0);
  });

  it('never exposes which respondents qualified', () => {
    const aggregate = aggregateResponses(responses(5));
    expect(Object.keys(aggregate.championSignal).sort()).toEqual([
      'displayCount', 'qualifyingCount', 'signalPresent',
    ]);
  });
});
