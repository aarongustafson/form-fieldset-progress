import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
	await page.goto('/test/browser/fixture.html');
	await expect(page.locator('form-fieldset-progress')).toHaveJSProperty(
		'state',
		'ready',
	);
});

test('panel navigation focuses the first field without autofocus on setup', async ({
	page,
}) => {
	const example = page.locator('form-fieldset-progress');
	expect(
		await page.evaluate(() => document.activeElement === document.body),
	).toBe(true);
	await example.evaluate((element) => {
		globalThis.focusedFields = [];
		element.addEventListener('form-fieldset-progress:change', () => {
			globalThis.focusedFields.push(document.activeElement.name);
		});
	});
	const name = example.getByRole('textbox', { name: 'Name', exact: true });
	await name.fill('Ada');
	await name.press('Enter');
	await expect(
		example.getByRole('textbox', { name: 'City', exact: true }),
	).toBeFocused();
	await example.locator('[data-fieldset-progress-previous]').click();
	await expect(name).toBeFocused();
	await example.evaluate((element) => {
		element.querySelector('[name=city]').value = 'London';
		element.goTo(2);
	});
	await expect(
		example.getByRole('textbox', { name: 'Notes', exact: true }),
	).toBeFocused();
	expect(await page.evaluate(() => globalThis.focusedFields)).toEqual([
		'city',
		'name',
		'notes',
	]);
});

test('first-field focus skips unavailable native controls and respects form ownership', async ({
	page,
}) => {
	const example = page.locator('form-fieldset-progress');
	await example.evaluate((element) => {
		const other = document.createElement('form');
		other.id = 'other-form';
		document.body.append(other);
		element.querySelector('#address').insertAdjacentHTML(
			'afterbegin',
			`<input type="hidden"><input disabled><input hidden>
			<fieldset disabled><legend>Unavailable</legend><input></fieldset>
			<div hidden><input></div><div inert><input></div>
			<div aria-hidden="true"><input></div>
			<div style="display:none"><input></div>
			<div style="visibility:hidden"><input></div>
			<details><summary>Additional fields</summary><input></details>
			<input form="other-form">
			<input type="button" value="Action"><input type="reset">
			<button type="button">Action</button>
			<label>Country <select name="country"><option>Canada</option></select></label>`,
		);
	});
	await example
		.getByRole('textbox', { name: 'Name', exact: true })
		.fill('Ada');
	await example.locator('[data-fieldset-progress-next]').click();
	await expect(
		example.getByRole('combobox', { name: 'Country' }),
	).toBeFocused();
	await page.keyboard.press('Tab');
	await expect(
		example.getByRole('textbox', { name: 'City', exact: true }),
	).toBeFocused();
});

test('panels with no focusable fields fall back to the fieldset', async ({
	page,
}) => {
	const example = page.locator('form-fieldset-progress');
	await example.evaluate((element) => {
		element.querySelector('#address').innerHTML = `<legend>Address</legend>
			<input disabled><div style="display:none"><input></div>
			<div inert><textarea></textarea></div>`;
	});
	await example
		.getByRole('textbox', { name: 'Name', exact: true })
		.fill('Ada');
	await example.locator('[data-fieldset-progress-next]').click();
	await expect(
		example.getByRole('group', { name: 'Address', exact: true }),
	).toBeFocused();
});

for (const anotherField of [false, true]) {
	test(`authored redirect to the original Next button is preserved with another field: ${anotherField}`, async ({
		page,
	}) => {
		const example = page.locator('form-fieldset-progress');
		await example.evaluate((element, extra) => {
			const next = element.querySelector('[data-fieldset-progress-next]');
			const city = element.querySelector('[name=city]');
			if (extra)
				city.insertAdjacentHTML('afterend', '<input name="extra">');
			city.addEventListener('focus', () => next.focus());
			element.addEventListener('form-fieldset-progress:change', () => {
				globalThis.preservedRedirect = document.activeElement === next;
			});
		}, anotherField);
		await example
			.getByRole('textbox', { name: 'Name', exact: true })
			.fill('Ada');
		const next = example.locator('[data-fieldset-progress-next]');
		await next.focus();
		await next.click();
		await expect(example).toHaveJSProperty('stepIndex', 1);
		await expect(next).toBeFocused();
		expect(await page.evaluate(() => globalThis.preservedRedirect)).toBe(
			true,
		);
	});
}
