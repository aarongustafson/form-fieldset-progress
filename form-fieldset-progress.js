const owners = new WeakMap();
const prefix = 'data-fieldset-progress-';
const defaults = {
	'previous-label': 'Back',
	'next-label': 'Next',
	'progress-label': 'Step {current} of {total}: {legend}',
};
const ariaDefaults = {
	'previous-aria-label': '{label} to {legend}',
	'next-aria-label': '{label} to {legend}',
	'progress-aria-label': '{label}',
};
const reviewDefaults = {
	'review-label': 'Review',
	'review-empty-label': 'Not provided',
	'review-checked-label': 'Selected',
	'review-unchecked-label': 'Not selected',
};
const reviewAttributes = [
	'review-panel',
	'review-ref',
	...Object.keys(reviewDefaults),
];
const references = [
	'previous-ref',
	'next-ref',
	'progress-ref',
	'progress-label-ref',
];
let sequence = 0;

function reviewText(element) {
	const walker = element.ownerDocument.createTreeWalker(
		element,
		NodeFilter.SHOW_TEXT,
	);
	const text = [];
	for (let node = walker.nextNode(); node; node = walker.nextNode()) {
		const excluded = node.parentElement.closest(
			'input, select, textarea, button, script, style, [aria-hidden="true"]',
		);
		if (!excluded || excluded === element || !element.contains(excluded))
			text.push(node.textContent);
	}
	return text.join('').replace(/\s+/g, ' ').trim();
}

function optionLabel(option) {
	return option.getAttribute('label') || reviewText(option);
}

const HTMLElementBase =
	globalThis.HTMLElement ??
	class {
		constructor() {
			throw new Error('form-fieldset-progress requires a browser DOM.');
		}
	};

/** Progressively enhance a form's outermost fieldsets in light DOM. */
export class FormFieldsetProgressElement extends HTMLElementBase {
	static get observedAttributes() {
		return [
			...references,
			...Object.keys(defaults),
			...Object.keys(ariaDefaults),
			...reviewAttributes,
			'no-validation',
		];
	}

	constructor() {
		super();
		this._state = 'idle';
		this._form = null;
		this._steps = [];
		this._index = 0;
		this._attributes = new Map();
		this._contents = new Map();
		this._generated = [];
		this._moves = [];
		this._session = null;
		this._invalidTarget = null;
		this._invalidTimer = null;
	}

	get state() {
		return this._state;
	}

	get form() {
		return this._form;
	}

	get stepIndex() {
		return this._index;
	}

	get stepCount() {
		return this._steps.length;
	}

	connectedCallback() {
		queueMicrotask(() => {
			if (this.isConnected && this._state === 'idle') this.refresh();
		});
	}

	disconnectedCallback() {
		this._teardown();
	}

	attributeChangedCallback(name, oldValue, newValue) {
		if (oldValue === newValue || this._state !== 'ready') return;
		if (
			references.includes(name) ||
			reviewAttributes.includes(name) ||
			!this._labelsValid()
		)
			this.refresh();
		else this._render();
	}

	/** Re-read authored markup; restore the original UI before attempting setup. */
	refresh() {
		this._teardown();
		if (!this.isConnected) return false;
		try {
			this._prepare();
			this._session = new AbortController();
			owners.set(this._form, this);
			this._build();
			this._listen();
			this._state = 'ready';
			this._render();
			this._emit('ready', this._detail());
			return true;
		} catch (error) {
			this._teardown();
			this._state = 'error';
			this._emit('error', { error });
			return false;
		}
	}

	next() {
		if (this._state !== 'ready' || this._index >= this.stepCount - 1)
			return false;
		return this.goTo(this._index + 1);
	}

	previous() {
		if (this._state !== 'ready' || this._index === 0) return false;
		return this.goTo(this._index - 1);
	}

	/** Navigate by zero-based index, validating every section crossed forward. */
	goTo(index) {
		if (!Number.isInteger(index) || index < 0 || index >= this.stepCount) {
			throw new RangeError(
				'The step index must identify an available fieldset.',
			);
		}
		if (this._state !== 'ready') return false;
		if (index === this._index) return true;
		if (
			index > this._index &&
			!this.hasAttribute('no-validation') &&
			!this._form.noValidate
		) {
			for (let current = this._index; current < index; current += 1) {
				const invalid = Array.from(this._form.elements).find(
					(control) =>
						this._steps[current].fieldset.contains(control) &&
						control.willValidate &&
						!control.validity.valid,
				);
				if (invalid) {
					this._show(current, false);
					invalid.reportValidity();
					invalid.focus();
					return false;
				}
			}
		}
		return this._navigate(index);
	}

