import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { FormFieldsetProgressElement } from '../index.js';

const pathFor = (path) => resolve(process.cwd(), path);
const json = (path) => JSON.parse(readFileSync(pathFor(path), 'utf8'));

describe('published API contracts', () => {
	it('documents every observed attribute and public method', () => {
		const manifest = json('custom-elements.json');
		const declaration = manifest.modules[0].declarations[0];
		expect(declaration.attributes.map(({ name }) => name).sort()).toEqual(
			FormFieldsetProgressElement.observedAttributes.toSorted(),
		);
		for (const { name } of declaration.members) {
			expect(
				Object.getOwnPropertyDescriptor(
					FormFieldsetProgressElement.prototype,
					name,
				),
			).toBeDefined();
		}
		expect(
			manifest.modules[2].exports.find(
				({ kind }) => kind === 'custom-element-definition',
			).name,
		).toBe('form-fieldset-progress');
	});

	it('exports only existing, explicitly packaged files', () => {
		const pkg = json('package.json');
		for (const target of Object.values(pkg.exports)) {
			for (const path of typeof target === 'string'
				? [target]
				: Object.values(target)) {
				expect(existsSync(pathFor(path))).toBe(true);
				expect(pkg.files).toContain(path.replace(/^\.\//, ''));
			}
		}
		for (const path of pkg.files)
			expect(existsSync(pathFor(path))).toBe(true);
		expect(readFileSync(pathFor('index.js'), 'utf8')).not.toContain(
			'customElements.define',
		);
	});
});
