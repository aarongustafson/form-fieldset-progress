import { test, expect } from '@playwright/test';

const host = 'form-fieldset-progress';

test.beforeEach(async ({ page }) => {
	await page.goto('/test/browser/fixture.html');
	await expect(
		page.locator(`${host} [data-fieldset-progress-next]`),
	).toBeVisible();
});

test('native validity, keyboard progression, focus, FormData, and final submit', async ({
	page,
}) => {
	await page
		.getByRole('button', { name: 'Next to Address', exact: true })
		.click();
	await expect(
		page.getByRole('textbox', { name: 'Name', exact: true }),
	).toBeFocused();
	await expect(
		page.getByRole('group', { name: 'Contact', exact: true }),
	).toBeVisible();
	await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Ada');
	await page
		.getByRole('textbox', { name: 'Name', exact: true })
		.press('Enter');
	await expect(page.locator('[name=city]')).toBeFocused();
	await expect(
		page.getByRole('group', { name: 'Contact', exact: true }),
	).toHaveCount(0);
	await expect(
		page.getByRole('button', { name: 'Back to Contact' }),
	).toBeVisible();
	await page
		.getByRole('textbox', { name: 'City', exact: true })
		.fill('London');
	await page
		.getByRole('textbox', { name: 'City', exact: true })
		.press('Enter');
	await expect(page.locator('[name=notes]')).toBeFocused();
	await expect(
		page.getByRole('button', { name: 'Send application', exact: true }),
	).toBeVisible();
	await page
		.getByRole('textbox', { name: 'Notes', exact: true })
		.fill('Line one');
	await page
		.getByRole('textbox', { name: 'Notes', exact: true })
		.press('Enter');
	await expect(
		page.getByRole('textbox', { name: 'Notes', exact: true }),
	).toHaveValue('Line one\n');
	await page
		.getByRole('button', { name: 'Send application', exact: true })
		.click();
	await expect
		.poll(() => page.evaluate(() => globalThis.submission))
		.toEqual({
			name: 'Ada',
			city: 'London',
			notes: 'Line one\n',
			action: 'send',
		});
});

test('final validation reveals earlier invalid fields and preserves native focus', async ({
	page,
}) => {
	const consoleErrors = [];
	page.on('console', (message) => {
		if (message.type() === 'error') consoleErrors.push(message.text());
	});
	await page.locator(host).evaluate((element) => {
		element.setAttribute('no-validation', '');
		element.goTo(2);
	});
	await page
		.getByRole('button', { name: 'Send application', exact: true })
		.click();
	await expect(
		page.getByRole('textbox', { name: 'Name', exact: true }),
	).toBeFocused();
	await expect(page.locator('#contact')).toBeVisible();
	expect(consoleErrors).toEqual([]);
	await page.locator(host).evaluate((element) => {
		element.querySelector('[name=name]').value = 'Ada';
		element.goTo(2);
		element.form.requestSubmit(element.querySelector('[value=send]'));
	});
	await expect(
		page.getByRole('textbox', { name: 'City', exact: true }),
	).toBeFocused();
	await expect(page.locator('#address')).toBeVisible();
});

test('formnovalidate, novalidate, and early requestSubmit do not send prematurely', async ({
	page,
}) => {
	await page.locator(host).evaluate((element) => {
		element.form.requestSubmit(element.querySelector('[value=draft]'));
	});
	await expect(page.locator('#address')).toBeVisible();
	expect(await page.evaluate(() => globalThis.submission)).toBeUndefined();
	await page.locator(host).evaluate((element) => {
		element.form.noValidate = true;
		element.form.requestSubmit();
	});
	await expect(page.locator('#review')).toBeVisible();
	await page.getByRole('button', { name: 'Save draft', exact: true }).click();
	await expect
		.poll(() => page.evaluate(() => globalThis.submission?.action))
		.toBe('draft');
});

