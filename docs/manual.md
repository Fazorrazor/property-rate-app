# Krowor Municipal Assembly (KKMA)
## Rate Revenue & Cadastral Administration Console
### Enterprise Stakeholder Operational Manual & Standard Operating Procedures (SOP)

**Document Classification:** Official Municipal Administration & Operational Manual  
**Governing Legislation:** Local Governance Act, 2016 (Act 936) & Public Financial Management Act, 2016 (Act 921)  
**Target Audience:** Municipal Chief Executive (MCE), Coordinating Director (MCD), Finance Director, Revenue Mobilization Officers, IT Administrators, Internal Audit Unit  
**System Version:** 2.4.0 (Enterprise Architecture)  

---

## Table of Contents
1. [Executive Summary & Legal Governance](#1-executive-summary--legal-governance)
2. [Architectural Separation & System Access](#2-architectural-separation--system-access)
3. [Officer Authentication & Security Protocol](#3-officer-authentication--security-protocol)
4. [Executive KPI Dashboard & Financial Metrics](#4-executive-kpi-dashboard--financial-metrics)
5. [Cadastral Registry Module (`REGISTRY`)](#5-cadastral-registry-module-registry)
6. [Ratepayer Directory & Master Dossiers (`RATEPAYERS`)](#6-ratepayer-directory--master-dossiers-ratepayers)
7. [Transactional SMS & Rollout Engine (`SMS_CENTER`)](#7-transactional-sms--rollout-engine-sms_center)
8. [Statutory Defaulters & Legal Debt Recovery (`DEFAULTERS`)](#8-statutory-defaulters--legal-debt-recovery-defaulters)
9. [Municipal Treasury & Revenue Settlements (`TREASURY`)](#9-municipal-treasury--revenue-settlements-treasury)
10. [Administrative Audit Trail & Security Ledger (`AUDIT_LOGS`)](#10-administrative-audit-trail--security-ledger-audit_logs)
11. [Gateway Configuration & Carrier Top-Up (`SETTINGS`)](#11-gateway-configuration--carrier-top-up-settings)
12. [Standard Operating Procedures (SOP) & Troubleshooting](#12-standard-operating-procedures-sop--troubleshooting)

---

## 1. Executive Summary & Legal Governance

The **KKMA Rate Revenue & Cadastral Administration Console** is the central digital back-office engine powering property rating, billing rollouts, revenue collection, citizen communication, and fiscal reconciliation for the Krowor Municipal Assembly.

### Legal Mandate
Under the **Local Governance Act, 2016 (Act 936)**, Sections 144 through 169:
- The Assembly is empowered to levy and collect general rates, special rates, and fees on all rateable premises within its administrative jurisdiction.
- The Municipal Finance Directorate must maintain an accurate Cadastral Valuation Roll and issue statutory demand notices for overdue obligations.
- Failure to settle assessed rates constitutes a statutory default, empowering the Assembly to initiate recovery actions, legal summons, and distraint proceedings.

### Primary Operational Objectives
1. **100% Cadastral Coverage**: Maintain a synchronized digital cadastre containing all property classifications (Residential, Commercial, Industrial, Mixed-Use, and Institutional).
2. **Frictionless Citizen Compliance**: Deliver instant billing assessments and 2-click Mobile Money (MTN, Telecel, AT) and Card checkout deep links via direct SMS notices.
3. **Transparent Back-Office Accounting**: Guarantee zero discrepancies between online gateway settlements (Paystack), counter cashier payments (GCR Value Books), and municipal bank deposits.
4. **Auditable Chain of Custody**: Record every back-office action, payment receipt, valuation change, and SMS dispatch in an immutable audit ledger compliant with the Auditor-General's requirements.

---

## 2. Architectural Separation & System Access

The municipal digital platform operates under a strict **Two-Domain Architectural Separation**:

```
+-----------------------------------------------------------------------------------+
|                           MUNICIPAL ENTERPRISE ARCHITECTURE                       |
+-----------------------------------------------------------------------------------+
                                          |
        +---------------------------------+---------------------------------+
        |                                                                   |
        v                                                                   v
+-------------------------------+                   +-------------------------------+
|     CITIZEN MOBILE/WEB APP    |                   |      ADMIN PORTAL CONSOLE     |
|       (ratepayerDb Scope)     |                   |       (adminDb Scope)         |
+-------------------------------+                   +-------------------------------+
| - Ratepayer Account Holders   |                   | - Municipal Officers Only     |
| - Property Assessment Bills   |                   | - Cadastre Management Roll    |
| - Instant Mobile Money/Card   |                   | - Batch Annual Billing Engine |
| - Digital Receipt Downloads   |                   | - Statutory Defaulter Queue   |
| - Zero Access to Back-Office  |                   | - SMS Carrier Rollout Engine  |
|   Ledgers or Audit Trails     |                   | - Value Books & Treasury      |
+-------------------------------+                   +-------------------------------+
                                          |
                                          v
                    +-------------------------------------------+
                    |        SHARED POSTGRESQL / SUPABASE       |
                    |             100% ACID Database            |
                    |  - User (Citizens/Ratepayers)             |
                    |  - AdminUser (Municipal Officers Only)    |
                    |  - Property, Bill, Receipt, AuditLog      |
                    +-------------------------------------------+
```

### Database Entity Isolation
- **`User` Table**: Restricted strictly to public citizens and property account holders. Contains phone numbers, property ownership links, and public payment histories.
- **`AdminUser` Table**: Reserved exclusively for back-office municipal administrators. Completely isolated from citizen records. Municipal officers authenticate via unique officer usernames and high-entropy security authorization passwords.

---

## 3. Officer Authentication & Security Protocol

Access to the administration console is strictly restricted to designated municipal officers.

### Security Specifications
- **Protocol**: 256-Bit TLS Encrypted Session.
- **Session Duration**:
  - *Standard Session*: Expires automatically after 24 hours of inactivity.
  - *Remembered Terminal*: 7-day secure persistence for authorized administrative hardware.
- **Audit Logging**: Every sign-in attempt, successful entry, and manual logout is committed to the security audit ledger.

### Step-by-Step Officer Sign-In
1. Navigate to the Municipal Console URL: `http://localhost:3000/login` (or deployed domain).
2. **Officer Username Field**: Enter your registered officer username (e.g., `Heinz`).
   > [!NOTE]
   > Telephone numbers are strictly rejected on the administrator login screen. Officers must use their official assigned username.
3. **Authorization Key Field**: Enter your multi-factor security password (e.g., `OPx9$vM2#qL8!kP4@wN7^zC3*bR6&yT5`).
4. **Remember this terminal**: Check this box only if using a dedicated municipal workstation.
5. Click **Login**. Upon verification (<400ms), you are automatically transitioned to the executive dashboard.

---

## 4. Executive KPI Dashboard & Financial Metrics

Upon logging in, the Cadastral Registry displays four primary Executive KPI metric cards reflecting real-time municipal fiscal health:

```
+----------------------------------------------------------------------------------------------------+
|                                    EXECUTIVE FISCAL KPI OVERVIEW                                   |
+---------------------------------+---------------------------------+--------------------------------+
|      TOTAL ASSESSED DEMAND      |        REVENUE COLLECTED        |       CUMULATIVE ARREARS       |
|          GH₵ 2,982,593.42       |          GH₵ 252,389.70         |        GH₵ 1,188,773.00        |
|     FY 2025 • 2,407 accounts    |    Efficiency: 8.46% of demand  |    Prior Debt • Act 936        |
+---------------------------------+---------------------------------+--------------------------------+
|                                    STATUTORY DEFAULTERS           |
|                                       1,167 accounts              |
|                                       Status: Recovery Active     |
+-------------------------------------------------------------------+
```

### How to Read the Metrics

#### 1. Total Assessed Demand
- **What it represents**: The gross municipal fiscal demand billed across all registered cadastre properties for the active financial year (FY 2025).
- **Calculation Formula**:
  $$\text{Total Assessed Demand} = \sum (\text{Rateable Value} \times \text{Rate Imposed}) + \text{Prior Accumulated Arrears}$$
- **Subtext Information**: Shows the financial year (`FY 2025`) and the total active rateable accounts (e.g., `2,407 accounts`).

#### 2. Revenue Collected
- **What it represents**: The total cash value of all settled payments reconciled through both digital channels (Paystack Mobile Money & Bank Cards) and verified counter cashier receipts.
- **Collection Efficiency %**:
  $$\text{Efficiency Rate} = \left(\frac{\text{Revenue Collected}}{\text{Total Assessed Demand}}\right) \times 100$$
  - Target benchmark for KKMA: $\ge 75\%$ by fiscal year-end.

#### 3. Cumulative Arrears
- **What it represents**: Historical unpaid property rate debts carried over from previous fiscal cycles under the Local Governance Act (Act 936).
- **Executive Relevance**: Represents overdue municipal revenue that must be recovered through targeted demand notices, payment settlement agreements, or statutory enforcement.

#### 4. Statutory Defaulters
- **What it represents**: The total count of property accounts whose balance remains unpaid past the statutory settlement deadline (e.g., `1,167 accounts`).
- **Status Indicator**:
  - `Recovery Active` (Red text): Indicates active defaulters exist, requiring targeted demand notices.
  - `Compliant` (Green text): Indicates 100% compliance across the municipality.

---

## 5. Cadastral Registry Module (`REGISTRY`)

The **Cadastral Registry** is the master property ledger containing every geo-referenced land parcel and building in the municipality.

### Available Features & Actions

| Action | Visual Trigger | Operational Description |
|---|---|---|
| **Annual Batch Billing Rollout** | Top Action Bar Button (`Run Annual Billing Batch`) | Triggers mass recalculation of property bills for all accounts and queues direct dual-link SMS notices. |
| **Search & Multi-Filter** | Search Input & Dropdowns | Instant multi-token lookup across Account #, Valuation #, Owner Name, Digital Address, and Telephone. |
| **View Ratepayer Dossier** | Row Click / Dossier Action | Opens master-detail side sheet containing the owner's complete multi-property portfolio and receipts. |
| **Record Manual Payment** | Action Menu (`Record Payment`) | Issues an official General Counterfoil Receipt (GCR) for cash/cheque collected at municipal counters. |
| **Edit Property Assessment** | Action Menu (`Edit Property`) | Modifies rateable value, rate imposed, classification, and physical address with mandatory audit logging. |
| **Single SMS Notice Dispatch** | Action Menu (`Send Notice`) | Instantly dispatches a dual-link statutory demand notice to the specific property owner's phone. |
| **Export Cadastre Data** | Top Action Bar (`Export CSV`) | Downloads filtered cadastral roll for field revenue collectors and off-grid validation. |
| **Bulk CSV Import** | Top Action Bar (`Import CSV`) | Ingests new survey batches or updated valuation rolls directly into the database. |

### Detailed Workflow: Running the Annual Batch Billing Rollout
1. Ensure the Assembly has approved the Fee-Fixing Resolution and Valuation Rates for the financial year.
2. Click the **Run Annual Billing Batch** button located above the property table.
3. The system confirms the batch operation:
   - Recalculates current fees based on property classification and rateable value.
   - Rolls unpaid current fees from the previous cycle into arrears.
   - Updates account balances and marks properties as `UNPAID`.
   - Generates queued SMS billing notices equipped with deep links for every property with a registered phone number.
   - Logs the operation to the administrative audit ledger.
4. An instant toast notification confirms the number of properties successfully billed.

### Detailed Workflow: Recording a Counter Cash Payment
1. Locate the property by entering the Account Number (e.g., `KKDA03991001`) in the search bar.
2. Click the **Actions** menu on the property row and select **Record Cash Payment**.
3. In the Payment Modal:
   - **Receipt / GCR Number**: Enter the serial number from the physical value book.
   - **Amount Paid (GH₵)**: Enter the exact sum collected.
   - **Settlement Allocation**: Select whether the payment settles:
     - *Total Balance*
     - *Arrears First* (statutory default)
     - *Current Year Fee Only*
   - **Payment Method**: Select `CASH`, `MOMO_OFFLINE`, `BANK_DRAFT`, or `DIRECT_DEPOSIT`.
   - **Payer Contact**: Enter the phone number of the person making the payment.
4. Click **Confirm & Issue Receipt**.
5. The property balance updates immediately, and an SMS receipt is queued to the payer.

---

## 6. Ratepayer Directory & Master Dossiers (`RATEPAYERS`)

The **Ratepayer Directory** aggregates citizen records across the entire municipal cadastre, enabling multi-property portfolio management.

### Key Capabilities
- **Portfolio Consolidation**: If a single citizen owns five properties across different zones, the directory consolidates their total assessed valuation, total arrears, and combined amount due into one unified dossier.
- **Citizen Verification Status**: Displays whether the ratepayer has verified their identity via SMS OTP on the Citizen Portal.

### The Master-Detail Side Sheet (Ratepayer Dossier)
Clicking any ratepayer row opens a slide-out panel containing four comprehensive audit tabs:
1. **Portfolio Tab**: Interactive cards for each property owned by the citizen, showing individual valuation, rateable fees, and current payment status.
2. **Receipt Archive Tab**: Complete chronological ledger of every payment receipt issued to this ratepayer, including transaction IDs, payment dates, amounts, and settlement methods.
3. **Communication History Tab**: Historical log of every SMS notification, billing notice, and reminder sent to the citizen's mobile number with real-time carrier delivery receipts.
4. **Audit Trail Tab**: Log of every municipal officer modification affecting this ratepayer's accounts.

---

## 7. Transactional SMS & Rollout Engine (`SMS_CENTER`)

The SMS Center manages all transactional municipal notices, billing broadcasts, and legal demand dispatches.

### The Dual Direct Link Standard
To eliminate barrier friction and drive immediate digital payments, **every SMS dispatched by the system strictly contains two deep links**:

```
+-----------------------------------------------------------------------------------+
|                        MUNICIPAL DUAL-LINK SMS FORMAT                             |
+-----------------------------------------------------------------------------------+
| Notice from Krowor Municipal Assembly (KKMA):                                    |
| Assessment Bill for Property #KKDA03991001.                                       |
| Owner: Heinz                                                                      |
| Current Assessment: GH₵ 250.00 | Arrears: GH₵ 600.00                             |
| Total Due: GH₵ 850.00 (Due by: 31-Dec-2025)                                       |
|                                                                                   |
| [LINK 1 - View Digital Bill]:                                                     |
| http://localhost:3000/properties?accountNumber=KKDA03991001                       |
|                                                                                   |
| [LINK 2 - Instant Checkout]:                                                      |
| http://localhost:3000/properties?accountNumber=KKDA03991001&action=pay             |
|                                                                                   |
| Inquiries: 0302-XXXXXX. Act 936.                                                  |
+-----------------------------------------------------------------------------------+
```

- **Link 1 (View Assessment)**: Opens the citizen portal directly to that property's detailed digital bill without requiring login credentials.
- **Link 2 (Instant Checkout)**: Opens the citizen portal and **immediately launches the payment modal** with the total amount pre-filled for 1-click Mobile Money or Card checkout.

### Dispatch Modes
1. **Safe Simulation Mode**: For testing, staff training, and pre-rollout message validation. SMS messages are recorded in the internal database and displayed in the audit queue without consuming carrier SMS credits or transmitting to external carrier networks.
2. **Live Gateway Mode**: Transmits real-time SMS packets over Ghana domestic carrier routes (MTN, Telecel, AT) or international gateways. Requires active carrier account balance.

---

## 8. Statutory Defaulters & Legal Debt Recovery (`DEFAULTERS`)

The **Statutory Defaulters** view isolates all non-compliant property accounts requiring legal debt mobilization under Act 936.

### Defaulter Criteria
An account automatically enters the Defaulters Queue when:
1. Outstanding balance (`totalAmountDue`) is greater than `GH₵ 0.00`.
2. The statutory settlement deadline for the billing cycle has elapsed.

### Legal Escalation Protocol

```
+-------------------+      +----------------------+      +----------------------+
|   STAGE 1: SMS    | ---> |   STAGE 2: FINAL     | ---> |   STAGE 3: LEGAL     |
|   DEMAND NOTICE   |      |   WRITTEN WARNING    |      |   SUMMONS & DISTRAINT|
+-------------------+      +----------------------+      +----------------------+
| Direct Dual-Link  |      | Physical Service by  |      | Court Proceedings    |
| SMS dispatched    |      | Municipal Revenue    |      | under Act 936        |
| via Console       |      | Taskforce            |      | Section 156          |
+-------------------+      +----------------------+      +----------------------+
```

### Key Actions in Defaulters View
- **Batch Statutory Demand Dispatch**: Select multiple defaulter accounts and click **Send Statutory Demand Notices** to dispatch formal legal alerts in bulk.
- **Filter by Debt Aging**: Isolate accounts with severe multi-year arrears (> GH₵ 1,000) for physical revenue taskforce intervention.
- **Export Defaulters Warrant List**: Export filtered accounts with full GPS coordinates and phone contacts for revenue taskforce field enforcement.

---

## 9. Municipal Treasury & Revenue Settlements (`TREASURY`)

The **Treasury Module** provides a real-time consolidated ledger of all revenue inflows across digital and physical collection channels.

### Settlement Channels Tracked
1. **Digital Online Gateway (Paystack)**:
   - Mobile Money (MTN MoMo, Telecel Cash, AT Money).
   - Bank Cards (Visa, Mastercard, GH-Link).
   - Automatically reconciled with Paystack transaction reference codes.
2. **Municipal Counter Receipts (GCR Manual)**:
   - Counter cash collections recorded by municipal cashiers.
   - Bank deposit slips and manager's cheques verified against GCR serial books.

### Treasury Reconciliation Actions
- **Search & Filter by Payment Method**: Isolate Mobile Money collections vs. Cashier receipts for daily bank reconciliation.
- **Export Daily Revenue Ledger**: Generates an audit-ready CSV/Excel sheet detailing every transaction reference, payer telephone, property account, settlement breakdown (Arrears vs Current Fee), and timestamp.

---

## 10. Administrative Audit Trail & Security Ledger (`AUDIT_LOGS`)

The **Audit Logs Module** guarantees full institutional governance, preventing fraud and unauthorized record tampering.

### Audited Event Categories
- `BATCH_BILLING`: Triggering of municipal-wide annual rate rollouts.
- `RECORD_PAYMENT`: Manual issuance of cashier receipts and balance write-downs.
- `EDIT_PROPERTY`: Alteration of rateable values, property classifications, or ownership.
- `SINGLE_SMS_DISPATCH`: Contextual transmission of demand notices.
- `BULK_SMS_DISPATCH`: Campaign rollout executions.
- `SETTINGS_UPDATE`: Changes to carrier API keys, sender IDs, or dispatch modes.

### Audit Record Information
Every audit record permanently stores:
- **Timestamp**: Exact date and time (ISO format) of execution.
- **Officer Username / ID**: Identity of the municipal officer who performed the action.
- **Action Type**: Specific operational category.
- **Entity Type & ID**: The exact property, user, or notification modified.
- **Details**: Full human-readable breakdown of the modification.

---

## 11. Gateway Configuration & Carrier Top-Up (`SETTINGS`)

The **Settings Tab** controls gateway carrier infrastructure, API credentials, and live billing balances.

### Carrier Gateway Options
1. **Arkesel (Domestic Ghana Gateway — Recommended)**:
   - Optimized for Ghana domestic networks (`+233`).
   - Highest delivery rates across MTN Ghana, Telecel Ghana, and AT.
   - Sender ID: Set to official registered ID (default: `Arnold` or `KKMA`).
2. **Twilio (International Gateway)**:
   - Used for international landlines and property owners residing abroad (US/UK/Diaspora).

### Live Carrier Balance Monitoring & Direct Top-Up Links
The Settings tab continuously monitors and displays the active carrier balance:
- **SMS Credits**: Remaining message transmission units (e.g., `93 SMS Credits`).
- **Main Balance**: Cash reserve balance in Ghanaian Cedi (e.g., `GH₵ 0.025`).

#### Direct Carrier Payment Portals
Next to the live balance indicator, direct hyperlinks provide 1-click access to top-up carrier funds:
- **Arkesel Top-Up Portal**: [https://sms.arkesel.com/user/billing/make-payment](https://sms.arkesel.com/user/billing/make-payment)
- **Twilio Billing Portal**: [https://console.twilio.com/billing](https://console.twilio.com/billing)

### Message Template Customization
Administrators can customize the standard statutory billing notice template using dynamic bracket variables:
- `{{ownerName}}`: Property owner's registered full name.
- `{{accountNumber}}`: Unique property cadastre ID (e.g., `KKDA03991001`).
- `{{totalDue}}`: Complete balance formatted in Ghanaian Cedi.
- `{{viewLink}}`: Deep link 1 to inspect the digital bill.
- `{{payLink}}`: Deep link 2 to trigger 1-click payment checkout.

---

## 12. Standard Operating Procedures (SOP) & Troubleshooting

### SOP 1: Annual Property Rate Rollout Cycle
1. **Preparatory Phase (November - December)**:
   - Complete field cadastre updates and import new properties via CSV.
   - Review and update valuation rate parameters in coordination with the Valuation Division.
2. **Execution Phase (January)**:
   - Navigate to `SETTINGS` and verify Arkesel SMS credit balance. Top up via the direct payment link if credits are low.
   - Set Dispatch Mode to `TEST` and dispatch a single notice to an internal test property to verify message formatting.
   - Switch Dispatch Mode to `LIVE`.
   - Navigate to `REGISTRY` and click **Run Annual Billing Batch**.
   - Monitor the SMS Center queue to verify successful carrier delivery to all ratepayers.
3. **Monitoring Phase (Monthly)**:
   - Review Collection Efficiency % on the Executive KPI Dashboard.
   - Inspect the Defaulters view and issue automated batch demand notices to accounts with overdue balances.

### SOP 2: Handling Citizen Billing Inquiries
1. When a citizen visits the revenue office or calls the help desk:
2. Ask for their **Account Number** or **Registered Phone Number**.
3. Open the **Ratepayer Directory** (`RATEPAYERS`) and type their contact into the search bar.
4. Click on their name to open their **Ratepayer Dossier**.
5. Inspect their property portfolio, current bill, arrears breakdown, and past payment receipts.
6. If the citizen claims an offline payment was made that does not reflect on their account:
   - Inspect their **Receipt Archive** in the dossier.
   - Cross-reference their physical GCR paper slip against the municipal counter ledger in the `TREASURY` tab.

### Troubleshooting Quick Reference

| Issue | Root Cause | Resolution Step |
|---|---|---|
| **Officer cannot log in** | Using telephone number instead of username | Ensure the officer enters their **Officer Username** (e.g., `Heinz`) and valid password, not a phone number. |
| **SMS dispatches failing** | Insufficient carrier balance | Open `SETTINGS`, inspect the Live Account Balance, and click the direct link to top up credits on Arkesel. |
| **Property total due looks incorrect** | Accumulated prior arrears | Open the Property Details sheet; check if unpaid debts from prior years have been added to the current fee. |
| **Citizen did not receive SMS** | Invalid phone format in cadastre | Verify the phone number begins with Ghanaian format (`024...`, `020...`, `055...` or `+233`). Update in the cadastre edit modal. |
| **Database changes not reflecting** | Cached client state | Click the **Refresh Data** button (`RefreshCw` icon) on the top bar or reload the page. |

---

*KKMA Directorate of Finance & Revenue Mobilization — Official System Manual &copy; 2026*