	_prepare() {
		const forms = this.querySelectorAll('form');
		if (forms.length !== 1) throw new Error('Wrap exactly one form.');
		this._form = forms[0];
		if (owners.has(this._form))
			throw new Error('This form already has a progress controller.');
		if (
			this.hasAttribute('review-panel') &&
			this.hasAttribute('review-ref')
		)
			throw new Error('Use either review-panel or review-ref, not both.');
		this._review = this._reference('review-ref', 'fieldset');
		if (
			this._review &&
			(this._review.closest('form') !== this._form ||
				this._review.parentElement.closest('fieldset') ||
				this._review.parentElement.closest('[hidden]') ||
				this._review.querySelector(
					'fieldset, input, select, textarea, button, progress, output, a[href], [contenteditable]',
				))
		)
			throw new Error(
				'The review reference must be an outermost, read-only fieldset in this form, without a hidden ancestor.',
			);
		const fieldsets = Array.from(
			this._form.querySelectorAll('fieldset'),
		).filter(
			(fieldset) =>
				fieldset !== this._review &&
				!fieldset.parentElement.closest('fieldset') &&
				!fieldset.closest('[hidden]'),
		);
		if (!fieldsets.length)
			throw new Error('Provide at least one visible outermost fieldset.');
		this._steps = fieldsets.map((fieldset) => {
			const legend = Array.from(fieldset.children).find(
				(child) => child.localName === 'legend',
			);
			if (!legend?.textContent.trim())
				throw new Error('Every step needs a nonempty legend.');
			return { fieldset, legend };
		});
		this._submits = Array.from(
			this._form
				.getRootNode()
				.querySelectorAll(
					'button, input[type="submit"], input[type="image"]',
				),
		).filter(
			(control) =>
				control.form === this._form &&
				['submit', 'image'].includes(control.type) &&
				!control.closest('[hidden]'),
		);
		if (!this._submits.length)
			throw new Error('Provide an authored submit button.');
		if (
			this._submits.some((control) =>
				this._steps.some(({ fieldset }) => fieldset.contains(control)),
			)
		) {
			throw new Error('Place submit buttons outside the step fieldsets.');
		}
		this._previous = this._reference('previous-ref', 'button');
		this._next = this._reference('next-ref', 'button');
		this._progress = this._reference('progress-ref', 'progress');
		this._progressLabel = this._reference('progress-label-ref');
		if (this._previous && this._previous === this._next)
			throw new Error('Navigation buttons must be distinct.');
		for (const button of [this._previous, this._next].filter(Boolean)) {
			if (button.type !== 'button' || button.form !== this._form) {
				throw new Error(
					'Navigation references must be type="button" buttons owned by this form.',
				);
			}
			if (this._steps.some(({ fieldset }) => fieldset.contains(button))) {
				throw new Error(
					'Place navigation controls outside the step fieldsets.',
				);
			}
			if (button.hasAttribute('aria-labelledby')) {
				throw new Error(
					'Use label templates instead of aria-labelledby on navigation buttons.',
				);
			}
		}
		for (const control of [this._progress, this._progressLabel].filter(
			Boolean,
		)) {
			if (
				control.closest('form') &&
				control.closest('form') !== this._form
			) {
				throw new Error(
					'Progress references must not belong to another form.',
				);
			}
			if (
				this._steps.some(({ fieldset }) => fieldset.contains(control))
			) {
				throw new Error(
					'Place progress UI outside the step fieldsets.',
				);
			}
		}
		this._buildReview();
		if (!this._labelsValid())
			throw new Error(
				'Visible label templates must produce nonempty text.',
			);
	}

	_reference(attribute, tagName) {
		if (!this.hasAttribute(attribute)) return null;
		const id = this.getAttribute(attribute);
		const element = this.ownerDocument.getElementById(id);
		if (
			!id ||
			/\s/.test(id) ||
			!element ||
			(tagName && element.localName !== tagName)
		) {
			throw new Error(
				`${attribute} must reference an existing ${tagName || 'text'} element by ID.`,
			);
		}
		return element;
	}