test('custom validity and canceled reset preserve context; reset and reconnect clean up', async ({
	page,
}) => {
	await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Ada');
	await page
		.locator('[name=name]')
		.evaluate((input) =>
			input.setCustomValidity('Choose a different name.'),
		);
	await page
		.getByRole('button', { name: 'Next to Address', exact: true })
		.click();
	await expect(page.locator('[name=name]')).toBeFocused();
	await page
		.locator('[name=name]')
		.evaluate((input) => input.setCustomValidity(''));
	await page
		.getByRole('button', { name: 'Next to Address', exact: true })
		.click();
	await page.locator(host).evaluate((element) => {
		element.form.addEventListener(
			'reset',
			(event) => event.preventDefault(),
			{ once: true },
		);
		element.form.reset();
	});
	await expect(page.locator('#address')).toBeVisible();
	await page.getByRole('button', { name: 'Start over' }).click();
	await expect(page.locator('#contact')).toBeVisible();
	await expect(page.locator('[name=name]')).toHaveValue('');
	await page.locator(host).evaluate((element) => {
		element.remove();
		document.body.append(element);
	});
	await expect(
		page.locator('[data-fieldset-progress-navigation]'),
	).toHaveCount(1);
	await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Ada');
	await page
		.getByRole('button', { name: 'Next to Address', exact: true })
		.click();
	await expect(page.locator('#address')).toBeVisible();
});

test('package root exports without registration; define module registers once', async ({
	page,
}) => {
	await page.goto('/demo/no-script.html');
	const result = await page.evaluate(async () => {
		const { FormFieldsetProgressElement } = await import(
			new URL('/index.js', location.href).href
		);
		const before = customElements.get('form-fieldset-progress');
		const { defineFormFieldsetProgress } = await import(
			new URL('/define.js', location.href).href
		);
		return {
			before: Boolean(before),
			same:
				customElements.get('form-fieldset-progress') ===
				FormFieldsetProgressElement,
			repeated: defineFormFieldsetProgress(),
		};
	});
	expect(result).toEqual({ before: false, same: true, repeated: true });
});

test('no JavaScript preserves all steps and native submission', async ({
	browser,
}) => {
	const context = await browser.newContext({ javaScriptEnabled: false });
	const page = await context.newPage();
	try {
		await page.goto('http://127.0.0.1:4176/test/browser/fixture.html');
		await expect(page.getByRole('group')).toHaveCount(3);
		await expect(
			page.getByRole('button', { name: 'Send application', exact: true }),
		).toBeVisible();
		await expect(
			page.locator('[data-fieldset-progress-navigation]'),
		).toHaveCount(0);
	} finally {
		await context.close();
	}
});

test('demos: authored icons, error recovery, single step, responsive layout, and RTL', async ({
	page,
}) => {
	await page.goto('/demo/');
	await expect(page.locator('#failure #missing')).toHaveCount(0);
	await expect(page.locator('#setup-error')).toContainText(
		'Enhancement unavailable',
	);
	await expect(page.locator('#failure fieldset:not([hidden])')).toHaveCount(
		2,
	);
	await page.getByRole('button', { name: 'Repair configuration' }).click();
	await expect(page.locator('#setup-error')).toContainText(
		'Configuration repaired',
	);
	await expect(page.locator('#failure fieldset:not([hidden])')).toHaveCount(
		1,
	);
	await expect(
		page.locator('#single [data-fieldset-progress-next]'),
	).toBeHidden();
	await expect(page.locator('#single [type=submit]')).toBeVisible();
	await expect(page.locator('#single progress')).toBeHidden();
	await expect(
		page.locator('#single [data-fieldset-progress-status]'),
	).toBeHidden();
	await expect(page.locator('#single').getByRole('progressbar')).toHaveCount(
		0,
	);
	await page.locator('#french-name').fill('Camille');
	await page.locator('#custom-next').click();
	await expect(page.locator('#custom-back [aria-hidden=true]')).toHaveText(
		'←',
	);
	await expect(page.locator('#custom-status')).toContainText('Étape 2/2');
	await page.setViewportSize({ width: 1280, height: 900 });
	const wide = await page
		.locator('.code-demo-pair')
		.first()
		.evaluate((pair) => {
			const [code, demo] = pair.children;
			return (
				code.getBoundingClientRect().right <
				demo.getBoundingClientRect().left
			);
		});
	expect(wide).toBe(true);
	await page.setViewportSize({ width: 320, height: 800 });
	expect(
		await page.evaluate(
			() => document.documentElement.scrollWidth <= innerWidth,
		),
	).toBe(true);
	const stacked = await page
		.locator('.code-demo-pair')
		.first()
		.evaluate((pair) => {
			const [code, demo] = pair.children;
			return (
				code.getBoundingClientRect().bottom <=
				demo.getBoundingClientRect().top
			);
		});
	expect(stacked).toBe(true);
	await page.locator('#rtl [data-fieldset-progress-next]').click();
	await expect(
		page.locator('#rtl [data-fieldset-progress-previous]'),
	).toBeVisible();
	expect(
		await page
			.locator('#rtl')
			.evaluate((element) => getComputedStyle(element).direction),
	).toBe('rtl');
	await page.emulateMedia({
		reducedMotion: 'reduce',
		forcedColors: 'active',
	});
	await expect(
		page.locator('#rtl [data-fieldset-progress-next]'),
	).toBeVisible();
});

