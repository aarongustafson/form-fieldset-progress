# `<form-fieldset-progress>`

Turn a form’s outermost fieldsets into one-section-at-a-time steps. The component
adds Back and Continue buttons, a progress indicator, and per-section validation
in light DOM. Without JavaScript, the full authored form remains usable.

**Unreleased:** develop from this checkout; no npm release has been published.

## Installation and registration

For local development, run `npm install` in this repository. In a consuming
project, install the checkout with `npm install ../form-fieldset-progress`.
Then use a bundler or import map to resolve package imports:

```js
import '@aarongustafson/form-fieldset-progress/define.js';
import '@aarongustafson/form-fieldset-progress/form-fieldset-progress.css';
```

The stylesheet is optional but supplies the default flex layout and distinct
secondary Back/primary Continue treatments. Without a bundler, copy the package
files and load `define.js` as a module and the CSS with a stylesheet link.

The package root and class module export the class **without registering it**:

```js
import { FormFieldsetProgressElement } from '@aarongustafson/form-fieldset-progress';

customElements.define('form-fieldset-progress', FormFieldsetProgressElement);
```

`define.js` registers the default tag on import. It also exports
`defineFormFieldsetProgress()`, which safely repeats registration for the same
class and tag, but throws on a conflicting definition. To use a different tag,
import the class instead; a constructor can only be registered once per registry.
The supplied CSS targets the default host name and generated data attributes.

## Basic use

Wrap exactly one form. Give every step a nonempty legend, and keep submit buttons
outside the step fieldsets:

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

Setup runs in a microtask after connection. All sections stay visible until setup
succeeds. Only visible outermost fieldsets become steps; nested fieldsets remain
part of their containing step. Initially hidden sections are excluded.
Disabled fieldsets can still be steps, but native validation ignores disabled
controls. Controls outside steps remain visible and participate in final native
validation.

The first step hides Back. The last hides Continue and shows the original submit
buttons. A single-step form shows its submit buttons immediately. No submit
button is synthesized: authored names, values, labels, listeners, and submission
overrides remain intact.

## Navigation and validation

- Continue validates eligible controls in the current section, including custom
  validity messages. Failure keeps the section visible and reports/focuses the
  first invalid control. Back never validates.
- `goTo(index)` validates every section crossed forward. If an intervening
  section is invalid, that section becomes active.
- `no-validation` skips step validation only. A form’s `novalidate` skips both
  step checks and native submission validation.
- Enter in a standard single-line input advances an intermediate step. Textareas,
  buttons, modified/composing key presses, and inputs with a datalist retain
  native keyboard behavior. Native implicit submission, if it occurs before the
  last step, advances rather than sending the form.
- `requestSubmit()` still runs native whole-form validation first. A capturing
  `invalid` listener reveals the first invalid section before the browser focuses
  it. A successful submit event before the last step advances one section instead
  of submitting; call `requestSubmit()` on the final step to submit.
- A submitter’s `formnovalidate` keeps its native validation bypass. If activated
  before the last step, it advances without a step check.
- Final submission uses normal browser behavior. The component does not mark
  the form complete, clear values, or replace server-side validation.
  `form.submit()` bypasses validation and submit events; use `requestSubmit()`
  when the component should participate.

Intermediate submit events are canceled during capture so ordinary authored
bubbling listeners (including persistence handlers) can see `defaultPrevented`.
Application submit handlers should respect that flag.

Inactive steps are hidden, **not disabled**, so their values remain in FormData.
The progress value counts sections left behind: zero on the first step and
`stepCount - 1` on the last, with `max=stepCount`. It can decrease when going
back. The visible description reports the current position; reaching the last
screen does not mean the form was submitted or every preceding answer is valid.

Reset returns to the first step after an uncanceled native reset. It does not
move focus. Navigation buttons and `goTo()` focus the destination fieldset group,
which takes its accessible name from the legend.

## Attributes and localization

Attributes are the configuration API; no JavaScript configuration object is
required. Authored attributes override defaults. Button templates describe the
**destination** section; progress templates describe the **current** section.

