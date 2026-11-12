import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';

const componentCSS = await readFile(
	new URL('../../form-fieldset-progress.css', import.meta.url),
	'utf8',
);
const demoCSS = await readFile(
	new URL('../../demo/styles.css', import.meta.url),
	'utf8',
);

// The study's 62 observations reduce to 19 palettes for these six tokens.
// Alpha is preserved. Substitution tests authored CSS, not OS repainting.
const tokens = [
	'Canvas',
	'CanvasText',
	'ButtonFace',
	'ButtonText',
	'Field',
	'FieldText',
];
const palettes = [
	['#ffffff', '#000000', '#efefef', '#000000', '#ffffff', '#000000'],
	['#121212', '#ffffff', '#6b6b6b', '#ffffff', '#3b3b3b', '#ffffff'],
	['#ffffff', '#000000', '#e9e9ed', '#000000', '#ffffff', '#000000'],
	['#1c1b22', '#fbfbfe', '#2b2a33', '#fbfbfe', '#2b2a33', '#fbfbfe'],
	['#ffffff', '#000000', '#c0c0c0', '#000000d8', '#ffffff', '#000000d8'],
	['#1e1e1e', '#ffffff', '#ffffff3f', '#ffffffd8', '#ffffff3f', '#ffffffd8'],
	['#ffffff', '#000000', '#f0f0f0', '#000000', '#ffffff', '#000000'],
	['#202020', '#ffffff', '#202020', '#ffffff', '#202020', '#ffffff'],
	['#fffaef', '#3d3d3d', '#fffaef', '#202020', '#fffaef', '#3d3d3d'],
	['#2d3236', '#ffffff', '#2d3236', '#b6f6f0', '#2d3236', '#ffffff'],
	['#000000', '#ffffff', '#000000', '#ffee32', '#000000', '#ffffff'],
	['#000000', '#ffffff', '#000000', '#ffee32', '#000000', '#ffee32'],
	['#2d3236', '#ffffff', '#2d3236', '#b6f6f0', '#2d3236', '#b6f6f0'],
	['#fffaef', '#3d3d3d', '#fffaef', '#202020', '#fffaef', '#202020'],
	['#ffffff', '#000000', '#c0c0c0', '#000000', '#ffffff', '#000000'],
	['#000000', '#ffffff', '#c0c0c0', '#000000', '#ffffff', '#000000'],
	['#ffffff', '#000000', '#ffffff', '#000000d8', '#ffffff', '#000000d8'],
	['#282828', '#ffffff', '#202020', '#ffffff', '#202020', '#ffffff'],
	['#202020', '#ffffff', '#00000000', '#ffffff', '#00000000', '#ffffff'],
];

function substitute(css, palette) {
	const colors = Object.fromEntries(
		tokens.map((token, index) => [token, palette[index]]),
	);
	return css.replace(
		/\b(CanvasText|Canvas|ButtonFace|ButtonText|FieldText|Field)\b/g,
		(token) => colors[token],
	);
}

async function measurements(locator) {
	return locator.evaluate((element) => {
		const context = document.createElement('canvas').getContext('2d');
		if (!context) throw new Error('Canvas color measurement unavailable.');
		const pixel = () => [...context.getImageData(0, 0, 1, 1).data];
		const paint = (color) => {
			context.fillStyle = color;
			context.fillRect(0, 0, 1, 1);
			return pixel();
		};
		const background = (node) => {
			context.clearRect(0, 0, 1, 1);
			const ancestors = [];
			for (; node; node = node.parentElement) ancestors.unshift(node);
			for (const ancestor of ancestors)
				paint(getComputedStyle(ancestor).backgroundColor);
			if (pixel()[3] !== 255)
				throw new Error('Expected opaque measurement surface.');
			return pixel();
		};
		const luminance = (rgb) =>
			rgb.slice(0, 3).reduce((sum, channel, index) => {
				const value = channel / 255;
				return (
					sum +
					(value <= 0.04045
						? value / 12.92
						: ((value + 0.055) / 1.055) ** 2.4) *
						[0.2126, 0.7152, 0.0722][index]
				);
			}, 0);
		const ratio = (a, b) => {
			const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
			return (values[0] + 0.05) / (values[1] + 0.05);
		};
		const style = getComputedStyle(element);
		const fill = background(element);
		const foreground = paint(style.color);
		const surround = background(element.parentElement);
		const border = paint(style.borderTopColor);
		return {
			text: ratio(foreground, fill),
			boundary: Math.max(ratio(fill, surround), ratio(border, surround)),
		};
	});
}

async function fixture(page) {
	await page.goto('/test/browser/fixture.html');
	await page.addStyleTag({
		content: 'body { color: CanvasText; background: Canvas; }',
	});
	const host = page.locator('form-fieldset-progress');
	await expect(host).toHaveJSProperty('state', 'ready');
	return host;
}

