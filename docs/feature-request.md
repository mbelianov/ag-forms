# Feature Requests

---

## FR-01 — Left-Align the Patient Table Title

**Page:** `PatientsPage`
**Status:** Done

### Description

The title of the Patient List table (`TableContainer` title) should be left-aligned.

### Implementation Notes

- Add `style={{ textAlign: 'left' }}` to the `<TableContainer>` component in
  [`frontend/src/pages/PatientsPage.tsx`](../frontend/src/pages/PatientsPage.tsx).
- No other files or components are affected.

---

## FR-02 — Merge Record Count into the Patient Table Title

**Page:** `PatientsPage`
**Status:** Done

### Description

The "X patients loaded / X patients found" count currently rendered as the `description` prop of
`TableContainer` should be moved inline with the title, formatted as a lighter suffix:

> **Patient List** <span style="font-size:0.75rem; font-weight:normal; color:#525252">50 patients loaded</span>

- The word(s) **Patient List** remain bold at the current title font size.
- The suffix `<N> patients loaded` (or `<N> patients found` when a search is active) is displayed
  immediately after, separated by a space, at **0.75 rem**, no bold, muted colour (`#525252`).
- The `description` prop of `TableContainer` is removed once the suffix is embedded in the title.

### Behaviour

| State | Suffix text |
|-------|------------|
| Default (no search submitted) | `N patients loaded` |
| Search active (results returned) | `N patients found` |

### Implementation Notes

- Carbon's `title` and `description` props on `TableContainer` only accept plain strings and
  cannot contain mixed formatting. Therefore:
  - **Remove** the `title` and `description` props from `<TableContainer>`.
  - **Inject a custom JSX header** as a direct child of `<TableContainer>`, placed before
    `<Table>`:
    ```tsx
    <TableContainer {...getTableContainerProps()}>
      <div style={{ padding: '1rem 1rem 0.5rem', textAlign: 'left' }}>
        <span style={{ fontWeight: 700, fontSize: '1rem' }}>Patient List</span>
        <span style={{ fontWeight: 400, fontSize: '0.75rem', marginLeft: '0.5rem', color: '#525252' }}>
          {totalItems} patient{totalItems !== 1 ? 's' : ''} {isSearchActive ? 'found' : 'loaded'}
        </span>
      </div>
      <Table ...>
    ```
- The existing `isSearchActive` state (introduced in T4-02) drives the `loaded` / `found` wording
  — no new state is required.
- Only [`frontend/src/pages/PatientsPage.tsx`](../frontend/src/pages/PatientsPage.tsx) is affected.

---

## FR-03 — Prevent Layout Shift When "Showing Search Results" Banner Appears

**Page:** `PatientsPage`  
**Status:** Done

### Description

When a search is submitted the `ActionableNotification` banner ("Showing search results for …")
is inserted into the document flow above the table, pushing the table downward. When the search
is cleared the banner disappears and the table jumps back up. This causes a disruptive visual
shift.

### Chosen Approach — Option A: Reserve the space always

Wrap the `ActionableNotification` in a fixed-height container that is **always rendered**,
regardless of whether a search is active. The container is empty when no search is active but
still occupies the same height, so the table position on screen never changes.

```tsx
{/* Fixed-height slot — always present so the table never shifts */}
<div style={{ height: '40px', marginBottom: '1rem' }}>
  {isSearchActive && (
    <ActionableNotification ... />
  )}
</div>
```

### Trade-offs

| Pro | Con |
|-----|-----|
| Single-line wrapper — minimal code change | Permanent ~40 px blank gap above table when no search is active |
| Zero layout complexity | |
| Table position is 100 % stable | |

### Implementation Notes

- Wrap the existing `{isSearchActive && <ActionableNotification ... />}` block in
  [`frontend/src/pages/PatientsPage.tsx`](../frontend/src/pages/PatientsPage.tsx) with
  `<div style={{ height: '40px', marginBottom: '1rem' }}>`.
- Remove the `style={{ marginBottom: '1rem' }}` prop from `ActionableNotification` itself
  (the wrapper div now owns the bottom margin).
- No other files are affected.

---
