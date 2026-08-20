# Interpreting results

How to read a Pulse without over-reading it. The formulas are in
[methodology.md](methodology.md); this is about what the numbers support and
what they do not.

---

## Start with the shape, not the scores

Open the overview and read the five dimensions **together**. The product refuses
to produce a single maturity score because the interesting information is in the
gaps between them:

| Pattern | What it usually means |
|---|---|
| Adoption high, Safety low | People are using AI faster than guidance arrived. Guardrails first |
| Adoption high, Workflow low | Real use, still task-by-task. Standardisation, not more tools |
| Interest high, Enablement low | Willingness is not the blocker. Access, clarity or training is |
| Adoption low, Interest low | Do not buy tools. Find the operational pain first |
| Confidence high, Adoption low | People believe they could, and are not. Ask why |

An average of those five would hide every one of them.

---

## Read the caveats as part of the number

**Confidence is self-reported.** Nothing was tested. Four questions ask how
confident somebody feels; a high score means people feel capable, which is
useful and is not evidence of capability. It was called "Capability" in an early
draft and renamed for exactly this reason.

**Safety is asymmetric.** A low Safety score is a meaningful warning signal — it
is unlikely that people under-report cautious behaviour. A high Safety score is
**not** proof that behaviour is safe, because the same self-report bias runs the
other way. Act on a low score. Do not relax on a high one.

**Enablement describes the organization, not the employee.** It is what
employees experienced of clarity, access and training. A low score is feedback
about the organization.

**"Unsure" counts as 0 in Enablement and Q18.** That is deliberate: a policy
employees do not know about is not enabling them. The relevant Unsure rate is
always shown beside the score, so you can tell "we have no policy" from "we have
one nobody found". Those need different responses.

---

## Sample size changes what the numbers mean

| Responses | How to read it |
|---|---|
| Under 5 | Nothing is calculated. Not hidden — not computed |
| 5–9 | Early directional. Look at the direction, not the value |
| 10–29 | Usable. Treat small differences between dimensions as noise |
| 30+ | The numbers are worth comparing to each other |

Below 30 the dashboard carries "treat small score differences cautiously". A
three-point gap between two dimensions in a 20-person sample is not a finding.

Also check **coverage**: each dimension shows how many respondents were scored
and how many could not be assessed. A dimension scored for 30 of 70 respondents
describes those 30.

---

## Recommendations

At most three primary priorities and three additional signals, from ten fixed
rules. Each card shows:

- **What we found** — only the conditions that actually fired, each with the
  measured value beside the threshold it was compared against;
- **Why it matters** — a fixed explanation for that rule, not generated text;
- **Recommended action** — the discovery step, not a purchase;
- **Evidence** — the measurements behind it.

Two things follow. First, you can check the reasoning: if a card says Safety
47.9 is below 50, that is the whole argument. Second, a recommendation that is
wrong for your organization is wrong because the rule's assumption does not hold
for you — which is a conversation about your context, not a mystery.

**Merged findings.** Where two rules describe the same underlying problem, the
sub-finding appears inside the card that absorbed it rather than as a second
near-identical card. An early draft fired ten overlapping recommendations, which
is how a report becomes unreadable.

**Confidence labels** are Strong Signal, Signal and Early Signal — how many
independent measures support the finding, and whether the sample is small. They
are never statistical confidence percentages, because nothing here computes one.

---

## The Opportunity Map

Two labels only.

**Explore** — at least 20% of respondents report this workflow as
time-consuming or repetitive, and fewer than 40% of *those specific people* use
AI for it. Friction exists and AI has not reached it.

**Standardize** — the same pain rate, but 40% or more of the pain group already
use AI there. People are improvising in a workflow they still find repetitive;
shared prompts, templates or process guidance may be worth more than a new tool.

The denominator is the point. "AI use among the pain group" is measured among
respondents who reported *that* workflow as painful, not across the whole
organization. That makes the comparison exact by construction rather than a
judgement about which use case resembles which pain point.

**An opportunity is a prompt to investigate, not a conclusion.** It establishes
no automation feasibility, no time saving, and no return on investment. The
survey cannot see how complex the workflow is, what systems it touches, or what
would break. The recommended next step is always to talk to the people who do
the work.

**Guardrail** is one organization-wide banner when Safety is below 50, never a
per-workflow label. Enable and Scale do not exist — they were removed because
survey evidence cannot support per-workflow readiness claims.

---

## Classifications

Five ordered levels from Non-user to Builder/Champion, evaluated top-down with
the first valid match winning. Contradictory answers fall to the more
conservative level rather than becoming unclassified.

Read the **distribution**, not the labels. A long tail of Explorers with few
Regular Users says something different from a bimodal split of Non-users and
Workflow Users.

The champion signal is organization-level and shows a display string ("5
potential champions", or "3+" below five). There is no list, and there never
will be — see [privacy.md](privacy.md).

---

## Written responses

Q27 is the highest-value and highest-risk field in the survey. It is shown on
its own screen with no context, in random order, and it is never segmentable.

Read them as a set. A theme appearing in six answers is worth acting on; a
single vivid comment is one person's experience, which matters but is not a
measurement. And read them knowing that somebody may have described themselves
recognisably without meaning to — that is a reason to handle the file carefully,
not a reason to skip the field.

---

## Segments

One dimension at a time, and only where the group **and everyone outside it**
both reach five people. Selecting a segment re-runs the whole analysis over that
group, so every number on the page reflects it.

Suppression is common in small organizations and is not a defect. If most
departments are suppressed, the honest reading is that your organization is too
small for departmental analysis — not that the tool is broken.

Comparing a segment to the whole organization is legitimate. Comparing two
segments to each other is where people start over-reading: with 12 and 15
respondents, a six-point difference is noise.

---

## What a Pulse cannot tell you

- Whether employees are actually good at using AI.
- Whether your AI use is actually safe or compliant.
- Whether a workflow can be automated, or what it would cost.
- Whether AI has saved anybody time.
- What any individual said.

It tells you what employees report about their own use, what support they say
they have, where they feel friction, and where those things disagree with each
other. That is enough to decide what deserves a real conversation next — which
is the whole ambition.

---

## A reasonable first session

1. Read the five dimensions together and note the largest gap.
2. Read the three primary recommendations and check the evidence behind each.
3. Look at the classification distribution — is this an organization of
   non-users, of task-by-task users, or of people already building?
4. Look at the top three barriers and the top three training requests. They
   usually explain the Enablement score.
5. Open the Opportunity Map. Pick one or two Explore or Standardize categories.
6. Read the written responses for the workflows you picked.
7. Decide who to interview. That is the output — the survey was the input.