test('English authored UI places progress above the form and actions below without reset', async ({
	page,
}) => {
	await page.goto('/demo/');
	const example = page.locator('#english-custom');
	await expect(example.getByRole('progressbar')).toHaveAccessibleName(
		'Step 1 of 3: Contact',
	);
	await expect(
		example.locator('button[type=reset], input[type=reset]'),
	).toHaveCount(0);
	await expect(
		example.locator('[data-fieldset-progress-navigation]'),
	).toHaveCount(0);
	await expect(example.locator('#english-next')).toHaveText('Next');
	await expect(example.locator('#english-next')).toHaveAccessibleName(
		'Next to Availability',
	);
	for (const width of [1280, 320]) {
		await page.setViewportSize({ width, height: 900 });
		const layout = await example.evaluate((element) => {
			const form = element.querySelector('form');
			const progress = element.querySelector('.custom-progress');
			const actions = element.querySelector('.custom-actions');
			return {
				progressAbove:
					progress.getBoundingClientRect().bottom <=
					form.getBoundingClientRect().top,
				buttonsBelow:
					form.getBoundingClientRect().bottom <=
					actions.getBoundingClientRect().top,
				noOverflow: document.documentElement.scrollWidth <= innerWidth,
				buttonsOwnedByForm: Array.from(
					actions.querySelectorAll('button'),
				).every((button) => button.form === form),
			};
		});
		expect(layout).toEqual({
			progressAbove: true,
			buttonsBelow: true,
			noOverflow: true,
			buttonsOwnedByForm: true,
		});
	}
	await example.locator('#english-next').click();
	await expect(example.locator('[name=email]')).toBeFocused();
	await example.locator('[name=email]').fill('ada@example.test');
	await example.locator('#english-next').focus();
	await page.keyboard.press('Enter');
	await expect(example.locator('[name=hours]')).toBeFocused();
	await expect(example.locator('#english-back')).toHaveText('Back');
	await expect(example.locator('#english-back')).toHaveAccessibleName(
		'Back to Contact',
	);
	await example.locator('[name=hours]').fill('4');
	await example.locator('#english-next').click();
	await expect(example.locator('#english-next')).toBeHidden();
	await expect(
		example.getByRole('button', { name: 'Send application', exact: true }),
	).toBeVisible();
	await example
		.getByRole('button', { name: 'Send application', exact: true })
		.click();
	await expect(example.locator('[data-result]')).toContainText(
		'Demo complete',
	);
	await example.locator('#english-back').click();
	await expect(example.locator('[name=hours]')).toHaveValue('4');
});

