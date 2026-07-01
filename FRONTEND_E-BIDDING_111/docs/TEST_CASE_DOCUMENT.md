# Test Case Document
## E-Bidding & Dispatch Management System

**Document Version:** 1.0  
**Created Date:** 2025-12-06  
**Project:** E-Bidding Dashboard  

---

## Table of Contents
1. [Functional Test Cases](#1-functional-test-cases)
2. [Integration Test Cases](#2-integration-test-cases)
3. [Negative Test Cases](#3-negative-test-cases)
4. [Acceptance Criteria](#4-acceptance-criteria)
5. [Sample Test Credentials](#5-sample-test-credentials)

---

## 1. Functional Test Cases

### 1.1 Zone Management Module

| Test Case ID | TC-ZONE-001 |
|--------------|-------------|
| **Module Name** | Zone Management |
| **Test Scenario** | Create a new zone |
| **Pre-Conditions** | User is logged in and on System Configuration page |
| **Steps to Execute** | 1. Click "+ Add Zone" button<br>2. Enter zone name "Test Zone"<br>3. Click "Add Zone" button |
| **Expected Result** | Zone is created and appears in the zones list. Success toast notification displayed. |
| **Actual Result** | - |
| **Status** | Pending |
| **Remarks** | - |

| Test Case ID | TC-ZONE-002 |
|--------------|-------------|
| **Module Name** | Zone Management |
| **Test Scenario** | Edit an existing zone |
| **Pre-Conditions** | At least one zone exists |
| **Steps to Execute** | 1. Click Edit (pencil) icon on a zone row<br>2. Modify zone name<br>3. Save changes |
| **Expected Result** | Zone name is updated in the list |
| **Actual Result** | - |
| **Status** | Pending |
| **Remarks** | Edit functionality via pencil icon |

| Test Case ID | TC-ZONE-003 |
|--------------|-------------|
| **Module Name** | Zone Management |
| **Test Scenario** | Delete an existing zone |
| **Pre-Conditions** | At least one zone exists |
| **Steps to Execute** | 1. Click Delete (trash) icon on a zone row<br>2. Confirm deletion if prompted |
| **Expected Result** | Zone is removed from the list. Associated destinations are also deleted. |
| **Actual Result** | - |
| **Status** | Pending |
| **Remarks** | Cascade delete for destinations |

| Test Case ID | TC-ZONE-004 |
|--------------|-------------|
| **Module Name** | Zone Management |
| **Test Scenario** | Verify zone list displays all zones |
| **Pre-Conditions** | Multiple zones exist in the system |
| **Steps to Execute** | 1. Navigate to System Configuration<br>2. View Zones section |
| **Expected Result** | All zones are displayed with correct names |
| **Actual Result** | - |
| **Status** | Pending |
| **Remarks** | - |

---

### 1.2 Destination Management Module

| Test Case ID | TC-DEST-001 |
|--------------|-------------|
| **Module Name** | Destination Management |
| **Test Scenario** | Create a new destination |
| **Pre-Conditions** | At least one zone exists |
| **Steps to Execute** | 1. Click "+ Add Destination"<br>2. Select a zone from dropdown<br>3. Enter destination name "Test Destination"<br>4. Click "Add Destination" |
| **Expected Result** | Destination is created and appears in the list with zone association |
| **Actual Result** | - |
| **Status** | Pending |
| **Remarks** | - |

| Test Case ID | TC-DEST-002 |
|--------------|-------------|
| **Module Name** | Destination Management |
| **Test Scenario** | Edit an existing destination |
| **Pre-Conditions** | At least one destination exists |
| **Steps to Execute** | 1. Click Edit icon on destination row<br>2. Modify destination name<br>3. Save changes |
| **Expected Result** | Destination name is updated |
| **Actual Result** | - |
| **Status** | Pending |
| **Remarks** | - |

| Test Case ID | TC-DEST-003 |
|--------------|-------------|
| **Module Name** | Destination Management |
| **Test Scenario** | Delete an existing destination |
| **Pre-Conditions** | At least one destination exists |
| **Steps to Execute** | 1. Click Delete icon on destination row<br>2. Confirm deletion |
| **Expected Result** | Destination is removed from the list |
| **Actual Result** | - |
| **Status** | Pending |
| **Remarks** | - |

| Test Case ID | TC-DEST-004 |
|--------------|-------------|
| **Module Name** | Destination Management |
| **Test Scenario** | Verify destination displays parent zone |
| **Pre-Conditions** | Destinations exist with zone associations |
| **Steps to Execute** | 1. View Destinations section |
| **Expected Result** | Each destination shows its parent zone name in parentheses |
| **Actual Result** | - |
| **Status** | Pending |
| **Remarks** | - |

---

### 1.3 Tonnage & Truck Availability Module

| Test Case ID | TC-TONN-001 |
|--------------|-------------|
| **Module Name** | Tonnage & Truck Availability |
| **Test Scenario** | Add a new tonnage option |
| **Pre-Conditions** | User is on System Configuration page |
| **Steps to Execute** | 1. Click "+ Add Tonnage"<br>2. Enter tonnage value "35"<br>3. Click "Add Tonnage" |
| **Expected Result** | New tonnage "35 Ton" appears in the list with availability = 0 |
| **Actual Result** | - |
| **Status** | Pending |
| **Remarks** | Availability auto-initialized to 0 |

| Test Case ID | TC-TONN-002 |
|--------------|-------------|
| **Module Name** | Tonnage & Truck Availability |
| **Test Scenario** | Edit tonnage value |
| **Pre-Conditions** | At least one tonnage option exists |
| **Steps to Execute** | 1. Click Edit icon on a tonnage row<br>2. Change value from "18" to "20"<br>3. Click "Save Changes" |
| **Expected Result** | Tonnage value is updated to "20 Ton". Availability remains unchanged. |
| **Actual Result** | - |
| **Status** | Pending |
| **Remarks** | Edit only affects tonnage_value, not availability |

| Test Case ID | TC-TONN-003 |
|--------------|-------------|
| **Module Name** | Tonnage & Truck Availability |
| **Test Scenario** | Delete a tonnage option |
| **Pre-Conditions** | At least one tonnage option exists |
| **Steps to Execute** | 1. Click Delete icon on a tonnage row |
| **Expected Result** | Tonnage is removed from the list. Associated dispatch rules are also deleted. |
| **Actual Result** | - |
| **Status** | Pending |
| **Remarks** | Cascade delete for dispatch rules |

| Test Case ID | TC-TONN-004 |
|--------------|-------------|
| **Module Name** | Tonnage & Truck Availability |
| **Test Scenario** | Increment truck availability |
| **Pre-Conditions** | A tonnage option exists with availability = 0 |
| **Steps to Execute** | 1. Click [+] button on a tonnage row<br>2. Click [+] again |
| **Expected Result** | Availability increases from 0 → 1 → 2 |
| **Actual Result** | - |
| **Status** | Pending |
| **Remarks** | Immediate store update |

| Test Case ID | TC-TONN-005 |
|--------------|-------------|
| **Module Name** | Tonnage & Truck Availability |
| **Test Scenario** | Decrement truck availability |
| **Pre-Conditions** | A tonnage option exists with availability > 0 |
| **Steps to Execute** | 1. Set availability to 3<br>2. Click [-] button |
| **Expected Result** | Availability decreases from 3 → 2 |
| **Actual Result** | - |
| **Status** | Pending |
| **Remarks** | - |

| Test Case ID | TC-TONN-006 |
|--------------|-------------|
| **Module Name** | Tonnage & Truck Availability |
| **Test Scenario** | Verify [-] button disabled at availability = 0 |
| **Pre-Conditions** | A tonnage option exists with availability = 0 |
| **Steps to Execute** | 1. Observe [-] button state |
| **Expected Result** | [-] button is disabled and cannot be clicked |
| **Actual Result** | - |
| **Status** | Pending |
| **Remarks** | Prevents negative availability |

---

### 1.4 Dispatch Rules Module

| Test Case ID | TC-RULE-001 |
|--------------|-------------|
| **Module Name** | Dispatch Rules |
| **Test Scenario** | Add dispatch rule with zone only |
| **Pre-Conditions** | Zones and tonnage options exist |
| **Steps to Execute** | 1. Click "+ Add Dispatch Rule"<br>2. Select Zone<br>3. Leave Destination empty<br>4. Select Tonnage<br>5. Enter Vehicle Count<br>6. Submit |
| **Expected Result** | Rule created with zone-level scope (destination = null) |
| **Actual Result** | - |
| **Status** | Pending |
| **Remarks** | Destination is optional |

| Test Case ID | TC-RULE-002 |
|--------------|-------------|
| **Module Name** | Dispatch Rules |
| **Test Scenario** | Add dispatch rule with zone and destination |
| **Pre-Conditions** | Zones with destinations and tonnage options exist |
| **Steps to Execute** | 1. Click "+ Add Dispatch Rule"<br>2. Select Zone<br>3. Select Destination<br>4. Select Tonnage<br>5. Enter Vehicle Count<br>6. Submit |
| **Expected Result** | Rule created with destination-level scope |
| **Actual Result** | - |
| **Status** | Pending |
| **Remarks** | - |

| Test Case ID | TC-RULE-003 |
|--------------|-------------|
| **Module Name** | Dispatch Rules |
| **Test Scenario** | Delete a dispatch rule |
| **Pre-Conditions** | At least one dispatch rule exists |
| **Steps to Execute** | 1. Click Delete icon on rule row |
| **Expected Result** | Rule is removed from the list |
| **Actual Result** | - |
| **Status** | Pending |
| **Remarks** | - |

| Test Case ID | TC-RULE-004 |
|--------------|-------------|
| **Module Name** | Dispatch Rules |
| **Test Scenario** | Destination dropdown filters by selected zone |
| **Pre-Conditions** | Multiple zones with different destinations exist |
| **Steps to Execute** | 1. Open Add Rule modal<br>2. Select "North Zone"<br>3. Observe Destination dropdown options |
| **Expected Result** | Only destinations belonging to "North Zone" are shown |
| **Actual Result** | - |
| **Status** | Pending |
| **Remarks** | Dynamic filtering |

---

### 1.5 Bidding Dashboard Module

| Test Case ID | TC-BID-001 |
|--------------|-------------|
| **Module Name** | Bidding Dashboard |
| **Test Scenario** | Create a new dispatch request |
| **Pre-Conditions** | User is logged in, zones and tonnage exist |
| **Steps to Execute** | 1. Click "+ New Dispatch"<br>2. Select Zone<br>3. Select Tonnage<br>4. Enter Truck Count<br>5. Click "Submit Dispatch" |
| **Expected Result** | Dispatch created, bid generated and appears in table with "Running" status |
| **Actual Result** | - |
| **Status** | Pending |
| **Remarks** | Auto-generates bid entry |

| Test Case ID | TC-BID-002 |
|--------------|-------------|
| **Module Name** | Bidding Dashboard |
| **Test Scenario** | Stop a running bid |
| **Pre-Conditions** | A bid exists with "Running" status |
| **Steps to Execute** | 1. Click "Stop" button on a running bid |
| **Expected Result** | Bid status changes to "Completed". Toast notification displayed. |
| **Actual Result** | - |
| **Status** | Pending |
| **Remarks** | - |

| Test Case ID | TC-BID-003 |
|--------------|-------------|
| **Module Name** | Bidding Dashboard |
| **Test Scenario** | Verify Stop button disabled for completed bids |
| **Pre-Conditions** | A bid exists with "Completed" status |
| **Steps to Execute** | 1. Observe Stop button state |
| **Expected Result** | Stop button is disabled |
| **Actual Result** | - |
| **Status** | Pending |
| **Remarks** | - |

| Test Case ID | TC-BID-004 |
|--------------|-------------|
| **Module Name** | Bidding Dashboard |
| **Test Scenario** | Verify bid table displays all columns |
| **Pre-Conditions** | Bids exist in the system |
| **Steps to Execute** | 1. Navigate to Bidding Dashboard |
| **Expected Result** | Table shows: Order ID, Plant, Qty (MT), Rank, Status, Action columns |
| **Actual Result** | - |
| **Status** | Pending |
| **Remarks** | - |

| Test Case ID | TC-BID-005 |
|--------------|-------------|
| **Module Name** | Bidding Dashboard |
| **Test Scenario** | Verify rank badge styling |
| **Pre-Conditions** | Bids with 1st and 2nd rank exist |
| **Steps to Execute** | 1. View bids table |
| **Expected Result** | 1st rank shows with green/success styling, 2nd rank with different style |
| **Actual Result** | - |
| **Status** | Pending |
| **Remarks** | Visual differentiation |

---

### 1.6 Dashboard Rendering & Stats

| Test Case ID | TC-DASH-001 |
|--------------|-------------|
| **Module Name** | Dashboard Stats |
| **Test Scenario** | Verify stats cards display correct values |
| **Pre-Conditions** | Data exists in the system |
| **Steps to Execute** | 1. Navigate to System Configuration |
| **Expected Result** | Stats show: Active Plants, Trucks Available, Active Bids, 1st Rank Wins |
| **Actual Result** | - |
| **Status** | Pending |
| **Remarks** | - |

| Test Case ID | TC-DASH-002 |
|--------------|-------------|
| **Module Name** | Dashboard Stats |
| **Test Scenario** | Verify Active Bids count updates |
| **Pre-Conditions** | Running bids exist |
| **Steps to Execute** | 1. Check Active Bids count<br>2. Stop a bid<br>3. Check count again |
| **Expected Result** | Active Bids count decreases by 1 |
| **Actual Result** | - |
| **Status** | Pending |
| **Remarks** | Real-time update |

---

### 1.7 Modal/Form Validations

| Test Case ID | TC-FORM-001 |
|--------------|-------------|
| **Module Name** | Form Validation |
| **Test Scenario** | Zone form - empty name validation |
| **Pre-Conditions** | Add Zone modal is open |
| **Steps to Execute** | 1. Leave zone name empty<br>2. Click "Add Zone" |
| **Expected Result** | Zone is NOT created. Form remains open. |
| **Actual Result** | - |
| **Status** | Pending |
| **Remarks** | Client-side validation |

| Test Case ID | TC-FORM-002 |
|--------------|-------------|
| **Module Name** | Form Validation |
| **Test Scenario** | Destination form - no zone selected |
| **Pre-Conditions** | Add Destination modal is open |
| **Steps to Execute** | 1. Enter destination name<br>2. Do NOT select zone<br>3. Click "Add Destination" |
| **Expected Result** | Destination is NOT created |
| **Actual Result** | - |
| **Status** | Pending |
| **Remarks** | - |

| Test Case ID | TC-FORM-003 |
|--------------|-------------|
| **Module Name** | Form Validation |
| **Test Scenario** | Tonnage form - zero/negative value |
| **Pre-Conditions** | Add Tonnage modal is open |
| **Steps to Execute** | 1. Enter "0" or "-5"<br>2. Click "Add Tonnage" |
| **Expected Result** | Tonnage is NOT created (value must be > 0) |
| **Actual Result** | - |
| **Status** | Pending |
| **Remarks** | - |

| Test Case ID | TC-FORM-004 |
|--------------|-------------|
| **Module Name** | Form Validation |
| **Test Scenario** | Dispatch form - missing required fields |
| **Pre-Conditions** | New Dispatch modal is open |
| **Steps to Execute** | 1. Leave Zone unselected<br>2. Click "Submit Dispatch" |
| **Expected Result** | Validation error toast: "Please fill in all required fields" |
| **Actual Result** | - |
| **Status** | Pending |
| **Remarks** | Zone, Tonnage, Trucks are required |

---

### 1.8 Notification System

| Test Case ID | TC-NOTIF-001 |
|--------------|-------------|
| **Module Name** | Notifications |
| **Test Scenario** | Notification created on zone add |
| **Pre-Conditions** | User on System Config |
| **Steps to Execute** | 1. Add a new zone |
| **Expected Result** | Notification added: "Zone Added" - "New zone 'X' has been added" |
| **Actual Result** | - |
| **Status** | Pending |
| **Remarks** | - |

| Test Case ID | TC-NOTIF-002 |
|--------------|-------------|
| **Module Name** | Notifications |
| **Test Scenario** | Notification created on bid status change |
| **Pre-Conditions** | A running bid exists |
| **Steps to Execute** | 1. Stop a bid |
| **Expected Result** | Notification added: "Bid Updated" - "Bid X status changed to Completed" |
| **Actual Result** | - |
| **Status** | Pending |
| **Remarks** | - |

| Test Case ID | TC-NOTIF-003 |
|--------------|-------------|
| **Module Name** | Notifications |
| **Test Scenario** | Verify notification limit |
| **Pre-Conditions** | Perform 15 actions that create notifications |
| **Steps to Execute** | 1. Check notifications list |
| **Expected Result** | Only 10 most recent notifications are stored (limit enforced) |
| **Actual Result** | - |
| **Status** | Pending |
| **Remarks** | Max 10 notifications |

---

### 1.9 Authentication Module

| Test Case ID | TC-AUTH-001 |
|--------------|-------------|
| **Module Name** | Authentication |
| **Test Scenario** | Successful login |
| **Pre-Conditions** | Valid credentials exist |
| **Steps to Execute** | 1. Select plant<br>2. Enter username "admin"<br>3. Enter password "admin123"<br>4. Click Login |
| **Expected Result** | User redirected to dashboard. isAuthenticated = true |
| **Actual Result** | - |
| **Status** | Pending |
| **Remarks** | - |

| Test Case ID | TC-AUTH-002 |
|--------------|-------------|
| **Module Name** | Authentication |
| **Test Scenario** | Failed login - wrong password |
| **Pre-Conditions** | - |
| **Steps to Execute** | 1. Select plant<br>2. Enter username "admin"<br>3. Enter wrong password<br>4. Click Login |
| **Expected Result** | Login fails. User stays on login page. |
| **Actual Result** | - |
| **Status** | Pending |
| **Remarks** | - |

| Test Case ID | TC-AUTH-003 |
|--------------|-------------|
| **Module Name** | Authentication |
| **Test Scenario** | Logout functionality |
| **Pre-Conditions** | User is logged in |
| **Steps to Execute** | 1. Click logout button |
| **Expected Result** | User redirected to login. isAuthenticated = false |
| **Actual Result** | - |
| **Status** | Pending |
| **Remarks** | - |

---

## 2. Integration Test Cases

### 2.1 Zone → Destination → Tonnage Flow

| Test Case ID | TC-INT-001 |
|--------------|-------------|
| **Module Name** | Zone-Destination Integration |
| **Test Scenario** | Create zone then add destination to it |
| **Pre-Conditions** | No zones exist |
| **Steps to Execute** | 1. Create zone "Test Zone"<br>2. Add destination "Test Dest" to "Test Zone"<br>3. Verify destination shows zone association |
| **Expected Result** | Destination correctly linked to zone |
| **Actual Result** | - |
| **Status** | Pending |
| **Remarks** | - |

| Test Case ID | TC-INT-002 |
|--------------|-------------|
| **Module Name** | Zone-Destination Integration |
| **Test Scenario** | Delete zone cascades to destinations |
| **Pre-Conditions** | Zone with destinations exists |
| **Steps to Execute** | 1. Delete the zone<br>2. Check destinations list |
| **Expected Result** | All destinations under that zone are also deleted |
| **Actual Result** | - |
| **Status** | Pending |
| **Remarks** | Cascade delete |

| Test Case ID | TC-INT-003 |
|--------------|-------------|
| **Module Name** | Tonnage-Dispatch Integration |
| **Test Scenario** | Delete tonnage cascades to dispatch rules |
| **Pre-Conditions** | Tonnage with dispatch rules exists |
| **Steps to Execute** | 1. Delete the tonnage<br>2. Check dispatch rules list |
| **Expected Result** | All dispatch rules using that tonnage are deleted |
| **Actual Result** | - |
| **Status** | Pending |
| **Remarks** | Cascade delete |

---

### 2.2 Dispatch → Bid Flow

| Test Case ID | TC-INT-004 |
|--------------|-------------|
| **Module Name** | Dispatch-Bid Integration |
| **Test Scenario** | Create dispatch auto-creates bid |
| **Pre-Conditions** | User logged in with plant selected |
| **Steps to Execute** | 1. Create dispatch request<br>2. Check bids table |
| **Expected Result** | New bid appears with dispatch_id reference |
| **Actual Result** | - |
| **Status** | Pending |
| **Remarks** | - |

| Test Case ID | TC-INT-005 |
|--------------|-------------|
| **Module Name** | Dispatch-Bid Integration |
| **Test Scenario** | Bid uses current plant name |
| **Pre-Conditions** | User logged in as "TANDA CEMENT WORKS" |
| **Steps to Execute** | 1. Create dispatch |
| **Expected Result** | Bid shows "TANDA CEMENT WORKS" as plant name |
| **Actual Result** | - |
| **Status** | Pending |
| **Remarks** | - |

---

### 2.3 State Update Flow (UI ↔ Store)

| Test Case ID | TC-INT-006 |
|--------------|-------------|
| **Module Name** | State Management |
| **Test Scenario** | Zustand store updates reflect in UI |
| **Pre-Conditions** | Zones displayed in UI |
| **Steps to Execute** | 1. Add new zone<br>2. Observe UI list |
| **Expected Result** | New zone appears immediately without page refresh |
| **Actual Result** | - |
| **Status** | Pending |
| **Remarks** | Reactive state |

| Test Case ID | TC-INT-007 |
|--------------|-------------|
| **Module Name** | State Management |
| **Test Scenario** | Availability update reflects immediately |
| **Pre-Conditions** | Tonnage with availability = 0 |
| **Steps to Execute** | 1. Click [+] button |
| **Expected Result** | Display changes from 0 to 1 immediately |
| **Actual Result** | - |
| **Status** | Pending |
| **Remarks** | No delay |

---

### 2.4 Dispatch Rule Filtering

| Test Case ID | TC-INT-008 |
|--------------|-------------|
| **Module Name** | Rule Creation Flow |
| **Test Scenario** | Zone selection filters destinations in modal |
| **Pre-Conditions** | Multiple zones with different destinations |
| **Steps to Execute** | 1. Open Add Dispatch Rule modal<br>2. Select "North Zone"<br>3. Check destination dropdown |
| **Expected Result** | Only North Zone destinations shown (Delhi, Chandigarh) |
| **Actual Result** | - |
| **Status** | Pending |
| **Remarks** | Dynamic filtering |

---

## 3. Negative Test Cases

### 3.1 Invalid/Empty Inputs

| Test Case ID | TC-NEG-001 |
|--------------|-------------|
| **Module Name** | Zone Management |
| **Test Scenario** | Empty zone name |
| **Pre-Conditions** | Add Zone modal open |
| **Steps to Execute** | 1. Leave name blank<br>2. Click Add |
| **Expected Result** | Zone not created |
| **Actual Result** | - |
| **Status** | Pending |
| **Remarks** | - |

| Test Case ID | TC-NEG-002 |
|--------------|-------------|
| **Module Name** | Zone Management |
| **Test Scenario** | Whitespace-only zone name |
| **Pre-Conditions** | Add Zone modal open |
| **Steps to Execute** | 1. Enter "   " (spaces only)<br>2. Click Add |
| **Expected Result** | Zone not created (trim validation) |
| **Actual Result** | - |
| **Status** | Pending |
| **Remarks** | - |

### 3.2 Wrong Data Formats

| Test Case ID | TC-NEG-003 |
|--------------|-------------|
| **Module Name** | Tonnage Management |
| **Test Scenario** | Non-numeric tonnage value |
| **Pre-Conditions** | Add Tonnage modal open |
| **Steps to Execute** | 1. Enter "abc"<br>2. Click Add |
| **Expected Result** | Tonnage not created (NaN check) |
| **Actual Result** | - |
| **Status** | Pending |
| **Remarks** | parseInt returns NaN |

| Test Case ID | TC-NEG-004 |
|--------------|-------------|
| **Module Name** | Tonnage Management |
| **Test Scenario** | Zero tonnage value |
| **Pre-Conditions** | Add Tonnage modal open |
| **Steps to Execute** | 1. Enter "0"<br>2. Click Add |
| **Expected Result** | Tonnage not created (value must be > 0) |
| **Actual Result** | - |
| **Status** | Pending |
| **Remarks** | - |

### 3.3 Negative Truck Counts

| Test Case ID | TC-NEG-005 |
|--------------|-------------|
| **Module Name** | Tonnage Availability |
| **Test Scenario** | Attempt to decrement below zero |
| **Pre-Conditions** | Tonnage with availability = 0 |
| **Steps to Execute** | 1. Attempt to click [-] button |
| **Expected Result** | Button is disabled. Availability remains 0. |
| **Actual Result** | - |
| **Status** | Pending |
| **Remarks** | Math.max(0, value) enforced |

| Test Case ID | TC-NEG-006 |
|--------------|-------------|
| **Module Name** | Dispatch Rules |
| **Test Scenario** | Zero vehicle count in dispatch rule |
| **Pre-Conditions** | Add Dispatch Rule modal open |
| **Steps to Execute** | 1. Fill all fields<br>2. Enter "0" for vehicle count<br>3. Submit |
| **Expected Result** | Rule not created (vehicleCount > 0 required) |
| **Actual Result** | - |
| **Status** | Pending |
| **Remarks** | - |

### 3.4 Authentication Failures

| Test Case ID | TC-NEG-007 |
|--------------|-------------|
| **Module Name** | Authentication |
| **Test Scenario** | Non-existent username |
| **Pre-Conditions** | Login page |
| **Steps to Execute** | 1. Enter username "nonexistent"<br>2. Enter any password<br>3. Login |
| **Expected Result** | Login fails. Returns false. |
| **Actual Result** | - |
| **Status** | Pending |
| **Remarks** | - |

| Test Case ID | TC-NEG-008 |
|--------------|-------------|
| **Module Name** | Authentication |
| **Test Scenario** | Wrong password for valid user |
| **Pre-Conditions** | Login page |
| **Steps to Execute** | 1. Enter username "admin"<br>2. Enter wrong password<br>3. Login |
| **Expected Result** | Login fails |
| **Actual Result** | - |
| **Status** | Pending |
| **Remarks** | - |

| Test Case ID | TC-NEG-009 |
|--------------|-------------|
| **Module Name** | Authentication |
| **Test Scenario** | No plant selected |
| **Pre-Conditions** | Login page |
| **Steps to Execute** | 1. Enter valid credentials<br>2. Do NOT select plant<br>3. Login |
| **Expected Result** | Login fails (plant required) |
| **Actual Result** | - |
| **Status** | Pending |
| **Remarks** | - |

### 3.5 Missing Required Data

| Test Case ID | TC-NEG-010 |
|--------------|-------------|
| **Module Name** | Destination Management |
| **Test Scenario** | Add destination without selecting zone |
| **Pre-Conditions** | Add Destination modal open |
| **Steps to Execute** | 1. Enter destination name only<br>2. Click Add |
| **Expected Result** | Destination not created |
| **Actual Result** | - |
| **Status** | Pending |
| **Remarks** | Zone required |

| Test Case ID | TC-NEG-011 |
|--------------|-------------|
| **Module Name** | Dispatch Creation |
| **Test Scenario** | Missing tonnage selection |
| **Pre-Conditions** | New Dispatch modal open |
| **Steps to Execute** | 1. Select zone<br>2. Enter truck count<br>3. Do NOT select tonnage<br>4. Submit |
| **Expected Result** | Validation error shown. Dispatch not created. |
| **Actual Result** | - |
| **Status** | Pending |
| **Remarks** | - |

---

## 4. Acceptance Criteria

### 4.1 Zone Management Module

| Criteria ID | Description | Status |
|-------------|-------------|--------|
| AC-ZONE-01 | User can create zones with unique names | Pending |
| AC-ZONE-02 | User can edit existing zone names | Pending |
| AC-ZONE-03 | User can delete zones | Pending |
| AC-ZONE-04 | Deleting a zone removes all associated destinations | Pending |
| AC-ZONE-05 | Zone list updates in real-time after CRUD operations | Pending |
| AC-ZONE-06 | Success toast shown after zone operations | Pending |

### 4.2 Destination Management Module

| Criteria ID | Description | Status |
|-------------|-------------|--------|
| AC-DEST-01 | User can create destinations linked to a zone | Pending |
| AC-DEST-02 | User can edit destination names | Pending |
| AC-DEST-03 | User can delete destinations | Pending |
| AC-DEST-04 | Destination displays parent zone name | Pending |
| AC-DEST-05 | Zone selection required before creating destination | Pending |

### 4.3 Tonnage & Truck Availability Module

| Criteria ID | Description | Status |
|-------------|-------------|--------|
| AC-TONN-01 | User can add tonnage options with positive values | Pending |
| AC-TONN-02 | New tonnage options initialize with availability = 0 | Pending |
| AC-TONN-03 | User can increment availability using [+] button | Pending |
| AC-TONN-04 | User can decrement availability using [-] button | Pending |
| AC-TONN-05 | [-] button disabled when availability = 0 | Pending |
| AC-TONN-06 | Availability never goes below 0 | Pending |
| AC-TONN-07 | Edit tonnage only modifies value, not availability | Pending |
| AC-TONN-08 | Deleting tonnage removes associated dispatch rules | Pending |
| AC-TONN-09 | Availability updates immediately on button click | Pending |

### 4.4 Dispatch Rules Module

| Criteria ID | Description | Status |
|-------------|-------------|--------|
| AC-RULE-01 | User can create dispatch rules with zone + tonnage + vehicle count | Pending |
| AC-RULE-02 | Destination is optional in dispatch rules | Pending |
| AC-RULE-03 | Destination dropdown filters based on selected zone | Pending |
| AC-RULE-04 | Vehicle count must be greater than 0 | Pending |
| AC-RULE-05 | User can delete dispatch rules | Pending |

### 4.5 Bidding Dashboard Module

| Criteria ID | Description | Status |
|-------------|-------------|--------|
| AC-BID-01 | User can create dispatch requests | Pending |
| AC-BID-02 | Creating dispatch auto-generates a bid entry | Pending |
| AC-BID-03 | Bid displays Order ID, Plant, Qty, Rank, Status | Pending |
| AC-BID-04 | User can stop running bids | Pending |
| AC-BID-05 | Stopped bids show "Completed" status | Pending |
| AC-BID-06 | Stop button disabled for non-running bids | Pending |
| AC-BID-07 | Rank badges visually differentiate 1st vs 2nd | Pending |

### 4.6 Authentication Module

| Criteria ID | Description | Status |
|-------------|-------------|--------|
| AC-AUTH-01 | User can login with valid credentials | Pending |
| AC-AUTH-02 | Invalid credentials prevent login | Pending |
| AC-AUTH-03 | Plant selection required for login | Pending |
| AC-AUTH-04 | User can logout and return to login page | Pending |
| AC-AUTH-05 | Session state maintained across navigation | Pending |

### 4.7 Notification System

| Criteria ID | Description | Status |
|-------------|-------------|--------|
| AC-NOTIF-01 | Notifications created for major actions | Pending |
| AC-NOTIF-02 | Maximum 10 notifications stored | Pending |
| AC-NOTIF-03 | Newest notifications appear first | Pending |

---

## 5. Sample Test Credentials

### 5.1 Sample User Accounts

| User ID | Role | Username | Password | Purpose |
|---------|------|----------|----------|---------|
| USR-001 | Admin | admin_test | Admin@123 | Full system access, configuration management |
| USR-002 | Supervisor | supervisor_test | Sup@12345 | Dispatch monitoring, bid management |
| USR-003 | Operator | operator_test | Op@45678 | Basic dispatch creation, view-only access |
| USR-004 | Admin | system_admin | SysAdmin@99 | System administration, user management |
| USR-005 | Viewer | viewer_test | View@1234 | Read-only access for reporting |

### 5.2 Password Validation Rules

| Rule | Requirement |
|------|-------------|
| Minimum Length | 8 characters |
| Uppercase | At least 1 uppercase letter |
| Lowercase | At least 1 lowercase letter |
| Number | At least 1 digit |
| Special Characters | Optional but recommended |

---

### 5.3 User Creation Test Cases

| Test Case ID | TC-USER-001 |
|--------------|-------------|
| **Module Name** | User Management |
| **Test Scenario** | Create new admin user |
| **Pre-Conditions** | Admin access available |
| **Steps to Execute** | 1. Navigate to user management<br>2. Click "Add User"<br>3. Enter username "new_admin"<br>4. Enter password "NewAdmin@123"<br>5. Select role "Admin"<br>6. Save |
| **Expected Result** | User created successfully |
| **Actual Result** | - |
| **Status** | Pending |
| **Remarks** | - |

| Test Case ID | TC-USER-002 |
|--------------|-------------|
| **Module Name** | User Management |
| **Test Scenario** | Create user with weak password |
| **Pre-Conditions** | Admin access available |
| **Steps to Execute** | 1. Try to create user with password "123" |
| **Expected Result** | Validation error: Password does not meet requirements |
| **Actual Result** | - |
| **Status** | Pending |
| **Remarks** | - |

| Test Case ID | TC-USER-003 |
|--------------|-------------|
| **Module Name** | User Management |
| **Test Scenario** | Create user with duplicate username |
| **Pre-Conditions** | User "admin" already exists |
| **Steps to Execute** | 1. Try to create user with username "admin" |
| **Expected Result** | Validation error: Username already exists |
| **Actual Result** | - |
| **Status** | Pending |
| **Remarks** | - |

---

### 5.4 Authentication Test Cases

| Test Case ID | TC-AUTH-004 |
|--------------|-------------|
| **Module Name** | Authentication |
| **Test Scenario** | Login with admin_test credentials |
| **Pre-Conditions** | admin_test user exists |
| **Steps to Execute** | 1. Select plant<br>2. Enter "admin_test"<br>3. Enter "Admin@123"<br>4. Login |
| **Expected Result** | Login successful, redirect to dashboard |
| **Actual Result** | - |
| **Status** | Pending |
| **Remarks** | - |

| Test Case ID | TC-AUTH-005 |
|--------------|-------------|
| **Module Name** | Authentication |
| **Test Scenario** | Login with operator_test credentials |
| **Pre-Conditions** | operator_test user exists |
| **Steps to Execute** | 1. Login with operator_test / Op@45678 |
| **Expected Result** | Login successful with operator role |
| **Actual Result** | - |
| **Status** | Pending |
| **Remarks** | - |

---

### 5.5 Failed Login Test Cases

| Test Case ID | TC-AUTH-006 |
|--------------|-------------|
| **Module Name** | Authentication |
| **Test Scenario** | Login with incorrect password |
| **Pre-Conditions** | - |
| **Steps to Execute** | 1. Enter "admin_test"<br>2. Enter "WrongPass123"<br>3. Login |
| **Expected Result** | Login fails. Error message displayed. |
| **Actual Result** | - |
| **Status** | Pending |
| **Remarks** | - |

| Test Case ID | TC-AUTH-007 |
|--------------|-------------|
| **Module Name** | Authentication |
| **Test Scenario** | Login with non-existent user |
| **Pre-Conditions** | - |
| **Steps to Execute** | 1. Enter "ghost_user"<br>2. Enter any password<br>3. Login |
| **Expected Result** | Login fails. User not found. |
| **Actual Result** | - |
| **Status** | Pending |
| **Remarks** | - |

| Test Case ID | TC-AUTH-008 |
|--------------|-------------|
| **Module Name** | Authentication |
| **Test Scenario** | Login with empty credentials |
| **Pre-Conditions** | - |
| **Steps to Execute** | 1. Leave username empty<br>2. Leave password empty<br>3. Login |
| **Expected Result** | Validation error. Login prevented. |
| **Actual Result** | - |
| **Status** | Pending |
| **Remarks** | - |

| Test Case ID | TC-AUTH-009 |
|--------------|-------------|
| **Module Name** | Authentication |
| **Test Scenario** | Login with SQL injection attempt |
| **Pre-Conditions** | - |
| **Steps to Execute** | 1. Enter "admin' OR '1'='1"<br>2. Enter any password<br>3. Login |
| **Expected Result** | Login fails. No security breach. |
| **Actual Result** | - |
| **Status** | Pending |
| **Remarks** | Security validation |

---

### 5.6 Password Validation Test Cases

| Test Case ID | TC-PASS-001 |
|--------------|-------------|
| **Module Name** | Password Validation |
| **Test Scenario** | Password less than 8 characters |
| **Pre-Conditions** | - |
| **Steps to Execute** | 1. Enter password "Ab1" |
| **Expected Result** | Validation error: Minimum 8 characters required |
| **Actual Result** | - |
| **Status** | Pending |
| **Remarks** | - |

| Test Case ID | TC-PASS-002 |
|--------------|-------------|
| **Module Name** | Password Validation |
| **Test Scenario** | Password without uppercase |
| **Pre-Conditions** | - |
| **Steps to Execute** | 1. Enter password "password123" |
| **Expected Result** | Validation error: Uppercase letter required |
| **Actual Result** | - |
| **Status** | Pending |
| **Remarks** | - |

| Test Case ID | TC-PASS-003 |
|--------------|-------------|
| **Module Name** | Password Validation |
| **Test Scenario** | Password without lowercase |
| **Pre-Conditions** | - |
| **Steps to Execute** | 1. Enter password "PASSWORD123" |
| **Expected Result** | Validation error: Lowercase letter required |
| **Actual Result** | - |
| **Status** | Pending |
| **Remarks** | - |

| Test Case ID | TC-PASS-004 |
|--------------|-------------|
| **Module Name** | Password Validation |
| **Test Scenario** | Password without number |
| **Pre-Conditions** | - |
| **Steps to Execute** | 1. Enter password "Passwordonly" |
| **Expected Result** | Validation error: Number required |
| **Actual Result** | - |
| **Status** | Pending |
| **Remarks** | - |

| Test Case ID | TC-PASS-005 |
|--------------|-------------|
| **Module Name** | Password Validation |
| **Test Scenario** | Valid password format |
| **Pre-Conditions** | - |
| **Steps to Execute** | 1. Enter password "ValidPass123" |
| **Expected Result** | Password accepted |
| **Actual Result** | - |
| **Status** | Pending |
| **Remarks** | Meets all criteria |

---

## 6. Test Execution Summary

### 6.1 Test Coverage Overview

| Module | Total Test Cases | Passed | Failed | Pending |
|--------|------------------|--------|--------|---------|
| Zone Management | 4 | - | - | 4 |
| Destination Management | 4 | - | - | 4 |
| Tonnage & Truck Availability | 6 | - | - | 6 |
| Dispatch Rules | 4 | - | - | 4 |
| Bidding Dashboard | 5 | - | - | 5 |
| Dashboard Stats | 2 | - | - | 2 |
| Form Validations | 4 | - | - | 4 |
| Notifications | 3 | - | - | 3 |
| Authentication | 3 | - | - | 3 |
| Integration Tests | 8 | - | - | 8 |
| Negative Tests | 11 | - | - | 11 |
| User/Password Tests | 14 | - | - | 14 |
| **TOTAL** | **68** | **-** | **-** | **68** |

### 6.2 Acceptance Criteria Coverage

| Module | Total Criteria | Met | Not Met | Pending |
|--------|----------------|-----|---------|---------|
| Zone Management | 6 | - | - | 6 |
| Destination Management | 5 | - | - | 5 |
| Tonnage & Availability | 9 | - | - | 9 |
| Dispatch Rules | 5 | - | - | 5 |
| Bidding Dashboard | 7 | - | - | 7 |
| Authentication | 5 | - | - | 5 |
| Notifications | 3 | - | - | 3 |
| **TOTAL** | **40** | **-** | **-** | **40** |

---

## 7. Notes

### 7.1 Current System Limitations
- Authentication uses client-side store (mock implementation)
- No actual database - uses Zustand for state management
- Password validation not yet implemented in login form
- User management UI not yet built

### 7.2 Recommended Improvements
1. Implement server-side authentication with Lovable Cloud
2. Add password strength validation to login/registration forms
3. Implement role-based access control (RBAC)
4. Add confirmation dialogs for delete operations
5. Implement form validation with Zod schema

---

**Document End**
