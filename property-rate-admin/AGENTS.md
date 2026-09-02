<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# UI Design Constraints & Global Rules

## STRICT REQUIREMENT: ZERO PILL ELEMENTS
- **Under NO circumstances use pills, capsule badges, background chips, or container bubbles around text, counts, icons, logos, or status indicators.**
- All counts, status badges, and metadata must use clean, minimalistic typography directly over the background (e.g. `(4 unread)` as muted text, not a pill; `&bull; Paid` as pure colored text).
- Navigation tabs must use clean typographic links with subtle underline indicators or left border accents, never rounded pill containers.
- All monetary amounts must strictly use Ghanaian Cedi (`GH₵`), with no dollar signs (`$`) anywhere in the application.

## STRICT REQUIREMENT: DYNAMIC RESPONSIVE LAYOUTS (NO HARDCODING)
- **Under NO circumstances use hardcoded or arbitrary magic numbers (like `w-[92%]`, `pb-[104px]`, etc.) to force elements into alignment.**
- All structural UI elements (cards, containers, wrappers) must rely on fluid layout systems—specifically dynamic Flexbox or CSS Grid behaviors (e.g., `flex-1`, `w-full`, `items-stretch`, `min-h-0`).
- Vertical spacing and gaps (such as the space between main content and a fixed navbar) must be handled dynamically by allowing flex containers to consume available space (`flex-1`), rather than using fixed bottom padding calculations.
- Horizontal scroll containers must use natural responsive padding and `scroll-snap` properties to hint at overflowing content (letting the browser handle the overflow natively) rather than explicitly squeezing element widths with percentages.

## SMS BILL ROLLOUT & TRANSACTIONAL MESSAGING ARCHITECTURE
- **Dual Direct Links Standard**: Every bill rollout SMS notice and demand notice must contain two explicit deep links:
  1. **Link 1 (View Assessment)**: `http://localhost:3000/properties?accountNumber={accountNumber}` to open and inspect the digital bill.
  2. **Link 2 (Instant Checkout)**: `http://localhost:3000/properties?accountNumber={accountNumber}&action=pay` to trigger direct in-app payment checkout.
- **Provider & Credentials**: Twilio is the primary provider (with E.164 phone number formatting for Ghana `+233` and US). When live credentials are absent or under development, use safe simulation mode and in-app logs. **Never run live test dispatches to real phone numbers without explicit user instruction.**

## ENTERPRISE ADMIN PORTAL & RATEPAYER DOSSIERS
- All administrator views must mirror Google Enterprise / Google Cloud Console design principles: high data density, clean master-detail side sheets, tabular figure alignments, and comprehensive audit history.
- The admin portal provides direct database connection for ratepayer dossiers, showing full multi-property portfolios, billing histories, payment receipt archives, and communication timelines.

## DATABASE SCHEMA SEPARATION ARCHITECTURE
- **Citizen App Scope (`ratepayerDb`)**: Restricted to public citizen operations (`User`, `Property`, `Receipt`, `Transaction`, `Bill`, `Notification`). Zero direct exposure to staff commissions, internal audit logs, or value book stocks.
- **Admin Portal Scope (`adminDb`)**: Complete administrative control over master cadastre, value book pools (`VBStock`, `TGCRNr`), staff revenue mobilizations, audit trails (`AuditLog`), and SMS rollout engines.
- **Data Integrity Standard**: Both clients access synchronized underlying PostgreSQL/Supabase tables to guarantee 100% ACID consistency and eliminate out-of-sync financial record discrepancies.


## MANDATORY WORKFLOW: DIAGNOSE & CONFIRM FIRST
- EVERY single time the user reports a bug, issues a new request, or asks a question, you MUST first explicitly identify the root cause of the problem and propose a solution.
- You MUST STOP and ask for the user's 'go ahead' or explicit approval BEFORE you write any code or modify any files.
- Treat every request as an interactive diagnostic session where compromise and alignment are required before action is taken.
