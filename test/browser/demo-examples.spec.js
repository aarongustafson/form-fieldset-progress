import { test, expect } from './fixtures.js';

test('basic demo validates two steps, keeps answers, and uses keyboard navigation', async ({
	page,
}) => {
	await page.goto('/demo/#getting-started');
	const host = page.locator('#basic');
	await expect(host).toHaveJSProperty('stepCount', 2);
	const name = host.getByRole('textbox', { name: 'Your name', exact: true });
	const next = host.getByRole('button', { name: 'Next to Delivery address' });
	await next.focus();
	await page.keyboard.press('Enter');
	await expect(name).toBeFocused();
	await expect(host).toHaveJSProperty('stepIndex', 0);
	await name.fill('Ada');
	await host
		.getByRole('textbox', { name: 'Email', exact: true })
		.fill('ada@example.test');
	await next.focus();
	await page.keyboard.press('Space');
	await expect(host).toHaveJSProperty('stepIndex', 1);
	await expect(
		host.getByRole('textbox', { name: 'City', exact: true }),
	).toBeFocused();
	expect(
		await host.evaluate((element) =>
			new FormData(element.form).get('name'),
		),
	).toBe('Ada');
	await host.getByRole('button', { name: 'Send application' }).click();
	await expect(
		host.getByRole('textbox', { name: 'City', exact: true }),
	).toBeFocused();
	await host
		.getByRole('textbox', { name: 'City', exact: true })
		.fill('London');
	await host.getByRole('button', { name: 'Back to Contact details' }).focus();
	await page.keyboard.press('Enter');
	await expect(name).toBeFocused();
	await expect(name).toHaveValue('Ada');
	await next.click();
	await host.getByRole('button', { name: 'Send application' }).click();
	await expect(host.getByRole('status')).toHaveText(
		'Demo complete. No data was sent.',
	);
});

test('nested and translated examples have distinct fragment destinations', async ({
	page,
}) => {
	await page.goto('/demo/');
	for (const id of [
		'short-button-labels',
		'destination-button-labels',
		'translated-controls',
		'arabic-navigation',
		'generated-review-example',
		'authored-review-example',
		'setup-recovery',
		'native-fallback',
	]) {
		await page.evaluate((fragment) => {
			location.hash = fragment;
		}, id);
		const target = page.locator(':target');
		await expect(target).toHaveAttribute('id', id);
		await expect(target.locator('.code-demo-pair')).toHaveCount(1);
		await expect(target.locator('h2, h3').first()).toBeVisible();
	}
});

test('without JavaScript the basic and embedded forms retain native validation and submission', async ({
	browser,
}) => {
	const context = await browser.newContext({ javaScriptEnabled: false });
	const page = await context.newPage();
	try {
		await page.goto('http://127.0.0.1:4176/demo/');
		const host = page.locator('#basic');
		await expect(
			host.getByRole('group', { name: 'Contact details', exact: true }),
		).toBeVisible();
		await expect(
			host.getByRole('group', { name: 'Delivery address', exact: true }),
		).toBeVisible();
		await host.getByRole('button', { name: 'Send application' }).click();
		await expect(
			host.getByRole('textbox', { name: 'Your name', exact: true }),
		).toBeFocused();
		await expect(
			host.locator('[data-fieldset-progress-navigation]'),
		).toHaveCount(0);
		await page.goto(
			'http://127.0.0.1:4176/demo/no-script.html#native-form',
		);
		const dialog = page.getByRole('dialog', {
			name: 'Native form example',
		});
		await expect(dialog.getByRole('group')).toHaveCount(2);
		await dialog.getByRole('button', { name: 'Send', exact: true }).click();
		await expect(
			dialog.getByRole('textbox', { name: 'Name', exact: true }),
		).toBeFocused();
		await dialog
			.getByRole('textbox', { name: 'Name', exact: true })
			.fill('Ada');
		await dialog.getByRole('button', { name: 'Send', exact: true }).click();
		await expect(dialog).toBeHidden();
	} finally {
		await context.close();
	}
});
