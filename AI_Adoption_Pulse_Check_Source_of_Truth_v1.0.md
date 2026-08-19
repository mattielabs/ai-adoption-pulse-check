# AI Adoption Pulse Check
## V1 Source of Truth Specification

**Status:** Pre-build product and technical specification  
**Version:** 1.0  
**Date:** August 18, 2026  
**Project:** Mattie Labs / Open-source portfolio project  
**Working product name:** AI Adoption Pulse Check

---

# 1. Purpose of This Document

This document is the current source of truth for the **AI Adoption Pulse Check** project.

It captures the agreed product concept, survey design, scoring model, recommendation engine, privacy model, user flows, technical architecture, V1 scope, and implementation constraints before development begins.

Use this document to:

- review the project with another model, engineer, researcher, or advisor;
- challenge assumptions before implementation;
- prevent later models from re-planning the product from scratch;
- create implementation briefs for coding agents;
- preserve product and technical decisions as the project evolves.

## Second-opinion instruction

A reviewer should **not assume the decisions below are correct simply because they are documented**.

Review the project critically for:

- survey validity and bias;
- scoring quality;
- whether any metrics overclaim what the survey can measure;
- privacy and anonymity risks;
- recommendation logic;
- product usefulness to real organizations;
- technical architecture;
- unnecessary complexity;
- missing security controls;
- open-source usability;
- FDE portfolio value;
- whether V1 can be built quickly without creating future dead ends.

Separate feedback into:

1. **Keep**
2. **Change before build**
3. **Defer until after V1**
4. **Risks requiring validation**

Do not expand V1 unless the additional complexity clearly improves the core product.

---

# 2. Product Thesis

AI Adoption Pulse Check is an open-source employee AI adoption discovery tool for organizations of roughly **10–500 employees**.

It is intended to answer:

> **How is AI actually being used across the organization, where are people struggling, what risks exist, and where should the organization focus next?**

The product is not intended to be another generic employee survey or an arbitrary “AI maturity score.”

It should turn employee responses into practical discovery data that can help an organization understand:

- current AI adoption;
- employee capability;
- workflow maturity;
- safe-use practices;
- organizational enablement;
- adoption barriers;
- training needs;
- repetitive work;
- workflow opportunities;
- potential internal champions;
- recommended next actions.

The intended discovery loop is:

```text
Survey
  ↓
Understand current state
  ↓
Identify gaps and barriers
  ↓
Identify workflow opportunities
  ↓
Prioritize action
  ↓
Run deeper discovery / implementation
  ↓
Repeat Pulse later
```

---

# 3. Why This Project Exists

The project has two goals.

## 3.1 Real-world utility

Organizations should be able to use it to run an anonymous AI usage/adoption survey and receive useful, explainable findings.

Potential users include:

- HR / People & Culture;
- operations leaders;
- IT / technology teams;
- AI adoption leads;
- team managers;
- consultants;
- implementation specialists;
- Forward Deployed Engineers;
- small and mid-sized organizations beginning AI adoption.

## 3.2 Portfolio value

The project should demonstrate skills relevant to customer-facing technical implementation and Forward Deployed Engineering:

- discovery methodology;
- requirements definition;
- privacy-aware product design;
- data collection;
- data modelling;
- deterministic scoring;
- recommendation systems;
- workflow opportunity identification;
- backend/API design;
- dashboard design;
- security boundaries;
- testing;
- deployment;
- documentation;
- open-source product design.

The project should be useful **because of the system and methodology**, not because it contains an LLM.

---

# 4. Core Product Principles

## 4.1 Anonymous by default

The survey does not ask for or intentionally collect:

- employee name;
- email address;
- employee ID;
- exact job title;
- IP address for analytics;
- device fingerprint;
- personal account identity.

Broad work context can be collected, but is optional.

## 4.2 Explainable over impressive

Core scoring and recommendations are deterministic.

No LLM is required to:

- score employees;
- calculate organization results;
- classify maturity;
- identify the main recommendation rules;
- produce the Opportunity Map.

## 4.3 No single AI maturity score

The system reports separate dimensions because a person or organization can be strong in one area and weak in another.

For example:

```text
Adoption       72
Capability     61
Workflow       44
Safety         38
Enablement     41
```

This is more useful than “AI maturity: 51/100.”

## 4.4 Discovery, not diagnosis

The survey provides directional evidence and recommended areas to investigate.

It must not imply that a 7–10 minute employee survey constitutes a complete organizational AI audit.

## 4.5 Privacy controls belong on the server

Sensitive segmented data must not be sent to the browser and merely hidden in the UI.

Minimum group-size rules must be enforced before aggregate data is returned.

## 4.6 Organizations own their data

Self-hosted organizations should be able to:

- export anonymous response data;
- export aggregate results;
- delete Pulse data;
- run without sending employee data to Mattie Labs.

## 4.7 Build the smallest useful V1

Do not add enterprise SaaS complexity before the core discovery method proves useful.

---

# 5. V1 Scope

V1 should allow an organization to:

1. configure a self-hosted deployment;
2. secure the admin area with one deployment-level passcode;
3. create a Pulse Check;
4. add up to three optional custom questions;
5. share an anonymous employee survey link;
6. collect complete anonymous responses;
7. give respondents an optional personal AI working snapshot;
8. calculate five organization dimensions;
9. identify barriers, training needs, and workflow opportunities;
10. generate deterministic prioritized recommendations;
11. filter aggregate results when privacy thresholds permit;
12. review unsegmented free-text opportunity responses;
13. export anonymous responses as CSV;
14. export aggregate analysis as JSON;
15. close a Pulse;
16. duplicate a Pulse for a future survey;
17. preserve previous Pulse runs separately;
18. provide a public synthetic demo for GitHub/recruiter review.

---

# 6. Explicitly Out of Scope for V1

Do not add:

- user accounts;
- employee authentication;
- OAuth;
- SSO;
- complex RBAC;
- email invitations;
- HRIS integrations;
- Slack/Teams integrations;
- billing;
- multi-tenant SaaS;
- company benchmarking;
- PDF report generation;
- real-time WebSockets;
- LLM-generated scoring;
- automatic LLM recommendations;
- automatic LLM clustering of free text;
- employee leaderboards;
- coworker comparison;
- longitudinal trend analytics beyond preserving separate Pulse runs;
- complex survey-builder functionality;
- editing the 28 core questions.

---

# 7. Survey Design

## 7.1 Survey length

**28 core questions**

Target completion time:

**7–10 minutes**

Survey sections:

1. About Your Work
2. Current AI Use
3. Confidence & Capability
4. How AI Fits Into Your Workflow
5. Safe & Responsible Use
6. Organizational Support
7. Learning & Development
8. Workflow & Opportunity Discovery

Q1–Q3 are optional work-context questions.

Q27 is optional free text.

---

# 8. Employee Survey Intro

Suggested default copy:

> **AI Adoption Pulse Check**
>
> This anonymous survey helps your organization understand how employees are currently using AI, where people need support, and where AI may be useful in everyday work.
>
> There are no right or wrong answers. You do not need to be an AI user to participate.
>
> Please do not include confidential, personal, customer, or sensitive company information in written responses.
>
> Estimated time: **7–10 minutes.**

Organizations may add a short introductory message, but should not alter the meaning of the privacy statement.

---

# 9. Core Survey Questions

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

**Optional. Not scored.**

---

## Section 2 — Current AI Use

### Q4. How often do you currently use generative AI tools?

Examples may include ChatGPT, Claude, Gemini, Microsoft Copilot or similar tools.

Single select:

- Never
- I have tried them, but rarely use them
- A few times per month
- A few times per week
- Most workdays
- Multiple times per day

**Dimension:** Adoption

### Q5. How often do you use AI specifically for work-related tasks?

Single select:

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

**Diagnostic only. Not scored.**

The tool list may be configurable without changing the core question.

### Q7. What do you currently use AI for at work?

Multi-select:

- Writing or editing
- Emails and communication
- Research or finding information
- Summarizing documents or meetings
- Brainstorming or idea generation
- Planning or organizing work
- Data analysis or spreadsheets
- Creating presentations
- Customer support
- Marketing or content creation
- Coding or technical work
- Creating images, video or audio
- Automating repetitive tasks
- Building workflows, agents or tools
- Decision support / comparing options
- Other
- I do not currently use AI for work

**Dimension:** Adoption  
**Also used for:** Opportunity analysis

---

## Section 3 — Confidence & Capability

For Q8–Q11 use:

- Not confident
- Slightly confident
- Somewhat confident
- Very confident
- Extremely confident
- I have not done this

### Q8. How confident are you giving an AI tool clear instructions for what you want it to do?

**Dimension:** Capability

### Q9. How confident are you adding useful context, examples or constraints when AI's first answer is not good enough?

**Dimension:** Capability

### Q10. How confident are you reviewing an AI response and deciding whether it is accurate and useful?

**Dimension:** Capability

### Q11. How confident are you deciding when AI is—and is not—appropriate for a work task?

**Dimension:** Capability

---

## Section 4 — How AI Fits Into Your Workflow

### Q12. Which statement best describes how you currently use AI at work?

Single select:

- I do not currently use AI for work
- I experiment occasionally when something comes to mind
- I use AI regularly for individual tasks
- I reuse prompts or approaches that work well
- AI is part of one or more repeatable workflows I use
- I have created AI workflows, automations, agents or tools
- I help other people use AI more effectively

**Dimension:** Workflow Maturity

### Q13. How often do you reuse a prompt, template or saved set of instructions rather than starting from scratch?

Single select:

- Never
- Rarely
- Sometimes
- Often
- Almost always
- I do not currently use AI

**Dimension:** Workflow Maturity

### Q14. Have you changed an existing work process because AI made a different approach possible?

Single select:

- No
- Not yet, but I can see opportunities
- Yes, one small process
- Yes, several processes
- Yes, AI is now built into recurring workflows
- Unsure

**Dimension:** Workflow Maturity

### Q15. Have you ever created or helped create any of the following?

Multi-select:

- A reusable prompt/template
- A shared prompt library
- A custom GPT/project/AI workspace
- An automated workflow
- An AI agent
- A tool or application using AI
- Documentation or training for other employees
- None of these
- I am not sure what some of these mean

**Dimension:** Workflow Maturity  
**Also used for:** Champion signal

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

Single select:

- Not confident
- Slightly confident
- Somewhat confident
- Very confident
- Extremely confident
- My organization has not provided guidance
- I am unsure

**Dimension:** Safety  
**Also used for:** Enablement diagnosis

### Q19. Do you know which AI tools your organization has approved for work use?

Single select:

- Yes, clearly
- Mostly
- I have a general idea
- No
- I do not think my organization has defined this
- Unsure

**Dimension:** Safety + Enablement

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

Multi-select:

- Email and communication
- Meetings and meeting follow-up
- Research
- Finding information across documents or systems
- Writing reports
- Creating or updating documents
- Data entry
- Data cleanup or validation
- Spreadsheet work
- Preparing presentations
- Scheduling or coordination
- Customer questions or support
- Reviewing documents
- Creating content
- Planning or project management
- Training or onboarding
- Repetitive system updates
- Technical/coding tasks
- Other
- None of these

**Opportunity signal. Not scored.**

### Q27. If AI could make one part of your work easier, what would you most want help with?

Optional free text.

Helper text:

> Describe the task or problem rather than including sensitive information. For example: “Turning meeting notes into follow-up actions” rather than pasting actual meeting notes.

**Opportunity signal. Not scored.**

### Q28. How interested are you in using AI more in your work if you had the right tools, guidance and support?

Single select:

- Not interested
- Slightly interested
- Moderately interested
- Very interested
- Extremely interested
- Unsure