	_buildReview() {
		if (!this._review && !this.hasAttribute('review-panel')) return;
		for (const attribute of Object.keys(reviewDefaults)) {
			if (!this._reviewMessage(attribute))
				throw new Error(`${attribute} must contain nonempty text.`);
		}
		if (!this._review) {
			this._review = this._create('fieldset', 'review-panel', this._form);
			const legend = this._create('legend', 'review-title', this._review);
			legend.textContent = this._reviewMessage('review-label');
		}
		const legend = Array.from(this._review.children).find(
			(child) => child.localName === 'legend',
		);
		if (!legend?.textContent.trim())
			throw new Error('The review fieldset needs a nonempty legend.');
		this._set(this._review, `${prefix}review-panel`, '');
		this._reviewList =
			this._review.querySelector(':scope > dl') ||
			this._create('dl', 'review', this._review);
		this._set(this._reviewList, `${prefix}review`, '');
		this._steps.push({ fieldset: this._review, legend });
	}

	_reviewMessage(attribute) {
		return (
			this.getAttribute(attribute) ?? reviewDefaults[attribute]
		).trim();
	}

	_reviewLabel(control) {
		const referenced = (control.getAttribute('aria-labelledby') || '')
			.split(/\s+/)
			.map((id) => this.ownerDocument.getElementById(id))
			.filter(Boolean);
		return (
			referenced.map((element) => reviewText(element)).join(' ') ||
			control.getAttribute('aria-label')?.trim() ||
			Array.from(control.labels || [], (label) => reviewText(label))
				.filter(Boolean)
				.join(' ') ||
			control.name
		);
	}

	_renderReview() {
		const groups = new Map();
		for (const control of this._form.elements) {
			if (
				!['input', 'select', 'textarea'].includes(control.localName) ||
				!control.name ||
				control.matches(':disabled') ||
				[
					'hidden',
					'password',
					'submit',
					'reset',
					'button',
					'image',
				].includes(control.type) ||
				(control.closest('fieldset') &&
					!this._steps.some(
						({ fieldset }) =>
							fieldset !== this._review &&
							fieldset.contains(control),
					))
			)
				continue;
			const key = ['radio', 'checkbox'].includes(control.type)
				? `${control.type}:${control.name}`
				: control;
			if (!groups.has(key)) groups.set(key, []);
			groups.get(key).push(control);
		}
		const entries = [];
		for (const controls of groups.values()) {
			const control = controls[0];
			let label = this._reviewLabel(control);
			let values;
			if (
				control.type === 'radio' ||
				(control.type === 'checkbox' && controls.length > 1)
			) {
				const fieldset = control.closest('fieldset');
				const legend =
					fieldset &&
					!this._steps.some((step) => step.fieldset === fieldset)
						? Array.from(fieldset.children).find(
								(child) => child.localName === 'legend',
							)
						: null;
				label = legend ? reviewText(legend) : control.name;
				values = controls
					.filter((item) => item.checked)
					.map((item) => this._reviewLabel(item));
			} else if (control.type === 'checkbox') {
				values = [
					this._reviewMessage(
						control.checked
							? 'review-checked-label'
							: 'review-unchecked-label',
					),
				];
			} else if (control.localName === 'select') {
				values = Array.from(control.selectedOptions)
					.filter(
						(option) =>
							!option.disabled &&
							!option.closest('optgroup[disabled]'),
					)
					.map((option) => optionLabel(option));
			} else if (control.type === 'file') {
				values = Array.from(control.files, (file) => file.name);
			} else {
				const option =
					control.list &&
					Array.from(control.list.options).find(
						(item) => item.value === control.value,
					);
				values = [
					option
						? optionLabel(option) || control.value
						: control.value,
				];
			}
			values = values.filter((value) => value !== '');
			const entry = this.ownerDocument.createElement('div');
			const term = this.ownerDocument.createElement('dt');
			const definition = this.ownerDocument.createElement('dd');
			term.textContent = label;
			if (values.length > 1) {
				const list = this.ownerDocument.createElement('ul');
				for (const value of values) {
					const item = this.ownerDocument.createElement('li');
					item.textContent = value;
					list.append(item);
				}
				definition.append(list);
			} else {
				definition.textContent =
					values[0] ?? this._reviewMessage('review-empty-label');
			}
			entry.append(term, definition);
			entries.push(entry);
		}
		if (!this._contents.has(this._reviewList))
			this._contents.set(
				this._reviewList,
				Array.from(this._reviewList.childNodes),
			);
		this._reviewList.replaceChildren(...entries);
	}

