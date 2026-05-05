# Apple iOS Human Interface Guidelines — Design Reference

Use this reference when reviewing visual design quality in `/ux-review`.
These are concrete, actionable rules derived from Apple's HIG and the Liquid Glass design system (iOS 26+).

## Core Design Principles

### Clarity
- The interface must be legible and easy to understand at a glance.
- Text must be sharp. Icons must be precise. Visual hierarchy must be obvious.
- The most important element on every screen should be unmistakable.

### Deference
- The UI should never compete with the content. It should step back and let user content be the star.
- Use translucent, subtle UI elements. Fluid animations. Generous whitespace.
- The interface helps the user understand and interact with content — it doesn't show off.

### Depth
- Visual layers, smooth transitions, and logical hierarchy create a sense of spatial depth.
- Users should always understand where they are and how they got there.
- Motion and layering communicate structure, not decoration.

## Typography Rules

| Element | Size | Weight |
|---------|------|--------|
| Large title (unscrolled) | 34pt | Bold |
| Large title (scrolled/inline) | 17pt | Semibold |
| Headline | 17pt | Semibold |
| Body text | 17pt | Regular |
| Callout | 16pt | Regular |
| Subhead | 15pt | Regular |
| Footnote | 13pt | Regular |
| Caption 1 | 12pt | Regular |
| Caption 2 | 11pt | Regular |
| **Minimum text size** | **11pt** | — |

### Typography principles
- Use the system font (SF Pro) unless there is a strong brand reason not to.
- Use **one typeface**. Mixing fonts makes the app feel fragmented.
- Establish hierarchy through weight, size, and color — not through multiple fonts.
- Support Dynamic Type so users can scale text to their preference.
- Bolder, left-aligned text for critical moments (alerts, onboarding, key decisions).
- Secondary text: use 60% opacity of the primary text color (not a separate gray).
- Never use ALL CAPS for body text. Reserve it sparingly for short labels if at all.

## Color Rules

### Palette discipline
- **3-4 primary colors maximum.** A tight palette feels intentional; too many colors feel chaotic.
- Avoid overly bright or saturated colors. Apple's palette is optimistic but never loud.
- Test every color in both Light Mode and Dark Mode.

### Semantic color usage
- **Reserve your brand/accent color for interactive elements only** — buttons, links, toggles, tappable text. This trains users: "color = tappable."
- Do not use the accent color for decoration, backgrounds, or non-interactive elements.
- Use system semantic colors (label, secondaryLabel, tertiaryLabel, separator, etc.) so colors adapt automatically to appearance modes and accessibility settings.

### Contrast requirements
- **4.5:1 minimum** contrast ratio for body text.
- **3:1 minimum** for large text (18pt+ regular or 14pt+ bold).
- Test against both light and dark backgrounds, especially with translucent/glass materials.

## Spacing & Layout

### Tap targets
- **Every interactive element must be at least 44×44pt.** No exceptions.
- Even if the visible element is smaller (e.g., a small icon), the tappable area must be 44×44pt.

### Margins and padding
- Use system-defined layout margins. They adapt per device and context.
- Content should never touch the edges of the screen — always respect safe areas.
- Use **generous, consistent whitespace** to group related elements and separate sections.
- Whitespace is not wasted space — it is the primary tool for visual grouping and breathing room.

### Safe areas
- Never place interactive or important content under the status bar, home indicator, Dynamic Island, or navigation/tab bars.
- Always use system safe area insets.

### Visual grouping
- Related elements should be visually grouped through proximity and consistent spacing.
- Unrelated elements should be separated by more space or visual dividers.
- Alignment communicates relationship — align text, images, and buttons to show how information is related.

## Navigation Patterns

### Tab bar
- Use for top-level sections. **3-5 tabs on iPhone.** Each additional tab adds complexity.
- Tab bar must remain visible as users navigate within sections.
- Use short labels + SF Symbols icons. Avoid text-only tabs.
- Reserve the tab bar for persistent, app-wide navigation. Do not put screen-specific actions in the tab bar.
- Selected tab uses the app's accent fill color.

### Navigation bar
- Use large titles. They transition to standard (inline) titles on scroll.
- Large title = 34pt Bold, scrolled = 17pt Semibold.
- Back button should always be present in pushed views.
- Keep navigation bar items minimal — one or two trailing actions maximum.

