import { execFileSync } from 'node:child_process';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '../define.js';

const tick = () => new Promise((resolve) => queueMicrotask(resolve));

async function fixture(attributes = '', extra = '') {
	document.body.innerHTML = `<form-fieldset-progress ${attributes}><form id="application">
		<fieldset><legend>Contact</legend><label>Name <input name="name" value="Ada"></label></fieldset>
		<button type="submit">Send</button>${extra}
	</form></form-fieldset-progress>`;
	await tick();
	return document.querySelector('form-fieldset-progress');
}

afterEach(() => document.body.replaceChildren());

describe('PR review regressions', () => {
	it('imports the class and registration helper without browser globals', () => {
		const result = execFileSync(
			process.execPath,
			[
				'--input-type=module',
				'--eval',
				`
			import assert from 'node:assert/strict';
			import { FormFieldsetProgressElement } from './index.js';
			import { defineFormFieldsetProgress } from './define.js';
			assert.throws(() => new FormFieldsetProgressElement(), /browser DOM/);
			console.log(JSON.stringify({
				name: FormFieldsetProgressElement.name,
				defined: defineFormFieldsetProgress(),
			}));
		`,
			],
			{ encoding: 'utf8' },
		);
		expect(JSON.parse(result)).toEqual({
			name: 'FormFieldsetProgressElement',
			defined: false,
		});
	});

	it.each(['form', 'host', 'wrapper'])(
		'rejects a wrapping progress-label reference to the %s without hiding the native form',
		async (target) => {
			const host = await fixture();
			host.remove();
			const form = host.querySelector('form');
			const span = document.createElement('span');
			span.setAttribute('data-fieldset-progress-label', '');
			span.textContent = 'Progress';
			const progress = document.createElement('progress');
			progress.id = 'meter';
			form.append(span, progress);
			let container = host;
			if (target === 'wrapper') {
				container = document.createElement('div');
				container.append(host);
			}
			const label = target === 'form' ? form : container;
			label.id = 'unsafe-label';
			host.setAttribute('progress-ref', 'meter');
			host.setAttribute('progress-label-ref', 'unsafe-label');
			const error = vi.fn();
			host.addEventListener('form-fieldset-progress:error', error);
			document.body.append(container);
			await tick();
			expect(host.state).toBe('error');
			expect(error).toHaveBeenCalledOnce();
			expect(form.closest('[hidden]')).toBeNull();
			expect(form.querySelector('[type=submit]').hidden).toBe(false);
			expect(host.querySelector('[name=name]').value).toBe('Ada');
		},
	);

	it.each([false, true])(
		'rejects a review inside a hidden wrapper when its own hidden attribute is %s',
		async (hidden) => {
			const host = await fixture(
				'review-ref="summary"',
				`<div hidden><fieldset id="summary" ${hidden ? 'hidden' : ''}><legend>Confirm</legend></fieldset></div>`,
			);
			expect(host.state).toBe('error');
			expect(host.querySelector('[type=submit]').hidden).toBe(false);
			expect(host.querySelector('form > fieldset').hidden).toBe(false);
		},
	);

	it('keeps an explicitly disabled submitter in its authored position', async () => {
		const host = await fixture(
			'',
			'<div id="disabled-actions"><button type="submit" disabled>Unavailable</button></div>',
		);
		const submit = host.querySelector('[disabled]');
		expect(host.state).toBe('ready');
		expect(submit.parentElement.id).toBe('disabled-actions');
		expect(submit.disabled).toBe(true);
		host.remove();
		expect(submit.parentElement.id).toBe('disabled-actions');
	});

	it.each(['native-step', 'native-review', 'explicit-review'])(
		'rejects a %s progress label inside a section and restores authored content',
		async (location) => {
			const host = await fixture();
			host.remove();
			const form = host.querySelector('form');
			const progress = document.createElement('progress');
			progress.id = 'meter';
			form.append(progress);
			host.setAttribute('progress-ref', progress.id);
			let section = form.querySelector('fieldset');
			if (location !== 'native-step') {
				section = document.createElement('fieldset');
				section.id = 'summary';
				section.hidden = true;
				section.innerHTML = '<legend>Confirm</legend>';
				form.append(section);
				host.setAttribute('review-ref', section.id);
			}
			const label = document.createElement(
				location === 'explicit-review' ? 'p' : 'label',
			);
			label.id = 'status';
			label.textContent = 'Authored progress';
			if (location === 'explicit-review')
				host.setAttribute('progress-label-ref', label.id);
			else label.htmlFor = progress.id;
			section.append(label);
			const error = vi.fn();
			host.addEventListener('form-fieldset-progress:error', error);
			document.body.append(host);
			await tick();
			expect(host.state).toBe('error');
			expect(error).toHaveBeenCalledOnce();
			expect(error.mock.calls[0][0].detail.error.message).toMatch(
				/progress UI outside the step fieldsets/,
			);
			expect(form.querySelector('fieldset').hidden).toBe(false);
			expect(form.querySelector('[type=submit]').hidden).toBe(false);
			expect(label.textContent).toBe('Authored progress');
			expect(label.parentElement).toBe(section);
			expect(section.hidden).toBe(location !== 'native-step');
			expect(
				host.querySelector('[data-fieldset-progress-navigation]'),
			).toBeNull();
		},
	);

	it('retains a nonempty datalist answer when the matching option has only a value', async () => {
		const host = await fixture(
			'review-panel',
			'<label>Route <input name="route" value="a" list="routes"></label><datalist id="routes"><option value="a"></option></datalist>',
		);
		expect(host.next()).toBe(true);
		const entry = Array.from(host.querySelectorAll('dl > div')).find(
			(item) => item.querySelector('dt').textContent === 'Route',
		);
		expect(entry.querySelector('dd').textContent).toBe('a');
	});
});
