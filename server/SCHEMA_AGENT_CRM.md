# Schema reference: dump.sql (database iapply_crm)

This document lists table and column names from **dump.sql** so server code stays aligned and errors are avoided.

**Server code** (leadsService, attendanceService, companiesService, etc.) now resolves table names using these lowercase/one-word names first so the database **iapply_crm** (from dump.sql) is used without errors.

## Table names (dump.sql uses PascalCase; resolved case-insensitively)

- `leads`
- `users`
- `attendance`
- `attendancerecords`
- `companies`
- `companyusers`
- `meetings`
- `documents`
- `leadtags`
- `ctaactivities`
- `travelclaims`
- `emailtemplates`
- `emailcampaigns`
- `fieldconfigs`
- `firebaseprojects`
- `importhistory`
- `notificationpreferences`
- `websitesignupleads`

## leads

Identifier columns: **firebase_id** (text), **id** (text). Use either for lookups/updates.

| DB column (exact)   | Frontend / API often uses |
|--------------------|---------------------------|
| firebase_id        | id (when from Firestore)  |
| id                 | id (when set)             |
| agency_name        | agencyName                |
| account_manager    | accountManager            |
| sales_person       | salesPerson               |
| agent_category     | agentCategory             |
| leadSource         | leadSource                |
| contacts           | contacts                  |
| tags               | tags                      |
| followUps          | followUps                 |
| countryInterest    | countryInterest           |
| websiteLink        | websiteLink               |
| remarks            | remarks                   |
| icpScore           | icpScore                  |
| status             | status                    |
| createdBy          | createdBy                 |
| createdAt          | createdAt                 |
| updatedAt          | updatedAt                 |
| updated_at         | updatedAt (datetime)      |
| agencyDocuments    | agencyDocuments           |
| onboardingDate     | onboardingDate            |

Server code uses **resolveColumnName** (camelCase → snake_case) so camelCase keys map to these DB columns.

## users

Identifier: **firebase_id**, **id** (both text). Email in **email** or **userEmail**.

## attendance

Identifier: **firebase_id** (varchar PK). Columns include: username, date, checkInTime, checkOutTime, status, action, startLocation, endLocation, start_location, end_location, createdAt, workingHours, etc.

## attendancerecords

Similar to attendance; columns: firebase_id, username, date, checkInTime, status, action, startLocation, endLocation, location, etc.

---

When adding or changing queries, use the **exact** column names above or resolve via `getColumns()` / `resolveColumnName()` so dump.sql (iapply_crm) and code stay in sync.
