# Navigation icon source and license notes

The production workbench navigation does not install or bundle a third-party animation runtime.

## Selected baseline

- Static geometry: [Lucide](https://github.com/lucide-icons/lucide), ISC License.
- Motion reference and selected motion patterns: [lucide-animated / pqoqubbw/icons](https://github.com/pqoqubbw/icons), MIT License.
- The Vue Storybook component is a local adaptation. It keeps the Lucide 24×24 geometry and ports only small, independently authored CSS loops; it does not redistribute the upstream website or tutorials.

The adapted icon set includes `calendar-check`, `contact`, `users`, `table-properties`, `history`, `calendar-minus`, `arrow-left-right`, `diff`, `list`, `bell`, `chart-line`, `id-card`, `user`, `settings`, `ellipsis`, and `log-out` geometries. Missing project-specific semantics are expressed by locally authored motion, not by altering the upstream license.

## Evaluated but not selected

- [gorkem-bwl/animated-icons](https://github.com/gorkem-bwl/animated-icons), ISC with Lucide ISC / Heroicons MIT / Iconoir MIT sources. Excellent coverage and Vue/standalone outputs, but its generated shared animation engine assigns generic effects such as scale-pop to some business icons and embeds a large shared CSS block in standalone SVGs.
- [Line-MD](https://github.com/cyberalien/line-md), MIT. Pure SVG/CSS and reduced-motion aware, but its dominant sequential render language is visually busier than this navigation requires.
- [AnimateIcons](https://github.com/Avijit07x/animateicons), MIT. High-quality and broad, but primarily React and bundles Motion unless individual source is copied.
- [heroicons-animated](https://github.com/heroicons-animated/heroicons-animated), MIT. Handcrafted, but React/Motion-oriented and less complete for the project’s business vocabulary.
- [cssvg-icons](https://icon.cssvg.com/), MIT. Zero-dependency SMIL, but the 66-icon catalog does not cover enough scheduling concepts.
- [lucide-motion-vue](https://github.com/respeak-io/lucide-motion-vue), mixed attribution. Vue-native, but some variants originate from a Commons Clause source and it depends on Motion for Vue, so it is not the cleanest licensing/runtime baseline.

## Delivery boundary

The production implementation retains this source map alongside the code. Any future icon additions must record the exact Lucide geometry source and preserve the upstream ISC/MIT license notices.

Full notice text: [`third-party-navigation-icon-licenses.md`](./third-party-navigation-icon-licenses.md).
