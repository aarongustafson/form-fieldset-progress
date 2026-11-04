import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';

const moduleURL =
	/^https:\/\/esm\.sh\/@aarongustafson\/form-fieldset-progress@[^/]+\/form-fieldset-progress\.js/;

test('the versioned CDN demo validates, navigates, submits, and reflows', async ({
	page,
}) => {
	await page.route(moduleURL, (route) =>
		route.fulfill({
			path: fileURLToPath(
				new URL('../../form-fieldset-progress.js', import.meta.url),
			),
			contentType: 'text/javascript',
			headers: { 'Access-Control-Allow-Origin': '*' },
		}),
	);
	await page.goto('/demo/esm.html');
	const element = page.locator('form-fieldset-progress');
	await expect(element).toHaveJSProperty('state', 'ready');
	const next = element.getByRole('button', {
		name: 'Next to Delivery notes',
	});
	await next.click();
	await expect(element).toHaveJSProperty('stepIndex', 0);
	const name = element.getByRole('textbox', { name: 'Your name' });
	await expect(name).toBeFocused();
	await name.fill('Ada');
	await next.focus();
	await page.keyboard.press('Enter');
	await expect(element).toHaveJSProperty('stepIndex', 1);
	await expect(element.getByRole('textbox', { name: 'Notes' })).toBeFocused();
	await element
		.getByRole('button', { name: 'Back to Contact details' })
		.click();
	await expect(name).toHaveValue('Ada');
	await next.click();
	await element
		.getByRole('textbox', { name: 'Notes' })
		.fill('Use side door.');
	await element.getByRole('button', { name: 'Send application' }).click();
	await expect(element.getByRole('status')).toHaveText(
		'Example submitted. No form data was sent.',
	);
	for (const width of [1280, 375]) {
		await page.setViewportSize({ width, height: 900 });
		const layout = await page
			.locator('.code-demo-pair')
			.evaluate((pair) => {
				const [code, demo] = pair.children;
				return {
					codeTop: code.getBoundingClientRect().top,
					demoTop: demo.getBoundingClientRect().top,
					overflow:
						document.documentElement.scrollWidth >
						document.documentElement.clientWidth,
				};
			});
		expect(layout.overflow).toBe(false);
		if (width === 1280) expect(layout.codeTop).toBe(layout.demoTop);
		else expect(layout.demoTop).toBeGreaterThan(layout.codeTop);
	}
});

test('a failed CDN import leaves both fieldsets and native submit usable', async ({
	page,
}) => {
	await page.route(moduleURL, (route) => route.abort('failed'));
	await page.goto('/demo/esm.html');
	const element = page.locator('form-fieldset-progress');
	for (const name of ['Contact details', 'Delivery notes'])
		await expect(element.getByRole('group', { name })).toBeVisible();
	await expect(
		element.locator('[data-fieldset-progress-navigation]'),
	).toHaveCount(0);
	await element.getByRole('textbox', { name: 'Your name' }).fill('Ada');
	await element.getByRole('button', { name: 'Send application' }).click();
	await expect(element.getByRole('status')).toBeVisible();
});
