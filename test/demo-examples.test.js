import { readFileSync } from 'node:fs';
import { Window } from 'happy-dom';
import { describe, expect, it } from 'vitest';

function readPage(name) {
	const window = new Window({
		settings: {
			disableCSSFileLoading: true,
			disableJavaScriptFileLoading: true,
			disableJavaScriptEvaluation: true,
			handleDisabledFileLoadingAsSuccess: true,
		},
	});
	return new window.DOMParser().parseFromString(
		readFileSync(`demo/${name}`, 'utf8'),
		'text/html',
	);
}

describe('authored demo destinations', () => {
	it.each(['index.html', 'esm.html'])(
		'%s gives each code/live example its own named destination',
		(name) => {
			const page = readPage(name);
			const ids = Array.from(
				page.querySelectorAll('[id]'),
				(node) => node.id,
			);
			expect(new Set(ids).size).toBe(ids.length);
			for (const pair of page.querySelectorAll('.code-demo-pair')) {
				const block = pair.closest('.demo-example, .demo-section');
				expect(block.id).toMatch(/^[a-z][a-z0-9-]+$/);
				expect(block.querySelector('h2, h3')).not.toBeNull();
				expect(block.querySelectorAll('.code-demo-pair')).toHaveLength(
					1,
				);
			}
		},
	);

	it('starts with two native steps and a submit control outside them', () => {
		const page = readPage('index.html');
		const form = page.querySelector('#basic form');
		expect(form.querySelectorAll(':scope > fieldset')).toHaveLength(2);
		expect(
			form.querySelectorAll('fieldset[hidden], fieldset[disabled]'),
		).toHaveLength(0);
		expect(
			form.querySelector('[type="submit"]').closest('fieldset'),
		).toBeNull();
	});

	it('keeps the embedded native form linkable and script-free', () => {
		const page = readPage('no-script.html');
		const dialog = page.querySelector('dialog[open]');
		expect(dialog.id).toBe('native-form');
		expect(dialog.querySelector('h1')).not.toBeNull();
		expect(page.querySelectorAll('script')).toHaveLength(0);
		expect(dialog.querySelectorAll('fieldset:not([hidden])')).toHaveLength(
			2,
		);
	});
});
