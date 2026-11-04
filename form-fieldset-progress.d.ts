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

/** A light-DOM fieldset controller with optional generated or referenced final review. */
export declare class FormFieldsetProgressElement extends HTMLElement {
	static get observedAttributes(): string[];
	readonly state: 'idle' | 'ready' | 'error';
	readonly form: HTMLFormElement | null;
	readonly stepIndex: number;
	/** Includes the optional final review fieldset. */
	readonly stepCount: number;
	/** Restore authored markup, re-read configuration, and start at the first step. */
	refresh(): boolean;
	/** Validate and advance, focusing the first available field or the fieldset; return false when canceled. */
	next(): boolean;
	/** Go back without validation, focusing the first available field or the fieldset; return false when canceled. */
	previous(): boolean;
	/** Validate sections crossed forward and focus the destination's first available field or fieldset. Return false when canceled. Throws RangeError for an invalid index. */
	goTo(index: number): boolean;
}

declare global {
	interface HTMLElementTagNameMap {
		'form-fieldset-progress': FormFieldsetProgressElement;
	}

	interface HTMLElementEventMap {
		'form-fieldset-progress:ready': CustomEvent<FieldsetProgressStepDetail>;
		'form-fieldset-progress:beforechange': CustomEvent<FieldsetProgressChangeDetail>;
		'form-fieldset-progress:change': CustomEvent<FieldsetProgressChangeDetail>;
		'form-fieldset-progress:error': CustomEvent<FieldsetProgressErrorDetail>;
	}
}
