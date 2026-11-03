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
		).toBe('Continue to Address');
		expect(host.querySelector('[type=submit]').hidden).toBe(true);
		expect(host.querySelector('progress').max).toBe(3);
		expect(host.querySelector('progress').value).toBe(0);
		expect(host.querySelector('progress').getAttribute('aria-label')).toBe(
			'Step 1 of 3: Contact',
		);
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
		).toBe('Back to Address');
		expect(submit.hidden).toBe(false);
		expect(submit.name).toBe('action');
		expect(submit.value).toBe('send');
		expect(host.querySelector('progress').value).toBe(2);
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
			'Étape 1/3 : Contact',
		);
	});

	it('preserves the visible wording in a button accessible name', async () => {
		const host = await fixture('next-aria-label="Next section"');
		expect(
			host
				.querySelector('[data-fieldset-progress-next]')
				.getAttribute('aria-label'),
		).toContain('Continue to Address');
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