| Attribute             | Default / purpose                                   |
| --------------------- | --------------------------------------------------- |
| `previous-ref`        | ID of an authored Back `<button type="button">`     |
| `next-ref`            | ID of an authored Continue `<button type="button">` |
| `progress-ref`        | ID of an authored `<progress>`                      |
| `progress-label-ref`  | ID of its visible text container                    |
| `previous-label`      | `Back to {legend}`                                  |
| `next-label`          | `Continue to {legend}`                              |
| `progress-label`      | `Step {current} of {total}: {legend}`               |
| `previous-aria-label` | `{label}`                                           |
| `next-aria-label`     | `{label}`                                           |
| `progress-aria-label` | `{label}`                                           |
| `no-validation`       | Boolean; absent by default                          |

Visible templates support `{legend}`, `{current}` (one-based), and `{total}`.
Accessible-name templates also support `{label}`, the rendered visible label.
Labels are inserted as text, never HTML. Visible templates must produce nonempty
text. Empty accessible-name templates fall back to the visible label.
If a button’s accessible-name override omits its exact visible wording, the
component prefixes that wording to keep the visible label in the accessible name.
Translate all six templates and the authored legends/submit labels as needed.
The component does not translate browser validation messages.

Label changes update in place. Reference changes restart setup at the first step.
For changes to legends, steps, or submit controls, call `refresh()`.

## Supply your own navigation

References may replace each generated control independently. Buttons must belong
to the controlled form, use `type="button"`, and sit outside step fieldsets.
Progress and its label must also remain outside steps and must not belong to a
different form. Referenced elements can be elsewhere in the same document;
external buttons need a `form` attribute.

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
      <!-- Labeled fields -->
    </fieldset>
    <fieldset>
      <legend>Review</legend>
      <!-- Review content -->
    </fieldset>
    <nav aria-label="Application sections">
      <button id="back" type="button">
        <span aria-hidden="true">←</span>
        <span data-fieldset-progress-label>Back</span>
      </button>
      <label id="application-status" for="application-progress"
        >Form progress</label
      >
      <progress id="application-progress" value="0" max="2"></progress>
      <button id="forward" type="button">
        <span data-fieldset-progress-label>Continue</span>
        <span aria-hidden="true">→</span>
      </button>
      <button type="submit">Send application</button>
    </nav>
  </form>
