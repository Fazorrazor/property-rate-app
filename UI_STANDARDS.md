# UI Design Standards & Apple Human Interface Guidelines

This document is the **single source of truth** for all visual, ergonomic, and interaction design decisions across the entire codebase—including both the **Citizen Application** (`property-rate-app`) and the **Enterprise Admin Portal** (`property-rate-admin`).

Before designing, modifying, or creating any UI components, views, or layouts, agents and developers **MUST** read, internalize, and strictly enforce the standards set forth herein.

---

## 1. Apple Human Interface Guidelines (HIG) Design Principles

The most successful and enduring designs are based on a deep understanding of how people think, feel, and interact with the world. These 8 principles form the foundation for every interface interaction:

### 1.1 Purpose — Make something meaningful
- **Create value**: Design begins with intention. At every stage of development, ask what your feature or view is for and whether the design genuinely serves that purpose. Focus on what makes the product genuinely useful.
- **Keep focused**: Prioritize your app’s most important features by aligning with how people want to use it. A product with a clear, unambiguous use is more effective at helping people meet their goals.
- **Find new ways to solve the problem**: Avoid re-creating tired or broken paradigms. Define what sets this platform apart and reflect that in clean, focused flows.

### 1.2 Agency — Let people do things their own way
- **Stay out of the way**: People use software to get things done. Get them directly to the task or content at hand. The best designs are unobtrusive and present only when people need them.
- **Give people the freedom to explore**: Let people move through your interface and access features without feeling locked into rigid, hostile modes. When a guided flow is necessary, make it effortless to review, skip, or escape.
- **Help people recover from mistakes**: Forgiving design creates confidence. Build instant, non-destructive undo, back navigation, and error recovery into every action. Recovering from an unexpected state must never cost users their time or data.

### 1.3 Responsibility — Act in people’s best interest
- **Be fully transparent about what your product does and why**: Build immediate trust. Make your intentions crystal clear from the first interaction. Provide transparent financial accounting, clear rate breakdowns, and plain explanations for every fee.
- **Keep people’s information safe**: Respect ratepayer and municipal privacy. Collect only what is strictly necessary. Never expose internal audit keys, personal identifiers, or session tokens to unauthorized parties.

### 1.4 Familiarity — Build on what people know
- **Use concepts that people know**: Ground your experience in established physical and digital patterns (e.g. municipal assessment bills, tax clearance certificates, ledger accounts) so ratepayers and municipal clerks feel immediately at home.
- **Keep visuals and interactions consistent**: Once a behavior, icon meaning, or appearance is established, apply it uniformly. Predictability breeds confidence.
- **Provide clear feedback**: Deliver immediate, unambiguous signals about what is happening (<100ms visual response). Clearly show active states, loading indicators, disabled states, and successful ledger commits.

### 1.5 Flexibility — Adapt to diverse contexts and needs
- **Design for everyone**: Treat accessibility, high contrast, readable typography, and variable network conditions as first-class citizens.
- **Preserve a person’s context**: Keep content and controls in predictable, stable positions across screen sizes. Use natural transitions to preserve spatial orientation.
- **Consider a variety of input methods**: Ensure complete usability across mobile touchscreens, hardware keyboards, desktop mice, and trackpads.
- **Approach every platform with intention**: Whether viewing on a mobile device in the field or an enterprise multi-monitor desktop in a municipal office, every view must feel native and meticulously crafted.

### 1.6 Simplicity — Be clear and direct
- **Include just what’s necessary**: Simplicity is not bare minimalism—it is clarity. Keep the vital information close by and let secondary details fall away gracefully through progressive disclosure.
- **Be concise**: Choose exact, plain words. Avoid municipal jargon or developer abbreviations where clear Ghanaian civic terminology serves better.
- **Establish hierarchy**: Make form and function immediately apparent. Prioritize recognizable controls and visual structure so people instantly know where they are and what action comes next.

### 1.7 Craft — Care about every detail
- **Quality sets the tone**: Every element of your design communicates how much care was invested. Be deliberate with each decision: pixel-perfect alignments, smooth transitions, precise typography, and tabular numeric alignments.
- **Experiment and iterate**: Prototype early, refine relentlessly, and discard clunky patterns. Maintain an uncompromisingly high bar for every screen.
- **Maintain your craft**: Shipping is not the finish line. Keep the quality bar high, purge visual debt, and keep styles clean and modern.

### 1.8 Delight — Make it human
- **Identify the emotion you want to inspire**: Tax and rate settlement should feel empowering, transparent, reassuring, and fast.
- **Create defining moments**: Turn ordinary actions (e.g., instant receipt confirmation, arrears clearance stamp, 1-click installment selection) into moments of reassurance and satisfaction.
- **Don't mistake delight for decoration**: Never sacrifice speed, utility, or clarity for gratuitous ornamentation. Delight is the natural result of an interface that works with effortless precision.

---

## 2. Strict Requirement: Zero Pill Elements

- **UNDER NO CIRCUMSTANCES use pills, capsule badges, background chips, or container bubbles around text, counts, icons, logos, or status indicators.**
- All counts, status badges, and metadata must use clean, minimalistic typography directly over the background (e.g., `(4 unread)` as muted text, not a pill; `&bull; Paid` as pure colored text; `~~GH₵ 250.00~~ • Cleared` as strike-through text with green accent).
- Selection controls and tabs must use clean typographic links with subtle underline indicators, left border accents, or full-width inset cards—**never** rounded pill containers or oval button groups.
- All monetary amounts must strictly use Ghanaian Cedi (`GH₵`), with no dollar signs (`$`) anywhere in the application.

---

## 3. Strict Requirement: Dynamic Responsive Layouts (No Hardcoding)

- **UNDER NO CIRCUMSTANCES use hardcoded or arbitrary magic numbers (like `w-[92%]`, `pb-[104px]`, etc.) to force elements into alignment.**
- All structural UI elements (cards, containers, wrappers) must rely on fluid layout systems—specifically dynamic Flexbox or CSS Grid behaviors (`flex-1`, `w-full`, `items-stretch`, `min-h-0`).
- Vertical spacing and gaps (such as the space between main content and a fixed navbar) must be handled dynamically by allowing flex containers to consume available space (`flex-1`), rather than using fixed bottom padding calculations.
- Horizontal scroll containers must use natural responsive padding and `scroll-snap` properties to hint at overflowing content natively.

---

## 4. The 20 UX Laws & Interface Design Standards

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

---

## 5. Enterprise Admin Portal & Ratepayer Dossiers

- All administrator views must mirror Google Enterprise / Google Cloud Console design principles: high data density, clean master-detail side sheets, tabular figure alignments, and comprehensive audit history.
- The admin portal provides direct database connection for ratepayer dossiers, showing full multi-property portfolios, billing histories, payment receipt archives, and communication timelines.
