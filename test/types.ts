import { FormFieldsetProgressElement } from '@aarongustafson/form-fieldset-progress';
import { defineFormFieldsetProgress } from '@aarongustafson/form-fieldset-progress/define.js';

const element = document.createElement('form-fieldset-progress');
const same: FormFieldsetProgressElement = element;
const success: boolean =
	same.next() && same.previous() && same.goTo(0) && same.refresh();
const form: HTMLFormElement | null = same.form;
const registered: boolean = defineFormFieldsetProgress();

same.addEventListener('form-fieldset-progress:change', (event) => {
	const index: number = event.detail.previousIndex;
	const fieldset: HTMLFieldSetElement = event.detail.fieldset;
	console.log(index, fieldset);
});
same.addEventListener('form-fieldset-progress:error', (event) => {
	const error: Error = event.detail.error;
	console.log(error);
});

// @ts-expect-error Step indices are numeric.
same.goTo('first');
// @ts-expect-error State is read-only.
same.state = 'ready';
console.log(success, form, registered);
