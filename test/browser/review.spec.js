import { test, expect } from '@playwright/test';

test('generated review validates, summarizes native labels and files, updates on return, and submits', async ({
	page,
}) => {
	await page.goto('/demo/');
	const example = page.locator('#generated-review');
	const next = example.locator('[data-fieldset-progress-next]');
	await expect(
		example.locator('[data-fieldset-progress-review-panel]'),
	).toBeHidden();
	await next.click();
	await expect(
		example.getByRole('textbox', { name: 'Name', exact: true }),
	).toBeFocused();
	await example
		.getByRole('textbox', { name: 'Name', exact: true })
		.fill('Ada');
	await next.click();
	await example.getByLabel('Country', { exact: true }).selectOption('ca');
	await example.getByLabel('SMS', { exact: true }).check();
	await example
		.getByLabel('Notes', { exact: true })
		.fill('<img src=x onerror=alert(1)>\nSecond line');
	await example.getByLabel('Attachments', { exact: true }).setInputFiles([
		{
			name: 'first.txt',
			mimeType: 'text/plain',
			buffer: Buffer.from('first'),
		},
		{
			name: 'second.txt',
			mimeType: 'text/plain',
			buffer: Buffer.from('second'),
		},
	]);
	await next.click();
	const review = example.getByRole('group', {
		name: 'Check your answers',
		exact: true,
	});
	await expect(review).toBeFocused();
	const entry = (label) =>
		review.locator('dl > div').filter({
			has: page.locator('dt', { hasText: new RegExp(`^${label}$`) }),
		});
	await expect(entry('Name').locator('dd')).toHaveText('Ada');
	await expect(entry('Country').locator('dd')).toHaveText('Canada');
	await expect(entry('Updates').locator('dd li')).toHaveText([
		'Email',
		'SMS',
	]);
	await expect(entry('Attachments').locator('dd li')).toHaveText([
		'first.txt',
		'second.txt',
	]);
	await expect(entry('Notes').locator('dd')).toHaveText(
		'<img src=x onerror=alert(1)>\nSecond line',
	);
	await expect(review.locator('img')).toHaveCount(0);
	await expect(example.getByRole('progressbar')).toHaveAttribute(
		'value',
		'3',
	);
	await expect(next).toBeHidden();
	await example.locator('[data-fieldset-progress-previous]').click();
	await example.getByLabel('Country', { exact: true }).selectOption('uk');
	await next.click();
	await expect(entry('Country').locator('dd')).toHaveText('United Kingdom');
	await example.getByRole('button', { name: 'Send', exact: true }).click();
	await expect(example.locator('[data-result]')).toHaveText(
		'Demo complete. No data was sent.',
	);
});

test('authored review adds a final screen to one input section and restores authored markup', async ({
	page,
}) => {
	await page.goto('/demo/');
	const example = page.locator('#authored-review');
	await expect(example.getByRole('progressbar')).toHaveAttribute('max', '2');
	await expect(example.locator('#answers')).toBeHidden();
	await example
		.getByRole('textbox', { name: 'Name', exact: true })
		.fill('Ada');
	await example
		.getByRole('textbox', { name: 'Name', exact: true })
		.press('Enter');
	await expect(
		example.getByRole('group', {
			name: 'Confirm your details',
			exact: true,
		}),
	).toBeFocused();
	await expect(example.locator('#answers dl > div dt')).toHaveText('Name');
	await expect(example.locator('#answers dl > div dd')).toHaveText('Ada');
	expect(
		await example.evaluate((element) => {
			const review = element.querySelector('#answers');
			const list = review.querySelector('dl');
			element.remove();
			return {
				hidden: review.hidden,
				entries: list.children.length,
				managed: list.hasAttribute('data-fieldset-progress-review'),
			};
		}),
	).toEqual({ hidden: true, entries: 0, managed: false });
});

