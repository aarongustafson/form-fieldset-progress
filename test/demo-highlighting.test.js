import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const name = 'form-fieldset-progress';
const hashes = {
	'esm.html':
		'306312a36b77251857ceca1e052a8f7234649f51b780e46da0241c3411bcad7b',
	'index.html':
		'9a11f1df6252d9db2857459f9666b622d0be3d634f45974723fd36a9c6295678',
};

describe('displayed component code', () => {
	for (const [file, hash] of Object.entries(hashes)) {
		it(`highlights component snippets without changing code in ${file}`, () => {
			const template = document.createElement('template');
			template.innerHTML = readFileSync(`demo/${file}`, 'utf8');
			const blocks = [...template.content.querySelectorAll('pre code')];
			const text = blocks.map((code) => code.textContent).join('\n');
			expect(createHash('sha256').update(text).digest('hex')).toBe(hash);
			expect(template.content.querySelector('mark mark')).toBeNull();
			for (const code of blocks) {
				const marks = [...code.querySelectorAll('mark')].map(
					(mark) => mark.textContent,
				);
				const snippets = [
					...code.textContent.matchAll(
						new RegExp(`<\\/?${name}\\b[^>]*>`, 'g'),
					),
					...code.textContent.matchAll(/import\s[\s\S]*?;/g),
					...code.textContent.matchAll(
						/(?:customElements\.(?:get|define)\([\s\S]*?\)|define[A-Z]\w*\(\))/g,
					),
				];
				for (const [snippet] of snippets) {
					expect(
						marks.some((mark) => mark.includes(snippet)),
						`${file}: ${snippet}`,
					).toBe(true);
				}
			}
		});
	}
});
