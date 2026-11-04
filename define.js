import { FormFieldsetProgressElement } from './form-fieldset-progress.js';

export function defineFormFieldsetProgress(tagName = 'form-fieldset-progress') {
	const hasWindow = typeof window !== 'undefined';
	const registry = hasWindow ? window.customElements : undefined;

	if (!registry || typeof registry.define !== 'function') {
		return false;
	}

	const existing = registry.get(tagName);
	if (existing && existing !== FormFieldsetProgressElement) {
		throw new Error(
			`${tagName} is already registered with a different class.`,
		);
	}
	if (!existing) {
		registry.define(tagName, FormFieldsetProgressElement);
	}

	return true;
}

defineFormFieldsetProgress();
