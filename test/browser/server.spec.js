import { get } from 'node:http';
import { test, expect } from '@playwright/test';

test('malformed URLs return 400 without stopping the demo server', async ({
	baseURL,
	request,
}) => {
	for (const path of ['/bad%zz', 'http://[']) {
		const status = await new Promise((resolve, reject) => {
			const outgoing = get(
				{ hostname: '127.0.0.1', port: new URL(baseURL).port, path },
				(response) => {
					response.resume();
					response.on('end', () => resolve(response.statusCode));
				},
			);
			outgoing.on('error', reject);
		});
		expect(status).toBe(400);
		expect((await request.get('/demo/')).status()).toBe(200);
	}
});
