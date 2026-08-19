/**
 * Every answer-option mapping in the V1.1 spec, asserted literally.
 *
 * These look repetitive on purpose: a mapping table is exactly the kind of
 * thing that gets "tidied" into something subtly different, and the whole
 * product rests on it.
 */

import { describe, expect, it } from 'vitest';
import {
  AGREEMENT_VALUES,
  CONFIDENCE_VALUES,
  FREQUENCY_VALUES,
  Q12_VALUES,
  Q13_VALUES,
  Q14_VALUES,
  Q18_VALUES,
  Q19_VALUES,
  Q28_VALUES,
  Q5_VALUES,
  q7BreadthValue,
} from '../../src/core/scoring/mappings.js';
import { NOT_ASSESSED } from '../../src/core/scoring/types.js';

describe('answer mappings', () => {
  it('maps Q5 work AI frequency', () => {
    expect(Q5_VALUES).toEqual({
      never: 0,
      less_than_monthly: 20,
      few_times_month: 40,
      few_times_week: 60,
      most_workdays: 80,
      multiple_times_day: 100,
    });
  });

  describe('Q7 breadth', () => {
    it('scores 0 for no categories', () => {
      expect(q7BreadthValue([])).toBe(0);
    });

    it('scores 25 for one category', () => {
      expect(q7BreadthValue(['email_communication'])).toBe(25);
    });

    it('scores 50 for two and for three categories', () => {
      expect(q7BreadthValue(['email_communication', 'presentations'])).toBe(50);
      expect(q7BreadthValue(['email_communication', 'presentations', 'creating_content'])).toBe(50);
    });

    it('scores 75 for four and for five categories', () => {
      const five = ['email_communication', 'presentations', 'creating_content', 'writing_documents', 'meetings_followup'];
      expect(q7BreadthValue(five.slice(0, 4))).toBe(75);
      expect(q7BreadthValue(five)).toBe(75);
    });

    it('scores 100 for six or more categories', () => {
      const six = ['email_communication', 'presentations', 'creating_content', 'writing_documents', 'meetings_followup', 'research_information'];
      expect(q7BreadthValue(six)).toBe(100);
      expect(q7BreadthValue([...six, 'data_entry_cleanup'])).toBe(100);
    });

    it('scores 0 when "I do not currently use AI for work" is selected', () => {
      expect(q7BreadthValue(['no_work_ai_use'])).toBe(0);
    });

    it('scores 0 when the no-use sentinel contradicts other selections', () => {
      // Contradictory but valid input must resolve deterministically to the
      // conservative value rather than being rejected.
      expect(q7BreadthValue(['no_work_ai_use', 'email_communication', 'writing_documents'])).toBe(0);
    });

    it('counts distinct categories only', () => {
      expect(q7BreadthValue(['email_communication', 'email_communication'])).toBe(25);
    });
  });

  it('maps Q8-Q11 confidence, with "I have not done this" as Not Assessed', () => {
    expect(CONFIDENCE_VALUES).toEqual({
      not_confident: 0,
      slightly_confident: 25,
      somewhat_confident: 50,
      very_confident: 75,
      extremely_confident: 100,
      not_done_this: NOT_ASSESSED,
    });
  });

  it('maps Q12 as a pure ordinal ladder', () => {
    expect(Q12_VALUES).toEqual({
      no_work_ai_use: 0,
      occasional_experiments: 20,
      regular_individual_tasks: 40,
      reuse_prompts_approaches: 60,
      repeatable_processes: 80,
      built_workflows_tools: 100,
    });
  });

  it('maps Q13 with "I do not use AI" as a real zero', () => {
    expect(Q13_VALUES).toEqual({
      never: 0,
      rarely: 25,
      sometimes: 50,
      often: 75,
      almost_always: 100,
      no_ai_use: 0,
    });
  });

  it('maps Q14 with "Unsure" as Not Assessed', () => {
    expect(Q14_VALUES).toEqual({
      no: 0,
      see_opportunities: 20,
      one_small_process: 50,
      several_processes: 75,
      recurring_workflows: 100,
      unsure: NOT_ASSESSED,
    });
  });

  it('maps Q16/Q17 with "Not applicable" as Not Assessed', () => {
    expect(FREQUENCY_VALUES).toEqual({
      never: 0,
      rarely: 25,
      sometimes: 50,
      usually: 75,
      always: 100,
      not_applicable: NOT_ASSESSED,
    });
  });

  it('maps Q18 with "Unsure" as a scored zero, not Not Assessed', () => {
    expect(Q18_VALUES.unsure).toBe(0);
    expect(Q18_VALUES).toEqual({
      not_confident: 0,
      slightly_confident: 25,
      somewhat_confident: 50,
      very_confident: 75,
      extremely_confident: 100,
      unsure: 0,
    });
  });

  it('maps Q19 with both "No" and "not defined" and "Unsure" as zero', () => {
    expect(Q19_VALUES).toEqual({
      yes_clearly: 100,
      mostly: 75,
      general_idea: 50,
      no: 0,
      not_defined: 0,
      unsure: 0,
    });
  });

  it('maps Q20-Q22 with "Unsure" as a scored zero', () => {
    expect(AGREEMENT_VALUES).toEqual({
      strongly_disagree: 0,
      disagree: 25,
      neither: 50,
      agree: 75,
      strongly_agree: 100,
      unsure: 0,
    });
  });

  it('maps Q28 Interest with "Unsure" as Not Assessed', () => {
    expect(Q28_VALUES).toEqual({
      not_interested: 0,
      slightly_interested: 25,
      moderately_interested: 50,
      very_interested: 75,
      extremely_interested: 100,
      unsure: NOT_ASSESSED,
    });
  });

  it('never maps an unknown or unsure value to the scale midpoint', () => {
    // Spec 12: "Never silently map unknown data to 50."
    const sentinelValues = [
      CONFIDENCE_VALUES.not_done_this,
      Q14_VALUES.unsure,
      FREQUENCY_VALUES.not_applicable,
      Q18_VALUES.unsure,
      Q19_VALUES.unsure,
      AGREEMENT_VALUES.unsure,
      Q28_VALUES.unsure,
    ];
    for (const value of sentinelValues) {
      expect(value).not.toBe(50);
    }
  });
});
