# AG Forms UI Development Plan

## Overview

This document outlines a high-level plan for developing the remaining UI components for the AG Forms prenatal ultrasound documentation system. The plan is organized into independent development buckets, each designed to be completed within 1 hour.

## Current State

### ✅ Completed Components
- **Authentication**: Login page with form validation
- **Layout**: Header with navigation and user menu
- **Routing**: Protected routes and navigation structure
- **Context**: AuthContext for authentication state management
- **Services**: API integration layer (auth, patient, examination services)
- **Dashboard**: Placeholder dashboard with basic tiles

### 📋 Existing Pages (Placeholder/Incomplete)
- PatientsPage
- CreatePatientPage
- PatientDetailPage
- EditPatientPage
- ExaminationsPage
- CreateExaminationPage
- ExaminationDetailPage
- EditExaminationPage

---

## Development Buckets

Each bucket is designed for **independent development** and can be completed in **≤1 hour**.

---

## 🎯 Bucket 1: Patient List & Search (1 hour)

### Objective
Implement the patient list page with search and filtering capabilities.

### Components to Develop
1. **PatientsPage.tsx** - Main patient list view
   - Data table with Carbon DataTable component
   - Search input with real-time filtering
   - Pagination controls
   - "Create New Patient" button
   - Patient cards showing: Name, Age, Phone
   - Click to view details navigation

### API Integration
- `GET /api/v1/patients` - Fetch patient list
- `GET /api/v1/patients/search?query={name}` - Search patients

### Acceptance Criteria
- [ ] Display list of all patients in a data table
- [ ] Search functionality filters by patient name
- [ ] Pagination works correctly (if >10 patients)
- [ ] Click on patient navigates to detail page
- [ ] "Create New Patient" button navigates to create page
- [ ] Loading states displayed during API calls
- [ ] Error handling with user-friendly messages

### Dependencies
- ✅ patientService.ts (already exists)
- ✅ Patient types (already defined)
- ✅ Carbon DataTable components

---

## 🎯 Bucket 2: Patient Create & Edit Forms (1 hour)

### Objective
Implement patient creation and editing functionality with validation.

### Components to Develop
1. **CreatePatientPage.tsx** - New patient form
2. **EditPatientPage.tsx** - Edit existing patient
3. **PatientForm.tsx** (shared component) - Reusable form component

### Form Fields
- Name (required, text)
- Age (required, number, 2-99)
- Phone (required, text with validation)
- Email (optional, email validation)
- Address (optional, textarea)

### Validation Rules
- Age: 2-99 years (non-standard range)
- Phone: Valid phone format
- Email: Valid email format (if provided)
- Name: Required, non-empty

### API Integration
- `POST /api/v1/patients` - Create patient
- `PUT /api/v1/patients/{id}` - Update patient
- `GET /api/v1/patients/{id}` - Fetch patient for editing

### Acceptance Criteria
- [ ] Create form validates all fields before submission
- [ ] Edit form pre-populates with existing patient data
- [ ] Success notification on create/update
- [ ] Error handling with field-specific validation messages
- [ ] ETag handling for concurrent update prevention
- [ ] Navigate to patient detail page after successful create/update

### Dependencies
- ✅ patientService.ts
- ✅ Carbon Form components
- ✅ Validation utilities

---

## 🎯 Bucket 3: Patient Detail View (1 hour)

### Objective
Display comprehensive patient information and associated examinations.

### Components to Develop
1. **PatientDetailPage.tsx** - Patient information display
   - Patient info card (name, age, contact details)
   - List of examinations for this patient
   - Action buttons (Edit Patient, Create Examination)

### Display Sections
1. **Patient Information**
   - Name, Age, Phone, Email, Address
   - Created date
   - **Note:** MRN is examination-level; it is displayed on Examination Detail, not on Patient Detail

2. **Examinations List**
   - Table/cards showing recent examinations
   - Columns: Date, Gestational Age, Status
   - Click to view examination details
   - Empty state if no examinations