**Diagnostic:** Interest / Adoption appetite  
**Not a maturity dimension.**

---

# 10. Core Scoring Dimensions

The system calculates five separate scores:

| Dimension | Range | Meaning |
|---|---:|---|
| Adoption | 0–100 | How much AI is actually being used for work |
| Capability | 0–100 | Confidence using and evaluating AI effectively |
| Workflow Maturity | 0–100 | One-off usage versus repeatable AI-assisted processes |
| Safety | 0–100 | Verification, human review and safe-use awareness |
| Enablement | 0–100 | Whether the organization provides access, guidance and training |

Opportunity is **not** scored as a maturity dimension.

---

# 11. Standard Five-Point Mapping

For ordinary five-point scales:

```text
Lowest / Never / Strongly disagree = 0
Low / Rarely / Disagree            = 25
Middle / Sometimes / Neither       = 50
High / Usually / Agree             = 75
Highest / Always / Strongly agree  = 100
```

`Unsure`, `Not applicable`, and equivalent responses must be handled explicitly per question.

They must never silently become 50.

---

# 12. Adoption Score

Weights:

```text
Q4 General AI usage       15%
Q5 Work AI usage          60%
Q7 Breadth of work uses   25%
```

Q4 and Q5 map:

```text
Never                 0
Rare / less monthly   20
Few times/month       40
Few times/week        60
Most workdays         80
Multiple/day         100
```

Q7 breadth:

```text
0 use cases   0
1            25
2–3          50
4–5          75
6+          100
```

“I do not currently use AI for work” = 0.

Formula:

```text
Adoption =
(Q4 × 0.15)
+ (Q5 × 0.60)
+ (Q7 × 0.25)
```

Q6 tool count is not scored.

Using more tools does not imply better adoption.

---

# 13. Capability Score

Weights:

```text
Q8 Clear instructions        25%
Q9 Context/refinement        25%
Q10 Evaluate AI output       30%
Q11 Appropriate-use choice   20%
```

Mapping:

```text
Not confident        0
Slightly             25
Somewhat             50
Very                 75
Extremely           100
```

“I have not done this” = **Not Assessed**, not zero.

Capability is calculated only when at least 60% of intended weighting is valid.

Available valid weights are normalized.

---

# 14. Workflow Maturity Score

Weights:

```text
Q12 Current workflow behaviour   50%
Q13 Prompt/process reuse         20%
Q14 Process redesign             20%
Q15 Highest artifact             10%
```

## Q12

```text
No AI work use                                 0
Occasional experiments                        20
Regular individual tasks                      40
Reuse prompts/approaches                      60
Repeatable workflows                          80
Created workflows/automations/agents/tools   100
Helps others use AI effectively               90
```

## Q13

```text
Never          0
Rarely        25
Sometimes     50
Often         75
Almost always 100
No AI use      0
```

## Q14

```text
No                                  0
See opportunities                  20
One small process                  50
Several processes                  75
AI in recurring workflows         100
Unsure                    Not Assessed
```

## Q15

Use the highest maturity artifact selected, not the number selected.

```text
None                              0
Reusable prompt/template         25
Shared prompt library            40
Custom GPT/project/workspace     50
Automated workflow               75
AI agent                         90
AI application/tool             100
Documentation/training          Champion signal only
```

Formula:

```text
Workflow =
(Q12 × 0.50)
+ (Q13 × 0.20)
+ (Q14 × 0.20)
+ (Q15 × 0.10)
```

---

# 15. Employee Behaviour Classification

The score and classification are related but not identical.

## Level 0 — Non-user

```text
Q5 = Never
AND
Q12 = Does not currently use AI for work
```

## Level 1 — Explorer

Occasional use with no repeatable workflow evidence.

Typical conditions:

```text
Q12 = Occasional experiment
OR
Q5 <= Few times/month
```

## Level 2 — Regular User

Meaningful workplace use, primarily task-by-task.

Typical conditions:

```text
Q12 = Regular individual tasks
AND
Q5 >= Few times/month
```

## Level 3 — Workflow User

Must show repeatable behaviour.

Typical requirement:

```text
Q12 = Reuses prompts/approaches
OR
Q12 = Repeatable workflows
```

plus one corroborating signal:

```text
Q13 >= Often
OR
Q14 >= One changed process
OR
Q15 includes reusable system
```

## Level 4 — Builder / Champion

Requires corroboration.

Either:

```text
Q12 = Created workflows/automations/agents/tools
```

plus Q15 includes:

- automated workflow;
- AI agent;
- AI application/tool;

or:

```text
Q12 = Helps others use AI effectively
```

plus evidence of shared prompts, documentation/training, workflows or reusable systems.

One optimistic answer must not create a Builder/Champion classification.

---

# 16. Safety Score

Weights:

```text
Q16 Verification behaviour       30%
Q17 Human review behaviour       25%
Q18 Sensitive-data awareness     30%
Q19 Approved-tool awareness      15%
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
Not confident          0
Slightly              25
Somewhat              50
Very                  75
Extremely            100
No company guidance    0
Unsure                 0
```

Q19:

```text
Yes, clearly          100
Mostly                 75
General idea           50
No                      0
Organization undefined  0
Unsure                   0
```

The low score records the absence of a safe operating boundary; it is not intended as blame on the employee.

---

# 17. Enablement Score

Weights:

```text
Q19 Approved tool clarity   15%
Q20 AI policy/guidance      35%
Q21 Tool access             20%
Q22 Training/guidance       30%
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

`Unsure = 0` is intentional because an organizational resource employees do not know exists is not effectively enabling them.

---

# 18. Score Bands

For display:

| Score | Band |
|---|---|
| 0–24 | Low |
| 25–49 | Emerging |
| 50–69 | Developing |
| 70–84 | Established |
| 85–100 | Strong |

Numbers should remain primary.

Band names are secondary presentation aids.

---

# 19. Missing-Data Rules

Q1–Q3:

- optional;
- never scored.

Q27:

- optional;
- never scored.

For a scored dimension:

- calculate only when at least **60% of intended weighting** has valid responses;
- normalize the remaining valid weights;
- if insufficient, display **Not enough information to calculate this score**;
- never substitute missing information with zero unless the specific answer semantics intentionally mean zero.

---

# 20. Organization-Level Aggregation

Calculate individual scores first.

Then aggregate respondent scores.

Do not total raw answer values first.

For each dimension show:

- mean;
- median;
- distribution;
- number scored;
- number not assessed.

Example:

```text
Capability: 58 / 100
Median: 61
64 of 72 respondents scored
8 not assessed
```

The primary displayed organization score can be the mean.

Distribution should remain visible because averages can hide polarized populations.

---

# 21. Interest Mapping

Q28 maps:

```text
Not interested         0
Slightly              25
Moderately            50
Very                  75
Extremely            100
Unsure       Not Assessed
```

Call this **Interest**, not a sixth maturity score.

---

# 22. Derived Organization Signals

## Adoption gap

```text
Adoption < 40
Interest >= 70
```

Employees want more AI use but something may be blocking adoption.

## Governance gap

```text
Adoption >= 70
Safety < 50
```

Adoption is running ahead of safe-use practices.

## Enablement gap

```text
Interest >= 70
Enablement < 50
```

Employee appetite exists while organizational support is weak.

## Workflow gap

```text
Adoption >= 60
Workflow < 50
```

Employees use AI frequently but mainly for isolated tasks.

## Capability gap

```text
Adoption >= 60
Capability < 50
```

Usage is meaningful but employee confidence is weak.

## Potential champion signal

```text
Workflow >= 75
Capability >= 70
Safety >= 70
```

plus corroboration from Q12/Q15.

The anonymous survey reports the number of potential champions, never their identities.

---

# 23. Recommendation Engine

The recommendation engine is deterministic, explainable, testable and versioned.

Each recommendation should contain:

```text
Priority
Title
What we found
Why it matters
Recommended action
Evidence
```

---

# 24. Recommendation Thresholds

Internal bands:

```text
VERY LOW      0–24
LOW          25–49
DEVELOPING   50–69
STRONG       70–84
VERY STRONG  85–100
```

Rule helpers:

```text
Gap            < 50
Strong         >= 70
High Use       >= 60
High Interest  >= 70
```

---

# 25. Recommendation Priority Levels

## Priority 1 — Risk / Guardrail

Address before encouraging broader adoption.

## Priority 2 — Adoption Blocker

Employees want or are trying to use AI but support is insufficient.

## Priority 3 — Improvement

Existing AI use could become more consistent or valuable.

## Priority 4 — Opportunity

Areas worth investigating, standardizing or scaling.

---

# 26. Core Recommendation Rules

## R01 — Adoption Is Outpacing Safety

Trigger:

```text
Adoption >= 60
AND Safety < 50
```

Priority: **1**

Title:

**Strengthen safe AI use before expanding adoption**

Suggested actions:

- clarify sensitive-data rules;
- publish approved tools;
- teach verification and human review;
- provide safe/unsafe examples;
- avoid aggressively expanding adoption until core guardrails are understood.

---

## R02 — Approved Tool Guidance Is Unclear

Trigger:

```text
Organization Q19 score < 50
```

Priority: **1**

Title:

**Clarify which AI tools employees may use**

---

## R03 — Data and Privacy Guidance Is Unclear

Trigger:

```text
Q18 organization score < 50
OR
Q20 organization score < 50
```

Priority: **1**

Title:

**Define clear AI data-handling boundaries**

---

## R04 — Verification Practices Are Weak

Trigger:

```text
(Q16 organization score < 50
OR Q17 organization score < 50)
AND Adoption >= 40
```

Priority: **1**

Title:

**Improve AI verification and human-review practices**

---

## R05 — Strong Interest, Weak Organizational Support

Trigger:

```text
Interest >= 70
AND Enablement < 50
```

Priority: **2**

Title:

**Remove organizational barriers to AI adoption**

Use Q19–Q23 to diagnose whether access, policy, training, security uncertainty or use-case clarity is the main issue.

---

## R06 — Tool Access Gap

Trigger:

```text
Q21 < 50
AND Interest >= 60
```

Priority: **2**

Title:

**Review access to appropriate AI tools**

This triggers investigation, not automatic software purchasing.

---

## R07 — Capability Gap

Trigger:

```text
Adoption >= 50
AND Capability < 50
```

Priority: **2**

Title:

**Build practical AI capability**

---

## R08 — Training Support Is Insufficient

Trigger:

```text
Q22 < 50
AND Interest >= 60
```

Priority: **2**

Title:

**Provide practical, role-relevant AI training**

Use Q24/Q25 to personalize topic and delivery recommendations.

---

## R09 — High Usage, Low Workflow Maturity

Trigger:

```text
Adoption >= 60
AND Workflow < 50
```

Priority: **3**

Title:

**Move from one-off AI use to repeatable workflows**

---

## R10 — Capable Users Need Workflow Training

Trigger:

```text
Capability >= 70
AND Workflow < 60
```

Priority: **3**

Title:

**Focus training on workflow design rather than AI basics**

---

## R11 — Low Adoption but High Interest

Trigger:

```text
Adoption < 40
AND Interest >= 70
```

Priority: **2**

Title:

**Investigate why employee interest is not converting into adoption**

---

## R12 — Low Adoption and Low Interest

Trigger:

```text
Adoption < 40
AND Interest < 50
```

Priority: **3**

Title:

**Start with workflow discovery, not an AI rollout**

Low AI adoption is not automatically a problem.

---

## R13 — Potential Internal Champions Exist

Trigger:

At least:

```text
5 respondents
OR 10% of respondents
```

meet:

```text
Workflow >= 75
Capability >= 70
Safety >= 70
```

plus corroboration from Q12/Q15.

Priority: **4**

Title:

**Consider building an internal AI champion group**

The survey must not reveal the identities of potential champions.

---

## R14 — Organization Is Ready to Scale Proven Practices

Trigger:

```text
Adoption >= 70
Workflow >= 70
Safety >= 70
Capability >= 70
```

Priority: **4**

Title:

**Identify proven AI practices that can be shared or scaled**

---

# 27. Recommendation Families

Use families to support deduplication:

```text
SAFETY
POLICY
ENABLEMENT
ACCESS
CAPABILITY
TRAINING
WORKFLOW
DISCOVERY
CHAMPIONS
SCALING
```

Only one primary recommendation from the same family should normally appear.

Related rule evidence can be merged into one recommendation.

---

# 28. Recommendation Ranking

Show a maximum of:

```text
3 Primary Priorities
+
up to 3 Additional Opportunities
```

Ranking order:

1. Priority 1
2. Priority 2
3. Priority 3
4. Priority 4

Within the same priority:

1. larger gap from rule threshold;
2. greater percentage of employees affected;
3. lower rule ID as deterministic tie-breaker.

---

# 29. Recommendation Evidence Requirement

Every recommendation must contain at least one measurable supporting signal.

Prefer:

- dimension score;
- question-level percentage;
- respondent count;
- relevant comparison.

Avoid unsupported generic advice.

---

# 30. Opportunity Engine

Opportunity is not a single score.

For each workflow category, calculate:

- Pain Signal — selected in Q26;
- Current AI Usage — corresponding Q7 usage;
- Interest — Q28 organization interest;
- Training Demand — relevant Q24 selections.

---

# 31. Opportunity Labels

## O01 — Explore

Trigger:

```text
Workflow selected as repetitive by >= 20% of respondents
AND
corresponding AI use < 40% of those reporting the pain
```

Meaning:

Meaningful workflow friction exists with relatively low AI use.

Suggested action:

**Investigate the workflow with employees before choosing a solution.**

## O02 — Enable

Trigger:

High current AI use plus:

```text
Capability < 50
OR Enablement < 50
```

Meaning:

Employees are already trying AI here but capability/support may be limiting results.

## O03 — Standardize

Trigger:

High current AI usage plus:

```text
Workflow < 60
```

Meaning:

Many employees may be solving the same problem individually.

Investigate whether shared prompts, templates, processes or guidance would help.

## O04 — Scale

Trigger:

Strong existing use plus:

```text
Workflow >= 70
Safety >= 70
```

Meaning:

Existing internal practices may be candidates for controlled sharing.

## O05 — Guardrail

Trigger:

Strong usage plus:

```text
Safety < 50
```

Meaning:

Use is established but safe-use practices need attention.

`Guardrail` overrides `Scale`.

---

# 32. Recommendation Confidence Labels

Avoid fake statistical confidence.

Allowed labels:

## Strong Signal

Multiple supporting measures.

## Signal

One clear rule with adequate sample size.

## Early Signal

Only when:

```text
5 <= n < 10
```

Never display invented percentages such as “92% confidence.”

---

# 33. Minimum Sample Rules

Organization recommendations require:

```text
n >= 5 completed surveys
```

For 5–9 responses:

> Early directional results — interpret cautiously.

At 10+ responses:

Normal organization analysis can be shown.

Any segmented result requires:

```text
segment n >= 5
```

---

# 34. Privacy Model

## 34.1 Anonymous by default

Do not intentionally collect:

```text
name
email
employee ID
exact job title
IP address
user agent for identity
device fingerprint
```

## 34.2 Work-context questions

Q1–Q3 are:

- optional;
- broadly categorized;
- used only for aggregate segmentation.

## 34.3 Minimum reporting group

Any requested segment or filter combination must satisfy:

```text
n >= 5
```

Examples:

```text
Finance = 7 → allowed
Finance + Manager = 4 → suppressed
```

The server returns suppression, not the underlying data.

## 34.4 Free-text protection

Q27:

- is never demographic-filterable in V1;
- never displays respondent context beside the response;
- carries a warning that respondents may voluntarily identify themselves;
- is not processed by an LLM in V1.

## 34.5 Duplicate-response protection

Use only soft browser-side prevention:

```text
localStorage:
pulse:{publicId}:submitted = true
```

Do not use:

- IP blocking;
- device fingerprinting;
- invasive browser identifiers.

Copy should explicitly state that this prevents accidental duplicate submissions on that browser but does not guarantee one response per employee.

---

# 35. Employee Personal Result

After successful submission, the employee can optionally receive a local personal result.

Show:

```text
Behaviour classification
Adoption
Capability
Workflow
Safety
Organization support experience
```

Enablement should not be framed as an employee competency.

Maximum recommendations:

```text
1 Primary Focus
+
1 Suggested Next Step
```

Examples:

- Explorer → try one low-risk recurring task;
- Regular User + low Workflow → turn one useful prompt into a reusable template;
- High Adoption + low Safety → focus on verification and safe data handling;
- strong Capability + Safety + Workflow → explore more structured workflows or help document useful practices.

Do not show:

- leaderboard;
- percentile versus coworkers;
- names;
- employee comparison.

Personal scoring should happen locally using the same versioned scoring package.

---

# 36. Admin Product Flow

## First deployment

```text
Welcome
  ↓