</form-fieldset-progress>
```

Use `data-fieldset-progress-label` for the text span in a button with icons;
otherwise its entire content becomes the generated label. Do not use
`aria-labelledby` on navigation buttons: label templates own their accessible
names. For a wrapping progress `<label>`, provide a separate
`data-fieldset-progress-label` text span, not a container holding the progress bar.
Text containers must not contain links or form controls.

Without `progress-label-ref`, the component reuses the progress element’s first
associated label or generates a visible label. It sets `aria-label` and
`aria-valuetext` on progress, replacing any authored `aria-labelledby` while
enhanced. Existing values are restored on teardown.

When Continue is generated, the component moves the original submit controls into
its navigation row and restores their positions on teardown. With an authored
Continue button, submit controls stay where authored. Supplying all three control
references avoids a generated navigation wrapper.

## JavaScript and events

| Member        | Behavior                                                                        |
| ------------- | ------------------------------------------------------------------------------- |
| `state`       | Read-only: `idle`, `ready`, or `error`                                          |
| `form`        | Read-only controlled form, or `null` when inactive                              |
| `stepIndex`   | Read-only zero-based current step; `0` when inactive                            |
| `stepCount`   | Read-only available section count                                               |
| `next()`      | Validate and advance; return whether navigation succeeded                       |
| `previous()`  | Go back without validation                                                      |
| `goTo(index)` | Navigate; throw `RangeError` for a noninteger/unavailable index                 |
| `refresh()`   | Restore authored UI, re-read it, and restart at step zero; return setup success |

`next()` and `previous()` return `false` at their boundaries or before readiness;
validation failures also return `false`. A `goTo()` to the active step returns
`true` without changing focus or emitting a change.

All events bubble:

| Event                           | Detail                               |
| ------------------------------- | ------------------------------------ |
| `form-fieldset-progress:ready`  | `stepIndex`, `stepCount`, `fieldset` |
| `form-fieldset-progress:change` | The same, plus `previousIndex`       |
| `form-fieldset-progress:error`  | `error`: the setup error             |

Change events follow rendering and any navigation focus update. Reset and native
invalid events can also change the active step. Initial setup emits ready, not
change. Register error listeners before upgrading the element, or use a
document-level listener before importing `define.js`.

## Styling

The optional stylesheet uses flexbox, logical spacing, wrapping, system colors,
and visible focus outlines. It does not use shadow DOM or a CSS framework.

Hooks: `data-fieldset-progress-navigation`, `data-fieldset-progress-previous`,
`data-fieldset-progress-next`, `data-fieldset-progress-progress`,
`data-fieldset-progress-status`, and `data-fieldset-progress-submit`.
`data-fieldset-progress-label` is an authored text-container hook.

| CSS custom property          | Default     |
| ---------------------------- | ----------- |
| `--fieldset-progress-gap`    | `0.75rem`   |
| `--fieldset-progress-width`  | `16rem`     |
| `--fieldset-progress-radius` | `0.25rem`   |
| `--fieldset-progress-accent` | `Highlight` |

Check contrast when changing colors, including the primary button text against
its background. Do not override `[hidden]` to display inactive UI.

## Accessibility, recovery, and lifecycle

Native fieldsets and legends retain their semantics. Inactive sections leave the
focus order and accessibility tree. Fieldsets receive temporary `tabindex="-1"`
so navigation can focus the group named by its legend across browsers. There is no live region:
focus communicates button-driven section changes without a duplicate announcement.
Progress has both a visible description and an explicit accessible name.
[`<progress>` has no native datalist linkage](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/progress#attributes);
use separate step text or a list rather than expecting native tick labels.

Authors must supply labeled fields, meaningful legends, accessible custom markup,
visible focus styles, and reachable error messages. Custom conditional fields
inside a step must manage their own validation eligibility; hiding a required
input with CSS does not remove its validation constraint.

Setup errors restore the unenhanced form and emit the error event. Disconnection
aborts listeners, removes generated UI, and restores moved nodes, original label
nodes, and component-managed attributes without clearing field values.
Reconnection starts at the first step. Async reset callbacks check session
cancellation so stale work cannot change a later instance.

This version does not observe arbitrary DOM mutations or integrate automatic
conditional-step discovery. During enhancement, visibility is component-owned.
To change the available sections, disconnect the host, update the restored
markup/hidden states, and reconnect it. `refresh()` is sufficient for additions
and legend changes, but restores previously managed visibility before reading it.
Do not nest progress controllers for the same form.

## Persistence

No values or step IDs are saved automatically. To save field values, compose with
[`form-saver`](https://github.com/aarongustafson/form-saver):

```html
<form-saver>
  <form-fieldset-progress>
    <form><!-- Fieldsets and submit button --></form>
  </form-fieldset-progress>
</form-saver>
```

Register both packages separately. `form-saver` currently uses localStorage;
review its sensitive-field exclusions, storage policy, and submit-clearing
behavior for your application. Restoring field values does not restore the active
step: this component still starts at the first section. There is no built-in
localStorage, IndexedDB, or asynchronous validation API.

## Development and validation

```sh
npm install
npm run test:run
npm run test:types
npx playwright install chromium firefox webkit
npm run test:browser
npm run lint
```

Run `node scripts/serve.js` and open <http://127.0.0.1:4176/demo/> for the demos.
The browser suite uses the same server and tests native validation, focus, form
submission, keyboard use, responsive layout, and the no-JavaScript fallback.
No runtime dependencies are required. Manual screen-reader checks remain part
of release review; passing automated tests alone does not establish conformance.

## License

[MIT](LICENSE)