### API Integration
- `GET /api/v1/patients/{id}` - Fetch patient details
- `GET /api/v1/examinations?patientId={id}` - Fetch patient examinations

### Acceptance Criteria
- [ ] Display all patient information clearly
- [ ] List examinations sorted by date (newest first)
- [ ] "Edit Patient" button navigates to edit page
- [ ] "Create Examination" button navigates to create examination page
- [ ] Click on examination navigates to examination detail
- [ ] Empty state message if no examinations
- [ ] Loading states for data fetching
- [ ] Error handling

### Dependencies
- ✅ patientService.ts
- ✅ examinationService.ts
- ✅ Carbon Tile and DataTable components

---

## 🎯 Bucket 4: Examination List View (1 hour)

### Objective
Display all examinations across all patients with filtering.

### Components to Develop
1. **ExaminationsPage.tsx** - All examinations list
   - Data table with examinations
   - Filter by status (draft/completed/reviewed)
   - Filter by date range
   - Search by patient name
   - Status badges with color coding

### Display Columns
- Patient Name (clickable to patient detail)
- Exam Date
- Gestational Age
- Status (badge)
- Actions (View Details)

### API Integration
- `GET /api/v1/examinations` - Fetch all examinations

### Acceptance Criteria
- [ ] Display all examinations in data table
- [ ] Status badges color-coded (draft=gray, completed=green, reviewed=blue)
- [ ] Filter by status works correctly
- [ ] Search by patient name filters results
- [ ] Click on patient name navigates to patient detail
- [ ] Click "View Details" navigates to examination detail
- [ ] Pagination if >10 examinations
- [ ] Loading and error states

### Dependencies
- ✅ examinationService.ts
- ✅ Carbon DataTable and Tag components

---

## 🎯 Bucket 5: Examination Create Form (1 hour)

### Objective
Implement examination creation with complex validation rules.

### Components to Develop
1. **CreateExaminationPage.tsx** - New examination form
2. **ExaminationForm.tsx** (shared component) - Reusable form

### Form Sections
1. **Basic Information**
   - Patient selection (dropdown or from patient detail page)
   - Exam Date (date picker, cannot be future)
   - Gestational Age (text, format: "28w 3d")
   - Status (dropdown: draft/completed/reviewed)

2. **Biometry Measurements** (all integers)
   - BPD (0-200 mm)
   - HC (0-500 mm)
   - AC (0-500 mm)
   - FL (0-100 mm)
   - EFW (0-10000 g)

3. **Doppler Measurements** (floats allowed)
   - PI (0-10)
   - RI (0-1)
   - Vessel (text)

4. **Clinical Notes**
   - Notes (textarea)
   - Findings (textarea)

### Critical Validation Rules
- **Biometry**: MUST be integers (no decimals)
- **Doppler**: Floats allowed
- **Gestational Age**: Format "XXw Xd" (regex: `^\d{1,2}w\s?\d{1}d$`)
- **Exam Date**: Cannot be in future

### API Integration
- `POST /api/v1/examinations` - Create examination
- `GET /api/v1/patients` - For patient selection dropdown

### Acceptance Criteria
- [ ] All validation rules enforced client-side
- [ ] Biometry fields reject decimal values
- [ ] Doppler fields accept decimal values
- [ ] Gestational age format validated
- [ ] Future dates rejected for exam date
- [ ] Success notification on creation
- [ ] Navigate to examination detail after creation
- [ ] Field-specific error messages
- [ ] Form can be pre-filled with patientId from URL params

### Dependencies
- ✅ examinationService.ts
- ✅ Carbon Form components (DatePicker, NumberInput, TextArea)
- ✅ Validation utilities

---

## 🎯 Bucket 6: Examination Edit Form (1 hour)

### Objective
Implement examination editing with same validation as create.

### Components to Develop
1. **EditExaminationPage.tsx** - Edit examination form
   - Reuses ExaminationForm.tsx component
   - Pre-populates with existing data
   - ETag handling for concurrent updates

