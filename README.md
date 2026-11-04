# `<form-fieldset-progress>`

Show a form’s fieldsets one section at a time. The component adds Back, Next,
and progress, validates fields before advancing, and shows the form’s submit
button on the last section. It uses light DOM. Without JavaScript, the authored
form remains visible.

See the [demo](demo/index.html) for examples, from default behavior through
label customization, authored controls, and section-change events.

## Installation

The package is unreleased. Install this checkout in a consuming project:

```sh
npm install ../form-fieldset-progress
```

With a bundler, register the element and load its optional stylesheet:

```js
import '@aarongustafson/form-fieldset-progress/define.js';
import '@aarongustafson/form-fieldset-progress/form-fieldset-progress.css';
```

The registration import also loads the TypeScript element and event mappings.

Without a bundler, copy the package files into your project, load `define.js`
with a module script, and link `form-fieldset-progress.css` as a stylesheet.

## Basic use

Wrap one form. Each outermost fieldset needs a nonempty legend. Place the submit
button outside the fieldsets:

```html
<form-fieldset-progress>
  <form action="/apply" method="post">
    <fieldset>
      <legend>Contact details</legend>
      <label>Name <input name="name" autocomplete="name" required /></label>
    </fieldset>
    <fieldset>
      <legend>Delivery address</legend>
      <label
        >City <input name="city" autocomplete="address-level2" required
      /></label>
    </fieldset>
    <button type="submit" name="action" value="apply">Send application</button>
  </form>
</form-fieldset-progress>
```

- Next validates the current section before advancing. Back does not validate.
- Back is hidden on the first section. On the last section, the authored submit
  button replaces Next. A one-section form shows Submit immediately and hides
  Back, Next, progress, and the progress label.
- Nested fieldsets stay within their outermost section. Fieldsets marked
  `hidden`, or inside a `[hidden]` ancestor, are excluded at setup.
- Inactive sections are hidden, not disabled. Their values remain in `FormData`.
- Navigation focuses the destination’s first available input, select, or textarea.
  If no field can receive focus, it focuses the fieldset, named by its legend.
- Progress’s value is the current section number, starting at one; its maximum
  is the section count. Section 1 of 3 is one-third full, and section 3 of 3 is
  full. This shows position in the form, not successful submission.

Setup runs in a microtask after connection. The authored sections remain visible
until setup succeeds.

## Change the labels

Use label attributes without changing the generated markup:

```html
<form-fieldset-progress
  previous-label="Previous"
  next-label="Continue"
  progress-label="Section {current} of {total}: {legend}"
>
  <form>
    <fieldset>
      <legend>Contact</legend>
      <label>Name <input name="name" /></label>
    </fieldset>
    <fieldset>
      <legend>Delivery notes</legend>
      <label>Notes <textarea name="notes"></textarea></label>
    </fieldset>
    <button type="submit">Send</button>
  </form>
</form-fieldset-progress>
```

| Attribute             | Default                               |
| --------------------- | ------------------------------------- |
| `previous-label`      | `Back`                                |
| `next-label`          | `Next`                                |
| `progress-label`      | `Step {current} of {total}: {legend}` |
| `previous-aria-label` | `{label} to {legend}`                 |
| `next-aria-label`     | `{label} to {legend}`                 |
| `progress-aria-label` | Uses the visible progress label       |

Visible templates accept `{legend}`, `{current}`, and `{total}`. For navigation
buttons, the tokens describe the destination section. For progress, they
describe the current section. `{current}` is one-based.

Accessible-name templates also accept `{label}`, the rendered visible label.
To include a section name in the visible button, use
`next-label="Continue to {legend}"`. Without an accessible-name override,
visible button templates containing `{legend}` use native button naming.
Short buttons receive the destination-aware accessible names listed above.

Labels are plain text, not HTML. Visible templates must produce nonempty text.
An empty accessible-name template uses the visible label. The component does
not add `aria-label` when the accessible name matches that visible text.
When a button’s
accessible-name override omits its visible wording, the component prefixes that
wording to keep the visible label in the accessible name.

Translate the templates and the authored legends, fields, and submit labels:

```html
<form-fieldset-progress
  lang="fr"
  previous-label="Retour"
  next-label="Continuer"
  previous-aria-label="{label} : {legend}"
  next-aria-label="{label} : {legend}"
  progress-label="Étape {current} sur {total} : {legend}"
>
  <form>
    <fieldset>
      <legend>Coordonnées</legend>
      <label>Votre nom <input name="name" required /></label>
    </fieldset>
    <fieldset>
      <legend>Confirmation</legend>
      <p>Vérifiez votre nom avant d’envoyer.</p>
    </fieldset>
    <button type="submit">Envoyer</button>
  </form>
</form-fieldset-progress>
```