	_build() {
		const authoredNext = Boolean(this._next);
		if (!this._previous || !this._next || !this._progress) {
			this._navigation = this._create('div', 'navigation', this._form);
		}
		this._previous ||= this._create('button', 'previous', this._navigation);
		this._progress ||= this._create(
			'progress',
			'progress',
			this._navigation,
		);
		this._next ||= this._create('button', 'next', this._navigation);
		for (const [button, name] of [
			[this._previous, 'previous'],
			[this._next, 'next'],
		]) {
			this._set(button, 'type', 'button');
			this._set(button, `${prefix}${name}`, '');
		}
		this._set(this._progress, `${prefix}progress`, '');
		this._set(this._progress, 'aria-labelledby', null);
		if (!this._progressLabel) {
			this._progressLabel = this._progress.labels?.[0] || null;
			if (!this._progressLabel) {
				this._progressLabel = this._create('label', 'status');
				if (this._progress.parentElement === this._navigation)
					this._navigation.prepend(this._progressLabel);
				else this._progress.before(this._progressLabel);
				this._progressLabel.htmlFor = this._identify(this._progress);
			}
		}
		this._progressLabelContainer = this._progressLabel;
		const controls =
			'form, fieldset, legend, button, input, select, textarea, progress, a[href], [contenteditable]';
		if (
			this._progressLabelContainer.contains(this._form) ||
			this._progressLabelContainer.contains(this) ||
			this._progressLabelContainer.matches(controls) ||
			Array.from(
				this._progressLabelContainer.querySelectorAll(controls),
			).some((control) => control !== this._progress)
		) {
			throw new Error(
				'The progress label must be a text container without form controls or links, except its own wrapped progress.',
			);
		}
		if (this._progressLabel.contains(this._progress)) {
			const labelText = this._progressLabel.querySelector(
				`[${prefix}label]`,
			);
			if (!labelText || labelText.contains(this._progress)) {
				throw new Error(
					'A wrapping progress label needs a separate data-fieldset-progress-label text container.',
				);
			}
			this._progressLabel = labelText;
		}
		this._set(this._progressLabel, `${prefix}status`, '');
		for (const { fieldset } of this._steps)
			this._set(fieldset, 'tabindex', '-1');
		for (const submit of this._submits)
			this._set(submit, `${prefix}submit`, '');
		const submitContainer = references.some((name) =>
			this.hasAttribute(name),
		)
			? this._navigation
			: this._buildDefaultControls();
		if (!authoredNext) {
			for (const submit of this._submits) {
				this._move(submit, submitContainer);
			}
		}
	}

	_buildDefaultControls() {
		const controls = this._create('div', 'controls', this._navigation);
		const resets = Array.from(this._form.elements).filter(
			(control) =>
				['button', 'input'].includes(control.localName) &&
				control.type === 'reset' &&
				!control.closest('[hidden]') &&
				!control.matches(':disabled'),
		);
		if (resets.length) {
			controls.setAttribute(`${prefix}has-reset`, '');
			const resetSlot = this._create('div', 'reset-slot', controls);
			for (const reset of resets) {
				this._set(reset, `${prefix}reset`, '');
				this._move(reset, resetSlot);
			}
		}
		const previousSlot = this._create('div', 'previous-slot', controls);
		previousSlot.append(this._previous);
		controls.append(this._progress);
		const nextSlot = this._create('div', 'next-slot', controls);
		nextSlot.append(this._next);
		return nextSlot;
	}

	_move(element, parent) {
		const marker = this.ownerDocument.createComment(
			'fieldset-progress control',
		);
		element.before(marker);
		this._moves.push({ element, marker });
		parent.append(element);
	}

	_create(tagName, hook, parent) {
		const element = this.ownerDocument.createElement(tagName);
		element.setAttribute(`${prefix}${hook}`, '');
		this._generated.push(element);
		parent?.append(element);
		return element;
	}

