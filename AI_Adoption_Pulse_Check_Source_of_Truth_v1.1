# AI Adoption Pulse Check
## V1.1 Source of Truth Specification

**Status:** Pre-build product and technical specification  
**Spec version:** 1.1  
**Date:** August 18, 2026  
**Project:** Mattie Labs / open-source portfolio project  
**Product name:** AI Adoption Pulse Check

---

# 1. Purpose

This document is the current source of truth for **AI Adoption Pulse Check**.

It supersedes `AI_Adoption_Pulse_Check_Source_of_Truth_v1.0.md` and incorporates the accepted findings from an independent second-opinion review completed before implementation.

Use this document to:

- guide implementation;
- review scope and methodology;
- create coding-agent briefs;
- preserve scoring and privacy decisions;
- keep future models from re-planning the product from scratch;
- explain the project publicly once it is ready.

If implementation and this document disagree, stop and resolve the discrepancy rather than silently changing methodology.

---

# 2. Product Thesis

AI Adoption Pulse Check is a privacy-first, open-source employee AI adoption discovery tool for organizations of roughly **10–500 employees**.

It should help answer:

> **How are employees actually using AI, where are adoption and support gaps, what self-reported risk signals exist, and which workflows deserve deeper investigation?**

It is not intended to be:

- a generic employee satisfaction survey;
- a certification of organizational AI maturity;
- a compliance audit;
- a test of employee AI skill;
- a black-box AI assessment.

The discovery loop is:

```text
Survey
  ↓
Understand current state
  ↓
Identify support and risk signals
  ↓
Identify workflow pain + existing AI use
  ↓
Prioritize next actions
  ↓
Run deeper workflow discovery / implementation
  ↓
Repeat Pulse later
```

---

# 3. Primary Real-World Use Case

The strongest V1 user is:

> A consultant, internal AI-adoption lead, HR/People leader, operations leader, IT lead, implementation specialist, or FDE-style practitioner beginning an AI adoption engagement with a roughly 30–200 person organization.

They need to decide:

- whether employees are already using AI;
- whether organizational guidance is keeping pace;
- where confidence is weak;
- whether AI use is still task-by-task;
- which recurring workflows deserve discovery interviews;
- whether guardrails should precede broader rollout.

The tool should make those decisions easier without pretending the survey is the complete discovery process.

---

# 4. Portfolio Purpose

The project should demonstrate:

- structured discovery;
- requirements definition;
- survey methodology;
- honest measurement boundaries;
- privacy-aware product design;
- data modelling;
- deterministic scoring;
- explainable recommendation logic;
- workflow-opportunity identification;
- backend/API design;
- security boundaries;
- automated testing;
- deployment;
- documentation;
- open-source product judgment.

The portfolio value should come from **methodology, engineering decisions, testing, and tradeoffs**, not from adding an LLM.

---

# 5. Core Product Principles

## 5.1 Privacy-first; no direct identifiers

The application does not ask for or intentionally store:

- employee name;
- email address;
- employee ID;
- account identity;
- exact job title;
- device fingerprint;
- employee-survey IP address as application data.

Do not market the system as perfectly anonymous.

Preferred language:

> **The survey collects no direct identifiers and suppresses small-group reporting.**

Employee-provided free text and contextual clues can still create re-identification risk. That limitation must be stated clearly.

## 5.2 Explainable over impressive

Core scoring, classifications, opportunity signals, and recommendations are deterministic and versioned.

No LLM is required.

## 5.3 No single AI maturity score

The system reports separate dimensions because one average maturity number would hide important differences.

Example:

```text
Adoption      72
Confidence    61
Workflow      44
Safety        38
Enablement    41
```

## 5.4 Discovery, not diagnosis

Survey findings are directional evidence.

The product must not imply that a short self-report survey proves:

- actual employee AI competence;
- actual organizational safety;
- compliance;
- ROI;
- readiness for automation.

## 5.5 Self-report limitations are explicit

**Confidence** measures self-reported confidence, not demonstrated skill.

**Safety** measures self-reported safe-use behaviours and awareness. A low score is a meaningful warning signal. A high score is not proof that behaviour is actually safe.

## 5.6 Privacy controls live on the server

Small-segment data must never be sent to the browser and merely hidden visually.

## 5.7 Organizations retain control of their data

Self-hosted deployments should allow:

- privacy-limited response export;
- aggregate export;
- Pulse deletion;
- operation without sending employee survey data to Mattie Labs.

## 5.8 Build the smallest useful V1

Do not add complexity solely for technical showmanship.

---

# 6. V1 Scope

V1 should support:

1. self-hosted organization setup;
2. one deployment-level admin passcode;
3. creation of repeatable Pulse runs;
4. **28 original core questions plus one additional risk diagnostic (Q19b)**;
5. up to three optional organization-specific questions;
6. public survey link;
7. no-direct-identifier response collection;
8. optional local personal result;
9. five separate organization dimensions;
10. employee behaviour classification;
11. barriers and training analysis;
12. workflow Opportunity Map;
13. deterministic recommendations;
14. single-dimension privacy-safe filtering;
15. unsegmented free-text opportunity review;
16. privacy-limited CSV export;
17. separate free-text export;
18. aggregate JSON export;
19. Pulse closing;
20. Pulse duplication;
21. historical Pulse preservation;
22. public synthetic demo;
23. self-hosting documentation;
24. automated tests for scoring, privacy, classification, recommendations, and core flows.

---

# 7. Explicitly Out of Scope

Do not add in V1:

- employee accounts;
- admin user accounts;
- OAuth;
- SSO;
- complex RBAC;
- email invitations;
- HRIS integrations;
- Slack/Teams integrations;
- billing;
- multi-tenant SaaS;
- organization benchmarking;
- PDF report generation;
- real-time WebSockets;
- LLM scoring;
- LLM recommendations;
- LLM free-text clustering;
- employee leaderboards;
- coworker percentile comparisons;
- longitudinal trend engine;
- stacked demographic filters;
- complex survey builder;
- editing the core survey;
- Docker / host-anywhere distribution;
- per-workflow Enable / Scale / Guardrail states;
- aggregate-result caching.

---

# 8. Survey Design

## 8.1 Length

The survey contains:

- **28 original core questions**
- **1 additional diagnostic question (Q19b)**
- up to 3 optional organization-specific questions

Target completion time remains **7–10 minutes**, subject to pilot validation.

## 8.2 Sections

1. About Your Work
2. Current AI Use
3. Confidence
4. How AI Fits Into Your Workflow
5. Safe & Responsible Use
6. Organizational Support
7. Learning & Development
8. Workflow & Opportunity Discovery

Q1–Q3 are optional work-context questions.

Q27 is optional free text.

---

# 9. Employee Survey Intro

Default copy:

> **AI Adoption Pulse Check**
>
> This survey does not ask for your name, email, employee ID, or account information. Results are only shown for groups that meet the minimum reporting threshold.
>
> It helps your organization understand how employees are currently using AI, where people need support, and where AI may be useful in everyday work.
>
> There are no right or wrong answers. You do not need to be an AI user to participate.
>
> Please do not include confidential, personal, customer, or sensitive company information in written responses.
>
> Estimated time: **7–10 minutes.**