test('demo fieldsets are borderless with spaced groups and a clear legend hierarchy', async ({
	page,
}) => {
	await page.goto('/demo/');
	const section = page.locator('#basic form > fieldset').first();
	const styles = await section.evaluate((fieldset) => {
		const style = getComputedStyle(fieldset);
		return {
			border: style.borderTopWidth,
			padding: style.padding,
			legendSize: parseFloat(
				getComputedStyle(fieldset.querySelector(':scope > legend'))
					.fontSize,
			),
			labelSize: parseFloat(
				getComputedStyle(fieldset.querySelector('label')).fontSize,
			),
		};
	});
	expect(styles.border).toBe('0px');
	expect(styles.padding).toBe('0px');
	expect(styles.legendSize).toBeGreaterThanOrEqual(styles.labelSize * 1.2);
	await page.locator('#applicant-name').fill('Ada');
	await page.locator('#applicant-email').fill('ada@example.test');
	await page.locator('#basic [data-fieldset-progress-next]').click();
	const radioGroup = page.locator('#basic .radio-group');
	const spacing = await radioGroup.evaluate((fieldset) => ({
		margin: parseFloat(getComputedStyle(fieldset).marginBlockStart),
		labelMargin: parseFloat(
			getComputedStyle(fieldset.querySelector('label')).marginBlockStart,
		),
		legendSize: getComputedStyle(fieldset.querySelector('legend')).fontSize,
		labelSize: getComputedStyle(fieldset.querySelector('label')).fontSize,
		gap:
			fieldset.querySelector('legend').getBoundingClientRect().top -
			fieldset.previousElementSibling.getBoundingClientRect().bottom,
	}));
	expect(spacing.margin).toBeGreaterThanOrEqual(spacing.labelMargin * 2);
	expect(spacing.legendSize).toBe(spacing.labelSize);
	expect(spacing.gap).toBeGreaterThan(spacing.labelMargin);
	const stacked = await page
		.locator('#failure fieldset + fieldset')
		.evaluate((fieldset) =>
			parseFloat(getComputedStyle(fieldset).marginBlockStart),
		);
	expect(stacked).toBeGreaterThanOrEqual(spacing.labelMargin * 2);
});

for (const includeReset of [true, false]) {
	test(`default footer reserves balanced navigation space ${includeReset ? 'with' : 'without'} Reset`, async ({
		page,
	}) => {
		await page.locator(host).evaluate((element, keepReset) => {
			element.remove();
			if (!keepReset) element.querySelector('[type=reset]').remove();
			element.setAttribute('no-validation', '');
			document.body.append(element);
		}, includeReset);
		await expect(
			page.locator('[data-fieldset-progress-controls]'),
		).toHaveCount(1);
		for (const direction of ['ltr', 'rtl']) {
			await page.locator(host).evaluate((element, dir) => {
				element.dir = dir;
			}, direction);
			for (const width of [1280, 320]) {
				await page.setViewportSize({ width, height: 900 });
				let initialCenter;
				for (const step of [0, 1, 2]) {
					await page
						.locator(host)
						.evaluate(
							(element, index) => element.goTo(index),
							step,
						);
					const layout = await page
						.locator(host)
						.evaluate((element) => {
							const form = element
								.querySelector('form')
								.getBoundingClientRect();
							const footer = element
								.querySelector(
									'[data-fieldset-progress-navigation]',
								)
								.getBoundingClientRect();
							const row = element
								.querySelector(
									'[data-fieldset-progress-controls]',
								)
								.getBoundingClientRect();
							const previous = element
								.querySelector(
									'[data-fieldset-progress-previous-slot]',
								)
								.getBoundingClientRect();
							const next = element
								.querySelector(
									'[data-fieldset-progress-next-slot]',
								)
								.getBoundingClientRect();
							const progress = element
								.querySelector('progress')
								.getBoundingClientRect();
							const reset = element
								.querySelector('[type=reset]')
								?.getBoundingClientRect();
							const center = progress.left + progress.width / 2;
							const rtl =
								getComputedStyle(element).direction === 'rtl';
							return {
								footerWidth: footer.width,
								formWidth: form.width,
								rowWidth: row.width,
								previousWidth: previous.width,
								nextWidth: next.width,
								center,
								expectedCenter:
									(previous.left +
										previous.width / 2 +
										next.left +
										next.width / 2) /
									2,
								resetBeforeBack:
									!reset ||
									reset.bottom <= previous.top ||
									(rtl
										? reset.left >= previous.right
										: reset.right <= previous.left),
								noOverflow:
									document.documentElement.scrollWidth <=
									innerWidth,
							};
						});
					expect(layout.footerWidth).toBeCloseTo(layout.formWidth, 0);
					expect(layout.rowWidth).toBeCloseTo(layout.footerWidth, 0);
					expect(layout.previousWidth).toBeGreaterThan(0);
					expect(layout.previousWidth).toBeCloseTo(
						layout.nextWidth,
						0,
					);
					expect(layout.center).toBeCloseTo(layout.expectedCenter, 0);
					initialCenter ??= layout.center;
					expect(layout.center).toBeCloseTo(initialCenter, 0);
					expect(layout.resetBeforeBack).toBe(true);
					expect(layout.noOverflow).toBe(true);
					if (step === 0)
						await expect(
							page.locator('[data-fieldset-progress-previous]'),
						).toBeHidden();
					else
						await expect(
							page.locator('[data-fieldset-progress-previous]'),
						).toBeVisible();
				}
			}
		}
	});
}

