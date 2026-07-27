
# TestSprite AI Testing Report(MCP)

---

## 1️⃣ Document Metadata
- **Project Name:** SudanFree-Admin
- **Date:** 2026-07-26
- **Prepared by:** TestSprite AI Team

---

## 2️⃣ Requirement Validation Summary

#### Test TC001 Administrator signs in and reaches the dashboard
- **Test Code:** [TC001_Administrator_signs_in_and_reaches_the_dashboard.py](./TC001_Administrator_signs_in_and_reaches_the_dashboard.py)
- **Test Error:** TEST BLOCKED

The authentication test could not be run — Firebase is blocking authentication requests from this origin, preventing sign-in and navigation to the dashboard.

Observations:
- The page shows the error: "Firebase: Error (auth/requests-from-referer-http://localhost:8080-are-blocked.)."
- After submitting the provided admin credentials, the application remained on the login screen and did not navigate to the dashboard.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/d05e8468-5d1c-4b8b-bc66-135ff6f07e86/f8b54d51-910f-4dd2-9c1b-e971694f3382
- **Status:** BLOCKED
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC002 Administrator approves a student request and sees generated credentials
- **Test Code:** [TC002_Administrator_approves_a_student_request_and_sees_generated_credentials.py](./TC002_Administrator_approves_a_student_request_and_sees_generated_credentials.py)
- **Test Error:** TEST BLOCKED

Login is blocked by Firebase referrer restrictions, preventing the test from proceeding to approve an enrollment request.

Observations:
- The login page shows a red error message: "Firebase: Error (auth/requests-from-referer-http://localhost:8080-are-blocked.)."
- The login form is visible and credentials were entered, but the authentication request is rejected by Firebase for this origin.
- No UI option is available to bypass or fix the Firebase referrer restriction from the application interface, so the enrollment-approval flow cannot be reached.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/d05e8468-5d1c-4b8b-bc66-135ff6f07e86/e4705aeb-a0a8-4a45-8e36-c112ffcc0d4a
- **Status:** BLOCKED
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC003 Administrator opens the Academy area after signing in
- **Test Code:** [TC003_Administrator_opens_the_Academy_area_after_signing_in.py](./TC003_Administrator_opens_the_Academy_area_after_signing_in.py)
- **Test Error:** TEST BLOCKED

The test could not be run — the login request is blocked by Firebase referer restrictions, preventing authentication and access to the dashboard.

Observations:
- The login page shows the error: "Firebase: Error (auth/requests-from-referer-http://localhost:8080-are-blocked.)."
- The page remained on the login screen after submitting credentials; the dashboard and its tabs (including Academy) were not reached.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/d05e8468-5d1c-4b8b-bc66-135ff6f07e86/74ea9999-54b6-419e-9d48-1c9443d0773a
- **Status:** BLOCKED
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC004 Administrator adds a new academy course
- **Test Code:** [TC004_Administrator_adds_a_new_academy_course.py](./TC004_Administrator_adds_a_new_academy_course.py)
- **Test Error:** TEST BLOCKED

Sign-in cannot be completed because authentication requests from this page are blocked by the backend/configuration (Firebase referer restrictions). The test cannot proceed to Academy or course creation while sign-in is blocked.

Observations:
- After submitting the login form, the page shows: "Firebase: Error (auth/requests-from-referer-http://localhost:8080-are-blocked.)" in red under the sign-in button.
- No authenticated session was established, so the Academy and Add Course functionality cannot be reached via the UI.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/d05e8468-5d1c-4b8b-bc66-135ff6f07e86/97af81cb-6ef1-42c5-812d-320adf08f84c
- **Status:** BLOCKED
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC005 Administrator deletes an existing academy course
- **Test Code:** [TC005_Administrator_deletes_an_existing_academy_course.py](./TC005_Administrator_deletes_an_existing_academy_course.py)
- **Test Error:** TEST BLOCKED

The test could not be run — authentication is blocked by Firebase referer restrictions, preventing sign-in and subsequent course deletion steps.

Observations:
- The login page shows the error: "Firebase: Error (auth/requests-from-referer-http://localhost:8080-are-blocked.)."
- The UI remained on the login screen after submitting credentials; no dashboard or Academy tab became accessible.

- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/d05e8468-5d1c-4b8b-bc66-135ff6f07e86/587c3dfb-a24a-4f0c-acc2-e954a31c18d6
- **Status:** BLOCKED
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC006 Administrator updates an existing academy course
- **Test Code:** [TC006_Administrator_updates_an_existing_academy_course.py](./TC006_Administrator_updates_an_existing_academy_course.py)
- **Test Error:** TEST BLOCKED

Authentication to the site is blocked by Firebase referer restrictions, preventing the test from signing in and continuing.

Observations:
- The login page displays the error 'Firebase: Error (auth/requests-from-referer-http://localhost:8080-are-blocked.)'.
- Submitting valid credentials did not navigate away from the login screen.
- The Academy and course editing pages could not be reached because authentication did not complete.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/d05e8468-5d1c-4b8b-bc66-135ff6f07e86/55841d5f-f20b-4683-b1bf-ac013d43f436
- **Status:** BLOCKED
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC007 Administrator reviews enrollment requests for a course
- **Test Code:** [TC007_Administrator_reviews_enrollment_requests_for_a_course.py](./TC007_Administrator_reviews_enrollment_requests_for_a_course.py)
- **Test Error:** TEST BLOCKED

The test could not be run — login is blocked by Firebase referer restrictions which prevents signing in.

Observations:
- After submitting credentials, the login form shows: 'خطأ في تسجيل الدخول: Firebase: Error (auth/requests-from-referer-http://localhost:8080-are-blocked.).'
- The application remained on the login page and no navigation to the dashboard occurred, preventing further test steps.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/d05e8468-5d1c-4b8b-bc66-135ff6f07e86/f86032c7-b6de-42a4-a49d-39019e46ed66
- **Status:** BLOCKED
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC008 Unauthorized login shows access denied
- **Test Code:** [TC008_Unauthorized_login_shows_access_denied.py](./TC008_Unauthorized_login_shows_access_denied.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/d05e8468-5d1c-4b8b-bc66-135ff6f07e86/638e25f4-dd88-4852-bf07-f6755d30fa4f
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC009 Administrator sees an empty requests state when no requests exist
- **Test Code:** [TC009_Administrator_sees_an_empty_requests_state_when_no_requests_exist.py](./TC009_Administrator_sees_an_empty_requests_state_when_no_requests_exist.py)
- **Test Error:** TEST BLOCKED

Signing in could not be completed because Firebase blocked authentication requests from this referer. The test cannot proceed to verify the course Requests tab without a successful sign-in.

Observations:
- A red error message is visible below the login button: "Firebase: Error (auth/requests-from-referer-http://localhost:8080-are-blocked.)."
- The page remained on the login screen after clicking the 'تسجيل الدخول login' button and no authenticated UI (e.g., Academy tab content) became available.

- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/d05e8468-5d1c-4b8b-bc66-135ff6f07e86/7d978827-b6ef-4cba-bc83-4f07faafef6f
- **Status:** BLOCKED
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---


## 3️⃣ Coverage & Matching Metrics

- **11.11** of tests passed

| Requirement        | Total Tests | ✅ Passed | ❌ Failed  |
|--------------------|-------------|-----------|------------|
| ...                | ...         | ...       | ...        |
---


## 4️⃣ Key Gaps / Risks
{AI_GNERATED_KET_GAPS_AND_RISKS}
---