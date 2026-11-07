# Stage 3 UI Visualization Requirements

## Purpose

Record the approved Tiny Wins UI visualization direction for a future visual-only implementation pass.

These requirements describe appearance, density, and presentation only. They must not change task behavior, timer behavior, AI behavior, storage, imports, exports, notifications, or native shell behavior.

## Scope

- Apply the approved compact aqua-glass visual direction to the existing Tiny Wins app UI.
- Preserve the current information architecture and workflows.
- Keep all current controls available unless this document explicitly changes only their visual presentation.
- Treat the preview webpage as the design reference, not as production code.

## Non-Goals

- Do not change domain logic.
- Do not change persistence or state shape.
- Do not change delete confirmation behavior.
- Do not change AI request behavior, limits, prompts, provider calls, or fallback behavior.
- Do not change tab creation, tab deletion, tab rename, task creation, task edit, task reorder, task finish, task pause/start, import/export, settings, notifications, or timer rules.
- Do not adopt any preview-only explanatory content into the app.

## Approved Visual Direction

- Make the interface denser, calmer, and more polished.
- Use tighter typography, spacing, and row heights while keeping controls readable.
- Use quieter glass depth: softer shadows, less puffiness, and fewer heavy translucent layers.
- Keep the native window and app panel visually blended into one continuous aqua surface.
- Keep the footer fully visible at the bottom while the task list scrolls with reserved bottom space.

## Header And Surface

- Keep the Tiny Wins logo and brand visible in the app header.
- Keep header controls in their existing functional order.
- Reduce excess visual weight around the header without removing affordance.
- Maintain the continuous aqua surface established in the previous macOS UI work.

## Tabs

- Keep the original single-row pill tab model.
- Each tab must continue to show:
  - full tab label, subject to existing overflow handling,
  - completed/total task count,
  - close/delete-tab control inside the pill.
- Selected tab text, count, and close icon must be white for contrast.
- Inactive tabs should remain compact and readable.
- The add-tab button remains beside the tab row.
- Do not replace the approved pill tabs with shortcut chips or alternate tab layouts.

## Add Task Composer

- Remove the leading `+` icon from the composer row because it does not add enough value.
- Preserve manual task creation behavior:
  - typing in the task field still creates a manual task,
  - Enter still submits where currently supported,
  - the add button still submits.
- Keep the composer compact and visually aligned with the task rows.
- Replace visible `AI` text with an icon-only AI assist control.
- The AI control must keep the existing accessible label and existing AI breakdown behavior.
- Manual task creation remains visually primary; AI remains secondary.

## AI Availability

- The AI assist control depends on the `OPENAI_API_KEY` system/environment variable.
- If `OPENAI_API_KEY` is available through the app's existing AI availability path, enable the AI icon button and preserve all previously defined AI breakdown behavior.
- If `OPENAI_API_KEY` is missing, keep the AI icon button visible but disabled/non-actionable.
- When AI is disabled because the key is missing, show a hover/focus tooltip that says: `Set OPENAI_API_KEY system variable to enable AI task breakdown.`
- Manual task creation must remain fully available when AI is disabled.
- Do not expose, persist, or log the OpenAI key in the client UI.
- The disabled AI state must be accessible. If a native disabled button cannot reliably expose the tooltip or receive focus, use an `aria-disabled` button or wrapper pattern that remains non-actionable and screen-reader friendly.
- The AI unavailable state must not block app launch, task management, imports, exports, timers, notifications, or settings.

## Task Rows

- Make task rows shorter and more space-efficient than the current app implementation.
- Keep progress fill visible but softer and less visually heavy.
- Keep running-task emphasis using a clear but compact visual marker.
- Keep task title, elapsed/planned timing, status, and created timing available.
- Show created timing in compact metadata without changing `createdAt` data.
- Keep task rows readable at the right-side macOS panel width.
- Task actions must remain hidden while a task is being renamed or edited.

## Task Actions

- Keep the same action set and behavior.
- Use a subtler circular task delete button:
  - pale circular background,
  - compact outline trash icon,
  - neutral blue/navy tone in the default state.
- Keep red or warning treatment reserved for confirmation/destructive state, not for the default delete affordance.
- Preserve the current two-click task delete confirmation behavior.
- Preserve finish, start/pause, and reorder behavior.

## Metadata

- Use compact task metadata so rows save vertical space.
- Include created date/time information in the task row presentation.
- Avoid metadata wrapping where possible at the target macOS panel width.
- If space is constrained, prefer concise labels over hiding the data entirely.

## Footer

- Footer remains visually attached to the same aqua surface.
- Footer remains fully visible at the bottom of the app.
- Task content may scroll underneath the reserved footer area.
- Footer copy and save-status behavior remain unchanged.

## Accessibility And Interaction Constraints

- Icon-only controls must keep descriptive accessible names.
- Focus states must remain visible.
- Do not rely on color alone to communicate destructive confirmation state.
- Compact controls must remain usable at the target desktop panel size.
- Keyboard behavior remains limited to the existing approved shortcuts and input behavior.

## Documentation Updates

- README wording may be updated only where labels changed visually or where AI availability wording must clarify the `OPENAI_API_KEY` system/environment variable requirement.
- Any documentation update must make clear that functionality remains unchanged.

## Acceptance Criteria

- The implemented app visually matches the approved Stage 3 preview direction.
- Existing app workflows remain unchanged.
- Existing tests for task creation, AI breakdown, tab behavior, footer visibility, task editing, and delete confirmation continue to pass or are updated only for visual/accessibility label changes.
- The AI icon button is enabled only when `OPENAI_API_KEY` is available through the existing AI availability path.
- The AI icon button is disabled/non-actionable when `OPENAI_API_KEY` is missing and exposes the required tooltip.
- No state migration is required.
- No backend, provider, or native shell behavior changes are included.