test('native review uses radio group legends and boolean messages while excluding sensitive and disabled fields', async ({
	page,
}) => {
	await page.goto('/test/browser/fixture.html');
	const example = page.locator('form-fieldset-progress');
	await example.evaluate((element) => {
		element.remove();
		element.querySelector('#review').remove();
		element.setAttribute('review-panel', '');
		element.setAttribute('review-label', 'Vérification');
		element.setAttribute('review-checked-label', 'Oui');
		element.setAttribute('review-unchecked-label', 'Non');
		const choices = document.createElement('fieldset');
		choices.innerHTML = `<legend>Choices</legend>
			<fieldset><legend>Delivery speed</legend>
				<label><input type="radio" name="speed" value="e" checked> Express delivery</label>
				<label><input type="radio" name="speed" value="s"> Standard delivery</label>
			</fieldset>
			<label><input type="checkbox" name="subscribe" checked> Subscribe</label>
			<label><input type="checkbox" name="agree"> Agree</label>
			<label>Password <input type="password" name="password" value="private"></label>
			<input type="hidden" name="token" value="private">
			<fieldset disabled><legend>Disabled</legend><label>Disabled input <input name="disabled" value="private"></label></fieldset>`;
		element.querySelector('form').append(choices);
		globalThis.reviewDecorations = 0;
		customElements.define(
			'review-probe-label',
			class extends HTMLElement {
				constructor() {
					super();
					globalThis.reviewDecorations += 1;
				}
			},
		);
		const label = document.createElement('label');
		const decoration = document.createElement('review-probe-label');
		decoration.textContent = 'e';
		const input = document.createElement('input');
		input.name = 'decorated';
		input.value = 'example';
		label.append('Contact ', decoration, 'mail ', input);
		element.querySelector('form').append(label);
		globalThis.reviewDecorations = 0;
		document.body.append(element);
	});
	await example.locator('[name=name]').fill('Ada');
	await example.evaluate((element) => {
		element.querySelector('[name=city]').value = 'London';
		element.goTo(element.stepCount - 1);
	});
	const summary = example.locator('[data-fieldset-progress-review]');
	await expect(summary).toContainText('Delivery speed');
	await expect(summary).toContainText('Express delivery');
	await expect(summary).not.toContainText('Standard delivery');
	await expect(summary).toContainText('Oui');
	await expect(summary).toContainText('Non');
	await expect(summary).not.toContainText('private');
	await expect(summary).toContainText('Contact email');
	expect(await page.evaluate(() => globalThis.reviewDecorations)).toBe(0);
	await expect(
		example.getByRole('group', { name: 'Vérification', exact: true }),
	).toBeFocused();
});

for (const wrapping of [false, true]) {
	test(`authored hidden progress ${wrapping ? 'wrapper' : 'label'} is revealed only with working enhancement`, async ({
		page,
	}) => {
		await page.goto('/test/browser/fixture.html');
		const example = page.locator('form-fieldset-progress');
		await example.evaluate((element, wrap) => {
			element.remove();
			element.setAttribute('progress-ref', 'hidden-meter');
			element.setAttribute('progress-label-ref', 'hidden-status');
			const container = document.createElement('div');
			container.innerHTML = wrap
				? '<div id="hidden-status" hidden><span data-fieldset-progress-label>Progress</span><progress id="hidden-meter" hidden></progress></div>'
				: '<label id="hidden-status" for="hidden-meter" hidden>Progress</label><progress id="hidden-meter" hidden></progress>';
			element.querySelector('form').prepend(container);
			const extra = document.createElement('label');
			extra.id = 'spare-status';
			extra.htmlFor = 'hidden-meter';
			extra.hidden = true;
			extra.textContent = 'Unused information';
			container.append(extra);
			document.body.append(element);
		}, wrapping);
		await expect(example.locator('#hidden-status')).toBeVisible();
		await expect(example.locator('#spare-status')).toBeHidden();
		await expect(example.getByRole('progressbar')).toHaveAccessibleName(
			'Step 1 of 3: Contact',
		);
		await example.evaluate((element) =>
			element.setAttribute('next-ref', 'missing'),
		);
		await expect(example.locator('#hidden-status')).toBeHidden();
		await expect(example.locator('#hidden-meter')).toBeHidden();
		await expect(example.locator('#contact')).toBeVisible();
		await expect(example.locator('#address')).toBeVisible();
	});
}

test('review and authored navigation retain useful no-JavaScript fallbacks', async ({
	browser,
}) => {
	const context = await browser.newContext({ javaScriptEnabled: false });
	const page = await context.newPage();
	try {
		await page.goto('/demo/');
		await expect(
			page.locator('#generated-review form > fieldset'),
		).toHaveCount(2);
		await expect(
			page.locator(
				'#generated-review [data-fieldset-progress-review-panel]',
			),
		).toHaveCount(0);
		await expect(page.locator('#answers')).toBeHidden();
		await expect(
			page.locator('#authored-review [type=submit]'),
		).toBeVisible();
		for (const id of [
			'english-back',
			'english-next',
			'english-progress',
			'english-status',
			'custom-back',
			'custom-next',
			'custom-progress',
			'custom-status',
		])
			await expect(page.locator(`#${id}`)).toBeHidden();
		await expect(
			page.locator('#english-custom [type=submit]'),
		).toBeVisible();
	} finally {
		await context.close();
	}
});
