import { test, expect } from '@playwright/test';

test('optional animation loading does not delay form enhancement', async ({
	page,
}) => {
	let release;
	const blocked = new Promise((resolve) => {
		release = resolve;
	});
	await page.route('**/demo/transitions.js', async (route) => {
		await blocked;
		await route.continue();
	});
	await page.goto('/demo/', { waitUntil: 'commit' });
	try {
		await expect(page.locator('#basic')).toHaveJSProperty('state', 'ready');
		await expect(page.locator('#animated')).toHaveJSProperty(
			'state',
			'ready',
		);
		await expect(
			page.locator('#basic form > fieldset:not([hidden])'),
		).toHaveCount(1);
		await expect(
			page.locator('#basic [data-fieldset-progress-next]'),
		).toBeVisible();
	} finally {
		release();
		await page.waitForLoadState('load');
	}
});

test('slow core loading preserves visible native fields and entered answers', async ({
	page,
}) => {
	let release;
	const blocked = new Promise((resolve) => {
		release = resolve;
	});
	await page.route('**/form-fieldset-progress.js', async (route) => {
		await blocked;
		await route.continue();
	});
	await page.goto('/demo/', { waitUntil: 'commit' });
	const example = page.locator('#basic');
	try {
		await expect(
			example.getByRole('group', {
				name: 'Contact details',
				exact: true,
			}),
		).toBeVisible();
		await expect(
			example.getByRole('group', {
				name: 'Delivery address',
				exact: true,
			}),
		).toBeVisible();
		await expect(
			example.getByRole('group', { name: 'Delivery notes', exact: true }),
		).toBeVisible();
		await expect(
			example.getByRole('button', {
				name: 'Send application',
				exact: true,
			}),
		).toBeVisible();
		await expect(
			example.locator('[data-fieldset-progress-navigation]'),
		).toHaveCount(0);
		await example
			.getByRole('textbox', { name: 'Your name', exact: true })
			.fill('Ada');
	} finally {
		release();
		await page.waitForLoadState('load');
	}
	await expect(example).toHaveJSProperty('state', 'ready');
	await expect(
		example.getByRole('textbox', { name: 'Your name', exact: true }),
	).toHaveValue('Ada');
});

test('failed core loading leaves the complete native form available', async ({
	page,
}) => {
	await page.route('**/form-fieldset-progress.js', (route) =>
		route.abort('failed'),
	);
	await page.goto('/demo/');
	const example = page.locator('#basic');
	for (const name of [
		'Contact details',
		'Delivery address',
		'Delivery notes',
	])
		await expect(
			example.getByRole('group', { name, exact: true }),
		).toBeVisible();
	await expect(
		example.getByRole('button', { name: 'Send application', exact: true }),
	).toBeVisible();
	await expect(
		example.locator('[data-fieldset-progress-navigation]'),
	).toHaveCount(0);
	await example
		.getByRole('textbox', { name: 'Your name', exact: true })
		.fill('Ada');
	await expect(
		example.getByRole('textbox', { name: 'Your name', exact: true }),
	).toHaveValue('Ada');
	await expect(page.locator('#animation-option')).toBeHidden();
});
