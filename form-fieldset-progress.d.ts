export interface FieldsetProgressStepDetail {
	stepIndex: number;
	stepCount: number;
	fieldset: HTMLFieldSetElement;
}

export interface FieldsetProgressChangeDetail extends FieldsetProgressStepDetail {
	previousIndex: number;
}

export interface FieldsetProgressErrorDetail {
	error: Error;
}

/** A light-DOM controller for the outermost fieldsets in one wrapped form. */
export declare class FormFieldsetProgressElement extends HTMLElement {
	static get observedAttributes(): string[];
	readonly state: 'idle' | 'ready' | 'error';
	readonly form: HTMLFormElement | null;
	readonly stepIndex: number;
	readonly stepCount: number;
	/** Restore authored markup, re-read configuration, and start at the first step. */
	refresh(): boolean;
	/** Validate the current section and advance, unless step validation is opted out. */
	next(): boolean;
	/** Go back without validation. */
	previous(): boolean;
	/** Validate sections crossed forward. Throws RangeError for an invalid index. */
	goTo(index: number): boolean;
}

declare global {
	interface HTMLElementTagNameMap {
		'form-fieldset-progress': FormFieldsetProgressElement;
	}

	interface HTMLElementEventMap {
		'form-fieldset-progress:ready': CustomEvent<FieldsetProgressStepDetail>;
		'form-fieldset-progress:change': CustomEvent<FieldsetProgressChangeDetail>;
		'form-fieldset-progress:error': CustomEvent<FieldsetProgressErrorDetail>;
	}
}