### API Integration
- `GET /api/v1/examinations/{id}` - Fetch examination for editing
- `PUT /api/v1/examinations/{id}` - Update examination

### Acceptance Criteria
- [ ] Form pre-populated with existing examination data
- [ ] All validation rules from create form apply
- [ ] ETag handling prevents concurrent update conflicts
- [ ] Success notification on update
- [ ] Navigate to examination detail after update
- [ ] Error message if examination modified by another user
- [ ] Cannot change patient (field disabled)

### Dependencies
- ✅ ExaminationForm.tsx (from Bucket 5)
- ✅ examinationService.ts

---

## 🎯 Bucket 7: Examination Detail View (1 hour)

### Objective
Display comprehensive examination information with formatted data.

### Components to Develop
1. **ExaminationDetailPage.tsx** - Examination display
   - Patient information header
   - Examination metadata
   - Biometry measurements table
   - Doppler measurements table
   - Clinical notes display
   - Action buttons

### Display Sections
1. **Patient Header**
   - Patient name (clickable to patient detail)
   - MRN
   - Link back to patient

2. **Examination Metadata**
   - Exam Date (formatted)
   - Gestational Age
   - Status (badge)
   - Created by, Created at

3. **Measurements Tables**
   - Biometry table (BPD, HC, AC, FL, EFW with units)
   - Doppler table (PI, RI, Vessel)
   - Empty state if no measurements

4. **Clinical Information**
   - Notes section
   - Findings section

5. **Actions**
   - Edit Examination button
   - Back to Patient button

### API Integration
- `GET /api/v1/examinations/{id}` - Fetch examination details

### Acceptance Criteria
- [ ] All examination data displayed clearly
- [ ] Biometry values shown as integers with units (mm, g)
- [ ] Doppler values shown with decimals
- [ ] Status badge color-coded
- [ ] Patient name links to patient detail
- [ ] "Edit Examination" navigates to edit page
- [ ] "Back to Patient" navigates to patient detail
- [ ] Empty states for missing measurements
- [ ] Loading and error states

### Dependencies
- ✅ examinationService.ts
- ✅ Carbon Tile and DataTable components

---

## 🎯 Bucket 8: Dashboard with Real Data (1 hour)

### Objective
Replace placeholder dashboard with real statistics and recent activity.

### Components to Develop
1. **DashboardPage.tsx** - Enhanced dashboard
   - Statistics tiles with real data
   - Recent patients list
   - Recent examinations list
   - Quick action buttons

### Dashboard Sections
1. **Statistics Tiles**
   - Total Patients (count)
   - Total Examinations (count)
   - Examinations This Week (count)
   - Pending Reviews (count of draft/completed status)

2. **Recent Activity**
   - Last 5 patients created (with dates)
   - Last 5 examinations (with patient names and dates)

3. **Quick Actions**
   - Create New Patient button
   - View All Patients button
   - View All Examinations button

### API Integration
- `GET /api/v1/patients` - Fetch patient count and recent patients
- `GET /api/v1/examinations` - Fetch examination count and recent examinations

### Acceptance Criteria
- [ ] Statistics tiles show real counts
- [ ] Recent patients list displays last 5 created
- [ ] Recent examinations list displays last 5 created
- [ ] Click on patient/examination navigates to detail page
- [ ] Quick action buttons navigate correctly
- [ ] Loading states for data fetching
- [ ] Error handling with fallback to placeholder data

### Dependencies
- ✅ patientService.ts
- ✅ examinationService.ts
- ✅ Carbon Tile and StructuredList components

---

## 🎯 Bucket 9: Error Handling & Loading States (1 hour)

### Objective
Implement consistent error handling and loading states across all pages.

### Components to Develop
1. **ErrorBoundary.tsx** - React error boundary component
2. **LoadingSpinner.tsx** - Reusable loading component
3. **ErrorMessage.tsx** - Reusable error display component
4. **EmptyState.tsx** - Reusable empty state component