Documentation must clarify that free-text responses or contextual details can still make a respondent identifiable to someone who already knows the situation.

---

# 10. Core Survey Questions

## Section 1 — About Your Work

### Q1. Which area best describes your work?

Single select:

- Administration / Operations
- Customer Service / Customer Success
- Finance / Accounting
- Human Resources / People & Culture
- IT / Technology
- Leadership / Management
- Marketing / Communications
- Product / Design
- Sales / Business Development
- Legal / Compliance
- Engineering / Technical
- Other
- Prefer not to say

**Optional. Not scored.**

### Q2. Which best describes your role level?

Single select:

- Individual contributor
- Team lead / Supervisor
- Manager
- Senior manager / Department leader
- Executive / Owner
- Other
- Prefer not to say

**Optional. Not scored.**

### Q3. Which description best matches most of your work?

Single select:

- Mostly working with people/customers
- Mostly working with documents, information or data
- Mostly creating content or communications
- Mostly technical or systems work
- Mostly planning, management or decision-making
- A fairly even mix
- Other
- Prefer not to say

**Optional. Not scored.**

---

## Section 2 — Current AI Use

### Q4. How often do you currently use generative AI tools?

Examples may include ChatGPT, Claude, Gemini, Microsoft Copilot or similar tools.

- Never
- I have tried them, but rarely use them
- A few times per month
- A few times per week
- Most workdays
- Multiple times per day

**Diagnostic only.**

Q4 allows comparison between general AI use and workplace AI use. It does not contribute to the Adoption score.

### Q5. How often do you use AI specifically for work-related tasks?

- Never
- Less than monthly
- A few times per month
- A few times per week
- Most workdays
- Multiple times per day

**Dimension:** Adoption

### Q6. Which AI tools do you currently use for work?

Multi-select:

- ChatGPT
- Microsoft Copilot
- Google Gemini
- Claude
- Perplexity
- AI features built into software I already use
- AI coding/development tools
- AI image/video/audio tools
- Other
- I do not currently use AI for work
- I am not sure which tools count as AI

**Diagnostic only.**

Tool count is never treated as maturity.

### Q7. What do you currently use AI for at work?

Multi-select.

**Shared Opportunity Map categories:**

- Email and communication
- Meetings and follow-up
- Research and finding information
- Writing documents and reports
- Reviewing or summarizing documents
- Data entry and cleanup
- Spreadsheets and analysis
- Presentations
- Scheduling and coordination
- Customer questions and support
- Creating content
- Planning and project management

**Usage-only categories:**

- Coding or technical work
- Creating images, video or audio
- Building workflows, automations or tools
- Other
- I do not currently use AI for work

**Dimension:** Adoption  
**Also used for:** Opportunity analysis

Only the shared categories are compared directly with Q26.

---

## Section 3 — Confidence

For Q8–Q11:

- Not confident
- Slightly confident
- Somewhat confident
- Very confident
- Extremely confident
- I have not done this

### Q8. How confident are you giving an AI tool clear instructions for what you want it to do?

**Dimension:** Confidence

### Q9. How confident are you adding useful context, examples or constraints when AI's first answer is not good enough?

**Dimension:** Confidence

### Q10. How confident are you reviewing an AI response and deciding whether it is accurate and useful?

**Dimension:** Confidence

### Q11. How confident are you deciding when AI is—and is not—appropriate for a work task?

**Dimension:** Confidence

These questions measure **self-reported confidence**, not demonstrated proficiency.

---

## Section 4 — How AI Fits Into Your Workflow

### Q12. Which statement best describes how you currently use AI at work?

Single select:

- I do not currently use AI for work
- I experiment occasionally when something comes to mind
- I use AI regularly for individual tasks
- I regularly reuse prompts or approaches that work well
- AI is part of one or more repeatable processes I follow
- I have built AI workflows, automations, or tools that I or others use

**Dimension:** Workflow

This is intentionally a pure ordinal ladder. Helping coworkers is captured separately in Q15.

### Q13. How often do you reuse a prompt, template or saved set of instructions rather than starting from scratch?

- Never
- Rarely
- Sometimes
- Often
- Almost always
- I do not currently use AI

**Dimension:** Workflow

### Q14. Have you changed an existing work process because AI made a different approach possible?

- No
- Not yet, but I can see opportunities
- Yes, one small process
- Yes, several processes
- Yes, AI is now built into recurring workflows
- Unsure

**Dimension:** Workflow

### Q15. Have you ever created or helped create any of the following?

Multi-select:

- A reusable prompt or template
- A shared prompt library your team can use
- A custom GPT, Claude Project, or similar configured AI workspace
- An automated workflow that uses AI, for example in Zapier, Power Automate, or n8n
- An AI agent — an AI setup that completes multi-step tasks with limited supervision
- A tool or application that uses AI
- Documentation or training to help other employees use AI
- Helped coworkers use AI effectively, informally or formally
- None of these
- I am not sure what some of these mean

**Diagnostic / classification evidence only. Not scored.**

---

## Section 5 — Safe & Responsible Use

### Q16. When an AI response contains important facts or information, how often do you verify it before relying on it?

- Never
- Rarely
- Sometimes
- Usually
- Always
- Not applicable

**Dimension:** Safety

### Q17. Before sharing work created with AI, how often do you review and edit the output yourself?

- Never
- Rarely
- Sometimes
- Usually
- Always
- Not applicable

**Dimension:** Safety

### Q18. How confident are you that you know what company, customer or personal information should not be entered into an AI tool?

- Not confident
- Slightly confident
- Somewhat confident
- Very confident
- Extremely confident
- Unsure

**Dimension:** Safety

Q18 intentionally measures the respondent's awareness/confidence only. Whether the organization supplied guidance is measured separately in Q20.

### Q19. Do you know which AI tools your organization has approved for work use?

- Yes, clearly
- Mostly
- I have a general idea
- No
- I do not think my organization has defined this
- Unsure

**Dimension:** Enablement

### Q19b. How often, if ever, do you use AI tools or accounts for work that were not provided by your organization?

- Never
- Rarely
- Sometimes
- Often
- I do not have access to organization-provided AI tools
- Prefer not to say

Helper text:

> This does not necessarily mean the tool is prohibited. The question helps identify where employees may be relying on independently accessed AI tools.

**Diagnostic only. Not scored.**

This is a key shadow/unmanaged-AI discovery signal.

---

## Section 6 — Organizational Support

For Q20–Q22:

- Strongly disagree
- Disagree
- Neither agree nor disagree
- Agree
- Strongly agree
- Unsure

### Q20. My organization has clearly explained how employees should and should not use AI.

**Dimension:** Enablement

### Q21. I have access to the AI tools I need to use AI effectively in my work.

**Dimension:** Enablement

### Q22. I have received enough guidance or training to use AI effectively and responsibly.

**Dimension:** Enablement

### Q23. What currently makes it harder for you to use AI effectively at work?

Select up to three:

- I do not know where AI would be useful
- I do not know how to use AI tools well
- I do not have enough time to learn
- I do not have access to the right tools
- I am unsure which tools are approved
- I am concerned about privacy or security
- I am concerned about accuracy or unreliable outputs
- AI does not work well for my tasks
- Company policies or expectations are not clear
- My workflows or systems do not work well with AI
- I prefer my current way of working
- I do not currently see a need for AI
- Other
- Nothing is currently preventing me from using AI

**Diagnostic only.**

---

## Section 7 — Learning & Development

### Q24. Which areas would you most like help learning?

Select up to three:

- AI basics and understanding what AI can do
- Writing better prompts/instructions
- Using AI for my specific role
- Research and information gathering
- Writing and communication
- Data, spreadsheets and analysis
- Creating presentations or content
- Building reusable AI workflows
- Automation
- AI agents
- AI tools available in our organization
- Privacy, security and responsible AI use
- Checking AI accuracy and quality
- Building AI applications or technical solutions
- I do not currently need AI training
- Other

**Diagnostic only.**

### Q25. How would you prefer to learn new AI skills?

Select up to two:

- Short practical tutorials
- Live workshops
- Self-paced courses
- Written guides / examples
- Short videos
- Role-specific examples
- One-on-one support
- Learning by building a real workflow
- Internal AI champions / coworkers
- I do not currently want additional training
- Other

**Diagnostic only.**

---

## Section 8 — Workflow & Opportunity Discovery

### Q26. Which parts of your work currently take significant time or involve repetitive effort?

Multi-select.

**Shared Opportunity Map categories:**

- Email and communication
- Meetings and follow-up
- Research and finding information
- Writing documents and reports
- Reviewing or summarizing documents
- Data entry and cleanup
- Spreadsheets and analysis
- Presentations
- Scheduling and coordination
- Customer questions and support
- Creating content
- Planning and project management

**Pain-only categories:**

- Training or onboarding
- Repetitive system updates
- Other
- None of these

**Opportunity signal. Not scored.**

### Q27. If AI could make one part of your work easier, what would you most want help with?

Optional free text.

Helper text:

> Describe the task or problem rather than including sensitive information. For example: “Turning meeting notes into follow-up actions” rather than pasting actual meeting notes.

**Opportunity signal. Not scored.**

### Q28. How interested are you in using AI more in your work if you had the right tools, guidance and support?

- Not interested
- Slightly interested
- Moderately interested
- Very interested
- Extremely interested
- Unsure

**Diagnostic:** Interest  
**Not a maturity dimension.**

---

# 11. Core Scoring Dimensions

| Dimension | Range | What it actually measures |
|---|---:|---|
| Adoption | 0–100 | Self-reported frequency and breadth of work-related AI use |
| Confidence | 0–100 | Self-reported confidence using and evaluating AI |
| Workflow | 0–100 | Self-reported movement from isolated use toward repeatable processes |
| Safety | 0–100 | Self-reported verification, review and data-handling awareness |
| Enablement | 0–100 | Employee-reported organizational clarity, access and training |

Opportunity and Interest remain separate diagnostic outputs.

---

# 12. Standard Score Mapping

For ordinary five-point scales:

```text
Lowest / Never / Strongly disagree = 0
Low / Rarely / Disagree            = 25
Middle / Sometimes / Neither       = 50
High / Usually / Agree             = 75
Highest / Always / Strongly agree  = 100
```

`Unsure`, `Not applicable`, and `Not Assessed` must be handled explicitly.

Never silently map unknown data to 50.

---

# 13. Adoption Score

Inputs:

```text
Q5 Work AI usage        70%
Q7 Breadth of work use  30%
```

Q5:

```text
Never               0
Less than monthly  20
Few times/month    40
Few times/week     60
Most workdays      80
Multiple/day      100
```

Q7 breadth:

```text
0 use categories    0
1                  25
2–3                50
4–5                75
6+                 100
```

`I do not currently use AI for work` = 0.

Formula:

```text
Adoption =
(Q5 × 0.70)
+ (Q7 × 0.30)
```

Q4 is diagnostic-only.

---

# 14. Confidence Score

Inputs:

```text
Q8
Q9
Q10
Q11
```

Equal weighting.

Mapping:

```text
Not confident        0
Slightly             25
Somewhat             50
Very                 75
Extremely           100
I have not done this Not Assessed
```

Formula:

```text
Confidence = mean(valid Q8, Q9, Q10, Q11)
```

Use the general missing-data rule below.

The dashboard and documentation must not call this demonstrated capability or skill.

---

# 15. Workflow Score

Inputs:

```text
Q12 Current workflow behaviour  50%
Q13 Reuse frequency             25%
Q14 Process redesign            25%
```

Q12:

```text
No work AI use                                   0
Occasional experiments                          20
Regular individual tasks                        40
Regularly reuse prompts/approaches              60
Repeatable processes                            80
Built workflows/automations/tools              100
```

Q13:

```text
Never          0
Rarely        25
Sometimes     50
Often         75
Almost always 100
No AI use      0
```

Q14:

```text
No                                0
See opportunities                20
One small process                50
Several processes                75
AI in recurring workflows       100
Unsure                  Not Assessed
```

Formula:

```text
Workflow =
(Q12 × 0.50)
+ (Q13 × 0.25)
+ (Q14 × 0.25)
```

Q15 is not scored. It is corroborating evidence for classification and champion signals.

---

# 16. Safety Score

Inputs:

```text
Q16 Verification behaviour       40%
Q17 Human review behaviour       30%
Q18 Data-handling awareness      30%
```

Q16/Q17:

```text
Never       0
Rarely     25
Sometimes  50
Usually    75
Always    100
N/A        Not Assessed
```

Q18:

```text
Not confident        0
Slightly             25
Somewhat             50
Very                 75
Extremely           100
Unsure                0
```

Formula:

```text
Safety =
(Q16 × 0.40)
+ (Q17 × 0.30)
+ (Q18 × 0.30)
```

Interpretation rule:

> A low Safety score is a meaningful risk signal. A high Safety score is not proof of actual safe behaviour because the dimension relies on self-report.

Show the `Unsure` rate alongside the organization Safety result.

---

# 17. Enablement Score

Inputs:

```text
Q19 Approved-tool clarity  20%
Q20 Policy/guidance        30%
Q21 Tool access            20%
Q22 Training/guidance      30%
```

Q19:

```text
Yes, clearly                 100
Mostly                        75
General idea                  50
No                             0
Organization has not defined   0
Unsure                         0
```

Q20–Q22:

```text
Strongly disagree   0
Disagree           25
Neither            50
Agree              75
Strongly agree    100
Unsure              0
```

Formula:

```text
Enablement =
(Q19 × 0.20)
+ (Q20 × 0.30)
+ (Q21 × 0.20)
+ (Q22 × 0.30)
```

`Unsure = 0` remains intentional because an organizational resource employees do not know about is not effectively enabling them.

Always show the relevant `Unsure`/unclear percentage beside the score.

---

# 18. Missing-Data Rule

A dimension is calculated only when at least **60% of its intended weighting** contains valid scored responses.

If the threshold is met:

- exclude legitimate `Not Assessed` values;
- normalize the remaining valid weights.

If it is not met:

> **Not enough information to calculate this score.**

Do not show zero.

Q1–Q3 and Q27 are optional and never scored.

---

# 19. Display Bands