test('Next defaults to the native button pair and separates progress accent from its paired overrides', async ({
	page,
}) => {
	const host = await fixture(page);
	await host.evaluate((element) => {
		element.style.setProperty(
			'--fieldset-progress-accent',
			'rgb(255, 0, 255)',
		);
		const probe = document.createElement('button');
		probe.id = 'button-probe';
		probe.textContent = 'Native button pair';
		probe.style.cssText = 'color: ButtonText; background: ButtonFace';
		element.append(probe);
	});
	const next = host.locator('[data-fieldset-progress-next]');
	const probe = host.locator('#button-probe');
	for (const property of ['color', 'background-color'])
		await expect(next).toHaveCSS(
			property,
			await probe.evaluate(
				(element, key) =>
					getComputedStyle(element).getPropertyValue(key),
				property,
			),
		);
	await expect(host.locator('progress')).toHaveCSS(
		'accent-color',
		'rgb(255, 0, 255)',
	);
	await host.evaluate((element) => {
		element.style.setProperty(
			'--fieldset-progress-next-background',
			'rgb(23, 63, 99)',
		);
		element.style.setProperty(
			'--fieldset-progress-next-color',
			'rgb(255, 255, 255)',
		);
	});
	await expect(next).toHaveCSS('background-color', 'rgb(23, 63, 99)');
	await expect(next).toHaveCSS('color', 'rgb(255, 255, 255)');
	expect((await measurements(next)).text).toBeGreaterThanOrEqual(4.5);
});

test('all recorded palette substitutions keep navigation, demo submits, fields, and supporting text readable', async ({
	page,
}) => {
	const host = await fixture(page);
	await host.evaluate((element) => {
		element.form.noValidate = true;
		element.goTo(1);
	});
	for (const palette of palettes) {
		const style = await page.addStyleTag({
			content: `${substitute(demoCSS, palette)}\n${substitute(componentCSS, palette)}\n
			/* A low-contrast accent exposes accidental button coupling. */
			:root { --fieldset-progress-accent: #eeeeee; }
			`,
		});
		const selectors = [
			'[data-fieldset-progress-next]',
			'[data-fieldset-progress-previous]',
			'[data-fieldset-progress-reset]',
			'[name=city]',
		];
		for (const selector of selectors) {
			const result = await measurements(host.locator(selector));
			expect(
				result.text,
				`${selector} text in ${palette}`,
			).toBeGreaterThanOrEqual(4.5);
			expect(
				result.boundary,
				`${selector} boundary in ${palette}`,
			).toBeGreaterThanOrEqual(3);
		}
		await host.evaluate((element) => {
			element.form.noValidate = true;
			element.goTo(2);
		});
		expect(
			(await measurements(host.locator('[value=send]'))).text,
			`Submit text in ${palette}`,
		).toBeGreaterThanOrEqual(4.5);
		expect(
			(
				await measurements(
					host.locator('[data-fieldset-progress-status]'),
				)
			).text,
		).toBeGreaterThanOrEqual(4.5);
		await host.evaluate((element) => element.goTo(1));
		await style.evaluate((element) => element.remove());
	}
});

for (const scheme of ['light', 'dark']) {
	test(`${scheme}: native button pair contrast`, async ({
		page,
		browserName,
	}) => {
		test.fail(
			browserName === 'webkit' &&
				scheme === 'dark' &&
				process.platform === 'linux',
			'Known bundled Ubuntu WebKit dark ButtonText/ButtonFace limitation; preserve the native control pair.',
		);
		await page.emulateMedia({ colorScheme: scheme });
		const host = await fixture(page);
		await page.addStyleTag({ content: demoCSS });
		expect(
			(await measurements(host.locator('[data-fieldset-progress-next]')))
				.text,
		).toBeGreaterThanOrEqual(4.5);
	});

	test(`${scheme}: native button surfaces and browser focus remain available`, async ({
		page,
	}) => {
		await page.emulateMedia({ colorScheme: scheme });
		const host = await fixture(page);
		await page.addStyleTag({ content: demoCSS });
		await host.evaluate((element) => {
			const probe = document.createElement('button');
			probe.id = 'native-focus';
			probe.textContent = 'Native focus';
			element.append(probe);
		});
		const next = host.locator('[data-fieldset-progress-next]');
		await page.keyboard.press('Tab');
		await next.focus();
		await expect(next).toBeFocused();
		const native = host.locator('#native-focus');
		await native.focus();
		const ring = await native.evaluate((element) => {
			const style = getComputedStyle(element);
			return {
				style: style.outlineStyle,
				color: style.outlineColor,
				width: style.outlineWidth,
			};
		});
		await next.focus();
		await expect(next).toHaveCSS('outline-style', ring.style);
		await expect(next).toHaveCSS('outline-color', ring.color);
		await expect(next).toHaveCSS('outline-width', ring.width);
		expect(ring.style).not.toBe('none');
		await page.addStyleTag({
			content:
				'button:focus-visible { outline: 4px dotted CanvasText; outline-offset: 6px; }',
		});
		await expect(next).toHaveCSS('outline-style', 'dotted');
		await expect(next).toHaveCSS('outline-width', '4px');
		await expect(next).toHaveCSS('outline-offset', '6px');
	});
}