### Error Handling Patterns
- Network errors: "Unable to connect to server"
- 404 errors: "Resource not found"
- 401 errors: Redirect to login
- 412 errors (ETag conflict): "Data was modified by another user"
- Generic errors: "An error occurred. Please try again."

### Loading States
- Full page loading (skeleton screens)
- Inline loading (spinners)
- Button loading states

### Acceptance Criteria
- [ ] ErrorBoundary catches React errors
- [ ] Consistent loading spinners across all pages
- [ ] User-friendly error messages (no technical details)
- [ ] Empty states for lists with no data
- [ ] Retry functionality for failed requests
- [ ] Error logging (console only, no user exposure)

### Dependencies
- ✅ Carbon Loading and InlineNotification components

---

## 🎯 Bucket 10: UI Polish & Accessibility (1 hour)

### Objective
Enhance UI consistency, accessibility, and user experience.

### Tasks
1. **Accessibility Improvements**
   - ARIA labels on all interactive elements
   - Keyboard navigation support
   - Focus management
   - Screen reader testing

2. **UI Consistency**
   - Consistent spacing and padding
   - Consistent button styles and placement
   - Consistent form layouts
   - Consistent color usage for status badges

3. **Responsive Design**
   - Mobile-friendly layouts (basic)
   - Tablet optimization
   - Desktop optimization

4. **User Experience**
   - Confirmation dialogs for destructive actions
   - Success notifications with auto-dismiss
   - Breadcrumb navigation
   - Back button functionality

### Acceptance Criteria
- [ ] All forms keyboard accessible
- [ ] All interactive elements have ARIA labels
- [ ] Focus indicators visible
- [ ] Consistent spacing throughout app
- [ ] Status badges use consistent colors
- [ ] Confirmation dialogs for delete actions
- [ ] Success notifications auto-dismiss after 5 seconds
- [ ] Basic mobile responsiveness

### Dependencies
- ✅ Carbon Design System accessibility features

---

## Implementation Order Recommendation

### Phase 1: Core Patient Management (Buckets 1-3)
**Total Time: 3 hours**
1. Bucket 1: Patient List & Search
2. Bucket 2: Patient Create & Edit Forms
3. Bucket 3: Patient Detail View

**Rationale**: Establishes the foundation for patient management, which is required for examination management.

### Phase 2: Examination Management (Buckets 4-7)
**Total Time: 4 hours**
4. Bucket 5: Examination Create Form (do before Bucket 4 to have data)
5. Bucket 6: Examination Edit Form
6. Bucket 7: Examination Detail View
7. Bucket 4: Examination List View

**Rationale**: Builds on patient management to create complete examination workflow.

### Phase 3: Enhancement & Polish (Buckets 8-10)
**Total Time: 3 hours**
8. Bucket 8: Dashboard with Real Data
9. Bucket 9: Error Handling & Loading States
10. Bucket 10: UI Polish & Accessibility

**Rationale**: Enhances user experience after core functionality is complete.

---

## Technical Guidelines

### Code Standards
- Use TypeScript with existing loose configuration
- Follow existing code style (single quotes, semicolons)
- Use Carbon Design System components
- Implement proper error handling
- Add loading states for all async operations

### Component Structure
```typescript
// Standard component structure
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Carbon components } from '@carbon/react';
import { service } from '../services/serviceFile';
import type { Type } from '../types';

export default function ComponentName() {
  // State
  const [data, setData] = useState<Type[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Hooks
  const navigate = useNavigate();
  
  // Effects
  useEffect(() => {
    fetchData();
  }, []);
  
  // Handlers
  const fetchData = async () => {
    setLoading(true);
    try {
      const result = await service.getData();
      setData(result);
    } catch (err) {
      setError('User-friendly error message');
    } finally {
      setLoading(false);
    }
  };
  
  // Render
  return (
    <div>
      {/* Component JSX */}
    </div>
  );
}
```

