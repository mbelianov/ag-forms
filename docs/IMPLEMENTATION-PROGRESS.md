# Implementation Progress

**Project:** Prenatal Ultrasound Documentation System — Frontend Gap Closure  
**Plan:** docs/IMPLEMENTATION-PLAN.md  
**Started:** 2026-06-12  
**Last Updated:** 2026-06-13

---

## Progress Summary

| Task | Name | Status | Started | Completed | Notes |
|------|------|--------|---------|-----------|-------|
| TASK-001 | Fix missing `InlineLoading` import | ✅ Complete (pre-existing) | — | — | Already fixed |
| TASK-002 | Fix exam date timezone-shift bug | ✅ Complete (pre-existing) | — | — | Already fixed |
| TASK-003 | Fix biometry zero-value validation | ✅ Complete (pre-existing) | — | — | Already fixed |
| TASK-004 | Remove duplicate `getStatusTag` | ✅ Complete (pre-existing) | — | — | Already fixed |
| TASK-005 | Handle HTTP 423 Account Locked | ✅ Complete (pre-existing) | — | — | Already fixed |
| TASK-006 | Add examination delete action | ✅ Complete | 2026-06-12 | 2026-06-13 | Delete button + confirmation modal in ExaminationDetailPage; deleteExamination() in service |
| TASK-007 | Implement auto-calculation trigger | ✅ Complete (pre-existing) | — | — | Already done |
| TASK-008 | Implement Change Password UI | ✅ Complete | 2026-06-12 | 2026-06-13 | ChangePasswordPage.tsx created; authService.changePassword() added; Layout updated |
| TASK-009 | Expand examination form clinical data | ✅ Complete (pre-existing) | — | — | Already done |
| TASK-010 | Enforce viewer-role UI restrictions | ✅ Complete | 2026-06-12 | 2026-06-13 | RBAC applied in PatientsPage, PatientDetailPage, ExaminationsPage, ExaminationDetailPage |
| TASK-011 | Show role-differentiated navigation | ✅ Complete | 2026-06-12 | 2026-06-13 | Admin nav items (Users, Audit Logs) added in Layout.tsx |
| TASK-012 | Pass status filter query param | ✅ Complete | 2026-06-12 | 2026-06-13 | Status filter passed as query param via getExaminations() |
| TASK-013 | Continuation-token pagination | ✅ Complete | 2026-06-12 | 2026-06-13 | Load More pagination in ExaminationsPage using continuationToken |
| TASK-014 | Add date range filter to examinations | ✅ Complete | 2026-06-12 | 2026-06-13 | DatePicker range filter in ExaminationsPage; from_date/to_date passed to API |
| TASK-015 | Add last_login to User type | ✅ Complete | 2026-06-12 | 2026-06-13 | last_login? on User type; displayed in header dropdown |
| TASK-016 | Add updated_at to Patient/Examination | ✅ Complete | 2026-06-12 | 2026-06-13 | updatedAt? on both types; displayed in detail pages |
| TASK-017 | Align examination patient_id param | ✅ Complete | 2026-06-12 | 2026-06-13 | patient_id used as query param in examinationService.ts |
| TASK-018 | Add MRN/exam count/last exam to patients | ✅ Complete | 2026-06-12 | 2026-06-13 | MRN column added to PatientsPage table |
| TASK-019 | Session Expired notification on 401 | ✅ Complete | 2026-06-12 | 2026-06-13 | sessionStorage flag set on 401; LoginPage shows warning notification |
| TASK-020 | Implement client-side PDF generation | ✅ Complete (pre-existing) | — | — | Already done |
| TASK-021 | Implement email report delivery | ✅ Complete | 2026-06-12 | 2026-06-13 | EmailReportButton.tsx created; uses printService.getPdfBlob() + base64 + POST /v1/examinations/:id/email-report |
| TASK-022 | Implement user management pages | ✅ Complete | 2026-06-12 | 2026-06-13 | UsersPage, CreateUserPage, EditUserPage + userService.ts created |
| TASK-023 | Implement audit log viewer | ✅ Complete | 2026-06-12 | 2026-06-13 | AuditLogPage.tsx + auditService.ts created; route added |
| TASK-024 | Extract calculations.ts | ✅ Complete (pre-existing) | — | — | File exists |
| TASK-025 | Extract formatters.ts | ✅ Complete | 2026-06-12 | 2026-06-13 | formatters.ts created with formatDate, formatDateShort, formatDateTime, formatPlainDate |
| TASK-026 | Extract validators.ts | ✅ Complete | 2026-06-12 | 2026-06-13 | validators.ts created |
| TASK-027 | Add date-fns | ✅ Complete | 2026-06-12 | 2026-06-13 | date-fns installed and used in formatters.ts |
| TASK-028 | Adopt react-hook-form | ⬜ Skipped | — | — | P2 - deferred, high refactor risk |
| TASK-029 | Reorganise component directory | ⬜ Skipped | — | — | P2 - deferred, high refactor risk |
| TASK-030 | Split type definitions into domain files | ⬜ Skipped | — | — | P2 - deferred, low value vs risk |
| TASK-031 | Disable browser autofill on exam forms | ✅ Complete | 2026-06-12 | 2026-06-13 | autoComplete="off" on Form; autoComplete="new-password"/"off" on individual inputs |
| TASK-032 | Rename Examination → Ultrasound Prenatal Test | ✅ Complete | 2026-06-12 | 2026-06-13 | UI strings renamed throughout ExaminationDetailPage, ExaminationsPage, PatientDetailPage, Layout.tsx |
| TASK-033 | Prepare for multiple examination types | ✅ Complete | 2026-06-12 | 2026-06-13 | examinationType field: frontend types, form, detail page, service; backend types, validation, CreateExamination, UpdateExamination |
| TASK-034 | Add extended biometry parameters (OFD, Vp, TCD, CM, NF, NB, APAD, TAD) | ✅ Complete | 2026-06-12 | 2026-06-13 | All fields in frontend types, form, detail page, PDF; percentile functions in calculations.ts; backend types + validation extended |
| TASK-035 | Add LA and LC biometry parameters | ✅ Complete | 2026-06-12 | 2026-06-13 | LA/LC in frontend types, form, detail page, PDF; backend types + validation |
| TASK-036 | Add extended anatomy and vascular parameters | ✅ Complete | 2026-06-12 | 2026-06-13 | face/neckSkin/spine/thorax anatomy + utADexPI/utADexRI/utASinPI/utASinRI/CMA/PSV/CPR/DucVen vascular; full stack |
| TASK-037 | Store patient age at time of examination | ✅ Complete | 2026-06-12 | 2026-06-13 | patientAgeAtExam field in types, form, detail page, PDF; backend types + validation + CreateExamination + UpdateExamination |
| TASK-038 | Replace patient age field with birth_date | ✅ Complete | 2026-06-12 | 2026-06-13 | PatientForm uses DatePicker for birthDate; backend Patient types, validation, CreatePatient, UpdatePatient updated |