test('demo field spacing keeps labels close and separates successive fields', async ({
	page,
}) => {
	await page.goto('/demo/');
	const spacing = await page.locator('#basic').evaluate((element) => {
		const first = element
			.querySelector('#applicant-name')
			.getBoundingClientRect();
		const nextLabel = element
			.querySelector('[for=applicant-email]')
			.getBoundingClientRect();
		const nextInput = element
			.querySelector('#applicant-email')
			.getBoundingClientRect();
		const labelSize = parseFloat(
			getComputedStyle(element.querySelector('[for=applicant-email]'))
				.fontSize,
		);
		return {
			fieldGap: nextLabel.top - first.bottom,
			labelGap: nextInput.top - nextLabel.bottom,
			labelSize,
		};
	});
	expect(spacing.fieldGap).toBeGreaterThanOrEqual(spacing.labelSize);
	expect(spacing.labelGap).toBeLessThan(spacing.fieldGap);
});

test('default reset hoisting preserves inherited fieldset disabling', async ({
	page,
}) => {
	await page.locator(host).evaluate((element) => {
		element.remove();
		const fieldset = element.querySelector('#contact');
		fieldset.disabled = true;
		const reset = document.createElement('button');
		reset.type = 'reset';
		reset.id = 'disabled-reset';
		reset.textContent = 'Clear contact';
		fieldset.append(reset);
		document.body.append(element);
	});
	await expect(page.locator('#contact > #disabled-reset')).toHaveCount(1);
	await expect(page.locator('#disabled-reset')).toBeDisabled();
});

test('the walkthrough introduces default behavior and labels before custom navigation and animation', async ({
	page,
}) => {
	await page.goto('/demo/');
	const sections = await page
		.locator('main > .demo-section')
		.evaluateAll((elements) => elements.map((element) => element.id));
	expect(sections.indexOf('getting-started')).toBe(0);
	expect(sections.indexOf('single-section')).toBe(1);
	expect(sections.indexOf('labels')).toBeGreaterThan(1);
	expect(sections.indexOf('labels')).toBeLessThan(
		sections.indexOf('custom-layout'),
	);
	expect(sections.indexOf('section-events')).toBeLessThan(
		sections.indexOf('section-transitions'),
	);
	const labels = page.locator('#short-labels');
	await expect(labels.locator('[data-fieldset-progress-next]')).toHaveText(
		'Continue',
	);
	await expect(labels.getByRole('progressbar')).toHaveAccessibleName(
		'Section 1 of 2: Contact',
	);
	await labels.locator('[data-fieldset-progress-next]').click();
	await expect(
		labels.locator('[data-fieldset-progress-previous]'),
	).toHaveText('Previous');
	const legends = page.locator('#legend-labels');
	await expect(legends.locator('[data-fieldset-progress-next]')).toHaveText(
		'Continue to Delivery notes',
	);
	await expect(
		legends.locator('[data-fieldset-progress-next]'),
	).toHaveAccessibleName('Continue to Delivery notes');
});