The component does not translate the browser’s validation messages.
Navigation/progress label-attribute changes update in place.

## Supply your own controls

Reference existing controls by ID to replace the generated ones:

| Attribute            | Referenced element                |
| -------------------- | --------------------------------- |
| `previous-ref`       | Back `<button type="button">`     |
| `next-ref`           | Next `<button type="button">`     |
| `progress-ref`       | `<progress>`                      |
| `progress-label-ref` | Progress’s visible text container |

```html
<form-fieldset-progress
  previous-ref="back"
  next-ref="forward"
  progress-ref="application-progress"
  progress-label-ref="application-status"
>
  <form id="application" action="/apply" method="post">
    <fieldset>
      <legend>Contact</legend>
      <label>Name <input name="name" required /></label>
    </fieldset>
    <fieldset>
      <legend>Delivery notes</legend>
      <label>Notes <textarea name="notes"></textarea></label>
    </fieldset>
    <nav aria-label="Application sections">
      <button id="back" type="button" hidden>Back</button>
      <label id="application-status" for="application-progress" hidden
        >Form progress</label
      >
      <progress id="application-progress" value="1" max="2" hidden></progress>
      <button id="forward" type="button" hidden>Next</button>
      <button type="submit">Send application</button>
    </nav>
  </form>
</form-fieldset-progress>
```

References work independently. Referenced buttons must belong to the controlled
form and remain outside its step fieldsets. Buttons elsewhere in the document
need `form="application"`. Progress and its text container must also stay outside
steps and must not belong to a different form.
Changing a reference attribute restarts setup at the first section.

The component updates referenced controls’ labels, progress, and visibility.
Start enhancement-only Back, Next, progress, and progress labels with `hidden`.
After successful setup, each is revealed when useful; single-section progress
stays hidden. Hide the referenced elements themselves, not their ancestors.
Leave Submit visible for the native fallback. Original hidden attributes
are restored on teardown or setup failure.
With a generated Next button, it moves enabled authored submit controls into its
footer. Disabled submit controls stay where authored, preserving disabled states
inherited from fieldsets.
With a referenced Next button, submit controls stay where authored. Any control reference
attribute opts out of the default reserved-slot layout and Reset relocation.

For a button with icons, put its text in a
`<span data-fieldset-progress-label>`. Otherwise the component replaces the
button’s entire content with its label. Navigation buttons must not use
`aria-labelledby`; the label templates supply their accessible names.

Without `progress-label-ref`, the component uses the progress element’s first
associated label or creates one. Both referenced and automatically selected
labels must remain outside all sections, including an authored review.
A wrapping label needs a separate
`data-fieldset-progress-label` text container that does not contain progress.
Neither the wrapper nor its text container may enclose the host, controlled
form, links, or other form controls; only its own wrapped progress is allowed.
During enhancement,
progress gets its name from an associated label, or from `aria-labelledby`
when the visible text is not a native label or multiple native labels would
add unrelated wording. A distinct `progress-aria-label`
template supplies an override; matching text is not copied into `aria-label`.
The component uses native progress values instead of a repeated `aria-valuetext`.
Authored naming attributes are restored on teardown.

