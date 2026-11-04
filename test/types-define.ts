import { defineFormFieldsetProgress } from '@aarongustafson/form-fieldset-progress/define.js';

const registered: boolean = defineFormFieldsetProgress();
const element = document.createElement('form-fieldset-progress');
const state: 'idle' | 'ready' | 'error' = element.state;
const form: HTMLFormElement | null = element.form;
const index: number = element.stepIndex;
const count: number = element.stepCount;
const success: boolean =
	element.next() &&
	element.previous() &&
	element.goTo(0) &&
	element.refresh();

element.addEventListener('form-fieldset-progress:ready', (event) => {
	const index: number = event.detail.stepIndex;
	const count: number = event.detail.stepCount;
	const fieldset: HTMLFieldSetElement = event.detail.fieldset;
	console.log(index, count, fieldset);
});
element.addEventListener('form-fieldset-progress:beforechange', (event) => {
	const index: number = event.detail.stepIndex;
	const previous: number = event.detail.previousIndex;
	const fieldset: HTMLFieldSetElement = event.detail.fieldset;
	event.preventDefault();
	console.log(index, previous, fieldset);
});
element.addEventListener('form-fieldset-progress:change', (event) => {
	const previous: number = event.detail.previousIndex;
	const fieldset: HTMLFieldSetElement = event.detail.fieldset;
	console.log(previous, fieldset);
});
element.addEventListener('form-fieldset-progress:error', (event) => {
	const error: Error = event.detail.error;
	console.log(error);
});

// @ts-expect-error Step indices are numeric.
element.goTo('first');
// @ts-expect-error State is read-only.
element.state = 'ready';
console.log(registered, state, form, index, count, success);
