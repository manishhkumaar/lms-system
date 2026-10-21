# Button

Triggers an action. Four variants: `primary` (one per view: the main action), `secondary` (supporting actions), `ghost` (toolbar and icon-only actions), `danger` (cancel lecture, remove student, reject lead).

**Consumer provides:** `children` (a verb-first label), optional `variant`, `icon`/`iconRight` (an `Icon` name), `touch` (44px height for the student portal), `block` (full width), and any native button props (`onClick`, `disabled`, `aria-label`).

- Labels are sentence case and start with a verb: "Schedule lecture", "Publish link", "Enrol student". Never "Submit" or "OK".
- An icon-only button must carry `aria-label`.
- Use `touch` + `block` for the student's Join and Watch buttons on mobile.
- A disabled button says why in its label or right beside it ("Join opens at 6:30 PM IST"), never silently greyed out.
- Destructive actions use `danger` and always go through a `Dialog` confirmation.