### Modals and sheets
- Sheets slide from the bottom and leave the previous screen visible (recessed) for context.
- Always provide a clear dismiss mechanism (swipe down, close button, or cancel).
- Use modals for focused tasks that require completion before returning.

### Search
- iOS 26+ includes a dedicated Search tab. Consider adding one for content-heavy apps.

## Component Patterns

### Buttons
- One clear primary action per screen. Make it visually dominant (filled, accent color).
- Secondary actions: use plain or outlined style. Visually recede.
- Destructive actions: use red, and demote visually. Never place next to primary action without clear separation.
- Button text should be a verb: "Save," "Send," "Delete" — not "OK" or "Yes."

### Forms
- Group related fields together.
- Labels must be persistent and visible — not placeholder-only (placeholders disappear on focus).
- Mark required vs optional fields clearly.
- Inline validation — show errors at the field, not just at the top of the form.
- Use the correct keyboard type for each field (email, number, phone, URL).

### Lists and tables
- Primary text: 17pt Regular. Secondary/detail text: 15pt or 12pt Regular at 60% opacity.
- Consistent row heights within a section.
- Use disclosure indicators (chevrons) to signal navigation to a detail view.

### Images
- Always display at intended aspect ratio — never stretch or distort.
- Provide @2x and @3x assets for Retina displays. Blurry images are unacceptable.
- Use corner radius consistent with the rest of the UI (Apple's superellipse: corner smoothing ~61%).

## Liquid Glass (iOS 26+)

### Material behavior
- Liquid Glass is a translucent material that reflects, refracts, and adapts to surrounding content.
- It dynamically adjusts between light and dark environments.
- Applied to controls, navigation bars, tab bars, sidebars, and system UI.

### Concentricity
- Nested containers must have concentric corner radii (inner radius = outer radius - padding).
- Corners should never feel "pinched" (too tight) or "flared" (too loose).
- Capsule shapes (radius = half height) are primary for iOS interactive elements.

### Hierarchy through glass
- Glass elements float above content — they should elevate and distinguish, not obscure.
- Controls sit on system materials, never directly on content.
- Remove unnecessary backgrounds and borders from bars — the glass material provides visual structure.

### Shape system
- **Capsules**: radius = half height. Used for iOS/iPadOS interactive elements (buttons, pills, segments).
- **Fixed shapes**: constant corner radius regardless of size. Used for cards, containers.
- **Concentric shapes**: inner radius calculated from parent. Used for nested elements.

### Grouping in bars
- Related actions share a glass background automatically when grouped via the correct API.
- Do not mix symbols with text in the same group (it reads as one button).
- Primary actions (Done, Save) get the accent color tint; keep them visually separated from secondary actions.

## Motion & Animation

- Animations should provide **feedback** — confirming that an action happened.
- Transitions should be smooth and meaningful, not decorative.
- Action sheets spring from their triggering element (not just from the bottom of the screen).
- Use the system's built-in animation curves — they feel native and are optimized for perceived performance.
- Avoid gratuitous animation. Every animation should serve a purpose: feedback, orientation, or continuity.

## Accessibility (Non-Negotiable)

- Support Dynamic Type for all text.
- All colors must pass contrast requirements (4.5:1 body, 3:1 large text).
- All interactive elements need accessibility labels.
- No color-only meaning — always pair color with text, icons, or patterns.
- Visible focus states for keyboard/switch control navigation.
- VoiceOver must produce a coherent reading order.

## Anti-Patterns — Things That Make iOS Apps Look Bad

- **Cramped layouts**: insufficient padding, elements too close together, no breathing room.
- **Inconsistent spacing**: different margins on different screens for no reason.
- **Too many fonts or weights**: fragmented, unprofessional feel.
- **Color overload**: more than 4 colors competing for attention.
- **Low contrast text**: especially gray-on-white or gray-on-light-gray.
- **Tiny tap targets**: buttons or links smaller than 44×44pt.
- **Placeholder-only labels**: labels disappear when user starts typing.
- **Misaligned elements**: text, icons, and buttons not aligned to a consistent grid.
- **Stretched or blurry images**: wrong aspect ratio or missing @2x/@3x assets.
- **Non-native navigation**: custom nav that breaks back button, swipe-to-go-back, or large title behavior.
- **Decorative animation**: motion that serves no UX purpose.
- **Ignoring Dark Mode**: UI that looks fine in light but breaks in dark, or vice versa.
- **Ignoring safe areas**: content hidden under the notch, Dynamic Island, or home indicator.
