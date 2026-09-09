# Website links

Import navigation components from `@/shared/links/link`. Use a real URL for
navigation; copying, sorting, filtering, and other actions remain buttons.
The shared components own appearance and destination indicators. Feature CSS owns
layout and data colors, not link hover, underline, focus, or button styling.
The existing Build a run spotlight is an intentional exception: preserve its
approved button design in `run-cta-spotlight.module.css` while using `ButtonLink`
for navigation behavior.

| Role                 | Component                      | Convention                                                                               |
| -------------------- | ------------------------------ | ---------------------------------------------------------------------------------------- |
| Prose/reference      | `TextLink`                     | Neutral text; persistent underline                                                       |
| Supporting action    | `TextLink layout="standalone"` | Same underline, with space for a directional indicator                                   |
| Model/language/score | `TextLink layout="data"`       | Mark the clickable text with `data-link-label`; keep metadata and metric colors separate |
| Prominent navigation | `ButtonLink`                   | Shared Button default, neutral, or outline variant and shared size                       |
| Site/menu navigation | `NavLink`                      | Shared neutral states and `aria-current`; menus retain their widget behavior             |
| Whole row/card/chart | `LinkSurface`                  | Shared focus/hover; preserve layout and chart encoding                                   |
| Icon shortcut        | `IconLink`                     | Required accessible label; compose with a tooltip when useful                            |
| Brand/skip           | `BrandLink`, `SkipLink`        | Purposeful special presentations                                                         |

The footer GitHub button uses the neutral palette: foreground fill, background
text, and 85% foreground on hover, preserving its original light/dark colors.

Use root-relative URLs for internal destinations. Existing model/language URL
helpers remain the source of truth. Pass `locale` explicitly in shell/404 code
that must work outside the normal route context; the component constructs the
localized path without requiring a provider. Queries and fragments are preserved.

External HTTP(S) destinations receive one diagonal arrow automatically. External
status does not imply a new tab. Use `newTab` only deliberately; it adds the
appropriate relationship and localized notice. `direction="forward"` and
`direction="back"` are for internal navigation; they never replace the external
indicator. Do not manually add external-link icons.

Use `download="filename"` only when the destination actually supports download
behavior. This renders a native anchor, adds a Download icon, and preserves the
filename. Release asset URLs keep their existing file-opening behavior; adding an
HTML `download` attribute alone would not guarantee cross-origin downloads.

Shared notices read the inherited UI locale directly from their small dictionaries.
This keeps them available inside feature providers that replace the active message
namespace. Keep those dictionaries in sync with supported UI locales.

The development-only `/en/design/links` page displays component examples. It
returns 404 in production and is not included in the sitemap. Review examples in
light/dark themes, with keyboard focus and narrow viewports. Text links remain
recognizable before hover; card/chart focus must be visible without changing the
meaning of score colors.

The lint configuration restricts raw routing-Link and external-icon imports to
the shared boundary. A focused architecture test rejects raw anchors elsewhere.
CSS review must also reject feature-level overrides: an import rule cannot police
arbitrary CSS. Keep the existing menu/tooltip composition as a single anchor and
preserve native modifier-click and keyboard activation.
