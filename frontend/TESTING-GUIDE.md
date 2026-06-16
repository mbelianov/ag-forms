# AG Forms Testing Guide

Comprehensive testing guide for the prenatal ultrasound documentation system minimal UI.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Complete Testing Workflow](#complete-testing-workflow)
3. [Feature-Specific Tests](#feature-specific-tests)
4. [Validation Testing](#validation-testing)
5. [Error Scenarios](#error-scenarios)
6. [Security Testing](#security-testing)
7. [Known Limitations](#known-limitations)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Starting the Development Environment

The application requires **3 separate terminals** running simultaneously:

#### Terminal 1: Start Azurite (Azure Storage Emulator)

```powershell
.\start-azurite.ps1
```

**Expected Output:**
```
Starting Azurite...
Azurite Table service is starting at http://127.0.0.1:10002
Azurite started successfully
```

**Keep this terminal running** throughout your testing session.

#### Terminal 2: Start Azure Functions Backend

```powershell
.\start-functions.ps1
```

**Expected Output:**
```
Starting Azure Functions...
Functions:
  HealthCheck: [GET] http://localhost:7071/api/HealthCheck
  Login: [POST] http://localhost:7071/api/v1/auth/login
  ...
```

**Keep this terminal running** throughout your testing session.

#### Terminal 3: Start Frontend Development Server

```powershell
.\start-frontend.ps1
```

**Expected Output:**
```
Starting frontend development server...
VITE ready in XXX ms
Local: http://127.0.0.1:3000/
```

**Keep this terminal running** throughout your testing session.

### Initialize the Database

After all three services are running, initialize the database with the default admin user:

```powershell
.\init-database.ps1
```

**Expected Output:**
```
========================================
Database initialized successfully!
========================================

Default Admin User Created:
  Username: admin
  Password: Admin123!@#$
  Email: admin@example.com
  Role: admin

You can now log in at: http://localhost:3000
========================================
```

### Default Credentials

- **Username:** `admin`
- **Password:** `Admin123!@#$`
- **Role:** admin (full access)

---

## Complete Testing Workflow

This section provides a step-by-step guide to test the entire application flow.

### Step 1: Login

1. Open browser and navigate to `http://127.0.0.1:3000`
2. You should be redirected to the login page
3. Enter credentials:
   - Username: `admin`
   - Password: `Admin123!@#$`
4. Click "Sign in"

**Expected Result:**
- Successful login
- Redirect to Dashboard page
- Header shows "Welcome, System Administrator"
- Navigation menu displays: Dashboard, Patients, Examinations, Logout

### Step 2: Create a Patient

1. Click "Patients" in the navigation menu
2. Click "Create New Patient" button
3. Fill in the patient form:
   - **Name:** `Maria Ivanova` (required)
   - **Age:** `28` (required, must be 2-99)
   - **Phone:** `+359888123456` (required)
   - **Email:** `maria.ivanova@example.com` (optional)
   - **Address:** `Sofia, Bulgaria` (optional)
4. Click "Create Patient"

**Expected Result:**
- Success notification appears
- Redirect to patient list page
- New patient appears in the list with auto-generated MRN (format: `MRN-2026-000001`)
- Patient card shows name, age, phone, and MRN

### Step 3: View Patient Details

1. From the patient list, click "View Details" on the newly created patient
2. Review the patient information displayed

**Expected Result:**
- Patient detail page shows all information
- MRN is displayed prominently
- "Edit Patient" and "Create Examination" buttons are visible
- "Examinations" section shows "No examinations found"

### Step 4: Create an Examination

1. From the patient detail page, click "Create Examination"
2. Fill in the examination form:
   - **Exam Date:** Select today's date (required, cannot be future)
   - **Gestational Age:** `28w 3d` (optional, format: "XXw Xd")
   - **Status:** Select "completed" (required)
   - **Biometry Section:**
     - BPD: `75` (integer only)
     - HC: `280` (integer only)
     - AC: `260` (integer only)
     - FL: `52` (integer only)
     - EFW: `1250` (integer only)
   - **Doppler Section:**
     - PI: `1.2` (float allowed)
     - RI: `0.65` (float allowed, 0-1 range)
     - Vessel: `Umbilical artery`
   - **Notes:** `Normal fetal development observed`
   - **Findings:** `All measurements within normal range`
3. Click "Create Examination"

**Expected Result:**
- Success notification appears
- Redirect to examination detail page
- All entered data is displayed correctly
- Examination ID is shown
- Patient information is displayed at the top

### Step 5: View Examination Details

1. Review the examination detail page

**Expected Result:**
- Examination date and gestational age displayed
- Status badge shows "completed" in green
- Biometry measurements displayed in a table
- Doppler measurements displayed in a table
- Notes and findings sections show entered text
- "Edit Examination" button is visible
- "Back to Patient" link navigates to patient detail page

### Step 6: Edit Patient Information

1. Navigate back to the patient detail page
2. Click "Edit Patient"
3. Modify the patient information:
   - Change **Age** to `29`
   - Update **Email** to `maria.updated@example.com`
4. Click "Update Patient"

**Expected Result:**
- Success notification appears
- Redirect to patient detail page
- Updated information is displayed
- MRN remains unchanged

### Step 7: Edit Examination

1. From the patient detail page, click on the examination to view details
2. Click "Edit Examination"
3. Modify examination data:
   - Update **Status** to "reviewed"
   - Change **BPD** to `76`
   - Update **Notes** to include additional observations
4. Click "Update Examination"

**Expected Result:**
- Success notification appears
- Redirect to examination detail page
- Updated information is displayed
- Status badge shows "reviewed"

### Step 8: Search Patients

1. Navigate to the Patients page
2. Use the search box to search for patients:
   - Enter `Maria` in the search box
   - Press Enter or click search icon

**Expected Result:**
- Patient list filters to show only matching patients
- Maria Ivanova appears in the results
- Clear search to show all patients again

### Step 9: Logout

1. Click "Logout" in the navigation menu
2. Confirm logout if prompted

**Expected Result:**
- Redirect to login page
- Session is cleared
- Attempting to access protected pages redirects to login

---

## Feature-Specific Tests

### Authentication Testing

#### Test 1: Valid Login
**Steps:**
1. Navigate to login page
2. Enter valid credentials (admin/Admin123!@#$)
3. Click "Sign in"

**Expected:** Successful login, redirect to dashboard

#### Test 2: Invalid Username
**Steps:**
1. Enter username: `wronguser`
2. Enter password: `Admin123!@#$`
3. Click "Sign in"

**Expected:** Error message "Invalid credentials" (generic message for security)

#### Test 3: Invalid Password
**Steps:**
1. Enter username: `admin`
2. Enter password: `wrongpassword`
3. Click "Sign in"

**Expected:** Error message "Invalid credentials"

#### Test 4: Empty Fields
**Steps:**
1. Leave username and password empty
2. Click "Sign in"

**Expected:** Validation errors for required fields

#### Test 5: Account Lockout (Security Feature)
**Steps:**
1. Attempt login with wrong password 5 times consecutively
2. Try to login with correct password on 6th attempt

**Expected:** 
- After 5 failed attempts: "Account locked for 30 minutes"
- Must wait 30 minutes before attempting again

#### Test 6: Session Persistence
**Steps:**
1. Login successfully
2. Refresh the page
3. Navigate to different pages

**Expected:** User remains logged in, no redirect to login page

#### Test 7: Logout
**Steps:**
1. Login successfully
2. Click "Logout"
3. Try to access protected pages

**Expected:** Redirect to login page, session cleared

### Patient Management Testing

#### Test 1: Create Patient - Valid Data
**Steps:**
1. Navigate to Patients → Create New Patient
2. Fill all required fields with valid data
3. Click "Create Patient"

**Expected:** 
- Patient created successfully
- Auto-generated MRN in format `MRN-YYYY-NNNNNN`
- Redirect to patient list

#### Test 2: Create Patient - Missing Required Fields
**Steps:**
1. Navigate to Create Patient page
2. Leave name field empty
3. Click "Create Patient"

**Expected:** Validation error "Name is required"

#### Test 3: Create Patient - Invalid Age
**Steps:**
1. Fill patient form
2. Enter age: `1` (below minimum)
3. Click "Create Patient"

**Expected:** Validation error "Age must be between 2 and 99 years"

**Also test:**
- Age: `100` → Error "Age must be between 2 and 99 years"
- Age: `0` → Error "Age must be between 2 and 99 years"

#### Test 4: Create Patient - Invalid Phone
**Steps:**
1. Fill patient form
2. Enter phone: `abc123`
3. Click "Create Patient"

**Expected:** Validation error "Phone must be a valid phone number"

#### Test 5: Create Patient - Invalid Email
**Steps:**
1. Fill patient form
2. Enter email: `notanemail`
3. Click "Create Patient"

**Expected:** Validation error "Email must be a valid email address"

#### Test 6: Edit Patient - Valid Update
**Steps:**
1. Navigate to patient detail page
2. Click "Edit Patient"
3. Modify age to `30`
4. Click "Update Patient"

**Expected:** 
- Patient updated successfully
- MRN remains unchanged
- Updated data displayed

#### Test 7: Edit Patient - Concurrent Update (ETag Conflict)
**Steps:**
1. Open patient edit page in two browser tabs
2. Update patient in Tab 1 and save
3. Update patient in Tab 2 and save

**Expected:** 
- Tab 1: Success
- Tab 2: Error "Patient was modified by another user. Please refresh and try again."

#### Test 8: View Patient Details
**Steps:**
1. Click "View Details" on any patient
2. Review displayed information

**Expected:**
- All patient fields displayed correctly
- MRN prominently shown
- List of examinations (if any)
- Edit and Create Examination buttons visible

#### Test 9: Search Patients - By Name
**Steps:**
1. Navigate to Patients page
2. Enter patient name in search box
3. Press Enter

**Expected:** Filtered list showing only matching patients

#### Test 10: Search Patients - No Results
**Steps:**
1. Enter non-existent name in search box
2. Press Enter

**Expected:** "No patients found" message

#### Test 11: Delete Patient (Soft Delete)
**Note:** If delete functionality is implemented

**Steps:**
1. Navigate to patient detail page
2. Click "Delete Patient"
3. Confirm deletion

**Expected:**
- Patient marked as deleted (isDeleted = true)
- Patient no longer appears in list
- Data retained in database (soft delete)

### Examination Management Testing

#### Test 1: Create Examination - Valid Data
**Steps:**
1. Navigate to patient detail page
2. Click "Create Examination"
3. Fill all fields with valid data
4. Click "Create Examination"

**Expected:**
- Examination created successfully
- Auto-generated examination ID
- Redirect to examination detail page

#### Test 2: Create Examination - Missing Required Fields
**Steps:**
1. Navigate to Create Examination page
2. Leave exam date empty
3. Click "Create Examination"

**Expected:** Validation error "Exam date is required"

#### Test 3: Create Examination - Future Date
**Steps:**
1. Fill examination form
2. Select a future date for exam date
3. Click "Create Examination"

**Expected:** Validation error "Exam date cannot be in the future"

#### Test 4: Create Examination - Invalid Gestational Age Format
**Steps:**
1. Fill examination form
2. Enter gestational age: `28 weeks 3 days` (wrong format)
3. Click "Create Examination"

**Expected:** Validation error "Gestational age must be in format '28w 3d'"

**Valid formats:**
- `28w 3d` ✓
- `28w3d` ✓
- `28w 0d` ✓

**Invalid formats:**
- `28 weeks 3 days` ✗
- `28w` ✗
- `28w 3` ✗

#### Test 5: Create Examination - Biometry Integer Validation (CRITICAL)
**Steps:**
1. Fill examination form
2. Enter BPD: `75.5` (decimal)
3. Click "Create Examination"

**Expected:** Validation error "BPD must be an integer"

**Test all biometry fields:**
- BPD: Must be integer (0-200)
- HC: Must be integer (0-500)
- AC: Must be integer (0-500)
- FL: Must be integer (0-100)
- EFW: Must be integer (0-10000)

#### Test 6: Create Examination - Doppler Float Validation
**Steps:**
1. Fill examination form
2. Enter PI: `1.25` (decimal allowed)
3. Enter RI: `0.65` (decimal allowed)
4. Click "Create Examination"

**Expected:** Examination created successfully (floats allowed for Doppler)

**Doppler validation:**
- PI: Float allowed (0-10)
- RI: Float allowed (0-1)

#### Test 7: Edit Examination - Valid Update
**Steps:**
1. Navigate to examination detail page
2. Click "Edit Examination"
3. Update status to "reviewed"
4. Click "Update Examination"

**Expected:**
- Examination updated successfully
- Status badge reflects new status

#### Test 8: Edit Examination - Concurrent Update (ETag Conflict)
**Steps:**
1. Open examination edit page in two browser tabs
2. Update examination in Tab 1 and save
3. Update examination in Tab 2 and save

**Expected:**
- Tab 1: Success
- Tab 2: Error "Examination was modified by another user. Please refresh and try again."

#### Test 9: View Examination Details
**Steps:**
1. Click on examination from patient detail page
2. Review displayed information

**Expected:**
- All examination fields displayed correctly
- Biometry table shows all measurements
- Doppler table shows all measurements
- Notes and findings displayed
- Status badge with appropriate color
- Edit button visible

#### Test 10: List Examinations for Patient
**Steps:**
1. Navigate to patient detail page
2. Review examinations section

**Expected:**
- List of all examinations for patient
- Sorted by date (most recent first)
- Each examination shows date, gestational age, and status

---

## Validation Testing

### Age Validation (Non-Standard Range)

**Rule:** Patient age must be between **2 and 99 years** (NOT 0-120)

| Input | Expected Result |
|-------|----------------|
| `1` | ✗ Error: "Age must be between 2 and 99 years" |
| `2` | ✓ Valid |
| `28` | ✓ Valid |
| `99` | ✓ Valid |
| `100` | ✗ Error: "Age must be between 2 and 99 years" |
| `0` | ✗ Error: "Age must be between 2 and 99 years" |
| `-5` | ✗ Error: "Age must be between 2 and 99 years" |
| `abc` | ✗ Error: "Age must be a number" |

### Biometry Integer Validation (CRITICAL)

**Rule:** All biometry measurements (BPD, HC, AC, FL, EFW) **MUST be integers**

| Field | Input | Expected Result |
|-------|-------|----------------|
| BPD | `75` | ✓ Valid |
| BPD | `75.5` | ✗ Error: "BPD must be an integer" |
| HC | `280` | ✓ Valid |
| HC | `280.3` | ✗ Error: "HC must be an integer" |
| AC | `260` | ✓ Valid |
| AC | `260.7` | ✗ Error: "AC must be an integer" |
| FL | `52` | ✓ Valid |
| FL | `52.2` | ✗ Error: "FL must be an integer" |
| EFW | `1250` | ✓ Valid |
| EFW | `1250.5` | ✗ Error: "EFW must be an integer" |

**Range Validation:**
- BPD: 0-200 mm
- HC: 0-500 mm
- AC: 0-500 mm
- FL: 0-100 mm
- EFW: 0-10000 g

### Doppler Float Validation

**Rule:** Doppler measurements (PI, RI) **allow float values**

| Field | Input | Expected Result |
|-------|-------|----------------|
| PI | `1.2` | ✓ Valid |
| PI | `1.25` | ✓ Valid |
| PI | `0.8` | ✓ Valid |
| PI | `11` | ✗ Error: "PI value is out of valid range" |
| RI | `0.65` | ✓ Valid |
| RI | `0.5` | ✓ Valid |
| RI | `1.5` | ✗ Error: "RI must be between 0 and 1" |

**Range Validation:**
- PI: 0-10
- RI: 0-1

### Gestational Age Format Validation

**Rule:** Format must be `"XXw Xd"` (regex: `^\d{1,2}w\s?\d{1}d$`)

| Input | Expected Result |
|-------|----------------|
| `28w 3d` | ✓ Valid |
| `28w3d` | ✓ Valid (space optional) |
| `8w 5d` | ✓ Valid (single digit week) |
| `40w 0d` | ✓ Valid |
| `28 weeks 3 days` | ✗ Error: "Gestational age must be in format '28w 3d'" |
| `28w` | ✗ Error: "Gestational age must be in format '28w 3d'" |
| `28w 3` | ✗ Error: "Gestational age must be in format '28w 3d'" |
| `28w 10d` | ✗ Error: "Gestational age must be in format '28w 3d'" (day > 6) |

### Date Validation

**Rule:** Examination date cannot be in the future

| Input | Expected Result |
|-------|----------------|
| Today's date | ✓ Valid |
| Yesterday | ✓ Valid |
| Last week | ✓ Valid |
| Tomorrow | ✗ Error: "Exam date cannot be in the future" |
| Next week | ✗ Error: "Exam date cannot be in the future" |

### Email Validation

**Rule:** Must be a valid email format (optional field)

| Input | Expected Result |
|-------|----------------|
| `user@example.com` | ✓ Valid |
| `user.name@example.co.uk` | ✓ Valid |
| `user+tag@example.com` | ✓ Valid |
| Empty string | ✓ Valid (optional) |
| `notanemail` | ✗ Error: "Email must be a valid email address" |
| `user@` | ✗ Error: "Email must be a valid email address" |
| `@example.com` | ✗ Error: "Email must be a valid email address" |

### Password Validation

**Rule:** Minimum **12 characters** (NOT 8)

| Input | Expected Result |
|-------|----------------|
| `Admin123!@#$` | ✓ Valid (12 chars) |
| `Pass123!@#$` | ✓ Valid (12 chars) |
| `Short123!` | ✗ Error: "Password must be at least 12 characters long" |
| `12345678901` | ✓ Valid (12 chars, but weak) |

---

## Error Scenarios

### Network Errors

#### Test 1: Backend Not Running
**Steps:**
1. Stop the backend (Terminal 2)
2. Try to login or perform any API operation

**Expected:**
- Error message: "Unable to connect to server"
- User-friendly error notification
- No stack traces or technical details exposed

#### Test 2: Azurite Not Running
**Steps:**
1. Stop Azurite (Terminal 1)
2. Try to create a patient or examination

**Expected:**
- Error message: "Service temporarily unavailable"
- Backend logs show storage connection error
- Generic error message to user (no technical details)

### Validation Errors

#### Test 1: Multiple Validation Errors
**Steps:**
1. Submit patient form with multiple invalid fields:
   - Name: empty
   - Age: `1`
   - Phone: `abc`
   - Email: `notanemail`

**Expected:**
- All validation errors displayed simultaneously
- Clear indication of which fields have errors
- Form not submitted until all errors resolved

#### Test 2: Server-Side Validation
**Steps:**
1. Bypass client-side validation (using browser dev tools)
2. Submit invalid data directly to API

**Expected:**
- Server-side validation catches invalid data
- Generic error message returned to client
- Detailed error logged server-side only

### Concurrent Update Conflicts (ETag)

#### Test 1: Patient Update Conflict
**Steps:**
1. Open patient edit page in two browser tabs
2. In Tab 1: Change age to `30`, save
3. In Tab 2: Change age to `31`, save

**Expected:**
- Tab 1: Success
- Tab 2: Error "Patient was modified by another user. Please refresh and try again."
- User must refresh to get latest data

#### Test 2: Examination Update Conflict
**Steps:**
1. Open examination edit page in two browser tabs
2. In Tab 1: Change status to "reviewed", save
3. In Tab 2: Change BPD to `76`, save

**Expected:**
- Tab 1: Success
- Tab 2: Error "Examination was modified by another user. Please refresh and try again."
- User must refresh to get latest data

### Authentication Errors

#### Test 1: Session Expiration
**Steps:**
1. Login successfully
2. Wait for session to expire (or manually delete auth cookie)
3. Try to access protected page

**Expected:**
- Redirect to login page
- Message: "Session expired. Please login again."

#### Test 2: Invalid Token
**Steps:**
1. Login successfully
2. Manually modify auth token in browser cookies
3. Try to access protected page

**Expected:**
- Redirect to login page
- Generic error message (no technical details)

---

## Security Testing

### Protected Routes

#### Test 1: Unauthenticated Access
**Steps:**
1. Ensure you are logged out
2. Try to access protected URLs directly:
   - `http://127.0.0.1:3000/patients`
   - `http://127.0.0.1:3000/examinations`
   - `http://127.0.0.1:3000/dashboard`

**Expected:**
- Redirect to login page for all protected routes
- No data exposed

#### Test 2: Authenticated Access
**Steps:**
1. Login successfully
2. Access protected URLs

**Expected:**
- Access granted to all protected routes
- Data displayed correctly

### Session Management

#### Test 1: Session Persistence
**Steps:**
1. Login successfully
2. Close browser tab (not entire browser)
3. Open new tab and navigate to application

**Expected:**
- User remains logged in
- Session persists across tabs

#### Test 2: Logout Clears Session
**Steps:**
1. Login successfully
2. Logout
3. Try to access protected page

**Expected:**
- Session cleared
- Redirect to login page
- Cannot access protected routes

### Generic Error Messages

#### Test 1: Login Error Messages
**Steps:**
1. Try to login with wrong username
2. Try to login with wrong password

**Expected:**
- Generic message: "Invalid credentials"
- No indication of whether username or password is wrong
- No technical details exposed

#### Test 2: Server Error Messages
**Steps:**
1. Trigger a server error (e.g., stop Azurite)
2. Try to create a patient

**Expected:**
- Generic message: "An error occurred. Please try again."
- No stack traces or technical details
- Detailed error logged server-side only

### Account Lockout

#### Test 1: Failed Login Attempts
**Steps:**
1. Attempt login with wrong password 5 times
2. Check account status

**Expected:**
- After 5 failed attempts: Account locked for 30 minutes
- Message: "Account locked due to too many failed attempts. Try again in 30 minutes."
- Cannot login even with correct password until lockout expires

#### Test 2: Lockout Expiration
**Steps:**
1. Trigger account lockout (5 failed attempts)
2. Wait 30 minutes
3. Try to login with correct password

**Expected:**
- After 30 minutes: Lockout expires
- Can login successfully with correct credentials

---

## Known Limitations

The following features are **not yet implemented** in the minimal UI:

### 1. PDF Generation
- **Status:** Not implemented
- **Workaround:** None (planned for future release)
- **Impact:** Cannot generate PDF reports from examinations

### 2. Email Reports
- **Status:** Not implemented
- **Workaround:** None (planned for future release)
- **Impact:** Cannot email examination reports to patients

### 3. User Management
- **Status:** Not implemented
- **Workaround:** Use init-database.ps1 to create admin user only
- **Impact:** Cannot create/edit/delete users through UI

### 4. Advanced Search
- **Status:** Basic search only (by name)
- **Workaround:** Use patient list and manual filtering
- **Impact:** Cannot search by MRN, phone, or other fields

### 5. Audit Logs Viewer
- **Status:** Not implemented
- **Workaround:** Query Azure Table Storage directly
- **Impact:** Cannot view audit logs through UI

### 6. Bulk Operations
- **Status:** Not implemented
- **Workaround:** Perform operations one at a time
- **Impact:** Cannot bulk delete or bulk update

### 7. Export Functionality
- **Status:** Not implemented
- **Workaround:** None
- **Impact:** Cannot export patient or examination data

### 8. Image Upload
- **Status:** Not implemented
- **Workaround:** None
- **Impact:** Cannot attach ultrasound images to examinations

### 9. Multi-language Support
- **Status:** English only
- **Workaround:** None
- **Impact:** Bulgarian medical terminology not fully supported in UI

### 10. Mobile Responsive Design
- **Status:** Desktop-optimized only
- **Workaround:** Use desktop browser
- **Impact:** May not display correctly on mobile devices

---

## Troubleshooting

### Common Issues and Solutions

#### Issue 1: "Cannot connect to server"

**Symptoms:**
- Error message when trying to login or perform operations
- Network errors in browser console

**Solutions:**
1. Check that all 3 terminals are running:
   - Terminal 1: Azurite
   - Terminal 2: Azure Functions
   - Terminal 3: Frontend
2. Verify backend is accessible: `http://localhost:7071/api/HealthCheck`
3. Check for port conflicts (7071, 3000, 10002)
4. Restart all services

#### Issue 2: "Database initialization failed"

**Symptoms:**
- init-database.ps1 script fails
- Error creating admin user

**Solutions:**
1. Ensure Azurite is running (Terminal 1)
2. Ensure backend is running (Terminal 2)
3. Check backend logs for detailed error
4. Try deleting Azurite data: `Remove-Item -Recurse -Force c:\azurite`
5. Restart Azurite and backend
6. Run init-database.ps1 again

#### Issue 3: "Port already in use"

**Symptoms:**
- Error starting Azurite, backend, or frontend
- Message: "Port XXXX is already in use"

**Solutions:**
1. Find process using the port:
   ```powershell
   netstat -ano | findstr :7071
   netstat -ano | findstr :3000
   netstat -ano | findstr :10002
   ```
2. Kill the process:
   ```powershell
   taskkill /PID <PID> /F
   ```
3. Restart the service

#### Issue 4: "Session expired" or "Unauthorized"

**Symptoms:**
- Randomly redirected to login page
- "Unauthorized" errors

**Solutions:**
1. Check browser cookies are enabled
2. Clear browser cache and cookies
3. Login again
4. Check backend logs for authentication errors

#### Issue 5: Validation errors not showing

**Symptoms:**
- Form submits with invalid data
- No validation error messages

**Solutions:**
1. Check browser console for JavaScript errors
2. Verify frontend is running latest code
3. Clear browser cache
4. Restart frontend (Terminal 3)

#### Issue 6: Data not persisting

**Symptoms:**
- Created patients/examinations disappear after refresh
- Data not saved

**Solutions:**
1. Check Azurite is running (Terminal 1)
2. Check backend logs for storage errors
3. Verify Azurite data directory exists: `c:\azurite`
4. Check Azurite logs: `c:\azurite\debug.log`

#### Issue 7: "Patient was modified by another user"

**Symptoms:**
- ETag conflict error when updating
- Cannot save changes

**Solutions:**
1. This is expected behavior for concurrent updates
2. Refresh the page to get latest data
3. Re-apply your changes
4. Save again

### How to Check Logs

#### Frontend Logs (Browser Console)
1. Open browser Developer Tools (F12)
2. Go to Console tab
3. Look for errors or warnings
4. Check Network tab for failed API requests

#### Backend Logs (Terminal 2)
1. Look at Terminal 2 where Azure Functions is running
2. Detailed error messages appear here
3. Look for stack traces and error details
4. Check for validation errors, database errors, etc.

#### Azurite Logs
1. Check Terminal 1 for Azurite output
2. Review debug log: `c:\azurite\debug.log`
3. Look for connection errors or storage errors

### How to Reset the Database

**Warning:** This will delete ALL data including patients and examinations.

#### Option 1: Delete Azurite Data
```powershell
# Stop Azurite (Ctrl+C in Terminal 1)
Remove-Item -Recurse -Force c:\azurite

# Restart Azurite
.\start-azurite.ps1

# Restart backend (Ctrl+C in Terminal 2, then restart)
.\start-functions.ps1

# Reinitialize database
.\init-database.ps1
```

#### Option 2: Use Azure Storage Explorer
1. Download and install [Azure Storage Explorer](https://azure.microsoft.com/features/storage-explorer/)
2. Connect to local Azurite
3. Delete tables manually
4. Restart backend
5. Run init-database.ps1

### Getting Help

If you encounter issues not covered in this guide:

1. **Check AGENTS.md** for project-specific patterns and decisions
2. **Review backend logs** in Terminal 2 for detailed error messages
3. **Check browser console** for frontend errors
4. **Verify all services are running** (3 terminals)
5. **Try resetting the database** as a last resort

---

## Testing Checklist

Use this checklist to ensure comprehensive testing:

### Setup
- [ ] All 3 terminals running (Azurite, Backend, Frontend)
- [ ] Database initialized with admin user
- [ ] Can access login page at http://127.0.0.1:3000

### Authentication
- [ ] Login with valid credentials
- [ ] Login with invalid credentials (error shown)
- [ ] Account lockout after 5 failed attempts
- [ ] Session persists across page refreshes
- [ ] Logout clears session
- [ ] Protected routes redirect to login when not authenticated

### Patient Management
- [ ] Create patient with valid data
- [ ] Create patient with invalid data (validation errors shown)
- [ ] View patient details
- [ ] Edit patient information
- [ ] Search patients by name
- [ ] MRN auto-generated correctly (MRN-YYYY-NNNNNN)

### Examination Management
- [ ] Create examination with valid data
- [ ] Create examination with invalid data (validation errors shown)
- [ ] View examination details
- [ ] Edit examination information
- [ ] Biometry values must be integers
- [ ] Doppler values allow floats
- [ ] Gestational age format validated (XXw Xd)
- [ ] Exam date cannot be in future

### Validation
- [ ] Age validation (2-99 years)
- [ ] Biometry integer validation (BPD, HC, AC, FL, EFW)
- [ ] Doppler float validation (PI, RI)
- [ ] Gestational age format validation
- [ ] Date validation (no future dates)
- [ ] Email validation
- [ ] Password validation (12 characters minimum)

### Error Handling
- [ ] Network errors show user-friendly messages
- [ ] Validation errors displayed clearly
- [ ] Concurrent update conflicts handled (ETag)
- [ ] Generic error messages (no technical details exposed)

### Security
- [ ] Protected routes require authentication
- [ ] Session management works correctly
- [ ] Generic error messages for security
- [ ] Account lockout after failed attempts

---

**Document Version:** 1.0  
**Last Updated:** 2026-06-16  
**Tested With:** React 19, TypeScript 6.0, Azure Functions v4, Azurite

---

*Made with Bob*