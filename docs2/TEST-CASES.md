# Comprehensive User Test Cases
## Prenatal Ultrasound Documentation System

**Version:** 1.0  
**Date:** June 15, 2026  
**Based on:** Documentation v2.0  
**Total Test Cases:** 180

---

## Table of Contents

1. [Test Summary](#test-summary)
2. [Authentication & User Management (30 Cases)](#1-authentication--user-management-30-cases)
3. [Patient Management (35 Cases)](#2-patient-management-35-cases)
4. [Examination Management (40 Cases)](#3-examination-management-40-cases)
5. [Search Functionality (15 Cases)](#4-search-functionality-15-cases)
6. [PDF Report Generation (10 Cases)](#5-pdf-report-generation-10-cases)
7. [Email Report Delivery (10 Cases)](#6-email-report-delivery-10-cases)
8. [Security & Authorization (20 Cases)](#7-security--authorization-20-cases)
9. [Edge Cases & Error Scenarios (20 Cases)](#8-edge-cases--error-scenarios-20-cases)
10. [Test Execution Guidelines](#test-execution-guidelines)

---

## Test Summary

| Category | Test Cases | Priority |
|----------|-----------|----------|
| Authentication & User Management | 30 | P0 |
| Patient Management | 35 | P0 |
| Examination Management | 40 | P0 |
| Search Functionality | 15 | P1 |
| PDF Report Generation | 10 | P0 |
| Email Report Delivery | 10 | P1 |
| Security & Authorization | 20 | P0 |
| Edge Cases & Error Scenarios | 20 | P2 |
| **TOTAL** | **180** | - |

### Test Coverage by Role

| Role | Test Cases | Focus Areas |
|------|-----------|-------------|
| Administrator | 60 | Full system access, user management, audit logs |
| Doctor | 80 | Patient/exam CRUD, reports, clinical workflows |
| Viewer | 20 | Read-only access, report viewing |
| Security | 20 | Injection attacks, authentication, authorization |

---

## 1. AUTHENTICATION & USER MANAGEMENT (30 Cases)

### 1.1 Login Tests (10 cases)

**TC-AUTH-001: Successful Admin Login**
- **Precondition:** Admin account exists
- **Steps:**
  1. Navigate to `http://localhost:3000`
  2. Enter username: `admin`
  3. Enter password: `Admin123!@#$`
  4. Click "Login"
- **Expected Result:** 
  - Redirect to dashboard
  - User profile shows "admin" in top right
  - Full menu visible (Dashboard, Patients, Examinations, Users)
- **Priority:** P0
- **Role:** Administrator

**TC-AUTH-002: Successful Doctor Login**
- **Precondition:** Doctor account created via API
- **Steps:**
  1. Navigate to login page
  2. Enter username: `dr.ivanova`
  3. Enter password: `SecureP@ss123!`
  4. Click "Login"
- **Expected Result:**
  - Redirect to dashboard
  - Limited menu options (no user management)
  - Can access Patients and Examinations
- **Priority:** P0
- **Role:** Doctor

**TC-AUTH-003: Successful Viewer Login**
- **Precondition:** Viewer account exists
- **Steps:**
  1. Navigate to login page
  2. Enter username: `viewer.petrov`
  3. Enter password: `ViewerPass2026!`
  4. Click "Login"
- **Expected Result:**
  - Redirect to dashboard
  - Read-only access only
  - No create/edit buttons visible
- **Priority:** P0
- **Role:** Viewer

**TC-AUTH-004: Login with Wrong Password**
- **Steps:**
  1. Enter valid username: `admin`
  2. Enter wrong password: `WrongPassword123`
  3. Click "Login"
- **Expected Result:**
  - Error message: "Invalid credentials"
  - Remain on login page
  - No hint about which field is wrong
- **Priority:** P0
- **Role:** Any

**TC-AUTH-005: Login with Non-existent Username**
- **Steps:**
  1. Enter username: `nonexistent.user`
  2. Enter any password
  3. Click "Login"
- **Expected Result:**
  - Error message: "Invalid credentials"
  - No indication that username doesn't exist (security)
- **Priority:** P0
- **Role:** Any

**TC-AUTH-006: Account Lockout After 5 Failed Attempts**
- **Steps:**
  1. Attempt login with wrong password 5 times
  2. Attempt 6th login with correct password
- **Expected Result:**
  - After 5th attempt: "Account locked" message
  - 30-minute lockout period
  - Correct password doesn't work during lockout
- **Priority:** P0
- **Role:** Any

**TC-AUTH-007: Case-Sensitive Username**
- **Steps:**
  1. Enter username: `ADMIN` (uppercase)
  2. Enter correct password
  3. Click "Login"
- **Expected Result:**
  - Login fails
  - Usernames are case-sensitive
- **Priority:** P1
- **Role:** Any

**TC-AUTH-008: Empty Credentials**
- **Steps:**
  1. Leave username empty
  2. Leave password empty
  3. Click "Login"
- **Expected Result:**
  - Validation errors on both fields
  - "Username is required"
  - "Password is required"
- **Priority:** P1
- **Role:** Any

**TC-AUTH-009: SQL Injection Attempt in Login**
- **Steps:**
  1. Enter username: `admin' OR '1'='1`
  2. Enter password: `anything`
  3. Click "Login"
- **Expected Result:**
  - Login fails
  - No SQL injection vulnerability
  - Input properly sanitized
- **Priority:** P0
- **Role:** Security Test

**TC-AUTH-010: XSS Attempt in Login**
- **Steps:**
  1. Enter username: `<script>alert('xss')</script>`
  2. Enter password: `test`
  3. Click "Login"
- **Expected Result:**
  - Input sanitized
  - No script execution
  - Login fails safely
- **Priority:** P0
- **Role:** Security Test

### 1.2 User Registration Tests (10 cases)

**TC-REG-001: Create Doctor User via API (PowerShell)**
- **Precondition:** Admin access to PowerShell
- **Steps:**
  ```powershell
  $newUser = @{
      username = "dr.georgiev"
      password = "DoctorPass2026!"
      email = "georgiev@hospital.bg"
      role = "doctor"
  } | ConvertTo-Json
  
  Invoke-RestMethod -Uri "http://localhost:7071/api/v1/auth/register" `
      -Method POST -Body $newUser -ContentType "application/json"
  ```
- **Expected Result:**
  - 201 Created response
  - User can login immediately
  - User appears in user list
- **Priority:** P0
- **Role:** Administrator

**TC-REG-002: Create Viewer User via API (curl)**
- **Steps:**
  ```bash
  curl -X POST http://localhost:7071/api/v1/auth/register \
    -H "Content-Type: application/json" \
    -d '{"username": "viewer.dimitrov", "password": "ViewerPass2026!", 
         "email": "dimitrov@hospital.bg", "role": "viewer"}'
  ```
- **Expected Result:**
  - 201 Created
  - Viewer account active
  - Can login with read-only access
- **Priority:** P0
- **Role:** Administrator

**TC-REG-003: Password Too Short (11 characters)**
- **Steps:**
  1. Attempt to create user with password: `Short123!`
- **Expected Result:**
  - 422 Unprocessable Entity
  - Error: "Password must be at least 12 characters"
- **Priority:** P0
- **Role:** Administrator

**TC-REG-004: Password Missing Uppercase**
- **Steps:**
  1. Create user with password: `lowercase123!`
- **Expected Result:**
  - 422 error
  - "Password must contain at least one uppercase letter"
- **Priority:** P0
- **Role:** Administrator

**TC-REG-005: Password Missing Lowercase**
- **Steps:**
  1. Create user with password: `UPPERCASE123!`
- **Expected Result:**
  - 422 error
  - "Password must contain at least one lowercase letter"
- **Priority:** P0
- **Role:** Administrator

**TC-REG-006: Password Missing Number**
- **Steps:**
  1. Create user with password: `NoNumberPass!`
- **Expected Result:**
  - 422 error
  - "Password must contain at least one number"
- **Priority:** P0
- **Role:** Administrator

**TC-REG-007: Password Missing Special Character**
- **Steps:**
  1. Create user with password: `NoSpecial123`
- **Expected Result:**
  - 422 error
  - "Password must contain at least one special character"
- **Priority:** P0
- **Role:** Administrator

**TC-REG-008: Duplicate Username**
- **Precondition:** User `dr.ivanova` exists
- **Steps:**
  1. Attempt to create another user with username `dr.ivanova`
- **Expected Result:**
  - 409 Conflict
  - "Username already exists"
- **Priority:** P0
- **Role:** Administrator

**TC-REG-009: Invalid Email Format**
- **Steps:**
  1. Create user with email: `invalid-email`
- **Expected Result:**
  - 422 error
  - "Invalid email format"
- **Priority:** P1
- **Role:** Administrator

**TC-REG-010: Invalid Role**
- **Steps:**
  1. Create user with role: `superadmin`
- **Expected Result:**
  - 422 error
  - "Invalid role" (only admin/doctor/viewer allowed)
- **Priority:** P0
- **Role:** Administrator

### 1.3 Password Management Tests (5 cases)

**TC-PWD-001: Change Password Successfully**
- **Precondition:** Logged in as doctor
- **Steps:**
  1. Click profile icon
  2. Select "Change Password"
  3. Enter current password: `DoctorPass2026!`
  4. Enter new password: `NewDoctorPass2026!`
  5. Confirm new password: `NewDoctorPass2026!`
  6. Click "Update Password"
- **Expected Result:**
  - Success message
  - Can login with new password
  - Cannot login with old password
- **Priority:** P0
- **Role:** Doctor

**TC-PWD-002: Wrong Current Password**
- **Steps:**
  1. Open change password dialog
  2. Enter wrong current password
  3. Enter valid new password
  4. Click "Update Password"
- **Expected Result:**
  - 401 Unauthorized
  - "Current password incorrect"
- **Priority:** P0
- **Role:** Any

**TC-PWD-003: Password Confirmation Mismatch**
- **Steps:**
  1. Enter current password correctly
  2. Enter new password: `NewPass123!`
  3. Enter confirm password: `DifferentPass123!`
  4. Click "Update Password"
- **Expected Result:**
  - 400 Bad Request
  - "Passwords do not match"
- **Priority:** P0
- **Role:** Any

**TC-PWD-004: New Password Doesn't Meet Requirements**
- **Steps:**
  1. Enter current password correctly
  2. Enter new password: `short`
  3. Click "Update Password"
- **Expected Result:**
  - 422 error with password requirements
- **Priority:** P0
- **Role:** Any

**TC-PWD-005: Change to Same Password**
- **Steps:**
  1. Enter current password correctly
  2. Enter same password as new password
  3. Click "Update Password"
- **Expected Result:**
  - Success (no restriction documented)
- **Priority:** P2
- **Role:** Any

### 1.4 Session Management Tests (5 cases)

**TC-SESS-001: Logout Successfully**
- **Precondition:** Logged in
- **Steps:**
  1. Click "Logout" button
- **Expected Result:**
  - Redirect to login page
  - Session cleared
  - Cannot access protected pages
- **Priority:** P0
- **Role:** Any

**TC-SESS-002: Access Protected Page Without Login**
- **Steps:**
  1. Navigate directly to `http://localhost:3000/patients`
- **Expected Result:**
  - Redirect to login page
  - Cannot access protected content
- **Priority:** P0
- **Role:** Unauthenticated

**TC-SESS-003: Session Timeout (8 hours)**
- **Precondition:** Logged in
- **Steps:**
  1. Wait 8+ hours (or mock time)
  2. Attempt to access any page
- **Expected Result:**
  - Redirect to login
  - "Session expired" message
- **Priority:** P1
- **Role:** Any

**TC-SESS-004: Token Tampering**
- **Steps:**
  1. Login successfully
  2. Modify JWT token in browser storage/cookie
  3. Attempt API call
- **Expected Result:**
  - 401 Unauthorized
  - Invalid token error
- **Priority:** P0
- **Role:** Security Test

**TC-SESS-005: Concurrent Sessions**
- **Steps:**
  1. Login on Browser A
  2. Login with same user on Browser B
  3. Perform action on Browser A
- **Expected Result:**
  - Both sessions work (no single-session restriction documented)
- **Priority:** P2
- **Role:** Any

---

## 2. PATIENT MANAGEMENT (35 Cases)

### 2.1 Create Patient Tests (15 cases)

**TC-PAT-001: Create Patient with All Fields**
- **Precondition:** Logged in as doctor
- **Steps:**
  1. Navigate to Patients page
  2. Click "Create New Patient"
  3. Enter name: `Мария Иванова`
  4. Enter age: `28`
  5. Enter address: `София, ул. Витоша 15`
  6. Enter phone: `+359888123456`
  7. Enter email: `maria.ivanova@email.bg`
  8. Click "Create Patient"
- **Expected Result:**
  - 201 Created
  - MRN auto-generated (e.g., `MRN-2026-001234`)
  - Patient appears in list
  - Success message displayed
- **Priority:** P0
- **Role:** Doctor

**TC-PAT-002: Create Patient with Minimum Required Fields**
- **Steps:**
  1. Click "Create New Patient"
  2. Enter name: `Петър Петров`
  3. Enter age: `35`
  4. Leave optional fields empty
  5. Click "Create Patient"
- **Expected Result:**
  - Success
  - MRN generated
  - Patient created with only required fields
- **Priority:** P0
- **Role:** Doctor

**TC-PAT-003: Create Patient with Cyrillic Name**
- **Steps:**
  1. Enter name: `Александра Димитрова-Георгиева`
  2. Enter age: `30`
  3. Click "Create Patient"
- **Expected Result:**
  - Success
  - Cyrillic characters handled correctly
  - Name displayed properly in list
- **Priority:** P0
- **Role:** Doctor

**TC-PAT-004: Patient Age Boundary - Minimum (2 years)**
- **Steps:**
  1. Enter name: `Дете Малко`
  2. Enter age: `2`
  3. Click "Create Patient"
- **Expected Result:**
  - Success (minimum valid age)
- **Priority:** P0
- **Role:** Doctor

**TC-PAT-005: Patient Age Boundary - Maximum (99 years)**
- **Steps:**
  1. Enter name: `Баба Стара`
  2. Enter age: `99`
  3. Click "Create Patient"
- **Expected Result:**
  - Success (maximum valid age)
- **Priority:** P0
- **Role:** Doctor

**TC-PAT-006: Patient Age Below Minimum (1 year)**
- **Steps:**
  1. Enter name: `Бебе Много Малко`
  2. Enter age: `1`
  3. Click "Create Patient"
- **Expected Result:**
  - 422 error
  - "Age must be between 2 and 99 years"
- **Priority:** P0
- **Role:** Doctor

**TC-PAT-007: Patient Age Above Maximum (100 years)**
- **Steps:**
  1. Enter name: `Човек Много Стар`
  2. Enter age: `100`
  3. Click "Create Patient"
- **Expected Result:**
  - 422 error
  - "Age must be between 2 and 99 years"
- **Priority:** P0
- **Role:** Doctor

**TC-PAT-008: Patient Age Negative**
- **Steps:**
  1. Enter age: `-5`
  2. Click "Create Patient"
- **Expected Result:**
  - Validation error
  - Negative age rejected
- **Priority:** P1
- **Role:** Doctor

**TC-PAT-009: Patient Age Decimal**
- **Steps:**
  1. Enter age: `28.5`
  2. Click "Create Patient"
- **Expected Result:**
  - Should be converted to integer `28` or validation error
- **Priority:** P1
- **Role:** Doctor

**TC-PAT-010: Patient Name Too Short (1 character)**
- **Steps:**
  1. Enter name: `М`
  2. Enter age: `28`
  3. Click "Create Patient"
- **Expected Result:**
  - 422 error
  - "Name must be 2-255 characters"
- **Priority:** P0
- **Role:** Doctor

**TC-PAT-011: Patient Name Maximum Length (255 characters)**
- **Steps:**
  1. Enter name with exactly 255 characters
  2. Enter age: `28`
  3. Click "Create Patient"
- **Expected Result:**
  - Success
- **Priority:** P1
- **Role:** Doctor

**TC-PAT-012: Patient Name Over Maximum (256 characters)**
- **Steps:**
  1. Enter name with 256 characters
  2. Click "Create Patient"
- **Expected Result:**
  - 422 error
  - "Name must be 2-255 characters"
- **Priority:** P1
- **Role:** Doctor

**TC-PAT-013: Invalid Phone Format**
- **Steps:**
  1. Enter valid name and age
  2. Enter phone: `invalid-phone`
  3. Click "Create Patient"
- **Expected Result:**
  - 422 error
  - "Invalid phone number format"
- **Priority:** P1
- **Role:** Doctor

**TC-PAT-014: Invalid Email Format**
- **Steps:**
  1. Enter valid name and age
  2. Enter email: `not-an-email`
  3. Click "Create Patient"
- **Expected Result:**
  - 422 error
  - "Invalid email address"
- **Priority:** P1
- **Role:** Doctor

**TC-PAT-015: Viewer Cannot Create Patient**
- **Precondition:** Logged in as viewer
- **Steps:**
  1. Navigate to Patients page
  2. Attempt to click "Create New Patient"
- **Expected Result:**
  - Button not visible OR
  - 403 Forbidden if accessed via API
- **Priority:** P0
- **Role:** Viewer

### 2.2 Read Patient Tests (5 cases)

**TC-PAT-016: View Patient List**
- **Precondition:** Multiple patients exist
- **Steps:**
  1. Navigate to Patients page
- **Expected Result:**
  - Table shows patients with:
    - Name
    - Age
    - MRN
    - Exam Count
    - Last Exam Date
- **Priority:** P0
- **Role:** Any

**TC-PAT-017: View Patient Details**
- **Precondition:** Patient exists
- **Steps:**
  1. Click on patient name in list
- **Expected Result:**
  - Patient detail page shows all information
  - Examination history visible
  - Actions available based on role
- **Priority:** P0
- **Role:** Any

**TC-PAT-018: View Patient with No Examinations**
- **Steps:**
  1. Open newly created patient
- **Expected Result:**
  - Patient details shown
  - "No examinations" message
  - Exam count = 0
- **Priority:** P1
- **Role:** Any

**TC-PAT-019: View Patient by MRN**
- **Steps:**
  1. Navigate to patient via MRN lookup
- **Expected Result:**
  - Correct patient displayed
- **Priority:** P1
- **Role:** Any

**TC-PAT-020: Pagination - 20 Patients Per Page**
- **Precondition:** 25+ patients exist
- **Steps:**
  1. Navigate to Patients page
  2. Observe pagination
- **Expected Result:**
  - 20 patients shown
  - Continuation token for next page
  - Can navigate to next page
- **Priority:** P1
- **Role:** Any

### 2.3 Update Patient Tests (5 cases)

**TC-PAT-021: Update Patient Name**
- **Precondition:** Patient exists
- **Steps:**
  1. Open patient details
  2. Click "Edit Patient"
  3. Change name to `Мария Иванова-Петрова`
  4. Click "Save Changes"
- **Expected Result:**
  - 200 OK
  - Name updated
  - New ETag returned
- **Priority:** P0
- **Role:** Doctor

**TC-PAT-022: Update Patient Age**
- **Steps:**
  1. Edit patient
  2. Change age from `28` to `29`
  3. Save
- **Expected Result:**
  - Success
  - Age updated
- **Priority:** P0
- **Role:** Doctor

**TC-PAT-023: Update Patient with Invalid Age**
- **Steps:**
  1. Edit patient
  2. Change age to `150`
  3. Save
- **Expected Result:**
  - 422 error
  - Age validation fails
- **Priority:** P0
- **Role:** Doctor

**TC-PAT-024: Concurrent Update Conflict (ETag)**
- **Steps:**
  1. User A opens patient for edit
  2. User B opens same patient for edit
  3. User A saves changes
  4. User B attempts to save changes
- **Expected Result:**
  - User B gets 409 Conflict
  - ETag mismatch error
- **Priority:** P0
- **Role:** Doctor

**TC-PAT-025: Viewer Cannot Update Patient**
- **Precondition:** Logged in as viewer
- **Steps:**
  1. Open patient details
  2. Attempt to edit
- **Expected Result:**
  - Edit button not visible OR
  - 403 Forbidden
- **Priority:** P0
- **Role:** Viewer

### 2.4 Delete Patient Tests (5 cases)

**TC-PAT-026: Soft Delete Patient**
- **Precondition:** Patient with no examinations
- **Steps:**
  1. Open patient details
  2. Click "Delete Patient"
  3. Confirm deletion
- **Expected Result:**
  - 200 OK
  - Patient marked as deleted
  - Not shown in normal lists
- **Priority:** P0
- **Role:** Doctor

**TC-PAT-027: Delete Patient with Examinations**
- **Precondition:** Patient has examinations
- **Steps:**
  1. Attempt to delete patient
- **Expected Result:**
  - Warning message OR
  - Soft delete with examinations preserved
- **Priority:** P0
- **Role:** Doctor

**TC-PAT-028: Deleted Patient Not in Search**
- **Precondition:** Patient deleted
- **Steps:**
  1. Search for deleted patient
- **Expected Result:**
  - Patient not found in normal search results
- **Priority:** P1
- **Role:** Any

**TC-PAT-029: Cannot Create Examination for Deleted Patient**
- **Precondition:** Patient deleted
- **Steps:**
  1. Attempt to create examination for deleted patient via API
- **Expected Result:**
  - 400 Bad Request
  - "Patient not found or deleted"
- **Priority:** P0
- **Role:** Doctor

**TC-PAT-030: Viewer Cannot Delete Patient**
- **Steps:**
  1. Login as viewer
  2. Open patient details
- **Expected Result:**
  - Delete button not visible OR
  - 403 Forbidden
- **Priority:** P0
- **Role:** Viewer

### 2.5 MRN Generation Tests (5 cases)

**TC-MRN-001: MRN Format Validation**
- **Steps:**
  1. Create patient
  2. Verify MRN format
- **Expected Result:**
  - Format matches `MRN-YYYY-NNNNNN`
  - Example: `MRN-2026-001234`
- **Priority:** P0
- **Role:** Doctor

**TC-MRN-002: MRN Uniqueness**
- **Steps:**
  1. Create 10 patients rapidly
  2. Verify all MRNs
- **Expected Result:**
  - All MRNs unique
  - No duplicates
- **Priority:** P0
- **Role:** Doctor

**TC-MRN-003: MRN Year Component**
- **Steps:**
  1. Create patient in 2026
  2. Verify MRN year
- **Expected Result:**
  - MRN contains `2026`
- **Priority:** P1
- **Role:** Doctor

**TC-MRN-004: MRN Sequential Numbering**
- **Steps:**
  1. Create patient A (gets MRN-2026-000001)
  2. Create patient B
- **Expected Result:**
  - Patient B gets MRN-2026-000002 (sequential)
- **Priority:** P1
- **Role:** Doctor

**TC-MRN-005: MRN Counter Reset Yearly**
- **Steps:**
  1. Mock system date to 2027-01-01
  2. Create patient
- **Expected Result:**
  - MRN starts at MRN-2027-000001
- **Priority:** P2
- **Role:** System Test

---

## 3. EXAMINATION MANAGEMENT (40 Cases)

### 3.1 Create Examination Tests (20 cases)

**TC-EXAM-001: Create Complete Examination**
- **Precondition:** Patient exists
- **Steps:**
  1. Open patient details
  2. Click "New Examination"
  3. Fill all sections:
     - Exam Date: `2026-06-12`
     - Status: `Completed`
     - LMP: `2026-01-15`
     - Presentation: `Cephalic`
     - Heart Rate: `145`
     - BPD: `52` (integer)
     - HC: `185` (integer)
     - AC: `163` (integer)
     - FL: `35` (integer)
     - EFW: `425` (integer)
     - Doppler PI: `0.85` (decimal allowed)
     - Doppler RI: `0.52` (decimal allowed)
  4. Click "Complete Examination"
- **Expected Result:**
  - 201 Created
  - Examination saved
  - Gestational age calculated
  - All data persisted correctly
- **Priority:** P0
- **Role:** Doctor

**TC-EXAM-002: Create Draft Examination**
- **Steps:**
  1. Fill partial examination data
  2. Click "Save as Draft"
- **Expected Result:**
  - Success
  - Status = `draft`
  - Can edit later
- **Priority:** P0
- **Role:** Doctor

**TC-EXAM-003: Biometry Integer Validation - BPD**
- **Steps:**
  1. Enter BPD: `52.3` (decimal)
  2. Attempt to save
- **Expected Result:**
  - 422 error
  - "BPD must be integer"
- **Priority:** P0
- **Role:** Doctor

**TC-EXAM-004: Biometry Integer Validation - HC**
- **Steps:**
  1. Enter HC: `185.7` (decimal)
  2. Save
- **Expected Result:**
  - 422 error
  - "HC must be integer"
- **Priority:** P0
- **Role:** Doctor

**TC-EXAM-005: Biometry Integer Validation - AC**
- **Steps:**
  1. Enter AC: `163.2` (decimal)
  2. Save
- **Expected Result:**
  - 422 error
  - "AC must be integer"
- **Priority:** P0
- **Role:** Doctor

**TC-EXAM-006: Biometry Integer Validation - FL**
- **Steps:**
  1. Enter FL: `35.8` (decimal)
  2. Save
- **Expected Result:**
  - 422 error
  - "FL must be integer"
- **Priority:** P0
- **Role:** Doctor

**TC-EXAM-007: Biometry Integer Validation - EFW**
- **Steps:**
  1. Enter EFW: `425.5` (decimal)
  2. Save
- **Expected Result:**
  - 422 error
  - "EFW must be integer"
- **Priority:** P0
- **Role:** Doctor

**TC-EXAM-008: Doppler PI Decimal Values Allowed**
- **Steps:**
  1. Enter Doppler PI: `0.85` (decimal)
  2. Save
- **Expected Result:**
  - Success
  - Decimal accepted for Doppler
- **Priority:** P0
- **Role:** Doctor

**TC-EXAM-009: Doppler RI Decimal Values Allowed**
- **Steps:**
  1. Enter Doppler RI: `0.52` (decimal)
  2. Save
- **Expected Result:**
  - Success
  - Decimal accepted for Doppler
- **Priority:** P0
- **Role:** Doctor

**TC-EXAM-010: Future Exam Date Rejected**
- **Steps:**
  1. Enter exam date: `2027-01-01` (future)
  2. Save
- **Expected Result:**
  - 422 error
  - "Exam date cannot be in the future"
- **Priority:** P0
- **Role:** Doctor

**TC-EXAM-011: Gestational Age Auto-Calculation**
- **Steps:**
  1. Enter LMP: `2026-01-15`
  2. Enter Ultrasound Date: `2026-06-12`
  3. Save
- **Expected Result:**
  - Gestational age calculated as `~21w 0d`
- **Priority:** P0
- **Role:** Doctor

**TC-EXAM-012: Gestational Age Format Validation**
- **Steps:**
  1. Manually enter gestational age: `28w 3d`
  2. Save
- **Expected Result:**
  - Format accepted (matches regex `^\d{1,2}w\s?\d{1}d$`)
- **Priority:** P0
- **Role:** Doctor

**TC-EXAM-013: Invalid Gestational Age Format**
- **Steps:**
  1. Enter gestational age: `28 weeks 3 days`
  2. Save
- **Expected Result:**
  - 422 error
  - Invalid format
- **Priority:** P1
- **Role:** Doctor

**TC-EXAM-014: Heart Rate Boundary - Minimum (100 bpm)**
- **Steps:**
  1. Enter heart rate: `100`
  2. Save
- **Expected Result:**
  - Success (minimum valid)
- **Priority:** P0
- **Role:** Doctor

**TC-EXAM-015: Heart Rate Boundary - Maximum (180 bpm)**
- **Steps:**
  1. Enter heart rate: `180`
  2. Save
- **Expected Result:**
  - Success (maximum valid)
- **Priority:** P0
- **Role:** Doctor

**TC-EXAM-016: Heart Rate Below Minimum**
- **Steps:**
  1. Enter heart rate: `99`
  2. Save
- **Expected Result:**
  - 422 error
  - "Heart rate must be 100-180 bpm"
- **Priority:** P0
- **Role:** Doctor

**TC-EXAM-017: Heart Rate Above Maximum**
- **Steps:**
  1. Enter heart rate: `181`
  2. Save
- **Expected Result:**
  - 422 error
  - "Heart rate must be 100-180 bpm"
- **Priority:** P0
- **Role:** Doctor

**TC-EXAM-018: BPD Range Validation (10-120 mm)**
- **Steps:**
  1. Enter BPD: `5` (below minimum)
  2. Save
- **Expected Result:**
  - 422 error
  - "BPD must be 10-120 mm"
- **Priority:** P0
- **Role:** Doctor

**TC-EXAM-019: Create Examination for Deleted Patient**
- **Precondition:** Patient is deleted
- **Steps:**
  1. Attempt to create examination via API
- **Expected Result:**
  - 400 Bad Request
  - "Patient not found"
- **Priority:** P0
- **Role:** Doctor

**TC-EXAM-020: Viewer Cannot Create Examination**
- **Steps:**
  1. Login as viewer
  2. Navigate to patient
- **Expected Result:**
  - "New Examination" button not visible OR
  - 403 Forbidden
- **Priority:** P0
- **Role:** Viewer

### 3.2 Read Examination Tests (5 cases)

**TC-EXAM-021: View Examination List for Patient**
- **Precondition:** Patient has multiple examinations
- **Steps:**
  1. Open patient details
  2. View Examinations tab
- **Expected Result:**
  - All examinations listed
  - Sorted by date (newest first)
  - Shows exam date, status, created by
- **Priority:** P0
- **Role:** Any

**TC-EXAM-022: View Examination Details**
- **Steps:**
  1. Click on examination in list
- **Expected Result:**
  - Full examination data displayed
  - All sections visible
  - Actions available based on role
- **Priority:** P0
- **Role:** Any

**TC-EXAM-023: View Draft Examination**
- **Steps:**
  1. Open draft examination
- **Expected Result:**
  - Status shows "Draft"
  - Edit button available
- **Priority:** P0
- **Role:** Any

**TC-EXAM-024: View Completed Examination**
- **Steps:**
  1. Open completed examination
- **Expected Result:**
  - Status shows "Completed"
  - All data visible
  - PDF generation available
- **Priority:** P0
- **Role:** Any

**TC-EXAM-025: Examination List Pagination**
- **Precondition:** Patient has 15+ examinations
- **Steps:**
  1. View examination list
- **Expected Result:**
  - Paginated results
  - Continuation token provided
- **Priority:** P1
- **Role:** Any

### 3.3 Update Examination Tests (5 cases)

**TC-EXAM-026: Update Draft Examination**
- **Precondition:** Draft examination exists
- **Steps:**
  1. Open draft examination
  2. Click "Edit"
  3. Modify biometry values
  4. Save
- **Expected Result:**
  - 200 OK
  - Changes saved
  - New ETag returned
- **Priority:** P0
- **Role:** Doctor

**TC-EXAM-027: Update Examination Status to Completed**
- **Steps:**
  1. Open draft examination
  2. Change status to "Completed"
  3. Save
- **Expected Result:**
  - Success
  - Status updated
- **Priority:** P0
- **Role:** Doctor

**TC-EXAM-028: Update with Invalid Biometry (Decimal)**
- **Steps:**
  1. Edit examination
  2. Change BPD to `52.5`
  3. Save
- **Expected Result:**
  - 422 error
  - Integer required
- **Priority:** P0
- **Role:** Doctor

**TC-EXAM-029: Concurrent Update Conflict**
- **Steps:**
  1. User A edits examination
  2. User B edits same examination
  3. User A saves
  4. User B saves
- **Expected Result:**
  - User B gets 409 Conflict
  - ETag mismatch
- **Priority:** P0
- **Role:** Doctor

**TC-EXAM-030: Viewer Cannot Update Examination**
- **Steps:**
  1. Login as viewer
  2. Open examination
- **Expected Result:**
  - Edit button not visible OR
  - 403 Forbidden
- **Priority:** P0
- **Role:** Viewer

### 3.4 Delete Examination Tests (5 cases)

**TC-EXAM-031: Soft Delete Examination**
- **Steps:**
  1. Open examination
  2. Click "Delete"
  3. Confirm
- **Expected Result:**
  - 200 OK
  - Examination soft deleted
  - Not shown in normal lists
- **Priority:** P0
- **Role:** Doctor

**TC-EXAM-032: Deleted Examination Not in List**
- **Steps:**
  1. Delete examination
  2. View patient's examination list
- **Expected Result:**
  - Deleted examination not shown
- **Priority:** P1
- **Role:** Any

**TC-EXAM-033: Cannot Edit Deleted Examination**
- **Steps:**
  1. Attempt to access deleted examination via direct URL
- **Expected Result:**
  - 404 Not Found
- **Priority:** P1
- **Role:** Doctor

**TC-EXAM-034: Admin Can Delete Any Examination**
- **Steps:**
  1. Login as admin
  2. Delete examination created by another doctor
- **Expected Result:**
  - Success
- **Priority:** P1
- **Role:** Administrator

**TC-EXAM-035: Viewer Cannot Delete Examination**
- **Steps:**
  1. Login as viewer
  2. Open examination
- **Expected Result:**
  - Delete button not visible OR
  - 403 Forbidden
- **Priority:** P0
- **Role:** Viewer

### 3.5 Calculation Tests (5 cases)

**TC-CALC-001: Calculate Gestational Age from LMP**
- **Steps:**
  1. Enter LMP: `2026-01-15`
  2. Enter Ultrasound Date: `2026-06-12`
  3. Trigger calculation
- **Expected Result:**
  - Gestational age calculated correctly (~21 weeks)
- **Priority:** P0
- **Role:** Doctor

**TC-CALC-002: Calculate Expected Delivery Date**
- **Steps:**
  1. Enter LMP: `2026-01-15`
  2. Calculate EDD
- **Expected Result:**
  - EDD = LMP + 280 days (~2026-10-22)
- **Priority:** P0
- **Role:** Doctor

**TC-CALC-003: Calculate Biometry Percentiles**
- **Steps:**
  1. Enter biometry values
  2. Trigger percentile calculation
- **Expected Result:**
  - Percentiles returned for BPD, HC, AC, FL
- **Priority:** P0
- **Role:** Doctor

**TC-CALC-004: Calculation Endpoint Direct Call**
- **Steps:**
  1. POST to `/api/v1/examinations/{id}/calculate`
- **Expected Result:**
  - 200 OK with calculated values
- **Priority:** P1
- **Role:** Doctor

**TC-CALC-005: Calculate with Missing Data**
- **Steps:**
  1. Attempt calculation with incomplete biometry
- **Expected Result:**
  - Partial results OR
  - Error indicating missing data
- **Priority:** P1
- **Role:** Doctor

---

## 4. SEARCH FUNCTIONALITY (15 Cases)

**TC-SEARCH-001: Search Patient by Full Name**
- **Steps:**
  1. Enter search: `Мария Иванова`
  2. Click Search
- **Expected Result:**
  - Exact match patient returned
- **Priority:** P0
- **Role:** Any

**TC-SEARCH-002: Search Patient by Partial Name**
- **Steps:**
  1. Enter search: `Мария`
  2. Click Search
- **Expected Result:**
  - All patients with "Мария" in name
- **Priority:** P0
- **Role:** Any

**TC-SEARCH-003: Search Patient by MRN**
- **Steps:**
  1. Enter search: `MRN-2026-001234`
  2. Click Search
- **Expected Result:**
  - Exact patient with that MRN
- **Priority:** P0
- **Role:** Any

**TC-SEARCH-004: Case-Insensitive Name Search**
- **Steps:**
  1. Enter search: `мария` (lowercase)
  2. Click Search
- **Expected Result:**
  - Matches `Мария`, `МАРИЯ`, etc.
- **Priority:** P1
- **Role:** Any

**TC-SEARCH-005: Search with Cyrillic Characters**
- **Steps:**
  1. Enter search: `Иванова`
  2. Click Search
- **Expected Result:**
  - Cyrillic search works correctly
- **Priority:** P0
- **Role:** Any

**TC-SEARCH-006: Search by Age Range**
- **Steps:**
  1. Set Min Age: `25`
  2. Set Max Age: `35`
  3. Click Search
- **Expected Result:**
  - Only patients aged 25-35 returned
- **Priority:** P1
- **Role:** Any

**TC-SEARCH-007: Search by Date Range**
- **Steps:**
  1. Set From Date: `2026-06-01`
  2. Set To Date: `2026-06-15`
  3. Click Search
- **Expected Result:**
  - Patients created in that date range
- **Priority:** P1
- **Role:** Any

**TC-SEARCH-008: Search with No Results**
- **Steps:**
  1. Enter search: `NonexistentPatient`
  2. Click Search
- **Expected Result:**
  - "No results found" message
- **Priority:** P1
- **Role:** Any

**TC-SEARCH-009: Empty Search Returns All**
- **Steps:**
  1. Leave search field empty
  2. Click Search
- **Expected Result:**
  - All patients returned (paginated)
- **Priority:** P1
- **Role:** Any

**TC-SEARCH-010: Quick Search from Header**
- **Steps:**
  1. Click header search bar
  2. Type `Мария`
  3. Select from dropdown
- **Expected Result:**
  - Navigate to patient details
- **Priority:** P1
- **Role:** Any

**TC-SEARCH-011: Search Examinations by Patient Name**
- **Steps:**
  1. Navigate to Examinations page
  2. Filter by patient: `Мария Иванова`
  3. Click Search
- **Expected Result:**
  - All examinations for that patient
- **Priority:** P1
- **Role:** Any

**TC-SEARCH-012: Search Examinations by Date Range**
- **Steps:**
  1. Set From: `2026-06-01`
  2. Set To: `2026-06-15`
  3. Click Search
- **Expected Result:**
  - Examinations in that date range
- **Priority:** P1
- **Role:** Any

**TC-SEARCH-013: Search Examinations by Status**
- **Steps:**
  1. Filter by Status: `Completed`
  2. Click Search
- **Expected Result:**
  - Only completed examinations
- **Priority:** P1
- **Role:** Any

**TC-SEARCH-014: Search Examinations by Doctor**
- **Steps:**
  1. Filter by Created By: `Dr. Arabadzhikova`
  2. Click Search
- **Expected Result:**
  - Examinations created by that doctor
- **Priority:** P1
- **Role:** Any

**TC-SEARCH-015: Combined Examination Filters**
- **Steps:**
  1. Filter by patient, date range, and status
  2. Click Search
- **Expected Result:**
  - Results match all criteria
- **Priority:** P1
- **Role:** Any

---

## 5. PDF REPORT GENERATION (10 Cases)

**TC-PDF-001: Generate PDF for Completed Examination**
- **Precondition:** Completed examination exists
- **Steps:**
  1. Open examination details
  2. Click "Generate PDF Report"
- **Expected Result:**
  - PDF opens in new window
  - A4 format
  - All data included
- **Priority:** P0
- **Role:** Doctor

**TC-PDF-002: PDF Contains Patient Information**
- **Steps:**
  1. Generate PDF
  2. Verify content
- **Expected Result:**
  - Patient name visible
  - Age visible
  - MRN visible
- **Priority:** P0
- **Role:** Doctor

**TC-PDF-003: PDF Contains Biometry Data**
- **Steps:**
  1. Generate PDF
  2. Check biometry section
- **Expected Result:**
  - BPD, HC, AC, FL, EFW displayed correctly
- **Priority:** P0
- **Role:** Doctor

**TC-PDF-004: PDF Contains Doppler Data**
- **Steps:**
  1. Generate PDF with Doppler data
  2. Verify Doppler section
- **Expected Result:**
  - PI and RI values shown with decimals
- **Priority:** P0
- **Role:** Doctor

**TC-PDF-005: PDF Contains Calculated Values**
- **Steps:**
  1. Generate PDF
  2. Check calculated fields
- **Expected Result:**
  - Gestational age included
  - EDD included
  - Percentiles included
- **Priority:** P0
- **Role:** Doctor

**TC-PDF-006: Print PDF Directly**
- **Steps:**
  1. Generate PDF
  2. Click browser Print button
- **Expected Result:**
  - Print dialog opens
  - A4 format preserved
- **Priority:** P0
- **Role:** Doctor

**TC-PDF-007: Download PDF**
- **Steps:**
  1. Generate PDF
  2. Click Download/Save
- **Expected Result:**
  - PDF file downloaded to local machine
- **Priority:** P0
- **Role:** Doctor

**TC-PDF-008: Viewer Can Generate PDF**
- **Steps:**
  1. Login as viewer
  2. Open examination
  3. Click "Generate PDF Report"
- **Expected Result:**
  - Success (viewers can generate reports per docs)
- **Priority:** P0
- **Role:** Viewer

**TC-PDF-009: Cannot Generate PDF for Draft**
- **Steps:**
  1. Open draft examination
  2. Attempt to generate PDF
- **Expected Result:**
  - Error or button disabled
  - "Complete examination first"
- **Priority:** P0
- **Role:** Doctor

**TC-PDF-010: PDF Not Persisted on Server**
- **Steps:**
  1. Generate PDF
  2. Check server storage
- **Expected Result:**
  - No PDF file stored (client-side generation only)
- **Priority:** P1
- **Role:** System Test

---

## 6. EMAIL REPORT DELIVERY (10 Cases)

**TC-
EMAIL-001: Email Report to Patient**
- **Precondition:** Patient has email, examination completed
- **Steps:**
  1. Open examination
  2. Click "Email Report"
  3. Confirm recipient email
  4. Click "Send"
- **Expected Result:**
  - 202 Accepted
  - Email sent to patient
  - Success message displayed
- **Priority:** P1
- **Role:** Doctor

**TC-EMAIL-002: Email with Custom Message**
- **Steps:**
  1. Click "Email Report"
  2. Enter custom message: `Please find your ultrasound report attached.`
  3. Send
- **Expected Result:**
  - Email includes custom message
- **Priority:** P1
- **Role:** Doctor

**TC-EMAIL-003: Email to Patient Without Email Address**
- **Precondition:** Patient has no email
- **Steps:**
  1. Attempt to email report
- **Expected Result:**
  - Error
  - "Patient email not available"
- **Priority:** P1
- **Role:** Doctor

**TC-EMAIL-004: Email with Invalid Recipient**
- **Steps:**
  1. Modify recipient email to invalid format
  2. Send
- **Expected Result:**
  - 422 error
  - "Invalid recipient email"
- **Priority:** P1
- **Role:** Doctor

**TC-EMAIL-005: Email Report for Draft Examination**
- **Steps:**
  1. Attempt to email draft examination
- **Expected Result:**
  - Error
  - "Examination must be completed"
- **Priority:** P1
- **Role:** Doctor

**TC-EMAIL-006: Email Delivery Failure**
- **Steps:**
  1. Mock SMTP failure
  2. Attempt to send email
- **Expected Result:**
  - 502 Bad Gateway
  - "Email delivery failed"
- **Priority:** P2
- **Role:** System Test

**TC-EMAIL-007: Email Audit Log Entry**
- **Steps:**
  1. Send email report
  2. Check audit logs
- **Expected Result:**
  - Audit entry created for email action
- **Priority:** P1
- **Role:** Administrator

**TC-EMAIL-008: Viewer Cannot Email Report**
- **Steps:**
  1. Login as viewer
  2. Open examination
- **Expected Result:**
  - Email button not visible OR
  - 403 Forbidden
- **Priority:** P0
- **Role:** Viewer

**TC-EMAIL-009: Email Multiple Reports**
- **Steps:**
  1. Email report for examination A
  2. Email report for examination B
- **Expected Result:**
  - Both emails sent successfully
- **Priority:** P2
- **Role:** Doctor

**TC-EMAIL-010: Email with Large PDF**
- **Steps:**
  1. Generate large PDF (with images)
  2. Email report
- **Expected Result:**
  - Email sent successfully OR
  - Size limit error
- **Priority:** P2
- **Role:** Doctor

---

## 7. SECURITY & AUTHORIZATION (20 Cases)

**TC-SEC-001: HTTPS Enforcement**
- **Steps:**
  1. Attempt to access via HTTP in production
- **Expected Result:**
  - Redirect to HTTPS
- **Priority:** P0
- **Role:** System Test

**TC-SEC-002: TLS 1.2+ Required**
- **Steps:**
  1. Attempt connection with TLS 1.1
- **Expected Result:**
  - Connection refused
- **Priority:** P0
- **Role:** System Test

**TC-SEC-003: SQL Injection in Patient Name**
- **Steps:**
  1. Create patient with name: `'; DROP TABLE Patients; --`
  2. Save
- **Expected Result:**
  - Input sanitized
  - No SQL injection
- **Priority:** P0
- **Role:** Security Test

**TC-SEC-004: XSS in Patient Name**
- **Steps:**
  1. Create patient with name: `<script>alert('xss')</script>`
  2. View patient list
- **Expected Result:**
  - Script not executed
  - Output encoded
- **Priority:** P0
- **Role:** Security Test

**TC-SEC-005: CSRF Protection**
- **Steps:**
  1. Attempt cross-site request without proper token
- **Expected Result:**
  - Request rejected
- **Priority:** P0
- **Role:** Security Test

**TC-SEC-006: Password Not Logged**
- **Steps:**
  1. Login with password
  2. Check server logs
- **Expected Result:**
  - Password not in logs
- **Priority:** P0
- **Role:** Security Test

**TC-SEC-007: Token Not Logged**
- **Steps:**
  1. Make authenticated request
  2. Check logs
- **Expected Result:**
  - Token value not in logs
- **Priority:** P0
- **Role:** Security Test

**TC-SEC-008: No Sensitive Data in Error Messages**
- **Steps:**
  1. Trigger error with sensitive data
  2. Check error response
- **Expected Result:**
  - Generic error message
  - No sensitive data exposed
- **Priority:** P0
- **Role:** Security Test

**TC-SEC-009: Rate Limiting on Login**
- **Steps:**
  1. Attempt 100 login requests in 1 minute
- **Expected Result:**
  - 429 Too Many Requests after threshold
- **Priority:** P0
- **Role:** Security Test

**TC-SEC-010: Account Lockout Timing**
- **Steps:**
  1. Lock account with 5 failed attempts
  2. Wait exactly 30 minutes
  3. Attempt login
- **Expected Result:**
  - Account unlocked
  - Login succeeds
- **Priority:** P0
- **Role:** Security Test

**TC-SEC-011: Doctor Cannot Access Admin Functions**
- **Steps:**
  1. Login as doctor
  2. Attempt to access user management API
- **Expected Result:**
  - 403 Forbidden
- **Priority:** P0
- **Role:** Doctor

**TC-SEC-012: Viewer Cannot Modify Data**
- **Steps:**
  1. Login as viewer
  2. Attempt to update patient via API
- **Expected Result:**
  - 403 Forbidden
- **Priority:** P0
- **Role:** Viewer

**TC-SEC-013: Audit Log for Patient Creation**
- **Steps:**
  1. Create patient
  2. Check audit logs
- **Expected Result:**
  - Audit entry with user, action, timestamp
- **Priority:** P1
- **Role:** Administrator

**TC-SEC-014: Audit Log for Examination Update**
- **Steps:**
  1. Update examination
  2. Check audit logs
- **Expected Result:**
  - Audit entry with old and new values
- **Priority:** P1
- **Role:** Administrator

**TC-SEC-015: Audit Log for Failed Login**
- **Steps:**
  1. Attempt login with wrong password
  2. Check audit logs
- **Expected Result:**
  - Failed login attempt logged
- **Priority:** P1
- **Role:** Administrator

**TC-SEC-016: Audit Log Retention (3 years)**
- **Steps:**
  1. Mock date to 3 years + 1 day after audit entry
  2. Check if audit entry exists
- **Expected Result:**
  - Entry should be archived or deleted per policy
- **Priority:** P2
- **Role:** System Test

**TC-SEC-017: Password Hash Storage**
- **Steps:**
  1. Create user
  2. Check database
- **Expected Result:**
  - Password stored as hash (Argon2id or bcrypt)
  - Not plaintext
- **Priority:** P0
- **Role:** Security Test

**TC-SEC-018: Token Expiration (8 hours)**
- **Steps:**
  1. Login
  2. Wait 8+ hours
  3. Attempt API call
- **Expected Result:**
  - 401 Unauthorized
  - Token expired
- **Priority:** P0
- **Role:** Security Test

**TC-SEC-019: CORS Restriction**
- **Steps:**
  1. Attempt API call from unauthorized origin
- **Expected Result:**
  - CORS error
  - Request blocked
- **Priority:** P0
- **Role:** Security Test

**TC-SEC-020: Managed Identity for Storage Access**
- **Steps:**
  1. Check Azure Functions configuration
- **Expected Result:**
  - Managed identity used
  - No connection strings in code
- **Priority:** P1
- **Role:** System Test

---

## 8. EDGE CASES & ERROR SCENARIOS (20 Cases)

**TC-EDGE-001: Emoji in Patient Name**
- **Steps:**
  1. Enter name: `Мария 😊 Иванова`
  2. Save
- **Expected Result:**
  - Emoji handled or rejected gracefully
- **Priority:** P2
- **Role:** Doctor

**TC-EDGE-002: Very Long Address**
- **Steps:**
  1. Enter 1000-character address
  2. Save
- **Expected Result:**
  - Truncated or validation error
- **Priority:** P2
- **Role:** Doctor

**TC-EDGE-003: All Optional Fields Empty**
- **Steps:**
  1. Fill only required fields
  2. Save
- **Expected Result:**
  - Success
  - Optional fields null
- **Priority:** P1
- **Role:** Doctor

**TC-EDGE-004: Maximum Biometry Values**
- **Steps:**
  1. Enter BPD: `120` (max)
  2. Enter HC: `400` (max)
  3. Enter AC: `400` (max)
  4. Enter FL: `100` (max)
  5. Enter EFW: `5000` (max)
  6. Save
- **Expected Result:**
  - Success
  - All at maximum valid values
- **Priority:** P1
- **Role:** Doctor

**TC-EDGE-005: Minimum Biometry Values**
- **Steps:**
  1. Enter BPD: `10` (min)
  2. Enter HC: `50` (min)
  3. Enter AC: `50` (min)
  4. Enter FL: `10` (min)
  5. Enter EFW: `100` (min)
  6. Save
- **Expected Result:**
  - Success
  - All at minimum valid values
- **Priority:** P1
- **Role:** Doctor

**TC-EDGE-006: Special Characters in Search**
- **Steps:**
  1. Search for: `O'Brien`
  2. Click Search
- **Expected Result:**
  - Special characters handled correctly
- **Priority:** P2
- **Role:** Any

**TC-EDGE-007: Rapid Patient Creation (10 in 10 seconds)**
- **Steps:**
  1. Create 10 patients rapidly
- **Expected Result:**
  - All created successfully
  - Unique MRNs
- **Priority:** P1
- **Role:** Doctor

**TC-EDGE-008: Concurrent Examination Creation**
- **Steps:**
  1. Two users create examinations for same patient simultaneously
- **Expected Result:**
  - Both succeed
  - No conflicts
- **Priority:** P1
- **Role:** Doctor

**TC-EDGE-009: Network Interruption During Save**
- **Steps:**
  1. Start saving patient
  2. Disconnect network
- **Expected Result:**
  - Error message
  - Retry option
- **Priority:** P2
- **Role:** Any

**TC-EDGE-010: Browser Back Button After Submit**
- **Steps:**
  1. Submit form
  2. Click browser back button
- **Expected Result:**
  - No duplicate submission
- **Priority:** P2
- **Role:** Any

**TC-EDGE-011: Multiple Browser Tabs**
- **Steps:**
  1. Edit same patient in two tabs
  2. Save in both
- **Expected Result:**
  - ETag conflict on second save
- **Priority:** P1
- **Role:** Doctor

**TC-EDGE-012: Extremely Long Patient Name**
- **Steps:**
  1. Enter 500-character name
  2. Save
- **Expected Result:**
  - Truncated at 255 or validation error
- **Priority:** P2
- **Role:** Doctor

**TC-EDGE-013: Zero Values in Biometry**
- **Steps:**
  1. Enter BPD: `0`
  2. Save
- **Expected Result:**
  - Validation error (min 10)
- **Priority:** P1
- **Role:** Doctor

**TC-EDGE-014: Negative Biometry Values**
- **Steps:**
  1. Enter BPD: `-10`
  2. Save
- **Expected Result:**
  - Validation error
- **Priority:** P1
- **Role:** Doctor

**TC-EDGE-015: Future LMP Date**
- **Steps:**
  1. Enter LMP in future
  2. Save
- **Expected Result:**
  - Validation error or warning
- **Priority:** P1
- **Role:** Doctor

**TC-EDGE-016: LMP After Ultrasound Date**
- **Steps:**
  1. Enter LMP > Ultrasound date
  2. Save
- **Expected Result:**
  - Validation error
- **Priority:** P1
- **Role:** Doctor

**TC-EDGE-017: Gestational Age > 42 Weeks**
- **Steps:**
  1. Calculate with very old LMP
  2. Check result
- **Expected Result:**
  - Warning or error
- **Priority:** P2
- **Role:** Doctor

**TC-EDGE-018: Unicode Characters**
- **Steps:**
  1. Enter name with various Unicode
  2. Save
- **Expected Result:**
  - Handled correctly
- **Priority:** P2
- **Role:** Doctor

**TC-EDGE-019: Whitespace-Only Name**
- **Steps:**
  1. Enter name: `   ` (spaces)
  2. Save
- **Expected Result:**
  - Validation error
- **Priority:** P1
- **Role:** Doctor

**TC-EDGE-020: Pagination Edge (Exactly 20)**
- **Steps:**
  1. View list with exactly 20 patients
  2. Check pagination
- **Expected Result:**
  - No "next page" shown
- **Priority:** P2
- **Role:** Any

---

## Test Execution Guidelines

### Priority Levels

- **P0 (Critical):** Must pass before release - 120 cases
- **P1 (High):** Should pass before release - 40 cases
- **P2 (Medium):** Can be deferred if needed - 20 cases

### Test Environments

1. **Local Development:** `http://localhost:3000` + `http://localhost:7071`
2. **Staging:** Azure staging environment
3. **Production:** Azure production environment

### Test Data Requirements

- 3 user accounts (admin, doctor, viewer)
- 25+ test patients with various ages
- 50+ test examinations (mix of draft/completed)
- Test data with Cyrillic characters
- Edge case test data (min/max values)

### Automation Recommendations

- **Unit Tests:** All validation logic (API layer)
- **Integration Tests:** API endpoints (existing in `/api/src/tests`)
- **E2E Tests:** Critical user workflows (Playwright/Cypress)
- **Manual Tests:** UI/UX, PDF generation, email delivery

### Success Criteria

- **P0 Tests:** 100% pass rate
- **P1 Tests:** 95% pass rate
- **P2 Tests:** 90% pass rate
- **No critical security vulnerabilities**
- **Performance:** < 2s page load, < 300ms API response

### Test Execution Order

1. **Phase 1:** Authentication & User Management (P0)
2. **Phase 2:** Patient Management (P0)
3. **Phase 3:** Examination Management (P0)
4. **Phase 4:** PDF Generation (P0)
5. **Phase 5:** Search & Email (P1)
6. **Phase 6:** Security Tests (P0)
7. **Phase 7:** Edge Cases (P2)

### Bug Reporting Template

```markdown
**Test Case ID:** TC-XXX-NNN
**Priority:** P0/P1/P2
**Environment:** Local/Staging/Production
**Steps to Reproduce:**
1. Step 1
2. Step 2
**Expected Result:** ...
**Actual Result:** ...
**Screenshots:** [if applicable]
**Logs:** [if applicable]
```

---

## Appendix: Test Data Templates

### Sample Test Users

```json
{
  "admin": {
    "username": "admin",
    "password": "Admin123!@#$",
    "role": "admin"
  },
  "doctor1": {
    "username": "dr.ivanova",
    "password": "DoctorPass2026!",
    "role": "doctor"
  },
  "viewer1": {
    "username": "viewer.petrov",
    "password": "ViewerPass2026!",
    "role": "viewer"
  }
}
```

### Sample Test Patients

```json
[
  {
    "name": "Мария Иванова",
    "age": 28,
    "phone": "+359888123456",
    "email": "maria.ivanova@email.bg"
  },
  {
    "name": "Петър Петров",
    "age": 35,
    "phone": "+359888234567"
  },
  {
    "name": "Александра Димитрова",
    "age": 30,
    "email": "alex.dimitrova@email.bg"
  }
]
```

### Sample Examination Data

```json
{
  "exam_date": "2026-06-12",
  "status": "completed",
  "pregnancy_data": {
    "lmp": "2026-01-15",
    "ultrasound_date": "2026-06-12",
    "obstetric_history": "G1P0"
  },
  "ultrasound_findings": {
    "presentation": "cephalic",
    "heart_rate": 145,
    "placenta": "anterior, grade 1"
  },
  "biometry": {
    "bpd": 52,
    "hc": 185,
    "ac": 163,
    "fl": 35,
    "efw": 425
  },
  "doppler": {
    "uterine_artery_right": {"pi": 0.85, "ri": 0.52},
    "umbilical_artery": {"pi": 1.02, "ri": 0.65}
  }
}
```

---

**Document Status:** Complete  
**Review Date:** June 15, 2026  
**Next Update:** After UAT feedback  
**Maintained By:** QA Team

---

*For technical documentation, see the `/docs` folder in the project repository.*