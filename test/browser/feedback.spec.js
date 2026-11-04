import { test, expect } from '@playwright/test';

for (const external of [false, true]) {
	for (const imageOnly of [false, true]) {
		test(`${external ? 'external' : 'internal'} image submit ${imageOnly ? 'alone' : 'alongside a button'} follows section visibility and native submission`, async ({
			page,
		}) => {
			await page.goto('/test/browser/fixture.html');
			await page.locator('form-fieldset-progress').evaluate(
				(element, config) => {
					element.remove();
					const form = element.querySelector('form');
					form.id = 'image-form';
					if (config.imageOnly)
						for (const button of form.querySelectorAll(
							'[type=submit]',
						))
							button.remove();
					const image = document.createElement('input');
					image.type = 'image';
					image.id = 'image-submit';
					image.name = 'send-image';
					image.alt = 'Send image';
					image.src =
						'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="40"%3E%3Crect width="100" height="40" fill="blue"/%3E%3C/svg%3E';
					if (config.external) {
						image.setAttribute('form', form.id);
						document.body.append(image);
					} else form.append(image);
					const otherForm = document.createElement('form');
					otherForm.innerHTML =
						'<input id="unrelated-image" type="image" alt="Unrelated" src="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22/%3E">';
					document.body.append(otherForm);
					form.addEventListener('submit', (event) => {
						event.preventDefault();
						globalThis.imageSubmission = {
							submitter: event.submitter.id,
							keys: Array.from(
								new FormData(form, event.submitter).keys(),
							),
						};
					});
					document.body.append(element);
				},
				{ external, imageOnly },
			);
			const example = page.locator('form-fieldset-progress');
			await expect
				.poll(() => example.evaluate((element) => element.state))
				.toBe('ready');
			await expect(page.locator('#image-submit')).toBeHidden();
			await expect(page.locator('#unrelated-image')).toBeVisible();
			await example.locator('[name=name]').fill('Ada');
			await example.locator('[data-fieldset-progress-next]').click();
			await expect(page.locator('#image-submit')).toBeHidden();
			await example.locator('[name=city]').fill('London');
			await example.locator('[data-fieldset-progress-next]').click();
			await expect(page.locator('#image-submit')).toBeVisible();
			await page
				.locator('#image-submit')
				.click({ position: { x: 5, y: 5 } });
			await expect
				.poll(() =>
					page.evaluate(() => globalThis.imageSubmission?.submitter),
				)
				.toBe('image-submit');
			const keys = await page.evaluate(
				() => globalThis.imageSubmission.keys,
			);
			expect(keys).toEqual(
				expect.arrayContaining([
					'name',
					'city',
					'send-image.x',
					'send-image.y',
				]),
			);
			expect(
				await example.evaluate((element) => {
					const image = document.querySelector('#image-submit');
					element.remove();
					return {
						hidden: image.hidden,
						external: !element.contains(image),
						owner: image.form?.id,
					};
				}),
			).toEqual({
				hidden: false,
				external,
				owner: external ? undefined : 'image-form',
			});
		});
	}
}

test('unsafe wrapped progress labels and hidden review ancestors fall back to a visible native form', async ({
	page,
}) => {
	await page.goto('/test/browser/fixture.html');
	const example = page.locator('form-fieldset-progress');
	await example.evaluate((element) => {
		element.remove();
		element.querySelector('#address').remove();
		element.querySelector('#review').remove();
		const form = element.querySelector('form');
		form.id = 'unsafe-label';
		const span = document.createElement('span');
		span.setAttribute('data-fieldset-progress-label', '');
		const meter = document.createElement('progress');
		meter.id = 'unsafe-meter';
		form.append(span, meter);
		element.setAttribute('progress-ref', meter.id);
		element.setAttribute('progress-label-ref', form.id);
		document.body.append(element);
	});
	await expect
		.poll(() => example.evaluate((element) => element.state))
		.toBe('error');
	await expect(
		example.getByRole('button', { name: 'Send application', exact: true }),
	).toBeVisible();
	await expect(
		example.getByRole('textbox', { name: 'Name', exact: true }),
	).toBeVisible();
	await example.evaluate((element) => {
		element.remove();
		element.removeAttribute('progress-label-ref');
		element.removeAttribute('progress-ref');
		element.querySelector('#unsafe-meter').remove();
		const wrapper = document.createElement('div');
		wrapper.hidden = true;
		wrapper.innerHTML =
			'<fieldset id="hidden-review" hidden><legend>Confirm</legend></fieldset>';
		element.querySelector('form').append(wrapper);
		element.setAttribute('review-ref', 'hidden-review');
		document.body.append(element);
	});
	await expect
		.poll(() => example.evaluate((element) => element.state))
		.toBe('error');
	await expect(
		example.getByRole('button', { name: 'Send application', exact: true }),
	).toBeVisible();
});

test('value-only datalist options remain visible answers in review', async ({
	page,
}) => {
	await page.goto('/demo/');
	const example = page.locator('#authored-review');
	await example.evaluate((element) => {
		const label = document.createElement('label');
		label.innerHTML =
			'Route <input name="route" value="a" list="review-routes"><datalist id="review-routes"><option value="a"></option></datalist>';
		element.querySelector('form > fieldset').append(label);
	});
	await example
		.getByRole('textbox', { name: 'Name', exact: true })
		.fill('Ada');
	await example.locator('[data-fieldset-progress-next]').click();
	await expect(
		example
			.locator('dl > div')
			.filter({ has: page.locator('dt', { hasText: /^Route$/ }) })
			.locator('dd'),
	).toHaveText('a');
});