### Validation Patterns
```typescript
// Client-side validation
const validateAge = (age: number): string | null => {
  if (age < 2 || age > 99) {
    return 'Age must be between 2 and 99 years';
  }
  return null;
};

// Biometry integer validation
const validateBiometry = (value: number, field: string): string | null => {
  if (!Number.isInteger(value)) {
    return `${field} must be an integer`;
  }
  return null;
};

// Gestational age format validation
const validateGestationalAge = (value: string): string | null => {
  const regex = /^\d{1,2}w\s?\d{1}d$/;
  if (!regex.test(value)) {
    return "Gestational age must be in format '28w 3d'";
  }
  return null;
};
```

### Error Handling Pattern
```typescript
try {
  const result = await service.operation();
  // Success notification
  showNotification('success', 'Operation completed successfully');
  navigate('/destination');
} catch (err: any) {
  // Generic error message (security requirement)
  const message = err.response?.data?.error || 'An error occurred. Please try again.';
  setError(message);
  // Log detailed error (console only)
  console.error('Operation failed:', err);
}
```

---

## Testing Checklist

Each bucket should be tested against these criteria:

### Functional Testing
- [ ] All user interactions work as expected
- [ ] Form validation prevents invalid submissions
- [ ] API calls succeed with valid data
- [ ] Navigation works correctly
- [ ] Data displays correctly

### Error Testing
- [ ] Invalid form data shows appropriate errors
- [ ] Network errors display user-friendly messages
- [ ] 404 errors handled gracefully
- [ ] Concurrent update conflicts detected (ETag)
- [ ] No technical details exposed to users

### UI/UX Testing
- [ ] Loading states display during async operations
- [ ] Success notifications appear and auto-dismiss
- [ ] Empty states show when no data available
- [ ] Buttons disabled during submission
- [ ] Consistent styling across pages

### Accessibility Testing
- [ ] Keyboard navigation works
- [ ] ARIA labels present
- [ ] Focus indicators visible
- [ ] Screen reader compatible

---

## Dependencies & Prerequisites

### Required Before Starting
- ✅ Backend API running on `http://localhost:7071`
- ✅ Azurite storage emulator running
- ✅ Frontend dev server running on `http://127.0.0.1:3000`
- ✅ Database initialized with admin user
- ✅ Carbon Design System installed
- ✅ React Router configured
- ✅ AuthContext implemented
- ✅ API services implemented

### External Dependencies
- Carbon Design System v1.109.0
- React 19.2.6
- React Router DOM 7.17.0
- Axios 1.18.0
- TypeScript 6.0.2

---

## Success Metrics

### Completion Criteria
- All 10 buckets implemented and tested
- All pages functional with real data
- All validation rules enforced
- Error handling consistent across app
- Loading states implemented
- Basic accessibility requirements met

### Quality Metrics
- No console errors in production build
- All API calls handle errors gracefully
- Forms validate before submission
- User-friendly error messages (no stack traces)
- Consistent UI/UX across all pages

---

## Future Enhancements (Out of Scope)

These features are documented but not included in the 10-hour plan:

1. **PDF Generation** - Export examinations to PDF
2. **Email Reports** - Send examination reports via email
3. **User Management** - Create/edit/delete users through UI
4. **Advanced Search** - Search by MRN, phone, multiple fields
5. **Audit Logs Viewer** - View audit trail in UI
6. **Bulk Operations** - Bulk delete, bulk update
7. **Export Functionality** - Export data to CSV/Excel
8. **Image Upload** - Attach ultrasound images
9. **Multi-language Support** - Bulgarian localization
10. **Advanced Mobile Optimization** - Native mobile experience

---

## Conclusion

This plan provides a structured approach to completing the AG Forms UI in 10 independent, 1-hour development buckets. Each bucket is self-contained and can be developed independently, allowing for flexible scheduling and parallel development if multiple developers are available.

The plan prioritizes core functionality (patient and examination management) before enhancements (dashboard, error handling, polish), ensuring a working application at each phase.

**Total Estimated Development Time: 10 hours**

---

*Document created: 2026-06-16*  
*Last updated: 2026-06-16*  
*Version: 1.0*