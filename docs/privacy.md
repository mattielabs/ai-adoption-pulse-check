# Privacy model

## The claim, exactly

> **The survey collects no direct employee identifiers and suppresses
> small-group reporting.**

That is the whole claim. The project does **not** say "anonymous", "fully
anonymous", or "your answers cannot be traced to you", because none of those
would be true. A person can describe their own situation in a written answer,
and a manager who already knows a unique circumstance can recognise it in an
aggregate. Those limits are documented rather than hidden — see
[threat-model.md](threat-model.md).

---

## What is never collected

The application does not ask for, and the schema has nowhere to put:

- name;
- email address;
- employee ID or payroll number;
- account identity, login, or SSO subject;
- exact job title;
- device fingerprint;
- the respondent's IP address as application data.

`migrations/0001_initial_schema.sql` is the primary evidence: the `responses`
table has five columns — `id`, `pulse_id`, `submitted_on`, `survey_version`,
`answers_json`, `custom_answers_json` — and none of them is an identifier.

Cloudflare, like any infrastructure provider, still processes ordinary network
metadata to serve a request. The application neither reads nor stores it. See
[threat-model.md](threat-model.md#what-this-cannot-protect-against).

---

## What is collected

| Data | Why | Constraints |
|---|---|---|
| Answers to Q1–Q28 and Q19b | The analysis | Q1–Q3 optional; Q27 optional |
| A day-level submission date | Ordering Pulses, nothing else | `YYYY-MM-DD`. No time component is stored at any point |
| The survey version | Historical results stay interpretable | Never mixed across versions |
| Up to three custom answers | Organization-specific context | Never scored |

**Q1–Q3 (department, role level, work type)** are optional, deliberately broad,
and used only for aggregate grouping. Every one of them offers "Prefer not to
say".

**Q27 (the written opportunity answer)** is optional, capped at 1,000
characters, and carries helper text asking respondents to describe the task
rather than paste sensitive content.

---

## The controls, and where they live

Every one of these is enforced **on the server**, before data leaves it. None
is a client-side hiding of something that arrived anyway.

### Minimum reporting group

Nothing is calculated below **5 responses**. Not calculated and then hidden —
the gate runs before analysis, so at four responses no aggregate exists in
memory to leak. Between 5 and 9, results are shown with an early-directional
caution.

### Complement suppression

A segment is reportable only when the segment **and everyone outside it** both
reach 5. "Managers: 18 of 20" also describes the two people who are not
managers, so it is refused. A suppressed segment returns no aggregate at all —
not a partial one, not a zeroed one.

### One filter dimension at a time

Department, role level or work type — never two. Stacked filters produce groups
small enough to identify people. The control cannot express a second dimension,
and the server refuses a hand-made request that names two.

### Availability is a boolean

An unavailable segment is labelled "not enough responses to report safely" and
never explained with a count. "Only 3 respondents" would undo the suppression it
is explaining.

### Free text is never joined to anything

Q27 has its own endpoint, its own SQL query, its own type, and its own export
file. The analysis query removes it with `json_remove` before the row leaves
SQLite; the free-text query returns the text and nothing else, in random order.
There is no query anywhere in the codebase that returns a written answer beside
anything it could be linked to.

### Duplicate handling is browser-local only

A `localStorage` marker prevents accidental double submission on the same
browser. No IP blocking, no fingerprinting. The copy says outright that it does
not identify anyone and does not guarantee one response per employee.

---

## Exports are intentionally limited

| File | Contains | Excludes |
|---|---|---|
| Response CSV | Q4–Q26, Q28, Q19b, the survey version, custom **select** answers | Q1–Q3, Q27, custom free text, every date, every row identifier |
| Written responses CSV | Q27 text, a per-file row token | Everything else |
| Aggregate JSON | The organization-level analysis and version stamps | Response rows, free text, per-person scores, suppressed-group counts |

Rows are shuffled before export, so file order carries no submission-order
signal. Cells beginning `=`, `+`, `-` or `@` are guarded against spreadsheet
formula injection.

**V1 offers no row-level export of Q1–Q3, and no opt-in to add it.** A
self-hoster with database access technically controls their own infrastructure,
but the product itself should not hand out a convenient re-identification path.
See [methodology.md](methodology.md#export-restrictions).

Every export requires an admin session and refuses below the reporting
threshold — a download must not become the one place four responses are
readable.

---

## What administrators can and cannot see

**Can:** organization-level scores, distributions, classifications, barriers,
training demand, the Opportunity Map, privacy-safe segment aggregates, and the
written responses with no context attached.

**Cannot:** a respondent list, a per-person score, a per-person classification,
a click-through from any figure to a person, a written answer beside the
department it came from, or a group small enough to identify someone.

There is no respondent browser. An aggregate discovery product with a
row-by-row viewer would contradict the model it is built on.

---

## Employee-facing copy

The survey intro states, before anybody answers anything:

> This survey does not ask for your name, email, employee ID, or account
> information. Results are only shown for groups that meet the minimum
> reporting threshold.

and

> Please do not include confidential, personal, customer, or sensitive company
> information in written responses.

---

## For self-hosters

You are the data controller. The application's controls constrain what the
**product** exposes; they do not constrain you, and they cannot. You can query
your own D1 database directly, and the schema is documented so you know exactly
what is in it.

Practical suggestions:

- decide a retention period and delete old Pulses; deletion removes their
  responses;
- keep the passcode as tightly held as any production credential;
- tell employees honestly what the tool does and does not collect — the claim
  above is short enough to quote;
- if your organization is small enough that a department has fewer than about
  ten people, expect most segments to be suppressed, and say so in advance
  rather than fielding the question afterwards.