| Score | Band |
|---|---|
| 0–24 | Low |
| 25–49 | Emerging |
| 50–69 | Developing |
| 70–84 | Established |
| 85–100 | Strong |

The number and underlying evidence matter more than the label.

For small samples, avoid presenting small score differences as meaningful precision.

Recommended UI note when `n < 30`:

> Treat small score differences cautiously; this is directional self-report data.

---

# 20. Employee Behaviour Classification

Classification is **ordered and exhaustive**.

Evaluate rules from Level 4 down to Level 0. First valid match wins.

Contradictory responses fall to the most conservative valid level rather than becoming unclassified.

## Level 4 — Builder / Champion

Requires:

- Q12 = built workflows/automations/tools;

**and** Q15 includes at least one of:

- automated AI workflow;
- AI agent;
- AI tool/application;
- shared prompt library;
- documentation/training;
- helped coworkers use AI effectively.

## Level 3 — Workflow User

Requires:

- Q12 = regularly reuse prompts/approaches OR repeatable processes;

**and** at least one corroborating signal:

- Q13 >= Often;
- Q14 >= one changed process;
- Q15 contains a reusable system/artifact.

## Level 2 — Regular User

Requires:

- Q5 >= a few times per month;

**and**
- Q12 = regular individual tasks OR higher;

but does not meet Level 3 or Level 4.

## Level 1 — Explorer

Any work AI use or experimentation that does not meet Level 2+.

Typical examples:

- Q5 less than a few times per month;
- Q12 = occasional experimentation;
- contradictory low-frequency / higher-confidence answers.

## Level 0 — Non-user

Requires:

- Q5 = Never;
- Q12 = no current work AI use;
- no contradictory Q15 evidence of AI workflows/tools.

Every valid response combination must map to exactly one level.

Automated tests must enforce exhaustiveness.

---

# 21. Organization-Level Aggregation

Calculate respondent scores first.

Then aggregate respondent scores.

For every dimension show:

- mean;
- median;
- distribution;
- number scored;
- number not assessed;
- relevant `Unsure` / unclear response rate.

Example:

```text
Enablement: 34 / 100
Median: 38
64 of 72 respondents scored
31% selected Unsure / unclear guidance responses
```

Do not compute organization scores by pooling raw answer points first.

---

# 22. Interest Mapping

Q28:

```text
Not interested         0
Slightly              25
Moderately            50
Very                  75
Extremely            100
Unsure       Not Assessed
```

Call this **Interest**, never maturity.

---

# 23. Derived Signals

## Adoption gap

```text
Adoption < 40
AND Interest >= 70
```

## Governance gap

```text
Adoption >= 70
AND Safety < 50
```

## Enablement gap

```text
Interest >= 70
AND Enablement < 50
```

## Workflow gap

```text
Adoption >= 60
AND Workflow < 50
```

## Confidence gap

```text
Adoption >= 60
AND Confidence < 50
```

## Potential champion signal

A respondent qualifies when:

```text
Workflow >= 75
Confidence >= 70
Safety >= 70
```

plus Q12/Q15 corroboration.

An organization-level champion signal requires at least **3 qualifying respondents**.

Never expose respondent identities.

Below five qualifying respondents, display only:

> **3+ potential champions**

rather than an exact count.

---

# 24. Recommendation Engine Principles

Recommendations are:

- deterministic;
- explainable;
- evidence-backed;
- versioned;
- limited in number.

Each recommendation contains:

```text
Priority
Title
What we found
Why it matters
Recommended action
Evidence
```

Maximum output:

```text
3 Primary Priorities
+
up to 3 Additional Opportunities / Signals
```

---

# 25. Recommendation Priority Levels

## Priority 1 — Guardrail / Risk

Address before encouraging broader use.

## Priority 2 — Adoption Blocker

Employees want or are trying to use AI, but support is insufficient.

## Priority 3 — Improvement / Discovery

Existing use can become more useful, consistent or intentional.

## Priority 4 — Internal Opportunity

Existing strengths may support broader learning or discovery.

---

# 26. Core Recommendation Rules — V1.1

V1.1 uses **10 recommendation outcomes**.

Sub-findings are merged into recommendations instead of consuming separate dashboard slots.

## R01 — Strengthen safe AI use before expanding adoption

Trigger:

```text
Adoption >= 60
AND Safety < 50
```

Priority: **1**  
Family: **SAFETY**

Evidence may include:

- Q16 verification weakness;
- Q17 review weakness;
- Q18 data-handling uncertainty;
- Q19b unmanaged tool usage.

If R01 fires, verification weaknesses that would otherwise trigger R03 are merged into R01.

---

## R02 — Publish clear AI usage guidance

Trigger:

```text
Q18 organization score < 50
OR
Q19 organization score < 50
OR
Q20 organization score < 50
```

Priority: **1**  
Family: **POLICY**

Possible sub-findings:

- sensitive-data boundaries unclear;
- approved tools unclear;
- general AI policy/guidance unclear.

One recommendation should summarize whichever signals fired.

---

## R03 — Improve verification and human review

Trigger:

```text
Adoption >= 40
AND
(Q16 organization score < 50 OR Q17 organization score < 50)
AND
R01 did not fire
```

Priority: **1**  
Family: **SAFETY**

This exists for organizations whose overall Safety score remains above threshold while verification/review has a specific weakness.

---

## R04 — Remove organizational barriers to adoption

Trigger:

```text
Interest >= 70
AND Enablement < 50
```

Priority: **2**  
Family: **ENABLEMENT**

Use the following as sub-findings, not separate recommendations:

- Q19 approved tools;
- Q20 policy clarity;
- Q21 tool access;
- Q22 training;
- Q23 top barriers;
- Q24 training demand;
- Q25 learning preference;
- Q19b no access to organization-provided tools.

---

## R05 — Build practical AI confidence

Trigger:

```text
Adoption >= 50
AND Confidence < 50
```

Priority: **2**  
Family: **CONFIDENCE**

Focus on:

- clear instructions;
- adding context;
- refinement;
- evaluating outputs;
- choosing when AI is appropriate.

---

## R06 — Move from one-off AI use to repeatable workflows

Trigger:

```text
Adoption >= 60
AND Workflow < 50
```

Priority: **3**  
Family: **WORKFLOW**

If Confidence >= 70, tailor the action toward workflow design rather than AI basics.

Suggested progression:

- save useful prompts;
- document recurring steps;
- standardize repeat tasks;
- identify deterministic steps;
- introduce automation only where justified.

---

## R07 — Investigate why interest is not converting into adoption

Trigger:

```text
Adoption < 40
AND Interest >= 70
AND Enablement >= 50
```

Priority: **2**  
Family: **DISCOVERY**

This rule is suppressed when R04 fires because low Enablement already explains the likely adoption blocker.

Use Q23 to explore non-enablement causes.

---

## R08 — Start with workflow discovery, not an AI rollout

Trigger:

```text
Adoption < 40
AND Interest < 50
```

Priority: **3**  
Family: **DISCOVERY**

Do not recommend broad AI purchasing or training merely because adoption is low.

Start by finding real operational pain.

---

## R09 — Consider an internal AI champion group

Trigger:

