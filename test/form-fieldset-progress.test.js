import { afterEach, describe, expect, it, vi } from 'vitest';
import { FormFieldsetProgressElement } from '../index.js';

const tick = () => new Promise((resolve) => queueMicrotask(resolve));

async function fixture(attributes = '', contents = '') {
	document.body.innerHTML = `
		<form-fieldset-progress ${attributes}>
			<form>
				<fieldset id="contact"><legend>Contact</legend>
					<label>Name <input name="name" required></label>
					<fieldset><legend>Preferences</legend><input name="preference" value="email"></fieldset>
				</fieldset>
				<fieldset id="address"><legend>Address</legend>
					<label>City <input name="city" required></label>
				</fieldset>
				<fieldset id="review"><legend>Review</legend><p>Check your details.</p></fieldset>
				<button type="submit" name="action" value="send">Send application</button>
				<button type="reset">Start over</button>
				${contents}
			</form>
		</form-fieldset-progress>`;
	await tick();
	return document.querySelector('form-fieldset-progress');
}

afterEach(() => {
	document.body.replaceChildren();
	vi.restoreAllMocks();
});

describe('progressive enhancement', () => {
	it.each([
		['generated', '', ''],
		[
			'referenced',
			'progress-ref="meter" progress-label-ref="status"',
			'<label id="status" for="meter">Authored progress</label><progress id="meter"></progress>',
		],
		[
			'wrapping',
			'progress-ref="meter"',
			'<label id="status"><span id="status-text" data-fieldset-progress-label>Authored progress</span><progress id="meter"></progress></label>',
		],
	])(
		'hides single-section progress and its %s label, restoring them for multiple sections',
		async (_name, attributes, contents) => {
			const host = await fixture(attributes, contents);
			host.querySelector('#address').remove();
			host.querySelector('#review').remove();
			host.refresh();
			const progress = host.querySelector('progress');
			expect(host.stepCount).toBe(1);
			expect(progress.hidden).toBe(true);
			for (const label of host.querySelectorAll(
				'[data-fieldset-progress-status]',
			))
				expect(label.hidden).toBe(true);
			for (const label of progress.labels)
				expect(label.hidden).toBe(true);
			expect(host.querySelector('[type=submit]').hidden).toBe(false);
			const second = document.createElement('fieldset');
			second.innerHTML = '<legend>Second section</legend>';
			host.form.append(second);
			host.refresh();
			expect(host.stepCount).toBe(2);
			expect(host.querySelector('progress').hidden).toBe(false);
			for (const label of host.querySelectorAll(
				'[data-fieldset-progress-status]',
			))
				expect(label.hidden).toBe(false);
			for (const label of host.querySelector('progress').labels)
				expect(label.hidden).toBe(false);
		},
	);

	it('restores authored progress visibility on teardown without unhiding authored multi-section UI', async () => {
		const host = await fixture(
			'progress-ref="meter" progress-label-ref="status"',
			'<label id="status" for="meter" hidden>Authored progress</label><progress id="meter" hidden></progress>',
		);
		expect(host.querySelector('#meter').hidden).toBe(true);
		expect(host.querySelector('#status').hidden).toBe(true);
		host.querySelector('#address').remove();
		host.querySelector('#review').remove();
		host.refresh();
		const progress = host.querySelector('#meter');
		const label = host.querySelector('#status');
		host.remove();
		expect(progress.hidden).toBe(true);
		expect(label.hidden).toBe(true);
		expect(label.textContent).toBe('Authored progress');
	});

	it('enhances outermost fieldsets in light DOM without disabling fields', async () => {
		const host = await fixture();
		expect(host).toBeInstanceOf(FormFieldsetProgressElement);
		expect(host.shadowRoot).toBeNull();
		expect(host.state).toBe('ready');
		expect(host.stepCount).toBe(3);
		expect(host.stepIndex).toBe(0);
		expect(host.form.querySelector('#address').hidden).toBe(true);
		expect(host.form.querySelector('#contact fieldset').hidden).toBe(false);
		expect(host.form.querySelector('input[name=city]').disabled).toBe(
			false,
		);
		expect(new FormData(host.form).get('preference')).toBe('email');
		expect(
			host.querySelector('[data-fieldset-progress-previous]').hidden,
		).toBe(true);
		expect(
			host.querySelector('[data-fieldset-progress-next]').textContent,
		).toBe('Next');
		expect(
			host
				.querySelector('[data-fieldset-progress-next]')
				.getAttribute('aria-label'),
		).toBe('Next to Address');
		expect(host.querySelector('[type=submit]').hidden).toBe(true);
		expect(host.querySelector('progress').max).toBe(3);
		expect(host.querySelector('progress').value).toBe(1);
		expect(host.querySelector('progress').getAttribute('aria-label')).toBe(
			null,
		);
		expect(host.querySelector('progress').labels[0].textContent).toBe(
			'Step 1 of 3: Contact',
		);
		expect(
			host.querySelector('progress').hasAttribute('aria-valuetext'),
		).toBe(false);
	});

	it('validates current fields before advancing but never validates Back', async () => {
		const host = await fixture();
		const name = host.querySelector('[name=name]');
		const report = vi.spyOn(name, 'reportValidity');
		expect(host.next()).toBe(false);
		expect(report).toHaveBeenCalledOnce();
		expect(host.stepIndex).toBe(0);
		name.value = 'Ada';
		expect(host.next()).toBe(true);
		expect(host.stepIndex).toBe(1);
		expect(host.previous()).toBe(true);
		expect(host.stepIndex).toBe(0);
	});

	it('offers validated navigation before rendering and allows cancellation', async () => {
		const host = await fixture();
		const before = vi.fn((event) => {
			expect(event.bubbles).toBe(true);
			expect(event.cancelable).toBe(true);
			expect(event.detail).toEqual({
				stepIndex: 1,
				previousIndex: 0,
				stepCount: 3,
				fieldset: host.querySelector('#address'),
			});
			expect(host.stepIndex).toBe(0);
			expect(host.querySelector('#address').hidden).toBe(true);
			event.preventDefault();
		});
		const change = vi.fn();
		host.addEventListener('form-fieldset-progress:beforechange', before);
		host.addEventListener('form-fieldset-progress:change', change);
		expect(host.next()).toBe(false);
		expect(before).not.toHaveBeenCalled();
		host.querySelector('[name=name]').value = 'Ada';
		const next = host.querySelector('[data-fieldset-progress-next]');
		next.focus();
		expect(host.next()).toBe(false);
		expect(before).toHaveBeenCalledOnce();
		expect(change).not.toHaveBeenCalled();
		expect(document.activeElement).toBe(next);
		expect(host.stepIndex).toBe(0);
		expect(host.querySelector('progress').value).toBe(1);
		host.removeEventListener('form-fieldset-progress:beforechange', before);
		expect(host.next()).toBe(true);
		expect(host.stepIndex).toBe(1);
		expect(change).toHaveBeenCalledOnce();
	});

	it('does not allow a navigation hook to cancel reset or invalid-field recovery', async () => {
		const host = await fixture();
		host.querySelector('[name=name]').value = 'Ada';
		host.querySelector('[name=city]').value = 'Seattle';
		host.goTo(2);
		const before = vi.fn((event) => event.preventDefault());
		host.addEventListener('form-fieldset-progress:beforechange', before);
		expect(host.previous()).toBe(false);
		expect(host.stepIndex).toBe(2);
		host.querySelector('[name=city]').dispatchEvent(
			new Event('invalid', { cancelable: true }),
		);
		expect(host.stepIndex).toBe(1);
		host.form.reset();
		await tick();
		expect(host.stepIndex).toBe(0);
		expect(before).toHaveBeenCalledOnce();
	});

	it('offers the same cancellable hook for an early formnovalidate submit', async () => {
		const host = await fixture(
			'',
			'<button id="skip" type="submit" formnovalidate>Skip checks</button>',
		);
		const before = vi.fn((event) => event.preventDefault());
		host.addEventListener('form-fieldset-progress:beforechange', before);
		host.form.dispatchEvent(
			new SubmitEvent('submit', {
				bubbles: true,
				cancelable: true,
				submitter: host.querySelector('#skip'),
			}),
		);
		expect(before).toHaveBeenCalledOnce();
		expect(host.stepIndex).toBe(0);
	});

	it('abandons navigation if a beforechange listener refreshes or disconnects the host', async () => {
		for (const action of ['refresh', 'remove']) {
			const host = await fixture('no-validation');
			host.addEventListener(
				'form-fieldset-progress:beforechange',
				() => host[action](),
				{ once: true },
			);
			expect(host.next()).toBe(false);
			expect(host.stepIndex).toBe(0);
			expect(host.state).toBe(action === 'refresh' ? 'ready' : 'idle');
		}
	});

	it('uses the original submit control on the last screen', async () => {
		const host = await fixture('no-validation');
		const submit = host.querySelector('[type=submit]');
		const events = [];
		host.addEventListener('form-fieldset-progress:change', (event) =>
			events.push(event.detail),
		);
		host.next();
		host.next();
		expect(host.querySelector('[data-fieldset-progress-next]').hidden).toBe(
			true,
		);
		expect(
			host.querySelector('[data-fieldset-progress-previous]').textContent,
		).toBe('Back');
		expect(
			host
				.querySelector('[data-fieldset-progress-previous]')
				.getAttribute('aria-label'),
		).toBe('Back to Address');
		expect(submit.hidden).toBe(false);
		expect(submit.name).toBe('action');
		expect(submit.value).toBe('send');
		expect(host.querySelector('progress').value).toBe(3);
		expect(events[1]).toMatchObject({
			previousIndex: 1,
			stepIndex: 2,
			stepCount: 3,
		});
	});

	it('supports visible and accessible localized templates without parsing HTML', async () => {
		const host = await fixture(`no-validation
			next-label="Suite : {legend}" next-aria-label="{label}, étape {current}/{total}"
			previous-label="Retour : {legend}" progress-label="Étape {current}/{total} : {legend}"
			progress-aria-label="{label}"`);
		expect(
			host
				.querySelector('[data-fieldset-progress-next]')
				.getAttribute('aria-label'),
		).toBe('Suite : Address, étape 2/3');
		host.setAttribute('next-label', '<b>{legend}</b>');
		expect(
			host.querySelector('[data-fieldset-progress-next]').textContent,
		).toBe('<b>Address</b>');
		expect(
			host.querySelector('[data-fieldset-progress-next] b'),
		).toBeNull();
		expect(host.querySelector('progress').getAttribute('aria-label')).toBe(
			null,
		);
		expect(host.querySelector('progress').labels[0].textContent).toBe(
			'Étape 1/3 : Contact',
		);
	});

	it('preserves the visible wording in a button accessible name', async () => {
		const host = await fixture('next-aria-label="Continue to {legend}"');
		expect(
			host
				.querySelector('[data-fieldset-progress-next]')
				.getAttribute('aria-label'),
		).toBe('Next: Continue to Address');
	});

	it('keeps short labels stable while long labels follow the destination', async () => {
		const host = await fixture('no-validation');
		const next = host.querySelector('[data-fieldset-progress-next]');
		const previous = host.querySelector(
			'[data-fieldset-progress-previous]',
		);
		host.next();
		expect(next.textContent).toBe('Next');
		expect(next.getAttribute('aria-label')).toBe('Next to Review');
		expect(previous.textContent).toBe('Back');
		expect(previous.getAttribute('aria-label')).toBe('Back to Contact');
		host.previous();
		expect(next.textContent).toBe('Next');
		expect(next.getAttribute('aria-label')).toBe('Next to Address');
	});

	it('uses customized short labels in default long labels and empty overrides', async () => {
		const host = await fixture('next-label="Continue"');
		const next = host.querySelector('[data-fieldset-progress-next]');
		expect(next.textContent).toBe('Continue');
		expect(next.getAttribute('aria-label')).toBe('Continue to Address');
		host.setAttribute('next-aria-label', '');
		expect(next.getAttribute('aria-label')).toBeNull();
	});

	it('counts the current section in progress, including a full final section', async () => {
		const host = await fixture('no-validation');
		const progress = host.querySelector('progress');
		for (const [index, percent] of [
			[0, 100 / 3],
			[1, 200 / 3],
			[2, 100],
		]) {
			host.goTo(index);
			expect(progress.value).toBe(index + 1);
			expect(progress.max).toBe(3);
			expect((progress.value / progress.max) * 100).toBeCloseTo(
				percent,
				10,
			);
		}
		host.previous();
		expect(progress.value).toBe(2);
	});

	it('links progress to a non-label text container without copying its accessible name', async () => {
		const host = await fixture(
			'progress-ref="meter" progress-label-ref="status"',
			'<p id="status">Authored progress</p><progress id="meter"></progress>',
		);
		const progress = host.querySelector('#meter');
		expect(progress.getAttribute('aria-label')).toBeNull();
		expect(progress.getAttribute('aria-labelledby')).toBe('status');
		host.setAttribute('progress-label', 'Section {current}: {legend}');
		expect(host.querySelector('#status').textContent).toBe(
			'Section 1: Contact',
		);
		expect(progress.getAttribute('aria-label')).toBeNull();
		host.setAttribute(
			'progress-aria-label',
			'Current section {current} of {total}',
		);
		expect(progress.getAttribute('aria-label')).toBe(
			'Current section 1 of 3',
		);
		expect(progress.getAttribute('aria-labelledby')).toBeNull();
		host.setAttribute('progress-aria-label', '{label}');
		expect(progress.getAttribute('aria-label')).toBeNull();
		expect(progress.getAttribute('aria-labelledby')).toBe('status');
	});

	it('identifies a wrapping non-label text span and restores authored naming on teardown', async () => {
		const host = await fixture(
			'progress-ref="meter" progress-label-ref="wrapper"',
			'<div id="wrapper"><span data-fieldset-progress-label>Authored progress</span><progress id="meter" aria-label="Old name" aria-labelledby="old-label" aria-valuetext="Old value"></progress></div>',
		);
		const progress = host.querySelector('#meter');
		const text = host.querySelector('#wrapper span');
		expect(text.id).not.toBe('');
		expect(progress.getAttribute('aria-labelledby')).toBe(text.id);
		expect(progress.hasAttribute('aria-label')).toBe(false);
		expect(progress.hasAttribute('aria-valuetext')).toBe(false);
		host.remove();
		expect(text.id).toBe('');
		expect(text.textContent).toBe('Authored progress');
		expect(progress.getAttribute('aria-label')).toBe('Old name');
		expect(progress.getAttribute('aria-labelledby')).toBe('old-label');
		expect(progress.getAttribute('aria-valuetext')).toBe('Old value');
	});

	it('uses native button text when the visible template names the destination', async () => {
		const host = await fixture('next-label="Continue to {legend}"');
		const next = host.querySelector('[data-fieldset-progress-next]');
		expect(next.textContent).toBe('Continue to Address');
		expect(next.getAttribute('aria-label')).toBeNull();
		host.setAttribute('next-label', 'Continue');
		expect(next.getAttribute('aria-label')).toBe('Continue to Address');
		host.setAttribute('next-aria-label', '{label}');
		expect(next.getAttribute('aria-label')).toBeNull();
	});

	it('uses authored controls without duplicating or destroying their icons', async () => {
		const host = await fixture(
			'previous-ref="prev" next-ref="forward" progress-ref="meter" progress-label-ref="status" no-validation',
			`<div class="my-navigation">
				<button type="button" id="prev"><i aria-hidden="true">←</i><span data-fieldset-progress-label>Previous</span></button>
				<label id="status" for="meter">Completion</label><progress id="meter" max="10" value="4"></progress>
				<button type="button" id="forward"><span data-fieldset-progress-label>Next</span><i aria-hidden="true">→</i></button>
			</div>`,
		);
		const next = host.querySelector('#forward');
		expect(
			host.querySelector('[data-fieldset-progress-navigation]'),
		).toBeNull();
		expect(host.querySelectorAll('progress')).toHaveLength(1);
		expect(next.querySelector('i').textContent).toBe('→');
		next.click();
		expect(host.stepIndex).toBe(1);
		expect(host.querySelector('#status').textContent).toBe(
			'Step 2 of 3: Address',
		);
		host.remove();
		expect(
			next.querySelector('[data-fieldset-progress-label]').textContent,
		).toBe('Next');
		expect(host.querySelector('#meter').getAttribute('value')).toBe('4');
		expect(host.querySelector('#status').textContent).toBe('Completion');
	});

	it.each([
		['next-ref="missing"', ''],
		['next-ref="bad"', '<div id="bad"></div>'],
		['next-ref="bad"', '<button id="bad">Wrong type</button>'],
		[
			'next-ref="same" previous-ref="same"',
			'<button type="button" id="same">Same</button>',
		],
		['progress-ref="bad"', '<input id="bad">'],
	])(
		'reports invalid references and leaves the form usable: %s',
		async (attributes, content) => {
			const errors = [];
			document.addEventListener(
				'form-fieldset-progress:error',
				(event) => errors.push(event.detail),
				{ once: true },
			);
			const host = await fixture(attributes, content);
			expect(host.state).toBe('error');
			expect(errors).toHaveLength(1);
			expect(errors[0].error).toBeInstanceOf(Error);
			expect(host.querySelector('#address').hidden).toBe(false);
			expect(host.querySelector('[type=submit]').hidden).toBe(false);
		},
	);

	it('rejects missing legends, no steps, and submit controls inside steps', async () => {
		const host = await fixture();
		host.querySelector('legend').remove();
		expect(host.refresh()).toBe(false);
		expect(host.state).toBe('error');
		expect(host.querySelector('#address').hidden).toBe(false);
	});

	it('restores DOM position, focus attributes, and generated UI on disconnect/reconnect', async () => {
		const host = await fixture('no-validation');
		const submit = host.querySelector('[type=submit]');
		const reset = host.querySelector('[type=reset]');
		host.next();
		expect(document.activeElement).toBe(host.querySelector('#address'));
		host.remove();
		expect(host.state).toBe('idle');
		expect(
			host.querySelector('[data-fieldset-progress-navigation]'),
		).toBeNull();
		expect(host.querySelector('#address').hidden).toBe(false);
		expect(host.querySelector('#address').hasAttribute('tabindex')).toBe(
			false,
		);
		expect(submit.nextElementSibling).toBe(reset);
		document.body.append(host);
		await tick();
		expect(host.stepIndex).toBe(0);
		expect(
			host.querySelectorAll('[data-fieldset-progress-navigation]'),
		).toHaveLength(1);
	});

	it('resets to the first step unless reset is canceled', async () => {
		const host = await fixture('no-validation');
		host.next();
		host.form.reset();
		await tick();
		expect(host.stepIndex).toBe(0);
		host.next();
		host.form.addEventListener('reset', (event) => event.preventDefault(), {
			once: true,
		});
		host.form.reset();
		await tick();
		expect(host.stepIndex).toBe(1);
	});

	it('hoists the authored reset before a persistent Back slot in the default footer', async () => {
		const host = await fixture('no-validation');
		const reset = host.querySelector('[type=reset]');
		const controls = host.querySelector(
			'[data-fieldset-progress-controls]',
		);
		const previousSlot = host.querySelector(
			'[data-fieldset-progress-previous-slot]',
		);
		const nextSlot = host.querySelector(
			'[data-fieldset-progress-next-slot]',
		);
		expect(controls).not.toBeNull();
		expect(reset.parentElement).toBe(
			controls.querySelector('[data-fieldset-progress-reset-slot]'),
		);
		expect(reset.parentElement.nextElementSibling).toBe(previousSlot);
		expect(
			previousSlot.querySelector('[data-fieldset-progress-previous]')
				.hidden,
		).toBe(true);
		expect(
			nextSlot.querySelector('[data-fieldset-progress-next]').hidden,
		).toBe(false);
		host.next();
		expect(
			host.querySelector('[data-fieldset-progress-previous-slot]'),
		).toBe(previousSlot);
		reset.click();
		await tick();
		expect(host.stepIndex).toBe(0);
		host.remove();
		expect(reset.parentElement.localName).toBe('form');
		expect(reset.previousElementSibling.type).toBe('submit');
		expect(reset.hasAttribute('data-fieldset-progress-reset')).toBe(false);
	});

	it.each([
		[
			'previous-ref="custom-back"',
			'<button id="custom-back" type="button">Back</button>',
		],
		[
			'next-ref="custom-next"',
			'<button id="custom-next" type="button">Next</button>',
		],
		[
			'progress-ref="custom-progress"',
			'<progress id="custom-progress"></progress>',
		],
		[
			'progress-label-ref="custom-status"',
			'<span id="custom-status">Progress</span>',
		],
	])(
		'keeps Reset authored when any reference is defined: %s',
		async (attributes, content) => {
			const host = await fixture(attributes, content);
			const reset = host.querySelector('[type=reset]');
			expect(host.state).toBe('ready');
			expect(reset.parentElement).toBe(host.form);
			expect(
				host.querySelector('[data-fieldset-progress-reset-slot]'),
			).toBeNull();
			expect(
				host.querySelector('[data-fieldset-progress-controls]'),
			).toBeNull();
		},
	);

	it('moves button/input resets without losing handlers, and restores nested positions', async () => {
		const host = await fixture();
		const fieldset = host.querySelector('#contact');
		const input = document.createElement('input');
		input.type = 'reset';
		input.value = 'Clear answers';
		fieldset.append(input);
		const clicked = vi.fn();
		input.addEventListener('click', clicked);
		host.refresh();
		expect(
			host.querySelector('[data-fieldset-progress-reset-slot]').children,
		).toHaveLength(2);
		input.click();
		expect(clicked).toHaveBeenCalledOnce();
		host.remove();
		expect(input.parentElement).toBe(fieldset);
		expect(fieldset.lastElementChild).toBe(input);
	});

	it('does not hoist authored hidden resets or synthesize missing resets', async () => {
		const host = await fixture();
		const reset = host.querySelector('[type=reset]');
		host.remove();
		reset.hidden = true;
		document.body.append(host);
		await tick();
		expect(reset.parentElement).toBe(host.form);
		expect(reset.hidden).toBe(true);
		expect(
			host.querySelector('[data-fieldset-progress-reset-slot]'),
		).toBeNull();
		host.remove();
		reset.remove();
		document.body.append(host);
		await tick();
		expect(host.querySelector('[type=reset]')).toBeNull();
		expect(
			host.querySelector('[data-fieldset-progress-reset-slot]'),
		).toBeNull();
	});

	it('restores a hoisted reset before switching to reference-based UI', async () => {
		const host = await fixture(
			'',
			'<progress id="authored-progress"></progress>',
		);
		const reset = host.querySelector('[type=reset]');
		expect(
			reset.parentElement.hasAttribute(
				'data-fieldset-progress-reset-slot',
			),
		).toBe(true);
		host.setAttribute('progress-ref', 'authored-progress');
		expect(host.state).toBe('ready');
		expect(reset.parentElement).toBe(host.form);
		expect(
			host.querySelector('[data-fieldset-progress-reset-slot]'),
		).toBeNull();
	});

	it('keeps disabled reset controls in their authored positions', async () => {
		const host = await fixture(
			'',
			'<input type="reset" value="Unavailable reset" disabled>',
		);
		const reset = host.querySelector('input[type=reset]');
		expect(reset.parentElement).toBe(host.form);
		expect(reset.disabled).toBe(true);
	});

	it('respects novalidate and validates every traversed step for forward goTo', async () => {
		const host = await fixture();
		expect(host.goTo(2)).toBe(false);
		expect(host.stepIndex).toBe(0);
		host.querySelector('[name=name]').value = 'Ada';
		expect(host.goTo(2)).toBe(false);
		expect(host.stepIndex).toBe(1);
		host.form.noValidate = true;
		expect(host.goTo(2)).toBe(true);
		expect(() => host.goTo(-1)).toThrow(RangeError);
		expect(() => host.goTo(0.5)).toThrow(RangeError);
	});

	it('reveals only the first invalid section during native whole-form validation', async () => {
		const host = await fixture('no-validation');
		host.goTo(2);
		host.form.checkValidity();
		expect(host.stepIndex).toBe(0);
		await tick();
		expect(host.stepIndex).toBe(0);
	});

	it('does not undo a successful submission or intercept modified keyboard actions', async () => {
		const host = await fixture('no-validation');
		host.goTo(2);
		const event = new Event('submit', { bubbles: true, cancelable: true });
		host.form.dispatchEvent(event);
		expect(event.defaultPrevented).toBe(false);
	});

	it('cancels intermediate submission before earlier authored bubbling listeners run', async () => {
		const host = await fixture('no-validation');
		const seen = [];
		const form = host.form;
		form.addEventListener('submit', (event) =>
			seen.push(event.defaultPrevented),
		);
		host.refresh();
		form.dispatchEvent(
			new Event('submit', { bubbles: true, cancelable: true }),
		);
		expect(seen).toEqual([true]);
		expect(host.stepIndex).toBe(1);
	});

	it('keeps the generated status before the three navigation controls', async () => {
		const host = await fixture();
		const navigation = host.querySelector(
			'[data-fieldset-progress-navigation]',
		);
		expect(navigation.firstElementChild).toBe(
			host.querySelector('[data-fieldset-progress-status]'),
		);
	});

	it('fails safely for an empty label set after initialization', async () => {
		const host = await fixture();
		const error = vi.fn();
		host.addEventListener('form-fieldset-progress:error', error);
		host.setAttribute('next-label', '');
		expect(host.state).toBe('error');
		expect(error).toHaveBeenCalledOnce();
		expect(host.querySelector('#address').hidden).toBe(false);
	});

	it('does not let a label reference erase unrelated form content', async () => {
		const host = await fixture('progress-label-ref="contact"');
		expect(host.state).toBe('error');
		expect(host.querySelector('[name=name]')).not.toBeNull();
	});

	it('rejects a progress label that contains the whole form', async () => {
		const host = await fixture();
		host.form.id = 'whole-form';
		host.setAttribute('progress-label-ref', 'whole-form');
		expect(host.state).toBe('error');
		expect(host.querySelectorAll('fieldset')).toHaveLength(4);
	});

	it('rejects a progress label containing an input outside steps', async () => {
		const host = await fixture(
			'progress-label-ref="unsafe"',
			'<div id="unsafe"><input name="outside"></div>',
		);
		expect(host.state).toBe('error');
		expect(host.querySelector('[name=outside]')).not.toBeNull();
	});

	it('handles one section and preserves authored hidden sections on refresh', async () => {
		const host = await fixture();
		host.querySelector('#address').hidden = true;
		host.querySelector('#review').hidden = true;
		// Disconnect restores owned visibility; author changes belong after teardown.
		host.remove();
		host.querySelector('#address').hidden = true;
		host.querySelector('#review').hidden = true;
		document.body.append(host);
		await tick();
		expect(host.stepCount).toBe(1);
		expect(host.querySelector('[data-fieldset-progress-next]').hidden).toBe(
			true,
		);
		expect(host.querySelector('[type=submit]').hidden).toBe(false);
	});
});
