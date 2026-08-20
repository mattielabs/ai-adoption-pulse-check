# Threat model

What this product is designed to make harder, what it deliberately does not
attempt, and what it cannot promise. The honesty here is part of the product.
Read [privacy.md](privacy.md) first for what is and is not collected.

The subject is re-identification of a respondent from what the application
exposes. Ordinary application security — authentication, injection, transport —
is covered in [architecture.md](architecture.md#security-posture).

---

## Assets

| Asset | Why it matters |
|---|---|
| An individual's answer set | Reveals what one named person said about their own AI use, confidence, and safety behaviour |
| Q27 written text | Written in a person's own words; the highest-risk field in the survey |
| Q1–Q3 work context | Not sensitive alone; a strong linking key when combined with anything else |
| Small-group aggregates | An aggregate over three people is close to a disclosure |
| The admin passcode | One credential grants the whole administrative surface |

## Adversaries considered

1. **A curious administrator** — legitimate access, wanting to know who said
   what. The main adversary this design is built around.
2. **A manager with prior knowledge** — reads a published segment result and
   already knows a unique circumstance in their team.
3. **An unauthenticated outsider** — has the employee survey link, or found the
   deployment.
4. **A respondent's coworker** — sees a written response and recognises the
   phrasing or the situation.

A malicious self-hoster is explicitly **out of scope**: they own the database.

---

## Designed to reduce

### Direct identifier collection

Nothing is asked, and the schema has nowhere to put it. Verified by inspecting
`migrations/0001_initial_schema.sql` and by tests asserting the exact column set
of an inserted response.

### Small-segment exposure

Nothing is calculated below five responses, and the gate runs **before**
analysis rather than after, so no aggregate for a small group exists in process
memory at all. A test asserts the four-response payload contains no
`dimensions`, `recommendations`, `opportunities` or `mean`.

### Complement inference

A segment of 18 out of 20 also describes the other two. Both sides must reach
five. Tested at each boundary: `n=4` suppressed, `n=5` with complement ≥5
allowed, `n=5` with complement 4 suppressed.

### Suppression that explains itself away

An unavailable segment is a boolean and a phrase, never a count. "Only 3
respondents" would defeat the suppression. A test asserts a suppressed response
carries `status`, `pulse`, `reason` and the availability list, and nothing else.

### Stacked-filter re-identification

"Legal, executives, mostly document work" is a group of one in most
organizations of this size. The UI cannot express a second dimension — changing
the group-by clears the segment — and the server refuses a hand-made two-filter
request with `multiple_segmentation_dimensions`.

### Exact-time correlation

"Submitted at 14:32" plus knowing when somebody had a free half-hour is a
practical attack in a small team. Submission times are stored at day
granularity, and **no date at all** appears in the response export or the
free-text export.

### Submission-order correlation

Insertion order is submission order. The free-text query is `ORDER BY random()`,
export rows are shuffled with a cryptographic source before writing, and the
written-responses screen says so, so nobody reads position as meaning.

### Free-text-to-context linking

The single most valuable re-identification path is a written answer sitting
beside a department. It is closed structurally rather than by policy:

- the analysis query removes Q27 with `json_remove` inside SQLite, so free text
  never enters the memory that builds an aggregate;
- the free-text query selects Q27 and nothing else, and takes no filter
  argument — a filter is not refused so much as inexpressible;
- the two travel in different response types, on different endpoints, in
  different files.

A test runs the whole analysis pipeline with and without Q27 and requires
byte-identical output, which is what makes removing it at the data layer free.

### CSV context leakage

Exports are the easiest way to undo every other control. The response CSV omits
Q1–Q3, Q27, custom free text, every date and every row identifier; the
free-text CSV carries the text and a per-file token. Both refuse below five
responses. Assertions run against the bytes a browser actually downloads, not
against the shaping helpers.

### Spreadsheet formula injection

A respondent can write `=HYPERLINK(...)` into Q27. Cells beginning `=`, `+`,
`-`, `@`, tab or carriage return are prefixed with an apostrophe and quoted.
Tested end to end, through the real download.

### Header and filename injection

Pulse names are administrator-typed free text and reach `Content-Disposition`.
They are reduced to lowercase letters, digits and single hyphens — an allowlist
rather than an escape list — and the route re-asserts the pattern before
setting the header.

### Casual discovery of a survey link

Public Pulse ids carry at least 128 bits of cryptographic randomness. An
invalid id returns the same 404 as an id that never existed, so the endpoint
does not confirm which Pulses are real.

### Public demo reaching real data

The demo endpoints take no path parameter, no query parameter and no body, and
the module behind them holds no database reference. Tests run them against a
binding that throws on any access, and against no binding at all; both return
200.

---

## What this cannot protect against

Stated plainly, because a privacy claim with no stated limits is not credible.

### A respondent identifying themselves in free text

Somebody will write "as the only person handling EU payroll…". The helper text
asks people not to, the warning above the written-responses view says the risk
exists, and the export is separated — but the words are theirs, and nothing can
un-write them.

### A reader who already knows the situation

If exactly one person in a 30-person company runs the invoicing process, a
comment about invoicing identifies them to their manager regardless of what the
application does. Suppression thresholds do not help when the outside knowledge
does the work.

### Very small organizations

At the bottom of the supported range (10 employees), almost every segment is
suppressed and even organization-level results describe a group small enough
that individual answers move the number visibly. The tool still works; the
segmentation does not, and that is the honest expectation to set.

### A self-hoster querying their own database

`wrangler d1 execute` returns every row including Q27. This is not a
vulnerability — it is what owning your infrastructure means. The product's
restraint is about what the **product** hands out.

### A malicious administrator

One passcode, no roles, no per-action audit log. Somebody with the passcode can
read every aggregate and download every export. There is no separation of duties
in V1, and pretending otherwise would be worse than saying so.

### Infrastructure-level logging

Cloudflare processes IP addresses and request metadata to serve traffic, and a
self-hoster may enable additional logging. The application stores none of it and
claims nothing about it.

### Coordinated external knowledge

Someone who combines a published segment result with an org chart, a team
roster and knowledge of who was on leave can narrow an aggregate further than
the thresholds anticipate. The thresholds raise the cost; they do not make it
impossible.

### Response volume as a signal

That a Pulse has 12 responses in a 14-person department is itself information.
V1 shows total response counts to administrators, which is necessary for them to
know whether results are meaningful.

---

## Export-specific risks

1. **A downloaded file leaves the privacy model behind.** Once a CSV is on a
   laptop it can be joined to an HR export by anybody who has both. The product
   limits what is in the file; it cannot limit what the file is combined with.
2. **The row token is per-file.** It is generated at download time and never
   stored, so two free-text exports cannot be aligned — but within one file, row
   count is still a count.
3. **The aggregate JSON is a faithful copy of the dashboard.** That is the
   point, and it means the same reasoning applies: nothing in it is safe to
   publish that the dashboard is not.
4. **Custom questions are the one place an administrator can widen collection.**
   A custom question asking "which team are you on?" would defeat Q1–Q3's
   deliberate breadth. Select-type custom answers appear in the response CSV;
   custom free text does not appear anywhere. The design cannot prevent a badly
   chosen custom question, and [running-a-pulse.md](running-a-pulse.md) says so.

---

## Residual risk, summarised

This product reduces the risk of **casual** and **structural** re-identification
— the kind that happens because a dashboard offered a filter, an export carried
a column, or a file preserved an order. It does not defeat **contextual**
re-identification by somebody who already knows the team, and it makes no
attempt to defend against the person who controls the database.

Organizations at the small end of the range should expect suppression to be the
norm and should read written responses knowing they may recognise the author.
