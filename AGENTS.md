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


## THE 20 UX LAWS & INTERFACE DESIGN STANDARDS (MANDATORY FOR ALL UI WORK)
For every UI format, update, addition, or component created in both the Citizen App and the Admin Portal, strictly enforce these 20 UX laws:

1. **Hick's Law — Reduce choices per screen**: Minimize decision fatigue. Keep views focused, limit simultaneous competing choices, and decompose high-friction forms into progressive disclosure steps.
2. **Fitts's Law — Make targets large**: Ensure all clickable/touchable elements (buttons, inputs, filters, action triggers) have generous target bounds (min 44×44px on touch/mobile, ample padding on desktop) with interactive feedback.
3. **Jakob's Law — Follow familiar patterns**: Leverage standard user mental models for billing, checkout, data tables, master-detail side sheets, navigation, and search bars rather than reinventing interaction paradigms.
4. **Law of Proximity — Group related information**: Spatially cluster related labels, values, buttons, and summary totals using clean Flexbox/CSS Grid gap structures rather than arbitrary floating elements.
5. **Miller's Law — Break content into chunks**: Chunk dense data (ratepayer dossiers, assessment breakdowns, valuation parameters) into 5–7 digestible, logical groupings with clear typographic hierarchy.
6. **Doherty Threshold — Ensure interactions respond within 400ms**: Provide immediate visual feedback (<100ms) with optimistic UI updates, skeleton placeholders, and active/loading states for all asynchronous operations.
7. **Von Restorff Effect — Highlight the primary action**: Ensure the single primary call-to-action on any screen (e.g., *Pay Now GH₵...*, *Dispatch SMS Batch*, *Save Assessment*) stands out with prominent visual weight over secondary/outline actions.
8. **Minimize Target Distance — Place key actions nearby**: Position contextual action buttons adjacent to the data they modify (e.g., inline row actions, floating action drawers, sticky summary payment bars).
9. **Serial Position Effect — Put essentials first**: Position the most critical information (account balance, due date, property ID) at the very top/start and concluding primary confirmation actions at the bottom/end.
10. **Peak-End Rule — End user flows memorably**: Provide polished, reassuring completion states for transactional journeys (e.g., instant receipt downloads, clear confirmation stamps, transactional reference summaries).
11. **Zeigarnik Effect — Show visible progress**: Display clean step indicators, multi-step progress trackers, or completion metrics during multi-step billing, onboarding, or rollout operations.
12. **Law of Prägnanz — Simplify complex interfaces**: Reduce visual clutter and cognitive load. Eliminate unnecessary borders, excess dividers, and superfluous wrapper styling.
13. **Law of Similarity — Use sensible defaults**: Pre-fill known data (e.g., mobile money number, tax year, standard billing cycle) and maintain uniform styling for equivalent functional elements.
14. **Uniform Connectedness — Prevent errors proactively**: Provide inline real-time validation, dynamic input masking (e.g. phone number formatting, account number auto-formatting), and clear disabled states to prevent user mistakes before submission.
15. **Tesler's Law — Make errors recoverable**: Offer human-readable Ghanaian context error messages, one-click retry actions, non-destructive recovery, and preserved form state on failures.
16. **Postel's Law — Maintain pattern consistency**: Be liberal in what input formats are accepted (e.g. Ghanaian phone formats `024...`, `+233...`, `233...`, spaced account numbers) and strict/standard in output formatting.
17. **Visual Connectedness — Connect related elements visually**: Visually link related metrics and fields using subtle left border accents or clean background groupings (never pill/bubble badges).
18. **Parkinson's Law — Reduce task completion time**: Streamline user journeys to their shortest path (e.g. 2-click instant payment via deep links, 1-click dossier lookup).
19. **Occam's Razor — Reveal complexity gradually**: Employ progressive disclosure—show high-level overview cards first, allowing ratepayers and admins to expand valuation breakdowns and audit logs on demand.
20. **Pareto Principle — Make completion feel closer**: Emphasize the top 20% high-frequency actions that drive 80% of user activity (checking balance, making payments, viewing receipts, dispatching bills).

## MANDATORY WORKFLOW: DIAGNOSE & CONFIRM FIRST
- EVERY single time the user reports a bug, issues a new request, or asks a question, you MUST first explicitly identify the root cause of the problem and propose a solution.
- You MUST STOP and ask for the user's 'go ahead' or explicit approval BEFORE you write any code or modify any files.
- Treat every request as an interactive diagnostic session where compromise and alignment are required before action is taken.

## ANTI-AI CODE BLOAT, OVER-ENGINEERING & YAGNI GOVERNANCE
- **Anti-Over-Abstraction / YAGNI ("You Aren't Gonna Need It")**: Under no circumstances spin up brand-new helper functions, wrappers, utility classes, or speculative layers to solve simple 2-line inline fixes. Solve problems directly and idiomatically at the site of failure.
- **Eliminate Hallucinated Boilerplate**: Avoid verbose, multi-tiered boilerplate patterns where a simple, native TypeScript or React expression (e.g. `useMemo`, native array operations, standard hooks) suffices.
- **Contextual Economy & Surgical Precision**: Maintain architectural continuity across sessions. Do not patch bugs by blindly piling new functions or layers on top of old ones. Always simplify, prune, and consolidate existing logic instead of accumulating dead code.
- **Dead Code Purging**: Proactively remove orphaned variables, unused functions, obsolete state parameters, and redundant wrapper abstractions on every modification.