test('the event example reports completed section changes rather than invalid navigation', async ({
	page,
}) => {
	await page.goto('/demo/');
	const example = page.locator('#events');
	const output = page.locator('#section-event');
	await expect(output).toHaveText('No section change yet.');
	await example.locator('[data-fieldset-progress-next]').click();
	await expect(output).toHaveText('No section change yet.');
	await example.getByLabel('Name', { exact: true }).fill('Ada');
	await example.getByLabel('Name', { exact: true }).press('Enter');
	expect(JSON.parse(await output.textContent())).toEqual({
		previousIndex: 0,
		stepIndex: 1,
		stepCount: 2,
		fieldset: 'event-notes',
	});

	await example.locator('[data-fieldset-progress-previous]').click();
	expect(JSON.parse(await output.textContent())).toEqual({
		previousIndex: 1,
		stepIndex: 0,
		stepCount: 2,
		fieldset: 'event-contact',
	});
});

test('progress represents the current section and uses its visible label as the accessible name', async ({
	page,
}) => {
	const example = page.locator('form-fieldset-progress');
	const progress = example.getByRole('progressbar');
	for (const [index, legend] of [
		[0, 'Contact'],
		[1, 'Address'],
		[2, 'Review'],
	]) {
		await example.evaluate((element, step) => {
			element.form.noValidate = true;
			element.goTo(step);
		}, index);
		await expect(progress).toHaveAccessibleName(
			`Step ${index + 1} of 3: ${legend}`,
		);
		await expect(progress).not.toHaveAttribute('aria-label');
		await expect(progress).not.toHaveAttribute('aria-valuetext');
		const ratio = await progress.evaluate(
			(element) => element.value / element.max,
		);
		expect(ratio).toBeCloseTo((index + 1) / 3, 10);
	}
});

test('single-section external and wrapping progress labels remain hidden and restore on disconnect', async ({
	page,
}) => {
	await page.goto('/demo/');
	await page.locator('#single').evaluate((element) => {
		element.remove();
		element.setAttribute('progress-ref', 'external-meter');
		element.setAttribute('progress-label-ref', 'external-text');
		const label = document.createElement('label');
		label.id = 'external-status';
		label.innerHTML =
			'<span id="external-text" data-fieldset-progress-label>Form progress</span><progress id="external-meter"></progress>';
		document.body.append(label, element);
	});
	await expect(page.locator('#external-meter')).toBeHidden();
	await expect(page.locator('#external-status')).toBeHidden();
	await expect(page.locator('#external-text')).toBeHidden();
	await expect(
		page.getByRole('progressbar', { name: 'Form progress' }),
	).toHaveCount(0);
	await page.locator('#single').evaluate((element) => element.remove());
	await expect(page.locator('#external-status')).toBeVisible();
	await expect(page.locator('#external-text')).toHaveText('Form progress');
	await expect(page.locator('#external-meter')).toBeVisible();
});

for (const wrapping of [false, true]) {
	test(`progress names a ${wrapping ? 'wrapping' : 'separate'} text container by reference`, async ({
		page,
	}) => {
		await page
			.locator('form-fieldset-progress')
			.evaluate((element, wrap) => {
				element.remove();
				element.setAttribute('progress-ref', 'named-meter');
				element.setAttribute('progress-label-ref', 'named-status');
				const container = document.createElement('div');
				container.innerHTML = wrap
					? '<div id="named-status"><span data-fieldset-progress-label>Progress</span><progress id="named-meter"></progress></div>'
					: '<p id="named-status">Progress</p><progress id="named-meter"></progress>';
				element.querySelector('form').prepend(container);
				document.body.append(element);
			}, wrapping);
		const example = page.locator('form-fieldset-progress');
		const progress = example.getByRole('progressbar');
		await expect(progress).toHaveAccessibleName('Step 1 of 3: Contact');
		await expect(progress).not.toHaveAttribute('aria-label');
		await expect(progress).toHaveAttribute('aria-labelledby');
		await example.evaluate((element) =>
			element.setAttribute(
				'progress-label',
				'Section {current}: {legend}',
			),
		);
		await expect(progress).toHaveAccessibleName('Section 1: Contact');
		await example.evaluate((element) =>
			element.setAttribute(
				'progress-aria-label',
				'Current section {current} of {total}',
			),
		);
		await expect(progress).toHaveAccessibleName('Current section 1 of 3');
		await expect(progress).not.toHaveAttribute('aria-labelledby');
	});
}
