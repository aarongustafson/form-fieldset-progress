import { afterEach, describe, expect, it } from 'vitest';
import '../define.js';

const tick = () => new Promise((resolve) => queueMicrotask(resolve));

async function fixture(attributes = '', extra = '') {
	document.body.innerHTML = `<form-fieldset-progress ${attributes}><form id="application">
		<fieldset><legend>Contact</legend><label>Name <input name="name" value="Ada" required></label></fieldset>
		<fieldset><legend>Delivery</legend><label>City <input name="city" value="London" required></label></fieldset>
		<button type="submit">Send</button>${extra}
	</form></form-fieldset-progress>`;
	await tick();
	return document.querySelector('form-fieldset-progress');
}

const entries = (host) =>
	Array.from(
		host.querySelectorAll('[data-fieldset-progress-review] > div'),
		(entry) => [
			entry.querySelector('dt').textContent,
			entry.querySelector('dd').textContent,
		],
	);

afterEach(() => document.body.replaceChildren());

describe('opt-in review', () => {
	it('adds no review by default', async () => {
		const host = await fixture();
		expect(host.stepCount).toBe(2);
		expect(
			host.querySelector('[data-fieldset-progress-review]'),
		).toBeNull();
	});

	it('generates a final, validated fieldset with a labeled definition list', async () => {
		const host = await fixture(
			'review-panel review-label="Check your answers"',
		);
		expect(host.stepCount).toBe(3);
		const review = host.querySelector(
			'[data-fieldset-progress-review-panel]',
		);
		expect(review.hidden).toBe(true);
		host.querySelector('[name=name]').value = '';
		expect(host.goTo(2)).toBe(false);
		host.querySelector('[name=name]').value = 'Ada';
		expect(host.goTo(2)).toBe(true);
		expect(review.querySelector('legend').textContent).toBe(
			'Check your answers',
		);
		expect(entries(host)).toEqual([
			['Name', 'Ada'],
			['City', 'London'],
		]);
		expect(host.querySelector('progress').value).toBe(3);
		expect(host.querySelector('[type=submit]').hidden).toBe(false);
		expect(host.querySelector('[data-fieldset-progress-next]').hidden).toBe(
			true,
		);
		expect(new FormData(host.form).get('name')).toBe('Ada');
	});

	it('updates on entry, respects cancellation, and returns to the first section on reset', async () => {
		const host = await fixture('review-panel');
		host.addEventListener(
			'form-fieldset-progress:beforechange',
			(event) => event.preventDefault(),
			{ once: true },
		);
		expect(host.goTo(2)).toBe(false);
		expect(entries(host)).toEqual([]);
		host.goTo(2);
		host.previous();
		host.querySelector('[name=city]').value = 'Paris';
		host.next();
		expect(entries(host)).toContainEqual(['City', 'Paris']);
		host.form.reset();
		await tick();
		expect(host.stepIndex).toBe(0);
		host.goTo(2);
		expect(entries(host)).toContainEqual(['City', 'London']);
		host.removeAttribute('review-panel');
		expect(host.stepCount).toBe(2);
		expect(
			host.querySelector('[data-fieldset-progress-review-panel]'),
		).toBeNull();
	});

	it('uses an authored hidden fieldset, restoring its nodes and visibility on teardown', async () => {
		const host = await fixture(
			'review-ref="summary"',
			'<fieldset id="summary" hidden><legend>Confirm</legend><p>Check the details below.</p><dl><div><dt>Original</dt><dd>Content</dd></div></dl></fieldset>',
		);
		const review = host.querySelector('#summary');
		const original = review.querySelector('dl > div');
		expect(host.stepCount).toBe(3);
		host.goTo(2);
		expect(review.hidden).toBe(false);
		expect(entries(host)).toContainEqual(['Name', 'Ada']);
		expect(review.querySelector('p').textContent).toBe(
			'Check the details below.',
		);
		host.refresh();
		expect(host.stepCount).toBe(3);
		host.remove();
		expect(review.hidden).toBe(true);
		expect(review.querySelector('dl > div')).toBe(original);
		expect(
			review
				.querySelector('dl')
				.hasAttribute('data-fieldset-progress-review'),
		).toBe(false);
	});

	it('uses option labels and group legends, handles empty values and files, and omits sensitive or unsuccessful controls', async () => {
		const host = await fixture(
			'review-panel',
			`<label>Country <select name="country"><option value="uk">United Kingdom</option></select></label>
			<fieldset id="choices"><legend>Preferences</legend>
				<fieldset><legend>Delivery speed</legend><label><input type="radio" name="speed" value="s" checked> Standard</label><label><input type="radio" name="speed" value="e"> Express</label></fieldset>
				<fieldset><legend>Updates</legend><label><input type="checkbox" name="updates" value="e" checked> Email</label><label><input type="checkbox" name="updates" value="s" checked> SMS</label></fieldset>
				<label><input type="checkbox" name="subscribe" checked> Subscribe</label>
				<label><input type="checkbox" name="agree"> Accept terms</label>
				<label>Notes <textarea name="notes"></textarea></label>
				<label>Attachments <input type="file" name="files" multiple></label>
				<label>Secret <input type="password" name="secret" value="private"></label>
				<input type="hidden" name="token" value="private">
				<label>Disabled <input name="disabled" value="private" disabled></label>
				<label>Route <input name="route" value="a" list="routes"></label>
				<datalist id="routes"><option value="a" label="Route A"></option></datalist>
			</fieldset>`,
		);
		Object.defineProperty(host.querySelector('[type=file]'), 'files', {
			value: [new File(['a'], 'a.txt'), new File(['b'], 'b.txt')],
		});
		host.goTo(host.stepCount - 1);
		expect(entries(host)).toEqual([
			['Name', 'Ada'],
			['City', 'London'],
			['Country', 'United Kingdom'],
			['Delivery speed', 'Standard'],
			['Updates', 'EmailSMS'],
			['Subscribe', 'Selected'],
			['Accept terms', 'Not selected'],
			['Notes', 'Not provided'],
			['Attachments', 'a.txtb.txt'],
			['Route', 'Route A'],
		]);
		expect(
			host.querySelectorAll('[data-fieldset-progress-review] dd ul'),
		).toHaveLength(2);
		expect(
			host.querySelector('[data-fieldset-progress-review]').textContent,
		).not.toContain('private');
	});

	it('localizes messages and renders values and accessible labels as plain text', async () => {
		const host = await fixture(
			'review-panel review-label="Vérification" review-empty-label="Non renseigné" review-checked-label="Oui" review-unchecked-label="Non"',
			'<label>Empty <input name="empty"></label><label><input type="checkbox" name="yes" checked> Yes</label><label><input type="checkbox" name="no"> No</label>',
		);
		const name = host.querySelector('[name=name]');
		name.value = '<img src=x onerror=alert(1)>';
		name.setAttribute('aria-label', '<b>Person</b>');
		host.goTo(2);
		expect(entries(host)).toContainEqual([
			'<b>Person</b>',
			'<img src=x onerror=alert(1)>',
		]);
		expect(entries(host)).toContainEqual(['Empty', 'Non renseigné']);
		expect(entries(host)).toContainEqual(['Yes', 'Oui']);
		expect(entries(host)).toContainEqual(['No', 'Non']);
		expect(
			host.querySelector(
				'[data-fieldset-progress-review] img, [data-fieldset-progress-review] b',
			),
		).toBeNull();
	});

	it.each([
		[
			'review-panel review-ref="summary"',
			'<fieldset id="summary" hidden><legend>Confirm</legend></fieldset>',
		],
		['review-ref="missing"', ''],
		['review-ref="summary"', '<div id="summary">Confirm</div>'],
		[
			'review-ref="summary"',
			'<fieldset id="summary" hidden><legend>Confirm</legend><input name="bad"></fieldset>',
		],
		['review-panel review-label=""', ''],
		['review-panel review-empty-label=""', ''],
	])(
		'reports invalid review configuration and restores the native form: %s',
		async (attributes, extra) => {
			let error;
			document.addEventListener(
				'form-fieldset-progress:error',
				(event) => {
					error = event.detail.error;
				},
				{ once: true },
			);
			const host = await fixture(attributes, extra);
			expect(host.state).toBe('error');
			expect(error).toBeInstanceOf(Error);
			expect(host.querySelector('fieldset').hidden).toBe(false);
			expect(host.querySelector('[type=submit]').hidden).toBe(false);
			expect(
				host.querySelector('[data-fieldset-progress-review-panel]'),
			).toBeNull();
		},
	);
});

