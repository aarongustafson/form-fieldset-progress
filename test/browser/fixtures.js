import { test as base, expect } from '@playwright/test';

export const test = base.extend({
	context: async ({ context }, use) => {
		await context.route('**/demo/code-examples.js', (route) =>
			route.fulfill({
				contentType: 'text/javascript',
				body: 'export {};',
			}),
		);
		await use(context);
	},
});

export { expect };