Organization Setup
  ↓
Admin Dashboard
```

Organization settings:

- organization name;
- optional logo;
- accent colour;
- optional survey introduction.

Admin passcode is configured as a deployment secret, not entered into ordinary organization settings.

---

# 37. Admin Access

V1 uses one deployment-level admin passcode.

No usernames.

No user accounts.

No password recovery.

Suggested secrets:

```text
ADMIN_PASSCODE_HASH
SESSION_SECRET
```

Successful login creates a:

- Secure;
- HttpOnly;
- SameSite=Strict;
- short-lived session cookie.

Add basic failed-login throttling.

---

# 38. Admin Home

Show:

- organization;
- Create Pulse Check;
- active Pulse;
- previous Pulse runs;
- response counts;
- created/opened/closed dates.

Each Pulse remains independent.

---

# 39. Create Pulse Flow

## Step 1 — Basics

- Pulse name;
- optional description;
- open date;
- optional closing date.

## Step 2 — Survey configuration

28 core questions remain fixed.

Admin may:

- show/hide organization logo;
- enable/disable personal result;
- add up to 3 custom questions.

Custom question types:

- single select;
- multi-select;
- free text.

Custom questions never affect scoring.

## Step 3 — Review

Show:

- survey name;
- estimated time;
- 28 core questions;
- custom questions;
- privacy configuration;
- personal-result setting.

Then create Pulse.

---

# 40. Pulse Management

Suggested route:

```text
/admin/pulses/{pulseId}
```

Tabs:

```text
Overview
Results
Opportunities
Responses
Export
Settings
```

Display:

- status;
- response count;
- survey link;
- copy link;
- close Pulse.

---

# 41. Employee Survey Flow

Suggested route:

```text
/p/{publicPulseId}
```

Landing screen includes:

- organization;
- survey title;
- anonymity notice;
- 7–10 minute estimate;
- sensitive-data warning;
- Start Survey.

Survey is section-based with visible progress.

Answers remain browser-local until submission.

Partially completed surveys should not create partial database responses.

---

# 42. Submission Flow

```text
Browser
  ↓
