/**
 * Public surface of the core methodology package.
 *
 * This package has no dependency on React, Hono, or the Cloudflare runtime. It
 * runs identically in the browser (personal results), in the Worker
 * (organization analysis), against demo fixtures, and in Vitest. Spec 54.
 */

export * from './versions.js';

export * from './survey/categories.js';
export * from './survey/options.js';
export * from './survey/questions.js';
export * from './survey/answers.js';
export * from './survey/validation.js';

export * from './scoring/types.js';
export * from './scoring/mappings.js';
export * from './scoring/questionValues.js';
export * from './scoring/weighting.js';
export * from './scoring/calculateScores.js';

export * from './classification/classifyRespondent.js';
export * from './classification/championSignal.js';

export * from './aggregation/bands.js';
export * from './aggregation/distributions.js';
export * from './aggregation/aggregate.js';

export * from './recommendations/types.js';
export * from './recommendations/evidence.js';
export * from './recommendations/rules.js';
export * from './recommendations/ranking.js';
export * from './recommendations/deduplication.js';
export * from './recommendations/engine.js';

export * from './opportunities/categories.js';
export * from './opportunities/analyze.js';

export * from './privacy/thresholds.js';
export * from './privacy/segmentation.js';
export * from './privacy/exports.js';

export * from './analysis/runAnalysis.js';

export * from './util/number.js';
export * from './util/random.js';