	_identify(element) {
		if (element.id) return element.id;
		let id;
		do {
			id = `fieldset-progress-${++sequence}`;
		} while (this.ownerDocument.getElementById(id));
		this._set(element, 'id', id);
		return id;
	}

	_listen() {
		const { signal } = this._session;
		this._previous.addEventListener('click', () => this.previous(), {
			signal,
		});
		this._next.addEventListener('click', () => this.next(), { signal });
		this._form.addEventListener(
			'reset',
			(event) => {
				queueMicrotask(() => {
					if (!signal.aborted && !event.defaultPrevented)
						this._show(0, false);
				});
			},
			{ signal },
		);
		// Native validation runs before submit, including for requestSubmit().
		this._form.addEventListener(
			'invalid',
			(event) => {
				if (
					this._invalidTarget?.willValidate &&
					!this._invalidTarget.validity.valid &&
					this._invalidTarget !== event.target
				) {
					event.preventDefault();
					return;
				}
				this._invalidTarget = event.target;
				const index = this._steps.findIndex(({ fieldset }) =>
					fieldset.contains(event.target),
				);
				if (index !== -1) this._show(index, false);
				// Browsers can run microtasks between invalid events in one validation pass.
				clearTimeout(this._invalidTimer);
				this._invalidTimer = setTimeout(() => {
					if (!signal.aborted) this._invalidTarget = null;
					this._invalidTimer = null;
				}, 0);
			},
			{ capture: true, signal },
		);
		this._form.addEventListener(
			'keydown',
			(event) => {
				const target = event.target;
				if (
					event.defaultPrevented ||
					event.key !== 'Enter' ||
					event.isComposing ||
					event.altKey ||
					event.ctrlKey ||
					event.metaKey ||
					event.shiftKey ||
					target.localName !== 'input' ||
					!this._steps[this._index].fieldset.contains(target) ||
					[
						'button',
						'submit',
						'reset',
						'image',
						'file',
						'checkbox',
						'radio',
						'range',
						'color',
					].includes(target.type) ||
					target.getAttribute('list') ||
					this._index === this.stepCount - 1
				)
					return;
				event.preventDefault();
				this.next();
			},
			{ signal },
		);
		this._form.addEventListener(
			'submit',
			(event) => {
				if (
					event.defaultPrevented ||
					this._index === this.stepCount - 1
				)
					return;
				event.preventDefault();
				if (event.submitter?.formNoValidate)
					this._navigate(this._index + 1);
				else this.next();
			},
			{ capture: true, signal },
		);
	}

	_navigate(index) {
		const previousIndex = this._index;
		const step = this._steps[index];
		if (
			!this._emit(
				'beforechange',
				{
					stepIndex: index,
					stepCount: this.stepCount,
					fieldset: step.fieldset,
					previousIndex,
				},
				true,
			) ||
			this._state !== 'ready' ||
			this._index !== previousIndex ||
			this._steps[index] !== step
		)
			return false;
		this._show(index, true);
		return true;
	}

	_show(index, focus) {
		const previousIndex = this._index;
		this._index = index;
		this._render();
		if (focus) this._steps[index].fieldset.focus();
		if (index !== previousIndex)
			this._emit('change', { ...this._detail(), previousIndex });
	}

	_render() {
		if (this._review && this._steps[this._index].fieldset === this._review)
			this._renderReview();
		for (const [index, { fieldset }] of this._steps.entries()) {
			this._set(fieldset, 'hidden', index === this._index ? null : '');
		}
		this._set(this._previous, 'hidden', this._index === 0 ? '' : null);
		this._set(
			this._next,
			'hidden',
			this._index === this.stepCount - 1 ? '' : null,
		);
		for (const submit of this._submits) {
			this._set(
				submit,
				'hidden',
				this._index === this.stepCount - 1 ? null : '',
			);
		}
		this._set(this._progress, 'max', String(this.stepCount));
		this._set(this._progress, 'value', String(this._index + 1));
		this._set(this._progress, 'hidden', this.stepCount === 1 ? '' : null);
		for (const label of new Set([
			this._progressLabel,
			this._progressLabelContainer,
			...this._progress.labels,
		])) {
			if (this.stepCount !== 1 && !label.contains(this._progressLabel))
				continue;
			this._set(label, `${prefix}status`, '');
			this._set(label, 'hidden', this.stepCount === 1 ? '' : null);
		}
		this._label(this._previous, 'previous', Math.max(0, this._index - 1));
		this._label(
			this._next,
			'next',
			Math.min(this.stepCount - 1, this._index + 1),
		);
		const text = this._template('progress-label', this._index);
		this._text(this._progressLabel, text);
		const accessible = this._template(
			'progress-aria-label',
			this._index,
			text,
		);
		this._set(
			this._progress,
			'aria-label',
			accessible === text ? null : accessible,
		);
		const nativeLabel =
			this._progress.labels.length === 1 &&
			Array.from(this._progress.labels).some(
				(label) =>
					label.contains(this._progressLabel) &&
					!label.closest('[hidden]'),
			);
		this._set(
			this._progress,
			'aria-labelledby',
			accessible === text && !nativeLabel
				? this._identify(this._progressLabel)
				: null,
		);
		this._set(this._progress, 'aria-valuetext', null);
	}