Validate response
  ↓
Generate local personal result
  ↓
Submit anonymous response
  ↓
Worker validates schema/version
  ↓
D1 stores response
  ↓
Aggregate analysis updated
```

---

# 43. Admin Overview Dashboard

The first screen should answer the main question in roughly 30 seconds.

Order:

1. Pulse status / response count
2. Five dimension scores
3. Top three recommendations
4. Adoption distribution
5. Top barriers
6. Training priorities
7. Opportunity summary

Detailed charts belong deeper in Results.

---

# 44. Results Dashboard

Sections:

## Adoption

- usage frequency;
- work usage;
- tools;
- current use cases;
- maturity distribution.

## Capability

- instruction confidence;
- refinement confidence;
- evaluation confidence;
- appropriate-use confidence.

## Workflow

- task-by-task versus reusable;
- process redesign;
- workflow/tool creation.

## Safety

- verification;
- human review;
- sensitive-data awareness;
- approved-tool awareness.

## Enablement

- policy clarity;
- tool access;
- training;
- barriers.

Filters:

- all respondents;
- department;
- role level;
- work type.

Every filtered result must satisfy the server-enforced anonymity threshold.

---

# 45. Opportunity Dashboard

Example:

| Workflow | Pain Signal | Current AI Use | Status |
|---|---:|---:|---|
| Reporting | 38% | 12% | Explore |
| Email | 35% | 69% | Standardize |
| Research | 31% | 72% | Enable |
| Data validation | 24% | 8% | Explore |
| Meeting follow-up | 21% | 66% | Scale |

Each workflow can open a detail view with:

- respondent count;
- pain percentage;
- current AI usage;
- opportunity label;
- deterministic recommended next action.

---

# 46. Free-Text Opportunity Responses

Q27 appears separately.

No demographic filters.

Warning:

> Written responses may contain identifying information voluntarily provided by employees. These responses are not available through demographic filtering.

V1 allows:

- review;
- export.

No automatic AI analysis.

---

# 47. Exports

## Anonymous Responses CSV

One anonymous response per row.

Do not expose unnecessary calculated personal profiles.

Protect against CSV formula injection.

## Aggregate Results JSON

Include:

```text
pulse metadata
responseCount
dimensionScores
distributions
barriers
trainingPriorities
opportunities
recommendations
surveyVersion
scoringVersion
recommendationEngineVersion
```

---

# 48. Recurring Pulse Checks

Admin can choose:

**Duplicate as New Pulse**

Copy:

- configuration;
- custom questions;
- branding/settings.

Do not copy:

- responses;
- aggregates;
- recommendations.

Historical Pulse runs remain independently accessible.

No trend comparison engine in V1.

---

# 49. Closing and Deleting a Pulse

## Close Pulse

Stops new responses.

Preserves:

- dashboard;
- results;
- exports.

## Delete Pulse Data

Self-hosting organization controls retention.

Permanent deletion should delete the Pulse and associated response data after an explicit confirmation flow.

---

# 50. Branding

Self-hosters can configure:

- company name;
- logo;
- one accent colour.

Retain small attribution such as:

> AI Adoption Pulse Check — open-source project by Mattie Labs

The product itself should remain neutral rather than looking like every organization is using a Mattie Labs-branded survey.

---

# 51. Public Demo

The public project should include:

```text
Explore Sample Organization
Take Sample Survey
View on GitHub
```

The demo organization should use roughly **75 synthetic responses**.

Synthetic responses should live as fixtures rather than mixing with real response storage.

Example:

```text
/demo/sample-responses.json
```

The real scoring and recommendation engine runs against those fixtures.

The demo therefore demonstrates the actual product logic rather than showing static screenshots.

---

# 52. V1 Technical Stack

Current recommended stack:

## Frontend

- Next.js
- TypeScript
- Tailwind CSS

## Backend

- Cloudflare Workers
- Cloudflare D1

## Deployment

- Cloudflare
- self-hostable from GitHub

## Testing

- Vitest
- Playwright

## AI

No AI API required.

---

# 53. High-Level Architecture

```text
Employee Browser
      │
      ├── Survey UI
      ├── Local draft
      └── Local personal result
              │
              ▼
       Public API Worker
              │
              ▼
             D1
              ▲
              │
         Admin API
              ▲
              │
       Admin Dashboard
```

---

# 54. Core Logic Architecture

Keep survey and analysis logic outside React UI components.

Suggested structure:

```text
src/core/