At least **3 respondents** qualify for the potential champion signal.

Priority: **4**  
Family: **CHAMPIONS**

Do not expose identities.

Suggested action:

> Invite employees to opt in separately if they want to support pilots, share practices, or help document useful workflows.

---

## R10 — Review reliance on independently accessed AI tools

Trigger:

```text
Adoption >= 60
AND
percentage of valid Q19b responses selecting Sometimes or Often >= 30%
```

Priority: **1**  
Family: **SAFETY**

`Prefer not to say` is excluded from the rate denominator and reported separately.

This is a discovery signal, not an accusation of policy violation.

If R01 also fires, R10 may be merged into R01 as a supporting finding rather than taking another primary slot.

---

# 27. Recommendation Deduplication

Families:

```text
SAFETY
POLICY
ENABLEMENT
CONFIDENCE
WORKFLOW
DISCOVERY
CHAMPIONS
```

Normally only one primary recommendation from a family is shown.

Additional rule:

> No more than two primary recommendations may depend on the same root evidence question.

This prevents future rule additions from recreating recommendation flooding.

---

# 28. Recommendation Ranking

Order:

1. Priority 1
2. Priority 2
3. Priority 3
4. Priority 4

Within a priority:

1. larger gap from threshold;
2. greater proportion of respondents affected;
3. lower rule ID as deterministic tie-breaker.

Every recommendation must cite measurable evidence.

---

# 29. Recommendation Confidence Labels

Allowed:

## Strong Signal

Multiple supporting measures.

## Signal

One clear rule with adequate sample.

## Early Signal

Only when:

```text
5 <= n < 10
```

Never invent statistical-confidence percentages.

---

# 30. Opportunity Engine

The Opportunity Map is one of the core differentiators.

It uses only the **shared Q7/Q26 categories** so that current AI use and workflow pain are directly comparable.

For each shared category calculate:

```text
Pain count
Pain rate
AI-use-among-pain count
AI-use-among-pain rate
```

Important:

> Current AI usage for a workflow is calculated among respondents who reported that same workflow as time-consuming/repetitive.

This avoids arbitrary many-to-many mappings and makes the comparison exact by construction.

---

# 31. Opportunity Labels — V1.1

V1 intentionally uses only two per-workflow labels.

## Explore

Trigger:

```text
Pain rate >= 20%
AND
AI use among respondents reporting that pain < 40%
```

Meaning:

> Meaningful workflow friction exists, but AI use within that workflow is still limited.

Suggested action:

> Interview employees who perform this workflow and map the current process before selecting a solution.

## Standardize

Trigger:

```text
Pain rate >= 20%
AND
AI use among respondents reporting that pain >= 40%
```

Meaning:

> Employees are already using AI in a workflow they still experience as repetitive or time-consuming.

Suggested action:

> Investigate whether shared prompts, templates, process guidance, or a controlled workflow would improve consistency.

## Organization-wide Guardrail banner

If:

```text
Safety < 50
```

show above the entire Opportunity Map:

> **Guardrail signal:** Strengthen safe-use practices before broadly scaling AI workflows.

Do not assign Guardrail, Enable or Scale as per-workflow labels in V1.

Those labels are deferred until per-workflow evidence can actually support them.

---

# 32. Minimum Sample Rules

Organization-level results require:

```text
n >= 5 completed responses
```

For 5–9:

> **Early directional results — interpret cautiously.**

Normal analysis begins at 10+.

---

# 33. Segmentation Privacy Rules

V1 permits only **one filter dimension at a time**:

- department;
- role level;
- work type.

No stacked filters.

A segment can be returned only if:

```text
segment n >= 5
AND
complement n >= 5
```

Example:

```text
Total respondents = 20
Managers = 18
Non-managers = 2

Managers segment → suppressed
```

Even though the displayed segment contains more than five people, the complement is too small.

The server returns:

```text
suppressed: true
reason: "minimum_group_or_complement_size"
```

The underlying aggregate is never returned.

---

# 34. Privacy Model

## 34.1 Preferred claim

Use:

> **Privacy-first employee AI adoption survey that collects no direct employee identifiers.**

Do not promise perfect anonymity.

## 34.2 Work-context questions

Q1–Q3 are:

- optional;
- broad;
- used only for aggregate reporting;
- omitted from default row-level export.

## 34.3 Response date

Store submission time only at **day granularity**:

```text
submitted_on
YYYY-MM-DD
```

V1 has no use for exact time.

This reduces timing-correlation risk.

## 34.4 Free text

Q27:

- never supports demographic filtering;
- never displays department/role/work-type context;
- is exported separately;
- is not processed by an LLM;
- includes a warning that respondents may voluntarily identify themselves.

## 34.5 Duplicate-response handling

Soft browser-only prevention:

```text
localStorage:
pulse:{publicId}:submitted = true
```

Do not use employee IP blocking or device fingerprinting.

Copy:

> This helps prevent accidental duplicate responses on this browser. It does not identify you or guarantee one response per employee.

## 34.6 Infrastructure limitation

Documentation must distinguish:

- data the application intentionally stores;
- ordinary network/security metadata an infrastructure provider may process.

The application must not claim that no network provider ever sees an IP address.

---

# 35. Export Privacy

Exports must not bypass dashboard privacy controls.

## 35.1 Default response CSV

Contains:

- scored/non-context survey answers;
- custom non-free-text answers if safe;
- survey version metadata where useful.

Excludes:

- Q1 department;
- Q2 role;
- Q3 work type;
- Q27 free text;
- exact timestamps;
- account/device/network identifiers.

Rows are shuffled before export.

The UI must label this as a **limited response export**, not “fully anonymous data.”

## 35.2 Free-text export

Separate file containing:

- Q27 response text only;
- optional random non-linkable row token if technically needed.

No department, role, work type, or other survey answers.

## 35.3 Aggregate JSON

Aggregate JSON may include privacy-safe segmented results only if the same server-side segment + complement checks pass.

## 35.4 No context opt-in export in V1

V1 does **not** offer row-level Q1–Q3 export.

A self-hoster with database access technically controls their infrastructure, but the product itself should not provide a convenient re-identification path.

---

# 36. Employee Personal Result

After submission, if enabled, calculate locally using the versioned scoring library.

Show:

```text
Behaviour classification
Adoption
Confidence
Workflow
Safety
Organization support experience
```

Enablement must be framed as organization-support experience, not employee skill.

Maximum:

```text
1 Primary Focus
+
1 Suggested Next Step
```

Never show:

- coworker comparison;
- percentile ranking;
- leaderboard;
- organization segmented results.

---

# 37. Admin Product Flow

First deployment:

```text
Welcome
  ↓
Organization Setup
  ↓
Admin Dashboard
```

Organization configuration:

- organization name;
- optional logo URL;
- accent colour;
- optional survey intro.

The admin passcode is a deployment secret.

---

# 38. Admin Authentication

V1 uses one deployment-level passcode.

No:

- usernames;
- user accounts;
- password recovery.

Secrets:

```text
ADMIN_PASSCODE_HASH
SESSION_SECRET
```

Minimum approach:

