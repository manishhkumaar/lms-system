# StatusChip

A pill naming the state of a lead, batch, lecture or attendance record; the word always carries the meaning, the colour only reinforces it.

**Consumer provides:** `status`: one of the keys in `StatusChip.statuses` (lead stages `new` … `enrolled`, `follow-up-due`; batch `draft` `upcoming` `ongoing` `full` `completed` `cancelled`; lecture `scheduled` `link-missing` `live` `rescheduled` `ended` `recording-processing` `recording-ready`; attendance `joined` `present` `unverified` `absent`). Or a free `tone` (`neutral` `info` `success` `warning` `danger`) with `children`.

- `live` gets a pulsing `danger` dot (still under `prefers-reduced-motion`).
- **Joined is not attendance.** `joined` means the student clicked Join; only `present` (verified by the meeting provider or confirmed by Operations) counts towards attendance reports. Show `unverified` until one of those happens.
- Never invent a new colour for a status; map it to one of the five tones.