test('paired-color demo validates, preserves entered data, submits, and resets without recoloring progress', async ({
	page,
}) => {
	await page.goto('/demo/');
	const host = page.locator('#paired-colors');
	await expect(host).toHaveJSProperty('state', 'ready');
	const next = host.getByRole('button', { name: 'Next to Delivery notes' });
	await expect(next).toHaveCSS('background-color', 'rgb(23, 63, 99)');
	await expect(next).toHaveCSS('color', 'rgb(255, 255, 255)');
	const progress = host.getByRole('progressbar');
	await expect(progress).toHaveCSS('accent-color', 'rgb(23, 63, 99)');
	await next.click();
	const name = host.getByRole('textbox', { name: 'Your name' });
	await expect(name).toBeFocused();
	await name.fill('Ada');
	await next.focus();
	await page.keyboard.press('Enter');
	await expect(host.getByRole('textbox', { name: 'Notes' })).toBeFocused();
	await host.getByRole('button', { name: 'Back to Contact' }).click();
	await expect(name).toHaveValue('Ada');
	await next.click();
	await host.getByRole('button', { name: 'Send application' }).click();
	await expect(host.getByRole('status')).toContainText('Demo complete');
	await host.getByRole('button', { name: 'Start over' }).click();
	await expect(name).toHaveValue('');
	await expect(next).toHaveCSS('background-color', 'rgb(23, 63, 99)');
	await expect(progress).toHaveAttribute('value', '1');
});

test('forced colors retain automatic adjustment, native progress semantics, and keyboard navigation', async ({
	page,
	browserName,
}) => {
	test.skip(
		browserName !== 'chromium',
		'Forced colors are emulated only in Chromium.',
	);
	await page.emulateMedia({ forcedColors: 'active' });
	const host = await fixture(page);
	await page.addStyleTag({ content: demoCSS });
	const progress = host.getByRole('progressbar');
	await expect(progress).toHaveAccessibleName('Step 1 of 3: Contact');
	await expect(progress).toHaveAttribute('value', '1');
	await expect(progress).toHaveAttribute('max', '3');
	const next = host.locator('[data-fieldset-progress-next]');
	await expect(next).toHaveCSS('forced-color-adjust', 'auto');
	expect((await measurements(next)).text).toBeGreaterThanOrEqual(4.5);
	await host.locator('[name=name]').fill('Ada');
	await next.focus();
	await page.keyboard.press('Enter');
	await expect(host.locator('[name=city]')).toBeFocused();
	await expect(progress).toHaveAccessibleName('Step 2 of 3: Address');
	await expect(progress).toHaveAttribute('value', '2');
	await expect(host.locator('[data-fieldset-progress-status]')).toContainText(
		'Step 2 of 3: Address',
	);
});

for (const path of ['index.html', 'esm.html', 'no-script.html']) {
	test(`${path}: demo buttons, fields, layout, and contrast remain usable`, async ({
		page,
	}) => {
		await page.route('https://esm.sh/**', (route) =>
			route.fulfill({
				body: 'export { FormFieldsetProgressElement } from "http://127.0.0.1:4176/form-fieldset-progress.js";',
				contentType: 'text/javascript',
				headers: { 'Access-Control-Allow-Origin': '*' },
			}),
		);
		await page.goto(`/demo/${path}`);
		if (path !== 'no-script.html')
			await expect(
				page.locator('form-fieldset-progress').first(),
			).toHaveJSProperty('state', 'ready');
		for (const width of [1280, 320]) {
			await page.setViewportSize({ width, height: 900 });
			expect(
				await page.evaluate(
					() => document.documentElement.scrollWidth <= innerWidth,
				),
			).toBe(true);
			for (const pair of await page.locator('.code-demo-pair').all()) {
				const code = await pair.locator(':scope > pre').boundingBox();
				const live = await pair.locator(':scope > .demo').boundingBox();
				if (width === 1280)
					expect(code.x + code.width).toBeLessThanOrEqual(live.x);
				else expect(code.y + code.height).toBeLessThanOrEqual(live.y);
			}
		}
		for (const button of await page.locator('button:visible').all()) {
			expect((await measurements(button)).text).toBeGreaterThanOrEqual(
				4.5,
			);
			expect(
				(await measurements(button)).boundary,
			).toBeGreaterThanOrEqual(3);
		}
		for (const field of await page
			.locator('input:not([type=radio]):visible, textarea:visible')
			.all()) {
			expect((await measurements(field)).text).toBeGreaterThanOrEqual(
				4.5,
			);
			expect((await measurements(field)).boundary).toBeGreaterThanOrEqual(
				3,
			);
		}
	});
}