- PBKDF2-HMAC-SHA256 salted passcode hash;
- constant-time derived-hash comparison;
- HMAC-signed short-lived session cookie;
- Secure;
- HttpOnly;
- SameSite=Strict;
- login throttling/backoff using a platform-supported server-side mechanism;
- no survey-respondent IP storage.

---

# 39. Admin Home

Show:

- organization;
- Create Pulse;
- active Pulse runs;
- historical Pulse runs;
- response counts;
- open/closed state;
- dates.

---

# 40. Create Pulse

## Step 1 — Basics

- Pulse name;
- optional description;
- open date;
- optional closing date.

## Step 2 — Configuration

The core survey is fixed.

Admin may:

- show/hide logo;
- enable/disable personal result;
- add up to 3 custom questions.

Custom types:

- single select;
- multi-select;
- free text.

Custom questions never affect scoring.

If implementation schedule slips, custom questions are the first currently accepted V1 feature that may be cut.

## Step 3 — Review

Show:

- title;
- estimated time;
- survey items;
- custom items;
- privacy notice;
- personal-result setting.

---

# 41. Employee Survey Flow

Public route concept:

```text
/p/{publicPulseId}
```

The `publicPulseId` must contain at least **128 bits of cryptographically secure randomness** encoded in a URL-safe format.

Survey:

- section-based;
- clear progress;
- local draft only until submission;
- no partial response stored server-side.

---

# 42. Submission Flow

```text
Browser
  ↓
Validate local response
  ↓
Calculate optional local personal result
  ↓
POST response
  ↓
Worker validates:
  - Pulse exists/open
  - version
  - schema
  - answer limits
  ↓
D1 stores response
  ↓
Return success
```

No aggregate recalculation occurs during submission.

---

# 43. Analysis Flow

Dashboard request:

```text
Admin request
  ↓
Authenticate session
  ↓
Load Pulse responses
  ↓
Run versioned scoring
  ↓
Aggregate
  ↓
Apply privacy suppression
  ↓
Run recommendation engine
  ↓
Run opportunity engine
  ↓
Return safe analysis
```

At the V1 target size, calculate on read.

Do not build an aggregate cache until measured performance justifies it.

---

# 44. Admin Overview Dashboard

Order:

1. response count / Pulse status;
2. five dimensions;
3. relevant `Unsure` / unclear rates;
4. top three recommendations;
5. adoption/classification distribution;
6. top barriers;
7. training priorities;
8. Opportunity Map summary.

The overview should answer the main organizational question within roughly 30 seconds.

---

# 45. Results Dashboard

## Adoption

- work AI-use frequency;
- general vs work AI use;
- AI tools;
- use cases;
- behaviour classification distribution.

## Confidence

- instructions;
- context/refinement;
- evaluation;
- appropriate-use confidence.

Label as **self-reported confidence**.

## Workflow

- task-by-task vs repeatable use;
- prompt/process reuse;
- process redesign;
- Q15 artefact/evidence frequencies.

## Safety

- verification;
- human review;
- data-handling awareness;
- Q19b independently accessed AI usage.

Include:

> High self-reported Safety does not prove actual safe behaviour.

## Enablement

- approved-tool clarity;
- policy clarity;
- tool access;
- training;
- top barriers;
- `Unsure` rates.

Filters:

- All
- Department
- Role level
- Work type

Only one filter dimension may be active.

---

# 46. Opportunity Dashboard

Example structure:

| Workflow | Pain | AI use among pain group | Status |
|---|---:|---:|---|
| Reporting/documents | 38% | 18% | Explore |
| Email/communication | 35% | 61% | Standardize |
| Data entry/cleanup | 24% | 11% | Explore |

If Safety < 50, show the organization-wide Guardrail banner above the table.

Clicking an opportunity may show:

- pain count;
- pain rate;
- AI-use-among-pain count;
- AI-use-among-pain rate;
- deterministic status;
- suggested next discovery action.

---

# 47. Free-Text Opportunity Responses

Dedicated view.

Never segment.

Warning:

> Written responses may contain identifying information voluntarily provided by employees. These responses are intentionally separated from work-context filters.

V1 supports:

- review;
- separate export.

No LLM processing.

---

# 48. Recurring Pulse Runs

**Duplicate as New Pulse** copies:

- survey configuration;
- custom questions;
- branding/configuration.

Does not copy:

- responses;
- analysis;
- recommendations.

No trend engine in V1.

---

# 49. Closing and Deleting

## Close Pulse

Stops new submissions.

Preserves analysis and exports.

## Delete Pulse

Explicit destructive confirmation.

Delete:

- Pulse;
- custom questions;
- responses.

Self-hosting organization controls retention.

---

# 50. Branding

Configurable:

- organization name;
- optional logo;
- one accent colour.

Small attribution:

> AI Adoption Pulse Check — open-source project by Mattie Labs

The application itself should remain neutral enough for real organizational use.

---

# 51. Public Demo

Public demo:

```text
Explore Sample Organization
Take Sample Survey
View on GitHub
```

Use roughly **75 synthetic responses**.

Fixtures remain separate from real D1 response data.

The real scoring, classification, recommendation, privacy-safe analysis, and Opportunity Map logic run against the fixtures.

---

# 52. V1 Technical Stack

## Client

- Vite
- React
- TypeScript
- Tailwind CSS
- React Router

## Server

- single Cloudflare Worker
- Hono
- Cloudflare D1
- Zod validation

## Tooling

- Wrangler
- Vitest
- Playwright

## AI

No AI API.

---

# 53. Deployment Architecture

One deployable Cloudflare application.

```text
Browser
  │
  ├── Vite/React static assets
  │
  └── /api/*
          ↓
    Hono Worker
          ↓
         D1
```

The Worker serves:

- API routes;
- built static SPA assets;
- SPA fallback routing.

This is intentionally simpler than a separate Next.js + Worker architecture.

No SSR is required for the survey/admin application.

---

# 54. Core Logic Structure

Keep business logic framework-independent.

Suggested:

```text
src/core/

survey/
  questions.ts
  versions.ts
  validation.ts

scoring/
  adoption.ts
  confidence.ts
  workflow.ts
  safety.ts
  enablement.ts
  calculateScores.ts

classification/
  classifyRespondent.ts

recommendations/
  rules.ts
  evidence.ts
  ranking.ts
  deduplication.ts

opportunities/
  categories.ts
  analyze.ts

privacy/
  thresholds.ts
  segmentation.ts
  exports.ts
```

The same core logic should run:

- client-side for personal results;
- Worker-side for organization analysis;
- against demo fixtures;
- in Vitest.

---

# 55. D1 Data Model

Keep V1 small.

## organizations

```text
id
name
logo_url
accent_color
survey_intro
created_at
updated_at
```

## pulses

```text
id
organization_id
public_id
name
description
status
survey_version
scoring_version
recommendation_version
opens_on
closes_on
personal_results_enabled
created_at
closed_at
```

Constraints:

- unique `public_id`;
- valid status enum/check;
- foreign key to organization.

## custom_questions

```text
id
pulse_id
type
question_text
options_json
position
created_at
```

Maximum three enforced server-side.

## responses

```text
id
pulse_id
submitted_on
survey_version
answers_json
custom_answers_json
```

`submitted_on` is day-level only.

