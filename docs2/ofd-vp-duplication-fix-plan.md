# OFD & Vp Duplication Fix Plan

## Top-Level Overview

The examination input form renders OFD and Vp `TextInput` fields **twice** — once in Row A (alongside BPD, HC, AC, FL) and again in Row B/C (alongside TCD, CM, Nuchal Fold, NB, APAD, TAD, LA, LC). Both occurrences bind to the same `formData.ofd` and `formData.vp` state properties, which write to the same `biometry.ofd` and `biometry.vp` database fields. The fix removes OFD and Vp from Row A only, leaving Row B/C unchanged.

---

## Findings

| Item | Detail |
|---|---|
| File | `frontend/src/components/ExaminationForm.tsx` |
| Row A location | Lines 779–799 — comment "Row A: BPD \| HC \| AC \| FL \| OFD \| Vp" |
| Row B/C location | Lines 879–903 — comment "Row B/C: TCD \| CM \| OFD \| Vp \| Nuchal Fold …" |
| Row A OFD binding | `formData.ofd` (same field as Row B/C) |
| Row A Vp binding | `formData.vp` (same field as Row B/C) |
| Row B/C OFD binding | `formData.ofd` |
| Row B/C Vp binding | `formData.vp` |
| DB field | `biometry.ofd` and `biometry.vp` (written in `buildExaminationPayload`) |
| Validation | Shared `errors.ofd` / `errors.vp` — no Row-A-specific validation |
| State init | Single initialisation at line 82 (`ofd`) and same object for `vp`) |

**Conclusion:** Both duplicates map to the same database fields. Fix is safe to apply.

---

## Sub-Tasks

### Sub-Task 1 — Remove OFD and Vp from Row A in ExaminationForm.tsx

**Intent**  
Delete the two standalone `<TextInput>` elements for `ofd` and `vp` that are currently appended at the end of Row A (the BPD/HC/AC/FL row). Row B/C retains these fields and is left completely unchanged.

**Expected Outcomes**  
- Row A renders only BPD, HC, AC, FL (with their percentile sub-fields).
- Row B/C continues to render TCD, CM, OFD, Vp, Nuchal Fold, NB, APAD, TAD, LA, LC.
- `formData.ofd` and `formData.vp` remain fully functional: read, write, validate, and submit paths are unaffected.
- No duplicate `id="ofd"` or `id="vp"` HTML attributes remain in the DOM.
- No TypeScript errors, no console warnings about duplicate keys or IDs.

**Todo List**  
1. Open `frontend/src/components/ExaminationForm.tsx`.
2. Locate lines 797–798 — the two `<TextInput>` elements with `id="ofd"` and `id="vp"` inside the Row A `<div style={row6}>` block.
3. Delete both lines (the OFD TextInput and the Vp TextInput from Row A).
4. Update the comment on line 779 from `{/* Row A: BPD | HC | AC | FL | OFD | Vp (row6, REQ-08 rule 4) */}` to `{/* Row A: BPD | HC | AC | FL (row6, REQ-08 rule 4) */}` to keep the comment accurate.
5. Confirm the closing `</div>` of Row A (line 799) is still correct — no structural JSX breaks.
6. Verify no other references to `id="ofd"` or `id="vp"` that were in Row A remain.

**Relevant Context**  
- Row A: [`ExaminationForm.tsx` lines 779–799](frontend/src/components/ExaminationForm.tsx)
- Row B/C (unchanged): [`ExaminationForm.tsx` lines 879–903](frontend/src/components/ExaminationForm.tsx)
- State initialisation: lines 82, 157 — `formData.ofd`, `formData.vp`
- Validation: line 372 — `formData.ofd || formData.vp` — unchanged, still references Row B/C values
- DB write: line 380 — `ofd: intOrUndef(formData.ofd)` — unchanged

**Status** `[x] done`

---

## Post-Fix Verification Checklist

- [ ] Row A contains exactly: BPD (+ percentile), HC (+ percentile), AC (+ percentile), FL (+ percentile)
- [ ] Row B/C contains: TCD, CM, OFD, Vp, Nuchal Fold, NB, APAD, TAD, LA, LC
- [ ] No duplicate HTML `id` attributes for `ofd` or `vp` in the rendered DOM
- [ ] TypeScript compilation succeeds with no new errors
- [ ] Form submit still correctly sends `ofd` and `vp` values to the API
- [ ] Form validation for `ofd` and `vp` still fires (via Row B/C inputs)
