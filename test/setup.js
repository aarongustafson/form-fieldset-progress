import { beforeAll } from 'vitest';
import { FormFieldsetProgressElement } from '../form-fieldset-progress.js';

const elementName = 'form-fieldset-progress'.toLowerCase();

// Define the custom element before tests run
beforeAll(() => {
	if (!customElements.get(elementName)) {
		customElements.define(elementName, FormFieldsetProgressElement);
	}

	// Make the class available globally for testing static methods
	globalThis.FormFieldsetProgressElement = FormFieldsetProgressElement;
});