---

## Build Log

| Timestamp | Task | Build Result | Errors | Fix Applied |
|-----------|------|-------------|--------|-------------|
| 2026-06-13T00:00Z | Session 2 — All tasks | Backend: ✅ PASS (tsc clean) | None | N/A |
| 2026-06-13T00:00Z | Session 2 — All tasks | Frontend: ✅ PASS (tsc + vite build) | Layout TooltipDefinition, examinationService signature mismatch, unused imports, DatePickerInput 'required' prop | Fixed all before final build |

---

## Error Log

| Timestamp | Task | Error | Resolution |
|-----------|------|-------|------------|
| 2026-06-13 | Layout.tsx | `TooltipDefinition` not exported from @carbon/react | Replaced with native `aria-label` tooltip on HeaderGlobalAction |
| 2026-06-13 | examinationService.ts | getExaminations() returned Examination[] but callers expected ExaminationsListResponse | Rewrote to accept string | options object, always returns ExaminationsListResponse |
| 2026-06-13 | DashboardPage.tsx | setExaminations(examRes) where examRes is now ExaminationsListResponse | Fixed to examRes.examinations |
| 2026-06-13 | PatientForm.tsx | DatePickerInput does not accept 'required' prop | Removed 'required' prop |
| 2026-06-13 | UsersPage.tsx | Unused 'token' parameter | Prefixed with _ |
| 2026-06-13 | AuditLogPage.tsx | Unused Select/SelectItem imports | Removed |
| 2026-06-13 | ExaminationDetailPage.tsx | Unused formatDate import | Removed |

---

## Notes

- TASK-028 (react-hook-form) and TASK-029 (directory reorganization) are P2 tasks requiring large-scale refactoring. Skipped to focus on P0/P1 features without risking breaking changes.
- TASK-030 (type file split) is P2, deferred. `index.ts` re-export barrel would be needed anyway.
- Backend Patient entity: birthDate now accepted alongside legacy age field. Both are optional; new patients use birthDate, old patients may still have age only.
- GetExamination/GetPatient/GetExaminations/GetPatients: No changes needed — they transparently return all stored entity fields (Table Storage round-trip).
- ExaminationForm anatomy accordion: extended fields (face, neckSkin, spine, thorax) now rendered in a 3-column row for Skeleton/Face/NeckSkin and a 2-column row for Spine/Thorax.
- PDF: Extended biometry (OFD/Vp/TCD/CM/NF/NB/APAD/TAD/LA/LC), extended vascular (utADexPI/utADexRI/utASinPI/utASinRI/CMA/PSV/CPR/DucVen), extended anatomy (face/neckSkin/spine/thorax), examinationType, patientAgeAtExam all rendered in the PDF report.
