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
		.getByRole('button', { name: 'Continue to Address', exact: true })
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
	await expect(page.locator('#address')).toBeFocused();
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
	await expect(page.locator('#review')).toBeFocused();
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
		.getByRole('button', { name: 'Continue to Address', exact: true })
		.click();
	await expect(page.locator('[name=name]')).toBeFocused();
	await page
		.locator('[name=name]')
		.evaluate((input) => input.setCustomValidity(''));
	await page
		.getByRole('button', { name: 'Continue to Address', exact: true })
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
		.getByRole('button', { name: 'Continue to Address', exact: true })
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