Do not create:

- `pulse_aggregates`;
- generic `organization_settings`.

Known organization settings belong in `organizations`.

---

# 56. Response Representation

Use stable machine values.

Example:

```json
{
  "surveyVersion": "1.1.0",
  "answers": {
    "q1": "operations",
    "q4": "few_times_week",
    "q5": "few_times_week",
    "q7": ["email_communication", "research_information"],
    "q19b": "rarely"
  }
}
```

Display-copy changes must not change historical answer meaning.

---

# 57. Runtime Versioning

Initial V1.1 spec constants:

```text
surveyVersion: "1.1.0"
scoringVersion: "1.1.0"
recommendationEngineVersion: "1.1.0"
```

Every response records the survey version.

Every analysis/export identifies all relevant versions.

If scoring changes later, historical results must remain reproducible under their original version.

---

# 58. API Surface

## Public

```text
GET  /api/pulses/:publicId
POST /api/pulses/:publicId/responses
```

## Admin authentication

```text
POST /api/admin/login
POST /api/admin/logout
```

## Admin Pulse operations

```text
GET  /api/admin/pulses
POST /api/admin/pulses

GET   /api/admin/pulses/:id
PATCH /api/admin/pulses/:id

POST /api/admin/pulses/:id/close
POST /api/admin/pulses/:id/duplicate
DELETE /api/admin/pulses/:id

GET /api/admin/pulses/:id/results
GET /api/admin/pulses/:id/opportunities
GET /api/admin/pulses/:id/responses/free-text
GET /api/admin/pulses/:id/export/responses.csv
GET /api/admin/pulses/:id/export/free-text.csv
GET /api/admin/pulses/:id/export/results.json
```

Add endpoints only when a concrete consumer requires them.

---

# 59. Security Floor Before Public Release

Minimum controls:

- PBKDF2-HMAC-SHA256 salted admin passcode hash;
- constant-time comparison;
- HMAC-signed short-lived session;
- Secure / HttpOnly / SameSite=Strict cookie;
- server-side login throttling/backoff;
- Zod validation on every write endpoint;
- hard request-size cap around 32 KB;
- Q27/free-text length cap around 1,000 characters;
- parameterized D1 queries only;
- public IDs with >=128 bits cryptographically secure randomness;
- indistinguishable 404 responses for invalid public IDs;
- output escaping for organization/custom/free-text content;
- CSV formula injection protection for cells beginning with `=`, `+`, `-`, or `@`;
- no secrets in D1;
- no secrets in logs;
- no employee survey IP storage as application data;
- privacy suppression performed before response data leaves the server.

Do not add enterprise controls without a demonstrated need.

---

# 60. Testing Strategy

## 60.1 Scoring

Test:

- every answer mapping;
- every formula;
- missing data;
- 60% validity threshold;
- weight normalization;
- exact boundary cases.

## 60.2 Classification

Mandatory property/coverage test:

> Every valid Q5/Q12/Q13/Q14/Q15 combination maps to exactly one classification.

Also test contradictory-response fallbacks.

## 60.3 Recommendations

For every rule:

- exact threshold;
- one point below;
- one point above;
- missing/Not Assessed inputs;
- early sample;
- deduplication;
- family conflict;
- ranking;
- R01/R03 merge behaviour;
- R01/R10 merge behaviour.

## 60.4 Privacy

Mandatory:

```text
segment n = 4 → suppressed
segment n = 5 and complement >= 5 → allowed
segment n = 5 and complement = 4 → suppressed
```

Also test:

- one-filter-only enforcement;
- no Q1–Q3 in default response CSV;
- no Q27 in default response CSV;
- free-text export contains no context columns;
- day-level dates only;
- CSV formula escaping.

## 60.5 Survey

Test:

- validation;
- optional questions;
- max-select limits;
- Q19b;
- closed Pulse;
- successful submission;
- duplicate-browser warning.

## 60.6 Admin

Test:

- invalid passcode;
- valid session;
- session expiry;
- create;
- close;
- duplicate;
- delete;
- export authorization.

## 60.7 End-to-end

At minimum one Playwright happy path for:

- employee survey;
- personal result;
- admin create Pulse;
- admin dashboard;
- privacy-safe filter;
- export.

---

# 61. Open-Source Repository Direction

Suggested:

```text
ai-adoption-pulse-check/

README.md
LICENSE
CONTRIBUTING.md

docs/
  methodology.md
  survey-design.md
  scoring.md
  recommendations.md
  privacy.md
  threat-model.md
  interpreting-results.md
  running-a-pulse-check.md
  self-hosting.md
  architecture.md
  limitations.md
  changelog.md

src/
tests/

demo/
  sample-responses.json
```

Current preferred license:

**MIT**

Review once more before public publication, but no licensing issue currently blocks development.

---

# 62. Self-Hosting Requirement

V1 is Cloudflare-only.

That limitation should be stated plainly.

Target setup experience:

```text
Clone repository
Install dependencies
Create D1 database
Set two secrets
Run migrations
Deploy with Wrangler
```

The self-hosting guide should be tested from a clean environment and target roughly **15 minutes for a technically comfortable user** after Cloudflare prerequisites are available.

Do not add Docker merely to claim platform independence.

Track broader hosting support as a post-V1 issue.

---

# 63. Documentation Standard

Documentation must explain:

- what each dimension measures;
- what each dimension does **not** measure;
- why Confidence replaced Capability;
- why no global maturity score exists;
- self-report bias;
- Safety interpretation;
- Unsure handling;
- scoring formulas;
- classification ladder;
- recommendation rules;
- Opportunity Map logic;
- privacy thresholds;
- complement suppression;
- export restrictions;
- threat model;
- free-text limitations;
- infrastructure metadata limitation;
- self-hosting;
- data retention;
- versioning;
- known limitations;
- pilot changes once available.

The methodology should be inspectable.

---

# 64. Privacy Threat Model — Minimum Documentation

The threat-model document should explicitly cover:

## Designed to reduce

- direct identifier collection;
- casual demographic re-identification;
- stacked-filter re-identification;
- complement/differencing exposure;
- exact-time correlation;
- contextual leakage through standard exports;
- linking free text to demographic responses.

## Cannot guarantee protection against

- a respondent identifying themselves in free text;
- a manager already knowing a unique situation;
- a self-hoster directly querying their own D1 database;
- infrastructure-level network/security logging outside the application;
- very small organizations inferring identities from context;
- coordinated external knowledge attacks.

This honesty is part of the product, not a disclaimer to hide.

---

# 65. Product Definition of Done

V1 is complete when:

- all survey items work end-to-end;
- no-direct-identifier response submission works;
- five dimensions calculate correctly;
- Confidence wording is used consistently;
- personal result runs locally;
- classification is exhaustive;
- organization aggregation works;
- `Unsure` rates are visible where relevant;
- privacy suppression includes complement checks;
- only one filter dimension can be active;
- recommendation engine runs deterministically;
- recommendation flood/dedup rules work;
- Q19b risk signal works;
- Opportunity Map uses exact shared Q7/Q26 categories;
- Explore / Standardize logic works;
- Guardrail banner works;
- custom questions work or are explicitly cut before release;
- passcode/session works;
- create/close/duplicate/delete Pulse works;
- response CSV is privacy-limited;
- free-text export is isolated;
- aggregate JSON is privacy-safe;
- synthetic demo exercises real logic;
- self-hosting guide is tested;
- critical automated tests pass;
- no AI API is required.