See [custom control placement](demo/index.html#custom-layout) and
[icons with translated labels](demo/index.html#translated-controls).

## Add a review screen

Review is opt-in. `review-panel` generates a final fieldset; `review-ref`
uses an authored one. Do not combine them.

```html
<form-fieldset-progress review-panel review-label="Check your answers">
  <form action="/apply" method="post">
    <fieldset>
      <legend>Contact</legend>
      <label>Name <input name="name" required /></label>
    </fieldset>
    <fieldset>
      <legend>Delivery</legend>
      <label
        >Country
        <select name="country">
          <option value="uk">United Kingdom</option>
          <option value="ca">Canada</option>
        </select>
      </label>
    </fieldset>
    <button type="submit">Send</button>
  </form>
</form-fieldset-progress>
```

The review participates in Back/Next, focus, events, and progress. Submit appears
there. Forward navigation validates the input sections before reaching review;
native final submission still validates the whole form.

Every entry into review rebuilds a `<dl>` containing one `<div>` with a `<dt>`
and `<dd>` per field or choice group. Changing answers with Back and returning
updates the summary. It does not mirror edits continuously while review is open.

- Include enabled, named native inputs, selects, and textareas in participating
  sections, plus form-associated controls outside fieldsets.
- Omit passwords, hidden inputs, buttons, and controls disabled directly or
  through a fieldset. The summary is not a submission payload.
- Use `aria-labelledby`, then `aria-label`, then associated native labels,
  falling back to the control’s name. Input/select/textarea content is excluded
  from wrapping label text.
- Radio groups and shared-name checkbox groups use a nested fieldset’s legend,
  or their name if there is no nested group legend. Selected choices show their
  labels; standalone checkboxes show Selected or Not selected.
- Selects and datalist choices use option labels rather than raw values.
  A datalist option without label text keeps the input’s value.
  File inputs show filenames only. Other values are shown as stored by the
  native control; empty values show Not provided.
- Multiple selections or files use a list inside the `<dd>`. Labels and values
  are inserted as plain text, never interpreted as HTML.

To supply a review fieldset, reference its ID:

```html
<form-fieldset-progress review-ref="answers">
  <form action="/apply" method="post">
    <fieldset>
      <legend>Contact</legend>
      <label>Name <input name="name" required /></label>
    </fieldset>
    <fieldset id="answers" hidden>
      <legend>Confirm your details</legend>
      <p>Check these answers before sending.</p>
      <dl></dl>
    </fieldset>
    <button type="submit">Send</button>
  </form>
</form-fieldset-progress>
```

The referenced fieldset must be outermost in this form, with a nonempty direct
legend and no hidden ancestor. Keep it read-only: no nested fieldsets, form
controls, editable content, or links. The component makes it the final section,
even if it appears earlier in the markup. Its first direct `<dl>` receives the
summary, or a list is created. Other authored content stays in place.

| Attribute                | Default / purpose                                                      |
| ------------------------ | ---------------------------------------------------------------------- |
| `review-panel`           | Boolean opt-in to a generated final review fieldset                    |
| `review-ref`             | ID of an authored review fieldset; does not customize footer placement |
| `review-label`           | `Review`; literal generated legend text                                |
| `review-empty-label`     | `Not provided`; empty fields and unselected groups                     |
| `review-checked-label`   | `Selected`; checked standalone checkbox                                |
| `review-unchecked-label` | `Not selected`; unchecked standalone checkbox                          |

All review messages must be nonempty plain text. Authored legends and field/choice
labels provide the rest of the localization. For example,
`review-label="Vérification" review-empty-label="Non renseigné"
review-checked-label="Oui" review-unchecked-label="Non"`.
Changing a review attribute restarts setup at the first section, retaining
native field values. Reset returns to the first section; the next review entry
shows the reset values.

Without JavaScript, no generated review exists; an authored hidden review stays
hidden and the form can submit normally. Disconnect, refresh, or failed setup
restores authored review nodes and hidden attributes and removes generated UI.
See the [generated and authored review examples](demo/index.html#review-panel).

## JavaScript API

| Member        | Behavior                                                                                               |
| ------------- | ------------------------------------------------------------------------------------------------------ |
| `state`       | Read-only: `idle`, `ready`, or `error`                                                                 |
| `form`        | Read-only controlled form, or `null` when inactive                                                     |
| `stepIndex`   | Read-only zero-based active index; `0` when inactive                                                   |
| `stepCount`   | Read-only section count; `0` when inactive                                                             |
| `next()`      | Validate and advance; return whether navigation succeeded                                              |
| `previous()`  | Go back without validation; return whether navigation succeeded                                        |
| `goTo(index)` | Navigate to a zero-based index, validating sections crossed forward                                    |
| `refresh()`   | Restore authored markup, re-read configuration, and restart at the first section; return setup success |

`next()` and `previous()` return `false` at their boundaries or before readiness.
Validation failures and canceled navigation return `false`. `goTo()` throws
`RangeError` for a noninteger or unavailable index. A request for the active
section returns `true` without changing focus or emitting a change event.

### Section-change events

All events bubble from the component:

| Event                                 | When it fires                                                                     | Detail                                                                |
| ------------------------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `form-fieldset-progress:ready`        | After successful setup                                                            | `stepIndex`, `stepCount`, `fieldset`                                  |
| `form-fieldset-progress:beforechange` | After applicable navigation checks, before rendering or focus changes; cancelable | Destination `stepIndex`, `stepCount`, `fieldset`, and `previousIndex` |
| `form-fieldset-progress:change`       | After the active section changes and any navigation focus update                  | Active `stepIndex`, `stepCount`, `fieldset`, and `previousIndex`      |
| `form-fieldset-progress:error`        | After setup fails and authored markup is restored                                 | `error`                                                               |

```js
const element = document.querySelector('form-fieldset-progress');
element.addEventListener('form-fieldset-progress:change', ({ detail }) => {
  console.log(detail.previousIndex, detail.stepIndex, detail.fieldset);
});
```

`fieldset` is the actual `HTMLFieldSetElement`; indices are zero-based.
Reset and native invalid-field recovery can also emit `change` when they switch
sections. Initial setup emits `ready`, not `change`.

Cancel `beforechange` with `preventDefault()` to prevent the requested navigation.
The navigation method then returns `false`. Without cancellation, navigation
remains synchronous. This event is not emitted for setup, reset, native
invalid-field recovery, or an active-section no-op.

See the [event demo](demo/index.html#section-events). The
[animation example](demo/index.html#section-transitions) uses `beforechange`
with an author-supplied View Transition script; animation is not built into the
component.

### Class-only imports

The package root and class module export the class without registering it:

```js
import { FormFieldsetProgressElement } from '@aarongustafson/form-fieldset-progress';

customElements.define('form-fieldset-progress', FormFieldsetProgressElement);
```

`define.js` registers the default tag on import and exports
`defineFormFieldsetProgress()`. Repeating registration for the same class and tag
is safe; conflicting definitions throw. To register a different tag, import the
class without importing `define.js`. The supplied host CSS targets the default tag.
Imports are safe without browser globals: the registration helper returns
`false` when no browser custom-element registry exists. Constructing the
element still requires a browser DOM and throws without one.

## Validation and submission

Keep per-section validation enabled. The boolean `no-validation` attribute skips
checks on forward navigation, but does not disable native submit validation.
It is not a replacement for validating each section.

- Next and forward `goTo()` check eligible controls, including custom validity
  messages. The first invalid section is shown and its invalid control is
  reported and focused.
- Enter in an ordinary single-line input advances an intermediate section.
  Textareas, inputs with a datalist, modified/composing keys, and button, submit,
  reset, image, file, checkbox, radio, range, and color inputs retain native
  keyboard behavior.
- `requestSubmit()` runs native whole-form validation first. The component
  reveals an invalid section before the browser focuses its control.
- A submit event before the last section is prevented and advances one section.
  Application submit handlers should respect `defaultPrevented`.
- A form’s `novalidate` skips section checks and native submit validation.
  A submitter’s `formnovalidate` retains its native bypass; before the last
  section, it advances without section checks.
- Final submission uses the authored submit control, preserving its name, value,
  label, listeners, and submission overrides. The component does not clear
  answers or mark submission complete.
- Native image submit inputs are supported, including controls outside the form
  associated through `form="..."`. They follow the same visibility and
  restoration rules as submit buttons and retain native coordinate submission.
- `form.submit()` bypasses validation and submit events. Use `requestSubmit()`
  when the component should participate.

See the [section-validation opt-out example](demo/index.html#validation-option).

## Reset

An uncanceled native reset restores form controls’ default values and returns to
the first section without moving focus. The component does not create Reset.

With no control reference attributes, it relocates authored button/input Reset controls
before Back in the footer, except controls hidden by a `[hidden]` ancestor or
disabled directly or through a fieldset. With any control reference attribute, Reset
stays where authored.

See the [Reset example](demo/index.html#optional-reset).

## Styling

The optional stylesheet provides a full-width footer, distinct Back/Next
treatments, and equal reserved Back and Next/Submit slots around progress.
Hiding Back does not collapse its slot. An authored Reset sits before Back and
wraps above navigation when the footer is 24rem wide or narrower.
Review styles distinguish field labels from values, preserve multiline answers,
and allow long values to wrap.

| CSS custom property          | Default                             |
| ---------------------------- | ----------------------------------- |
| `--fieldset-progress-gap`    | `0.75rem`                           |
| `--fieldset-progress-width`  | `16rem`, the maximum progress width |
| `--fieldset-progress-radius` | `0.25rem`                           |
| `--fieldset-progress-accent` | `Highlight`                         |

Light-DOM styling hooks:

- Controls: `data-fieldset-progress-previous`, `data-fieldset-progress-next`,
  `data-fieldset-progress-submit`, and `data-fieldset-progress-reset`.
- Progress: `data-fieldset-progress-progress` and `data-fieldset-progress-status`.
- Review: `data-fieldset-progress-review-panel`, `data-fieldset-progress-review`,
  and the generated `data-fieldset-progress-review-title`.
- Default layout: `data-fieldset-progress-navigation`,
  `data-fieldset-progress-controls`, `data-fieldset-progress-previous-slot`,
  `data-fieldset-progress-next-slot`, and `data-fieldset-progress-reset-slot`.
  The controls row has `data-fieldset-progress-has-reset` when Reset is present.
- Authored label text: `data-fieldset-progress-label`.

Slot wrappers are light-DOM layout elements, not shadow slots. Do not override
`[hidden]` to display inactive controls. Check contrast and visible focus when
changing styles.

## Reduce startup layout changes

The full native form can appear before the component’s JavaScript arrives,
then collapse to one section. Setup already runs together in a microtask;
loading the module earlier reduces the time before that happens.

Put the stylesheet and registration script in the document’s `<head>`.
Preload the class module so it can download alongside the registration helper:

```html
<link
  rel="stylesheet"
  href="/components/form-fieldset-progress/form-fieldset-progress.css"
/>
<link
  rel="modulepreload"
  href="/components/form-fieldset-progress/form-fieldset-progress.js"
/>
<script
  type="module"
  src="/components/form-fieldset-progress/define.js"
></script>
```

Adjust the URLs to match your deployment. Keep the module script’s normal
deferred execution; adding `async` can run setup before the form is fully
parsed. Load optional animation or other page scripts independently rather
than making the component wait for them.

Do not hide the host with `:not(:defined)`, or pre-hide its later fieldsets
with CSS. If JavaScript is unavailable or fails to load, that CSS can leave
the form or some fields inaccessible. `:defined` only means the element is
registered, not that setup succeeded. Authored `hidden` fieldsets are excluded
from ordinary steps, not automatically recovered as later sections.

These loading hints reduce avoidable delay; they do not guarantee a flash-free
first paint on a slow connection. The native form deliberately stays visible
and usable while loading and after failure. The component adds no startup
visibility mask or minimum loading delay.

## Accessibility and lifecycle

Fieldsets retain their legends and native grouping semantics. Inactive sections
leave the focus order and accessibility tree. Temporary `tabindex="-1"` lets
navigation focus the destination fieldset when it has no focusable fields,
including read-only review sections. Otherwise, navigation focuses its first
available input, select, or textarea in markup order. Hidden, disabled, inert,
and `aria-hidden` fields are skipped, as are button-like inputs and controls
owned by another form. The browser determines whether a field hidden by CSS
can receive focus. Setup, refresh, and reset do not move focus; validation
failures still focus the invalid field.
Progress has visible text and an accessible name. There is no additional live
announcement of section changes.

Supply labeled fields, meaningful legends, visible focus styles, and accessible
custom controls. Conditional fields within a section must manage their native
validation eligibility; hiding a required input with CSS does not remove its
validation constraint.

Invalid setup restores the authored form and emits the error event. Register
error listeners before importing `define.js` to observe initial setup errors.
Disconnection aborts component listeners and restores moved controls, original
label contents, and managed attributes without clearing entered values.
Reconnection starts at the first section.

Structure changes are not automatically observed. `refresh()` restores authored
markup before reading it again. To change component-managed hidden states or
the placement of relocated controls, disconnect the component, edit the
restored markup, and reconnect it. Do not nest controllers for the same form.

## Development

```sh
npm install
npm run test:run
npm run test:types
npx playwright install chromium firefox webkit
npm run test:browser
npm run lint
```

Run `node scripts/serve.js` and open <http://127.0.0.1:4176/demo/>.
The browser tests cover validation, focus, submission, keyboard use, layout,
events, and the no-JavaScript fallback. There are no runtime dependencies.
Manual screen-reader checks remain part of release review; automated checks
alone do not establish conformance.

## Publishing

The template’s release hooks are retained. `npm version minor` updates the
package version, updates and stages the pinned imports in
[the esm.sh demo](demo/esm.html), and creates the version commit and tag.
The `postversion` hook runs `git push --follow-tags`; the pushed version tag
triggers the publishing workflow. Configure npm trusted publishing for
`publish.yml` before running a release.

## License

[MIT](LICENSE)