	_label(button, name, index) {
		const text = this._template(`${name}-label`, index);
		const label = button.querySelector(`[${prefix}label]`) || button;
		this._text(label, text);
		const destinationVisible = this.getAttribute(`${name}-label`)?.includes(
			'{legend}',
		);
		const accessible =
			!this.hasAttribute(`${name}-aria-label`) && destinationVisible
				? text
				: this._template(`${name}-aria-label`, index, text);
		const accessibleName = accessible.includes(text)
			? accessible
			: `${text}: ${accessible}`;
		this._set(
			button,
			'aria-label',
			accessibleName === text ? null : accessibleName,
		);
	}

	_labelsValid() {
		return Object.keys(defaults).every((attribute) =>
			this._steps.every((_, index) =>
				this._template(attribute, index).trim(),
			),
		);
	}

	_template(attribute, index, label = '') {
		const tokens = {
			legend: this._steps[index].legend.textContent.trim(),
			current: String(index + 1),
			total: String(this.stepCount),
			label,
		};
		const template =
			this.getAttribute(attribute) ??
			defaults[attribute] ??
			ariaDefaults[attribute] ??
			'{label}';
		return (
			template
				.replace(
					/\{(legend|current|total|label)\}/g,
					(_, token) => tokens[token],
				)
				.trim() || label
		);
	}

	_set(element, attribute, value) {
		if (!this._attributes.has(element))
			this._attributes.set(element, new Map());
		const original = this._attributes.get(element);
		if (!original.has(attribute))
			original.set(attribute, element.getAttribute(attribute));
		if (value === null) element.removeAttribute(attribute);
		else if (element.getAttribute(attribute) !== value)
			element.setAttribute(attribute, value);
	}

	_text(element, text) {
		if (!this._contents.has(element))
			this._contents.set(element, Array.from(element.childNodes));
		if (element.textContent !== text) element.textContent = text;
	}

	_detail() {
		return {
			stepIndex: this._index,
			stepCount: this.stepCount,
			fieldset: this._steps[this._index].fieldset,
		};
	}

	_emit(name, detail, cancelable = false) {
		return this.dispatchEvent(
			new CustomEvent(`form-fieldset-progress:${name}`, {
				bubbles: true,
				cancelable,
				detail,
			}),
		);
	}

	_teardown() {
		this._session?.abort();
		this._session = null;
		clearTimeout(this._invalidTimer);
		this._invalidTimer = null;
		if (this._form && owners.get(this._form) === this)
			owners.delete(this._form);
		for (const { element, marker } of this._moves) {
			if (marker.parentNode) marker.replaceWith(element);
		}
		for (const [element, children] of this._contents)
			element.replaceChildren(...children);
		for (const [element, attributes] of this._attributes) {
			for (const [name, value] of attributes) {
				if (value === null) element.removeAttribute(name);
				else element.setAttribute(name, value);
			}
		}
		for (const element of this._generated) element.remove();
		this._attributes.clear();
		this._contents.clear();
		this._generated = [];
		this._moves = [];
		this._form = null;
		this._steps = [];
		this._index = 0;
		this._invalidTarget = null;
		this._previous = null;
		this._next = null;
		this._progress = null;
		this._progressLabel = null;
		this._progressLabelContainer = null;
		this._review = null;
		this._reviewList = null;
		this._navigation = null;
		this._submits = [];
		this._state = 'idle';
	}
}