survey/
  questions.ts
  versions.ts
  validation.ts

scoring/
  adoption.ts
  capability.ts
  workflow.ts
  safety.ts
  enablement.ts
  calculateScores.ts

classification/
  maturity.ts

recommendations/
  rules.ts
  ranking.ts
  deduplication.ts

opportunities/
  analyze.ts
  mappings.ts

privacy/
  thresholds.ts
  segmentation.ts
```

The same versioned core logic should be usable:

- server-side;
- in employee personal results;
- against demo fixtures;
- in automated tests.

---

# 55. Proposed D1 Data Model

Keep V1 small.

## organizations

```text
id
name
logo_url
accent_color
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
opens_at
closes_at
personal_results_enabled
created_at
closed_at
```

`public_id` must be an unguessable random identifier.

Do not expose sequential internal IDs in public URLs.

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
submitted_at
survey_version
answers_json
custom_answers_json
```

No identifying columns.

## pulse_aggregates

```text
pulse_id
response_count
aggregate_json
calculated_at
scoring_version
recommendation_version
```

This may be used to avoid recalculating all results every dashboard load.

## organization_settings

```text
organization_id
setting_key
setting_value
updated_at
```

Non-sensitive settings only.

Secrets never go into D1.

---

# 56. Response Representation

Use stable machine-readable IDs.

Example:

```json
{
  "surveyVersion": "1.0.0",
  "answers": {
    "q1": "operations",
    "q2": "individual_contributor",
    "q4": "few_times_week",
    "q5": "few_times_week",
    "q7": ["email", "research", "summarizing"]
  }
}
```

Do not store display copy as the canonical answer value.

This allows wording updates without breaking historical interpretation.

---

# 57. Versioning

Every response and analysis should record:

```text
surveyVersion
scoringVersion
recommendationEngineVersion
```

Initial:

```text
1.0.0
1.0.0
1.0.0
```

A report must remain reproducible using its recorded versions.

---

# 58. Aggregate Pipeline

When a response arrives:

```text
Validate request
  ↓
Confirm Pulse open
  ↓
Validate survey version
  ↓
Validate answer schema
  ↓
Store anonymous response
  ↓
Recalculate/update aggregate
  ↓
Run recommendation engine
  ↓
Store aggregate snapshot
  ↓
Return success
```

Exact aggregate update strategy may be reviewed before implementation.

---

# 59. Proposed API Surface

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

GET /api/admin/pulses/:id/results
GET /api/admin/pulses/:id/opportunities
GET /api/admin/pulses/:id/responses
GET /api/admin/pulses/:id/export
```

Do not create API endpoints without a concrete consumer.

---

# 60. Security Requirements

V1 should explicitly defend against:

- SQL injection;
- malformed submissions;
- oversized free-text input;
- public Pulse ID enumeration;
- unauthorized admin requests;
- admin passcode brute force;
- XSS in organization/custom-question/free-text data;
- CSV formula injection;
- privacy-threshold bypass;
- insecure session handling;
- accidental secret storage or logging.

Use parameterized D1 queries.

Validate all input server-side.

Escape/sanitize user-provided display data appropriately.

---

# 61. Testing Strategy

The repository should have strong deterministic tests because this is part of the portfolio value.

## Scoring tests

Cover:

- every answer mapping;
- weights;
- missing data;
- normalization;
- boundary conditions.

## Recommendation tests

Every rule must cover at minimum:

- exact trigger boundary;
- one point below;
- one point above;
- missing data;
- insufficient sample size;
- conflicting rules;
- deduplication;
- priority ordering.

Example:

```text
Adoption = 60, Safety = 49 → R01 fires
Adoption = 59, Safety = 49 → R01 does not fire
Adoption = 60, Safety = 50 → R01 does not fire
```

## Privacy tests

Critical:

```text
n = 4 → suppressed
n = 5 → allowed
```

Also test stacked filters.

## Survey flow tests

- required questions;
- optional questions;
- schema validation;
- successful submission;
- closed Pulse;
- duplicate browser warning.

## Admin tests

- invalid passcode;
- valid session;
- session protection;
- create Pulse;
- close Pulse;
- duplicate Pulse;
- export;
- privacy-filter enforcement.

---

# 62. Open-Source Repository Direction

Suggested structure:

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
  interpreting-results.md
  running-a-pulse-check.md
  self-hosting.md
  architecture.md

src/
tests/

demo/
  sample-responses.json
```

Current preferred license:

**MIT**

This may be reviewed before public release.

---

# 63. Documentation Standard

The project should explain:

- what the survey measures;
- what it does not measure;
- why each dimension exists;
- exact scoring formulas;
- recommendation rules;
- privacy design;
- minimum sample threshold;
- free-text limitations;
- self-hosting;
- data retention;
- how to interpret results;
- how to use findings for deeper workflow discovery;
- known limitations;
- methodology/version history.

The methodology should be inspectable rather than proprietary “black-box” scoring.

---

# 64. Product Definition of Done

V1 is complete when:

- the 28-question survey works end-to-end;
- anonymous responses can be submitted;
- five dimensions calculate correctly;
- personal results calculate locally;
- behaviour classification works;
- organization aggregation works;
- privacy suppression works server-side;
- recommendation rules run deterministically;
- recommendation deduplication and ranking work;
- Opportunity Map works;
- up to three custom questions work;
- admin passcode/session works;
- Pulse creation works;
- Pulse closing works;
- Pulse duplication works;
- CSV export works;
- aggregate JSON export works;
- free-text opportunity responses are protected correctly;
- synthetic demo data exercises the real engine;
- self-hosting documentation exists;
- automated tests cover critical business/privacy logic;
- no AI API is needed;
- no personal identity information is intentionally collected.

---

# 65. Portfolio Definition of Done

A reviewer should be able to understand:

1. the user problem;
2. the discovery methodology;
3. why one global maturity score was rejected;
4. how the five dimensions are calculated;
5. how deterministic recommendations work;
6. how anonymity is protected;
7. why `n >= 5` is enforced server-side;
8. how opportunity signals are derived;
9. how the backend stores data;
10. how the system is tested;
11. what was deliberately excluded from V1;
12. what could be improved after real-world validation.

The public demo should make the project understandable without requiring installation.

---

# 66. Known Assumptions That Need Validation

The following are current product assumptions rather than established facts.

They should be reviewed before or during pilot use.

## Survey assumptions

- 28 questions can reliably fit into a 7–10 minute experience.
- Employees understand terms such as workflow, agent, automation and AI application.
- Self-reported confidence meaningfully contributes to Capability.
- Current usage frequency is a useful proxy for Adoption.
- The selected weighting of each question is reasonable.

## Scoring assumptions

- 0–100 scores improve interpretation rather than creating false precision.
- The current weights are defensible.
- `Unsure = 0` for some Enablement/Safety questions is the best representation.
- The five score bands are useful and not overly judgmental.
- `60% valid weighting` is the correct minimum for dimension calculation.

## Privacy assumptions

- `n >= 5` is sufficient for the intended small-company context.
- Broad department/role/work-type buckets limit re-identification enough for V1.
- Free-text responses remain useful despite the inability to guarantee anonymity if users self-identify.
- Soft browser duplicate prevention is preferable to identity-based controls.

## Recommendation assumptions

- Thresholds such as 50, 60 and 70 generate useful priorities.
- Deterministic rules can provide sufficiently useful V1 recommendations.
- Recommendation deduplication families are correctly grouped.

## Opportunity assumptions

- Q7 and Q26 categories map cleanly enough to compare current AI use with repetitive-work pain.
- 20% pain prevalence is a useful Explore threshold.
- Opportunity labels are understandable and actionable.

## Technical assumptions

- Cloudflare Workers + D1 are the right balance of simplicity and portfolio value.
- Recalculating or caching aggregates using `pulse_aggregates` is worthwhile at the expected scale.
- One deployment-level passcode is adequate for V1 self-hosting.
- Next.js is the right frontend choice rather than a lighter static/Vite approach.

---

# 67. Questions for the Second-Opinion Reviewer

Review these specifically.

## Product

1. Is this genuinely useful to organizations, or is it still too close to a generic employee survey?
2. Is the product trying to measure anything that cannot reasonably be inferred from self-reported survey data?
3. Are any questions redundant or missing?
4. Is 28 questions the right length?
5. Are the five dimensions the right dimensions?
6. Should Opportunity remain unscored?

## Methodology

7. Are the weights reasonable?
8. Does the scoring introduce false precision?
9. Are any answer mappings problematic?
10. Should Safety and Enablement treat `Unsure` differently?
11. Are the employee maturity classifications defensible?
12. Is there a better way to calculate organization-level results?

## Recommendations

13. Are the recommendation thresholds sensible?
14. Are any recommendation rules likely to produce misleading advice?
15. Are any important combinations missing?
16. Is three primary recommendations the right limit?
17. Are Explore / Enable / Standardize / Scale / Guardrail the right opportunity labels?

## Privacy

18. Is `n >= 5` sufficient?
19. What re-identification risks remain?
20. Should any work-context question be removed or redesigned?
21. Is raw free-text storage acceptable?
22. Is localStorage duplicate prevention the right privacy tradeoff?

## Technical

23. Is Workers + D1 appropriate for a quick, open-source self-hosted product?
24. Is the proposed passcode/session model safe enough?
25. Should aggregate results be cached or calculated on request at this scale?
26. Is the schema too JSON-heavy?
27. Are there deployment or self-hosting problems with the current stack?
28. Are important security controls missing?

## V1 Scope

29. What should be removed before implementation?
30. Is anything missing that is genuinely necessary for V1 usefulness?
31. Which features should clearly remain post-V1?

## Portfolio / FDE Value

32. Does the project demonstrate meaningful discovery and implementation thinking?
33. What engineering decisions would make it stronger evidence without bloating the project?
34. What should the eventual case study emphasize?
35. What would a hiring manager challenge Alex on after seeing this repository?

---

# 68. Decision Status

## Locked for current V1 unless review reveals a material flaw

- product purpose;
- audience: organizations roughly 10–500;
- anonymous by default;
- 28-question core survey;
- five separate scored dimensions;
- Opportunity unscored;
- deterministic scoring;
- deterministic recommendations;
- optional personal result;
- maximum three custom questions;
- core questions not editable in V1;
- repeat Pulse runs;
- self-hosted + public demo;
- organization branding;
- admin passcode instead of accounts;
- server-enforced minimum reporting group;
- no LLM requirement;
- CSV + aggregate JSON export;
- free text unsegmented;
- public synthetic demo;
- open-source release.

## Open to second-opinion challenge

- exact question wording;
- scoring weights;
- scoring thresholds;
- `n >= 5`;
- recommendation thresholds;
- opportunity thresholds;
- score band names;
- maturity classification rules;
- data model details;
- aggregate caching strategy;
- Next.js versus a lighter frontend;
- Workers + D1 deployment architecture;
- MIT license choice.

---

# 69. Current Next Step

Do **not** start broad implementation immediately after this review.

After receiving the second opinion:

1. classify feedback into Keep / Change Before Build / Defer / Validate;
2. resolve any methodology, privacy or architecture issues;
3. update this source of truth to V1.1 if required;
4. then create a tightly scoped **Phase 0 / Phase 1 implementation brief** for the coding model.

The build should proceed incrementally rather than asking an agent to create the complete application in one pass.

---

# 70. Project North Star

> **AI Adoption Pulse Check should help an organization understand how employees are actually using AI, where adoption is blocked or risky, and which workflows deserve deeper investigation—without collecting unnecessary identity data or hiding the methodology behind AI-generated analysis.**
