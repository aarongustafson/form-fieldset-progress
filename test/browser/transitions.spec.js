import { test, expect } from '@playwright/test';

test('Reset is an optional later example rather than part of the introductory form', async ({
	page,
}) => {
	await page.goto('/demo/');
	await expect(page.locator('#basic [type=reset]')).toHaveCount(0);
	const example = page.locator('#reset-demo');
	await expect(
		example.locator('[data-fieldset-progress-reset-slot] [type=reset]'),
	).toBeVisible();
	expect(
		await example.evaluate((element) =>
			Boolean(
				document
					.querySelector('#basic')
					.compareDocumentPosition(element) &
				Node.DOCUMENT_POSITION_FOLLOWING,
			),
		),
	).toBe(true);
	await example.getByLabel('Name', { exact: true }).fill('Ada');
	await example.locator('[data-fieldset-progress-next]').click();
	await expect(
		example.getByRole('group', { name: 'Review', exact: true }),
	).toBeVisible();
	await example
		.getByRole('button', { name: 'Start over', exact: true })
		.click();
	await expect(example.getByLabel('Name', { exact: true })).toHaveValue('');
	await expect(
		example.getByRole('group', { name: 'Contact', exact: true }),
	).toBeVisible();
});

for (const fallback of [
	'reduced motion',
	'unsupported browser',
	'unchecked option',
]) {
	test(`section animation uses immediate navigation with ${fallback}`, async ({
		page,
	}) => {
		await page.emulateMedia({
			reducedMotion:
				fallback === 'reduced motion' ? 'reduce' : 'no-preference',
		});
		await page.addInitScript((unsupported) => {
			window.transitionCalls = 0;
			document.startViewTransition = unsupported
				? undefined
				: () => {
						window.transitionCalls += 1;
						throw new Error(
							'The immediate fallback must not start a transition.',
						);
					};
		}, fallback === 'unsupported browser');
		await page.goto('/demo/');
		if (fallback === 'unchecked option')
			await page.locator('#enable-transitions').uncheck();
		const example = page.locator('#animated');
		await example
			.getByLabel('Email', { exact: true })
			.fill('ada@example.test');
		await example.getByLabel('Email', { exact: true }).press('Enter');
		await expect(
			example.getByRole('group', { name: 'Delivery', exact: true }),
		).toBeFocused();
		expect(await page.evaluate(() => window.transitionCalls)).toBe(0);
		await expect(page.locator('html')).not.toHaveAttribute(
			'data-section-transition',
		);
	});
}

