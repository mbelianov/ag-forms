# Quick Start User Manual
## Prenatal Ultrasound Documentation System

**Version:** 1.0  
**Date:** June 15, 2026  
**Audience:** Medical Staff (Doctors, Administrators, Viewers)

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [How to Create a New User](#how-to-create-a-new-user)
3. [How to Create a New Patient](#how-to-create-a-new-patient)
4. [How to Create a Medical Record (Examination)](#how-to-create-a-medical-record-examination)
5. [How to Search for Patients](#how-to-search-for-patients)
6. [How to Search for Medical Records](#how-to-search-for-medical-records)
7. [Common Tasks](#common-tasks)
8. [Troubleshooting](#troubleshooting)

---

## Getting Started

### First Time Login

1. **Open the application** in your web browser:
   - Production: `https://ultrasound-app.example.com`
   - Development: `http://localhost:3000`

2. **Login with your credentials**:
   - Enter your username
   - Enter your password
   - Click "Login"

3. **Default Administrator Account** (first time setup only):
   - Username: `admin`
   - Password: `Admin123!@#$`
   - **⚠️ IMPORTANT**: Change this password immediately after first login!

### User Interface Overview

After logging in, you'll see:
- **Header**: Navigation menu with Dashboard, Patients, and Examinations
- **User Profile**: Your username displayed in the top right corner
- **Logout Button**: Sign out of the application
- **Dashboard**: Quick access cards for Patients, Examinations, and Reports

**Available Menu Items:**
- **Dashboard**: Overview and quick access
- **Patients**: Manage patient records
- **Examinations**: View and create ultrasound examinations

---

## How to Create a New User

**⚠️ IMPORTANT**: User management UI is not yet implemented in the frontend. To create additional users, you must use the API directly.

### Method 1: Using PowerShell (Recommended for Windows)

```powershell
$newUser = @{
    username = "dr.ivanova"
    password = "SecureP@ss123!"
    email = "maria.ivanova@hospital.bg"
    role = "doctor"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:7071/api/v1/auth/register" `
    -Method POST `
    -Body $newUser `
    -ContentType "application/json"
```

### Method 2: Using curl (Cross-platform)

```bash
curl -X POST http://localhost:7071/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "dr.ivanova",
    "password": "SecureP@ss123!",
    "email": "maria.ivanova@hospital.bg",
    "role": "doctor"
  }'
```

### User Roles

Choose the appropriate role when creating users:

- **admin**: Full system access
  - Create/edit/delete users (via API)
  - Manage all patients and examinations
  - Access all system features
  
- **doctor**: Clinical user
  - Create/edit patients
  - Create/edit examinations
  - Generate reports
  - Cannot manage users

- **viewer**: Read-only access
  - View patients and examinations
  - Cannot create or edit records
  - Cannot generate reports

### Password Requirements

Passwords must meet these criteria:
- ✓ Minimum 12 characters
- ✓ At least one uppercase letter (A-Z)
- ✓ At least one lowercase letter (a-z)
- ✓ At least one number (0-9)
- ✓ At least one special character (!@#$%^&*)

### Example: Creating a Doctor User

**PowerShell:**
```powershell
$newUser = @{
    username = "dr.petrov"
    password = "DoctorPass2026!"
    email = "ivan.petrov@hospital.bg"
    role = "doctor"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:7071/api/v1/auth/register" `
    -Method POST `
    -Body $newUser `
    -ContentType "application/json"
```

**curl:**
```bash
curl -X POST http://localhost:7071/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "dr.petrov",
    "password": "DoctorPass2026!",
    "email": "ivan.petrov@hospital.bg",
    "role": "doctor"
  }'
```

**Result**: Dr. Petrov can now log in at http://localhost:3000 and start documenting examinations.

### Creating Multiple Users

You can create multiple users by repeating the process with different usernames and emails. Each username must be unique.

---

## How to Create a New Patient

**Required Role:** Administrator or Doctor

### Step-by-Step Instructions

1. **Navigate to Patients**
   - Click "Patients" in the sidebar
   - Or click "New Patient" from the dashboard

2. **Click "Create New Patient" Button**
   - Located at the top right of the Patients page

3. **Fill in Patient Information**

   | Field | Description | Required | Example |
   |-------|-------------|----------|---------|
   | Full Name | Patient's complete name | ✓ | `Мария Иванова` |
   | Age | Patient age (2-99 years) | ✓ | `28` |
   | Address | Residential address | Optional | `София, ул. Витоша 15` |
   | Phone | Contact phone number | Optional | `+359888123456` |
   | Email | Patient email address | Optional | `maria.ivanova@email.bg` |

4. **Click "Create Patient"**
   - System automatically generates a Medical Record Number (MRN)
   - Format: `MRN-YYYY-NNNNNN` (e.g., `MRN-2026-001234`)
   - Patient is immediately available for examinations

### Important Notes

- **Age Validation**: Must be between 2 and 99 years
- **MRN Generation**: Automatic and unique for each patient
- **Bulgarian Names**: System supports Cyrillic characters
- **Phone Format**: International format recommended (+359...)

### Example: Creating a Patient

```
Full Name: Мария Иванова
Age: 28
Address: София, ул. Витоша 15, ап. 5
Phone: +359888123456
Email: maria.ivanova@email.bg
```

**Result**: 
- Patient created with MRN: `MRN-2026-001234`
- Ready for ultrasound examinations
- Appears in patient list immediately

---

## How to Create a Medical Record (Examination)

**Required Role:** Administrator or Doctor

### Step-by-Step Instructions

1. **Select a Patient**
   - Navigate to "Patients" page
   - Search for or select the patient
   - Click on patient name to open patient details

2. **Click "New Examination" Button**
   - Located in the patient details page
   - Or use "Create Examination" from the Examinations menu

3. **Fill in Examination Form**

   The examination form has multiple sections:

#### Section 1: Basic Information

| Field | Description | Required | Example |
|-------|-------------|----------|---------|
| Exam Date | Date of examination | ✓ | `2026-06-12` |
| Status | Examination status | ✓ | `Draft` or `Completed` |

#### Section 2: Pregnancy Data

| Field | Description | Required | Example |
|-------|-------------|----------|---------|
| Last Menstrual Period (LMP) | First day of last period | ✓ | `2026-01-15` |
| Ultrasound Date | Date of this ultrasound | ✓ | `2026-06-12` |
| Gestational Age | Calculated automatically | Auto | `28w 3d` |
| Obstetric History | Gravida/Para notation | Optional | `G1P0` |
| Family History | Relevant family history | Optional | `None` |

#### Section 3: Ultrasound Findings

| Field | Description | Required | Example |
|-------|-------------|----------|---------|
| Presentation | Fetal position | ✓ | `Cephalic` |
| Gender | Fetal gender | Optional | `Female` |
| Heart Rate | Beats per minute | ✓ | `145` |
| Fetal Movement | Activity level | ✓ | `Active` |
| Placenta | Location and grade | ✓ | `Anterior, Grade 1` |
| Amniotic Fluid | Volume assessment | ✓ | `Normal` |
| Umbilical Cord | Vessel count | ✓ | `3 vessels` |

#### Section 4: Biometry (Measurements)

**⚠️ IMPORTANT**: All biometry values must be **integers** (whole numbers), not decimals.

| Measurement | Description | Unit | Example |
|-------------|-------------|------|---------|
| BPD | Biparietal Diameter | mm | `52` |
| HC | Head Circumference | mm | `185` |
| AC | Abdominal Circumference | mm | `163` |
| FL | Femur Length | mm | `35` |
| EFW | Estimated Fetal Weight | g | `425` |

**System automatically calculates**:
- Gestational age from measurements
- Percentiles for each measurement
- Expected delivery date

#### Section 5: Anatomical Survey

Check each anatomical structure:
- ☐ Head: Normal/Abnormal
- ☐ Brain: Normal/Abnormal
- ☐ Heart: 4-chamber view
- ☐ Abdomen: Normal/Abnormal
- ☐ Kidneys: Bilateral, normal
- ☐ Limbs: Normal/Abnormal
- ☐ Skeleton: Normal/Abnormal

#### Section 6: Doppler Studies (Optional)

**Note**: Doppler values CAN be decimals.

| Artery | PI (Pulsatility Index) | RI (Resistance Index) |
|--------|------------------------|----------------------|
| Uterine Artery (Right) | `0.85` | `0.52` |
| Uterine Artery (Left) | `0.88` | `0.54` |
| Umbilical Artery | `1.02` | `0.65` |

#### Section 7: Comments and Conclusion

- **Comments**: Free text for additional observations
- **Conclusion**: Summary of findings
- **Recommendations**: Follow-up instructions

4. **Save Examination**
   - Click "Save as Draft" to continue later
   - Click "Complete Examination" to finalize
   - System validates all required fields

5. **Generate Report (Optional)**
   - Click "Generate PDF Report"
   - Report opens in new window
   - Can be printed or saved
   - Can be emailed to patient (if email provided)

### Validation Rules

**Critical Validations**:
- ✓ Exam date cannot be in the future
- ✓ Patient age must be 2-99 years
- ✓ Biometry values must be integers (no decimals)
- ✓ Doppler values can be decimals
- ✓ Gestational age format: `28w 3d`

### Example: Complete Examination

```
Basic Information:
- Exam Date: 2026-06-12
- Status: Completed

Pregnancy Data:
- LMP: 2026-01-15
- Ultrasound Date: 2026-06-12
- Gestational Age: 28w 3d (calculated)
- Obstetric History: G1P0

Ultrasound Findings:
- Presentation: Cephalic
- Gender: Female
- Heart Rate: 145 bpm
- Fetal Movement: Active
- Placenta: Anterior, Grade 1
- Amniotic Fluid: Normal
- Umbilical Cord: 3 vessels

Biometry:
- BPD: 52 mm
- HC: 185 mm
- AC: 163 mm
- FL: 35 mm
- EFW: 425 g

Anatomical Survey:
- All structures: Normal

Doppler Studies:
- Uterine Artery Right: PI 0.85, RI 0.52
- Uterine Artery Left: PI 0.88, RI 0.54
- Umbilical Artery: PI 1.02, RI 0.65

Comments: Normal examination. All parameters within normal limits.
```

**Result**: Examination saved and available for reporting.

---

## How to Search for Patients

### Quick Search (Header Search Bar)

1. **Click on the search bar** in the header
2. **Type patient name or MRN**
   - Example: `Мария` or `MRN-2026-001234`
3. **Select from dropdown results**
4. **Click to open patient details**

### Advanced Search (Patients Page)

1. **Navigate to Patients page**
2. **Use search filters**:

   | Filter | Description | Example |
   |--------|-------------|---------|
   | Name | Patient name (partial match) | `Мария` |
   | MRN | Medical Record Number | `MRN-2026-001234` |
   | Age Range | Min and max age | `25-35` |
   | Created Date | Date range filter | `2026-06-01 to 2026-06-15` |

3. **Click "Search"**
4. **Results display in table**:
   - Patient Name
   - Age
   - MRN
   - Number of Examinations
   - Last Examination Date

### Search Tips

- **Partial Name Search**: Type first few letters
- **Cyrillic Support**: Works with Bulgarian names
- **Case Insensitive**: `мария` = `Мария` = `МАРИЯ`
- **MRN Search**: Exact match required
- **Sort Results**: Click column headers to sort

### Example Searches

**Search by Name**:
```
Search: Иванова
Results: All patients with "Иванова" in their name
```

**Search by MRN**:
```
Search: MRN-2026-001234
Results: Exact patient with that MRN
```

**Search by Age Range**:
```
Min Age: 25
Max Age: 35
Results: All patients aged 25-35
```

---

## How to Search for Medical Records

### Search by Patient

1. **Open Patient Details**
   - Search for patient (see above)
   - Click on patient name

2. **View Examinations Tab**
   - All examinations for this patient are listed
   - Sorted by date (newest first)

### Search All Examinations

1. **Navigate to Examinations page**
2. **Use search filters**:

   | Filter | Description | Example |
   |--------|-------------|---------|
   | Patient Name | Filter by patient | `Мария Иванова` |
   | Date Range | From/To dates | `2026-06-01 to 2026-06-15` |
   | Status | Draft or Completed | `Completed` |
   | Doctor | Created by doctor | `Dr. Arabadzhikova` |

3. **Click "Search"**
4. **Results display**:
   - Patient Name
   - Exam Date
   - Status
   - Created By
   - Actions (View, Edit, Print)

### Advanced Filters

**Filter by Date Range**:
```
From: 2026-06-01
To: 2026-06-15
Results: All examinations in June 1-15, 2026
```

**Filter by Status**:
```
Status: Completed
Results: Only finalized examinations
```

**Filter by Doctor**:
```
Created By: Dr. Arabadzhikova
Results: All examinations by this doctor
```

### Viewing Examination Details

1. **Click on examination** in search results
2. **View complete examination data**:
   - All measurements
   - Calculations
   - Images (if attached)
   - Comments

3. **Available Actions**:
   - **Edit**: Modify examination (if draft)
   - **Print**: Generate PDF report
   - **Email**: Send report to patient
   - **Delete**: Soft delete (admin only)

---

## Common Tasks

### Change Your Password

1. Click on your **profile icon** (top right)
2. Select **"Change Password"**
3. Enter:
   - Current password
   - New password (min 12 characters)
   - Confirm new password
4. Click **"Update Password"**

### View Patient History

1. Search for patient
2. Click on patient name
3. View **"Examinations"** tab
4. See complete examination history
5. Click any examination to view details

### Generate PDF Report

1. Open examination details
2. Click **"Generate PDF Report"**
3. Report opens in new window
4. Options:
   - **Print**: Send to printer
   - **Save**: Download PDF
   - **Email**: Send to patient email

### Email Report to Patient

1. Open examination details
2. Verify patient has email address
3. Click **"Email Report"**
4. Confirm recipient email
5. Click **"Send"**
6. Patient receives PDF report via email

### Edit Patient Information

1. Open patient details
2. Click **"Edit Patient"**
3. Modify fields as needed
4. Click **"Save Changes"**
5. System validates and updates

### Update Examination

1. Open examination details
2. Click **"Edit Examination"**
3. Modify any section
4. Click **"Save"** or **"Complete"**
5. Changes are saved immediately

---

## Troubleshooting

### Cannot Login

**Problem**: "Invalid credentials" error

**Solutions**:
1. Verify username is correct (case-sensitive)
2. Check password (case-sensitive)
3. Ensure Caps Lock is OFF
4. Contact administrator if account is locked
5. Wait 30 minutes if locked due to failed attempts

### Cannot Create Patient

**Problem**: "Validation error" when creating patient

**Solutions**:
1. Check age is between 2-99 years
2. Verify all required fields are filled
3. Ensure phone number format is valid
4. Check email format if provided

### Cannot Save Examination

**Problem**: "Validation error" when saving examination

**Solutions**:
1. **Biometry values must be integers** (no decimals)
   - ✗ Wrong: `52.3` mm
   - ✓ Correct: `52` mm
2. Exam date cannot be in the future
3. All required fields must be completed
4. Check gestational age format: `28w 3d`

### Search Returns No Results

**Problem**: Cannot find patient or examination

**Solutions**:
1. Check spelling (especially Cyrillic characters)
2. Try partial name search
3. Verify MRN format: `MRN-YYYY-NNNNNN`
4. Expand date range filters
5. Clear all filters and try again

### PDF Report Not Generating

**Problem**: Report generation fails

**Solutions**:
1. Ensure examination is completed (not draft)
2. Verify all required fields are filled
3. Check browser allows pop-ups
4. Try different browser
5. Contact administrator if issue persists

### Email Report Failed

**Problem**: Cannot send report to patient

**Solutions**:
1. Verify patient has valid email address
2. Check email format is correct
3. Ensure examination is completed
4. Try again after a few minutes
5. Contact administrator if issue persists

### Account Locked

**Problem**: "Account locked" message

**Solutions**:
1. Wait 30 minutes for automatic unlock
2. Contact administrator for immediate unlock
3. Avoid multiple failed login attempts
4. Ensure correct password is used

### Page Not Loading

**Problem**: Application not responding

**Solutions**:
1. Check internet connection
2. Refresh browser (F5 or Ctrl+R)
3. Clear browser cache
4. Try different browser
5. Contact IT support if issue persists

---

## Getting Help

### Support Contacts

**Technical Support**:
- Email: support@hospital.bg
- Phone: +359 2 XXX XXXX
- Hours: Monday-Friday, 8:00-17:00

**Administrator**:
- Contact your system administrator for:
  - User account issues
  - Permission problems
  - System configuration

### Additional Resources

- **Full Documentation**: See `/docs` folder
- **API Reference**: `docs/04-api-specification.md`
- **Security Guide**: `docs/03-security-architecture.md`
- **Training Videos**: Available on internal portal

---

## Quick Reference Card

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl + K` | Quick search |
| `Ctrl + N` | New patient |
| `Ctrl + E` | New examination |
| `Ctrl + S` | Save current form |
| `Ctrl + P` | Print/Generate PDF |
| `Esc` | Close dialog |

### User Roles Summary

| Role | Create Users | Create Patients | Create Exams | View Only |
|------|--------------|-----------------|--------------|-----------|
| Administrator | ✓ | ✓ | ✓ | ✓ |
| Doctor | ✗ | ✓ | ✓ | ✓ |
| Viewer | ✗ | ✗ | ✗ | ✓ |

### Required Field Indicators

- **✓** = Required field
- **Optional** = Not required
- **Auto** = Automatically calculated

---

## Appendix: Field Validation Rules

### Patient Fields

| Field | Min | Max | Format | Example |
|-------|-----|-----|--------|---------|
| Name | 2 chars | 100 chars | Any | `Мария Иванова` |
| Age | 2 years | 99 years | Integer | `28` |
| Phone | - | - | International | `+359888123456` |
| Email | - | - | Valid email | `name@domain.bg` |

### Examination Fields

| Field | Min | Max | Format | Example |
|-------|-----|-----|--------|---------|
| BPD | 10 mm | 120 mm | Integer | `52` |
| HC | 50 mm | 400 mm | Integer | `185` |
| AC | 50 mm | 400 mm | Integer | `163` |
| FL | 10 mm | 100 mm | Integer | `35` |
| EFW | 100 g | 5000 g | Integer | `425` |
| Heart Rate | 100 bpm | 180 bpm | Integer | `145` |
| Doppler PI | 0.1 | 5.0 | Decimal | `0.85` |
| Doppler RI | 0.1 | 1.0 | Decimal | `0.52` |

---

**Document Version:** 1.0  
**Last Updated:** June 15, 2026  
**Next Review:** September 15, 2026

---

*For technical documentation, see the `/docs` folder in the project repository.*