# UI and UX Rules

## Design goals

The interface should make a complex genealogy graph understandable without sacrificing correctness. Clarity, hierarchy, accessibility, and interaction feedback take priority over decorative animation.

## Component policy

- Reuse established component primitives before creating new ones.
- Prefer shadcn/ui or other approved libraries already adopted by the repository.
- Do not introduce a second competing design system casually.
- Domain components such as `PersonCard`, `RelationshipEditor`, or `FamilyTreeViewport` may compose low-level primitives but should not reinvent buttons, dialogs, form controls, or menus.

## Family tree visualization

- The visible tree is a projection of domain data, never the canonical data model.
- Nodes must identify people clearly enough to avoid confusing same-name relatives.
- Parent/child direction must remain visually understandable.
- Partner/spouse connections must be visually distinguishable from parent/child connections.
- Large trees need pan/zoom and practical rendering limits or virtualization where appropriate.
- Selecting a person should have an unambiguous visual state.
- Do not encode critical relationship meaning by color alone.
- Tree layout changes must not mutate genealogy relationships.

## Responsive behavior

- Core browsing and profile workflows must function on mobile.
- Dense graph editing may use a desktop-optimized workspace, but mobile must degrade intentionally rather than break or overflow silently.
- Avoid fixed dimensions that assume one viewport size.
- Dialogs, sheets, forms, and tables must remain usable at narrow widths.

## Accessibility

Target WCAG 2.1 AA principles where feasible.

- Every interactive element must be keyboard reachable.
- Use semantic HTML before ARIA workarounds.
- Icon-only controls require accessible labels.
- Inputs require associated labels and understandable validation messages.
- Focus must be visible and managed correctly for dialogs/overlays.
- Maintain adequate text/background contrast.
- Respect `prefers-reduced-motion` for nonessential animation.

## Forms

- Validate as close to input as useful, but server validation remains authoritative.
- Preserve user input after recoverable validation failures.
- Clearly distinguish required, optional, unknown, and approximate genealogical data.
- Dangerous operations require confirmation proportional to their impact.
- Do not use destructive red actions for ordinary navigation.

## Loading, empty, and error states

Every data-driven screen must define:

- loading behavior,
- empty behavior,
- recoverable error behavior,
- permission-denied behavior when relevant.

Avoid indefinite spinners. Errors should explain the next valid action without exposing internal details.

## Motion and performance

- Animation should communicate state or spatial relationships, not distract from genealogical information.
- Prefer transform/opacity animations for performance.
- Avoid continuous background animation and heavy parallax in core workflows.
- Large graph interaction must remain responsive; reduce detail rather than freezing the UI.

## Content conventions

Vietnamese is the default interface language unless multilingual support is explicitly added. Use consistent kinship terminology and avoid silently translating stored proper names.