---

# 66. Portfolio Definition of Done

A reviewer should be able to understand:

1. the real user problem;
2. why the survey is only one discovery input;
3. why Capability was renamed Confidence;
4. why Safety is treated asymmetrically;
5. why one maturity score was rejected;
6. how scoring works;
7. how recommendations are derived;
8. why rules were consolidated;
9. why Opportunity Map categories were aligned by construction;
10. why per-workflow Scale/Enable labels were removed;
11. why exact timestamps were removed;
12. why row-level context export was removed;
13. why stacked filters were cut;
14. why aggregate caching was deliberately not built;
15. why the architecture was simplified to one Worker;
16. what pilot evidence changed later.

These deletions and limitations are part of the engineering story.

---

# 67. Pilot Validation Plan

Do not endlessly debate these before building.

Validate with a real pilot.

## Survey

Measure:

- actual completion time;
- section drop-off;
- Q15 “not sure what these mean” rate;
- confusion around agent/workflow terminology;
- custom-question usage.

## Measurement

Inspect:

- whether Confidence clusters unrealistically high;
- whether Safety clusters unrealistically high;
- whether `Unsure = 0` creates useful or misleading Enablement results;
- whether score distributions have enough spread to be useful;
- whether 0–100 presentation feels more precise than the data deserves.

## Recommendations

Check:

- how many rules fire;
- whether the top three feel distinct;
- whether admins agree the evidence supports the recommendation;
- whether thresholds 40/50/60/70 need revision.

## Opportunity Map

Check:

- whether 20% pain prevalence yields a manageable set;
- whether Explore vs Standardize is actionable;
- whether shared categories are broad enough but not too broad.

## Privacy

Check:

- whether segmentation is useful at 10–30 respondents;
- whether users understand why some segments are suppressed;
- whether free text creates identifiable situations.

## Product value

Most important pilot question:

> Did the Pulse change which workflows or adoption problems the organization chose to investigate next?

---

# 68. Decision Status

## Locked for V1.1 unless implementation reveals a concrete blocker

- product purpose;
- target organization size;
- privacy-first/no-direct-identifier positioning;
- five separate dimensions;
- Confidence instead of Capability;
- Safety as self-reported behaviour/awareness;
- Q4 diagnostic-only;
- Q15 diagnostic/classification-only;
- Q19 only in Enablement;
- Q19b unmanaged-tool diagnostic;
- shared Q7/Q26 Opportunity categories;
- deterministic scoring;
- deterministic recommendations;
- 10 recommendation outcomes;
- Explore / Standardize only per workflow;
- organization-wide Guardrail banner;
- one filter dimension at a time;
- segment + complement >= 5;
- day-level submission date;
- no row-level work-context export;
- separate free-text export;
- >=3 champion signal;
- no aggregate cache;
- single Vite/React + Hono Worker architecture;
- D1;
- public synthetic demo;
- Cloudflare-only V1;
- no LLM dependency.

## Validate rather than redesign now

- exact question weights;
- exact score thresholds;
- 60% valid-weight threshold;
- 20% opportunity pain threshold;
- score-band names;
- n >= 5 usefulness for smaller organizations;
- custom-question usefulness;
- 7–10 minute completion estimate.

---

# 69. Current Next Step

The methodology and architecture review gate is complete.

Next:

1. preserve this V1.1 source of truth;
2. create a tightly scoped **Phase 0 / Phase 1 implementation brief**;
3. initialize the repository;
4. build incrementally;
5. do not ask a coding agent to implement the complete application in one uncontrolled pass.

Suggested first implementation phase should focus on:

- repository/tooling foundation;
- versioned survey schema;
- scoring library;
- classification;
- recommendation rules;
- Opportunity Map logic;
- privacy utilities;
- automated unit tests;

before building the full UI.

---

# 70. Project North Star

> **AI Adoption Pulse Check should help an organization understand self-reported AI use, support gaps, risk signals, and workflow opportunities well enough to decide what deserves deeper discovery next — without collecting unnecessary identity data, overstating what a survey can prove, or hiding the methodology behind AI-generated analysis.**

---

# 71. V1.0 → V1.1 Change Log

The V1.1 review did not change the core product concept. It corrected methodology, privacy, recommendation logic, and implementation complexity before code was written.

## Measurement

- Renamed **Capability** to **Confidence**.
- Explicitly defined Confidence as self-reported, not demonstrated skill.
- Reframed Safety as self-reported safe-use behaviour and awareness.
- Added asymmetric Safety interpretation.
- Removed Q4 from Adoption scoring.
- Simplified Confidence to equal weighting.
- Removed Q15 from Workflow scoring.
- Removed Q19 from Safety.
- Separated Q18 respondent awareness from Q20 organization guidance.
- Simplified weights across scoring dimensions.
- Added `Unsure`-rate reporting.

## Survey

- Rewrote Q12 as a true ordinal workflow ladder.
- Moved “helping coworkers” evidence to Q15.
- Added plain-language examples to Q15.
- Aligned Q7 and Q26 around a shared workflow-category list.
- Added Q19b for independently accessed/unmanaged AI tool usage.
- Kept Q27 free text because it is central to discovery value.

## Recommendations

- Reduced overlapping recommendations to 10 outcomes.
- Merged tool/data/policy clarity into one guidance recommendation.
- Merged access/training/support blockers into one enablement recommendation.
- Made verification a sub-finding of the broader Safety rule when appropriate.
- Added unmanaged-tool reliance as a first-class risk signal.
- Added a root-evidence duplication backstop.

## Opportunity Map

- Removed per-workflow Enable, Scale and Guardrail labels.
- Retained only **Explore** and **Standardize**.
- Added one organization-wide Guardrail banner.
- Made Q7/Q26 comparison exact by sharing categories.

## Privacy

- Replaced perfect-anonymity language with no-direct-identifier / privacy-first language.
- Added complement suppression.
- Removed stacked filters.
- Changed submission timestamps to day-level storage.
- Removed Q1–Q3 from default row-level CSV.
- Split Q27 into a standalone free-text export.
- Removed V1 option to export row-level work-context fields.
- Added a required privacy threat-model document.
- Clarified infrastructure metadata limitations.

## Architecture

- Replaced Next.js + separate API Worker with:
  - Vite
  - React
  - TypeScript
  - Tailwind
  - React Router
  - single Hono Cloudflare Worker
  - D1
- Removed `pulse_aggregates`.
- Removed generic `organization_settings`.
- Changed analysis to compute on read at V1 scale.
- Added Zod as the API validation layer.
- Defined a minimum public-release security floor.

## Scope

The V1.1 review made the product smaller overall.

Removed complexity:

- aggregate caching;
- stacked demographic filters;
- three unsupported opportunity labels;
- overlapping recommendation outcomes;
- generic settings storage;
- unnecessary Next.js/SSR infrastructure;
- duplicate scoring inputs.

Added only controls that materially improve validity or privacy.