describe('authored enhancement-only controls', () => {
	it('does not reveal an unrelated hidden native label when taking over referenced UI', async () => {
		const host = await fixture(
			'progress-ref="meter" progress-label-ref="status"',
			'<label id="status" for="meter" hidden>Progress</label><label id="extra-status" for="meter" hidden>Extra information</label><progress id="meter" hidden></progress>',
		);
		expect(host.querySelector('#status').hidden).toBe(false);
		expect(host.querySelector('#extra-status').hidden).toBe(true);
	});

	it.each(['label', 'div'])(
		'reveals a referenced hidden wrapping %s and restores it on teardown',
		async (tag) => {
			const host = await fixture(
				'progress-ref="meter" progress-label-ref="status"',
				`<${tag} id="status" hidden><span data-fieldset-progress-label>Progress</span><progress id="meter" hidden></progress></${tag}>`,
			);
			expect(host.querySelector('#status').hidden).toBe(false);
			expect(host.querySelector('#meter').hidden).toBe(false);
			host.remove();
			expect(host.querySelector('#status').hidden).toBe(true);
			expect(host.querySelector('#meter').hidden).toBe(true);
		},
	);

	it('reveals referenced UI when useful and restores authored hidden attributes on disconnect', async () => {
		const host = await fixture(
			'previous-ref="back" next-ref="next" progress-ref="meter" progress-label-ref="status"',
			'<button id="back" type="button" hidden>Back</button><button id="next" type="button" hidden>Next</button><label id="status" for="meter" hidden>Progress</label><progress id="meter" hidden></progress>',
		);
		expect(host.querySelector('#back').hidden).toBe(true);
		expect(host.querySelector('#next').hidden).toBe(false);
		expect(host.querySelector('#meter').hidden).toBe(false);
		expect(host.querySelector('#status').hidden).toBe(false);
		host.next();
		expect(host.querySelector('#back').hidden).toBe(false);
		expect(host.querySelector('#next').hidden).toBe(true);
		host.remove();
		for (const id of ['back', 'next', 'meter', 'status'])
			expect(host.querySelector(`#${id}`).hidden).toBe(true);
	});
});
