# UI Design Standards & Apple Human Interface Guidelines (Active Memory Rule)

MANDATORY INSTRUCTION FOR AGENTS:
Before designing, modifying, or creating any UI components, views, or layouts in both Citizen App and Admin Portal, you MUST strictly adhere to the standards defined in [UI_STANDARDS.md](../../UI_STANDARDS.md):

1. **Apple Human Interface Guidelines (HIG)**:
   - Purpose (Create value, Keep focused, Solve cleanly)
   - Agency (Stay out of the way, Freedom to explore, Mistake forgiveness)
   - Responsibility (Full transparency, Data security)
   - Familiarity (Real-world concepts, Consistency, Clear feedback)
   - Flexibility (Accessibility, Responsive context preservation)
   - Simplicity (Essential clarity, Concise copy, Intuitive hierarchy)
   - Craft (Quality, Attention to detail, Polish)
   - Delight (Human connection, Defining reassuring moments)

2. **STRICT ZERO-PILL RULE**:
   - Zero pills, capsule badges, background chips, or container bubbles around text, counts, icons, logos, or status indicators.
   - Use clean typography directly over background (`&bull; Paid`, `~~GH₵ 250.00~~ • Cleared`).
   - Currency strictly Ghanaian Cedi (`GH₵`).

3. **DYNAMIC RESPONSIVE LAYOUTS (NO HARDCODING)**:
   - Zero arbitrary magic numbers (`w-[92%]`, `pb-[104px]`). Rely entirely on fluid Flexbox and Grid.

4. **THE 20 UX LAWS**:
   - Hick's Law, Fitts's Law (≥44px targets), Jakob's Law, Doherty Threshold (<100ms feedback, <400ms completion), Occam's Razor, etc.