test('native transitions animate only section snapshots and keep controls stationary', async ({
	page,
}) => {
	const failures = [];
	page.on('pageerror', (error) => failures.push(error.message));
	page.on('console', (message) => {
		if (message.type() === 'error') failures.push(message.text());
	});
	await page.emulateMedia({ reducedMotion: 'no-preference' });
	await page.addInitScript(() => {
		window.sectionTransitions = [];
		const start = document.startViewTransition;
		if (start)
			document.startViewTransition = function (update) {
				const transition = start.call(this, update);
				window.sectionTransitions.push(transition);
				return transition;
			};
	});
	await page.goto('/demo/');
	const example = page.locator('#animated');
	await example.locator('[data-fieldset-progress-next]').click();
	await expect(example.getByLabel('Email', { exact: true })).toBeFocused();
	expect(await page.evaluate(() => window.sectionTransitions.length)).toBe(0);
	await example.getByLabel('Email', { exact: true }).fill('ada@example.test');
	await example.getByLabel('Email', { exact: true }).press('Enter');
	const supported = await page.evaluate(
		() => typeof document.startViewTransition === 'function',
	);
	await expect(
		example.getByRole('group', { name: 'Delivery', exact: true }),
	).toBeFocused();
	if (!supported) {
		expect(failures).toEqual([]);
		return;
	}
	const snapshot = await page.evaluate(async () => {
		await window.sectionTransitions[0].ready;
		const animations = document.getAnimations();
		for (const animation of animations) animation.pause();
		return {
			names: animations.map((animation) => animation.animationName),
			root: getComputedStyle(document.documentElement).viewTransitionName,
			step: getComputedStyle(
				document.querySelector('#animated fieldset:not([hidden])'),
			).viewTransitionName,
			progress: getComputedStyle(
				document.querySelector('#animated progress'),
			).viewTransitionName,
			direction: document.documentElement.dataset.sectionTransition,
		};
	});
	expect(snapshot.names).toEqual(
		expect.arrayContaining(['demo-section-in', 'demo-section-out']),
	);
	expect(snapshot).toMatchObject({
		root: 'none',
		step: 'demo-section',
		progress: 'none',
		direction: 'forward',
	});
	await expect(example.getByRole('group')).toHaveCount(1);
	await page.evaluate(async () => {
		for (const animation of document.getAnimations()) animation.finish();
		await window.sectionTransitions[0].finished;
	});
	await expect(page.locator('html')).not.toHaveAttribute(
		'data-section-transition',
	);
	await example.getByLabel('City', { exact: true }).fill('Seattle');
	const footer = await example
		.locator('[data-fieldset-progress-navigation]')
		.boundingBox();
	await example.locator('[data-fieldset-progress-next]').click();
	await expect(
		example.getByRole('group', { name: 'Review', exact: true }),
	).toBeFocused();
	await page.evaluate(async () => {
		await window.sectionTransitions[1].finished;
	});
	expect(
		await example
			.locator('[data-fieldset-progress-navigation]')
			.boundingBox(),
	).toEqual(footer);
	await example.locator('[data-fieldset-progress-previous]').click();
	await expect(page.locator('html')).toHaveAttribute(
		'data-section-transition',
		'backward',
	);
	await page.locator('#enable-transitions').uncheck();
	await expect(page.locator('html')).not.toHaveAttribute(
		'data-section-transition',
	);
	await page.locator('#enable-transitions').check();
	await example.locator('[data-fieldset-progress-next]').click();
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await expect(
		example.getByRole('group', { name: 'Review', exact: true }),
	).toBeFocused();
	await expect(page.locator('html')).not.toHaveAttribute(
		'data-section-transition',
	);
	expect(failures).toEqual([]);
});

test('interrupting a pending snapshot does not replay stale navigation', async ({
	page,
}) => {
	await page.emulateMedia({ reducedMotion: 'no-preference' });
	await page.addInitScript(() => {
		window.pendingTransitions = [];
		document.startViewTransition = (update) => {
			const pending = { update, skipped: false };
			window.pendingTransitions.push(pending);
			return {
				ready: Promise.resolve(),
				finished: new Promise((resolve) => {
					pending.finish = resolve;
				}),
				skipTransition() {
					pending.skipped = true;
					pending.finish();
				},
			};
		};
	});
	await page.goto('/demo/');
	const example = page.locator('#animated');
	await example.getByLabel('Email', { exact: true }).fill('ada@example.test');
	await example.locator('[data-fieldset-progress-next]').click();
	await page.evaluate(async () => {
		await window.pendingTransitions[0].update();
		window.pendingTransitions[0].finish();
	});
	await example.getByLabel('City', { exact: true }).fill('Seattle');
	await example.locator('[data-fieldset-progress-next]').click();
	await example.locator('[data-fieldset-progress-previous]').click();
	await page.evaluate(() => window.pendingTransitions[1].update());
	await expect(
		example.getByRole('group', { name: 'Contact', exact: true }),
	).toBeFocused();
	expect(
		await page.evaluate(() => window.pendingTransitions[1].skipped),
	).toBe(true);
	await expect(page.locator('html')).not.toHaveAttribute(
		'data-section-transition',
	);
});

test('the motion example retains its native no-JavaScript form', async ({
	browser,
}) => {
	const context = await browser.newContext({ javaScriptEnabled: false });
	try {
		const page = await context.newPage();
		await page.goto('http://127.0.0.1:4176/demo/');
		await expect(page.locator('#animated').getByRole('group')).toHaveCount(
			3,
		);
		await expect(page.locator('#animated [type=submit]')).toBeVisible();
		await expect(
			page.locator('#animated [data-fieldset-progress-navigation]'),
		).toHaveCount(0);
		await expect(page.locator('#enable-transitions')).toBeHidden();
	} finally {
		await context.close();
	}
});
