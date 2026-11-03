import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const types = {
	'.html': 'text/html',
	'.js': 'text/javascript',
	'.css': 'text/css',
};

createServer(async (request, response) => {
	const url = new URL(request.url, 'http://localhost');
	const path = resolve(
		root,
		`.${decodeURIComponent(url.pathname)}`,
		url.pathname.endsWith('/') ? 'index.html' : '',
	);
	if (!path.startsWith(`${root}${sep}`)) {
		response.writeHead(403).end('Forbidden');
		return;
	}
	try {
		const content = await readFile(path);
		response
			.writeHead(200, {
				'Content-Type':
					types[extname(path)] || 'application/octet-stream',
			})
			.end(content);
	} catch (error) {
		if (error.code !== 'ENOENT' && error.code !== 'EISDIR') throw error;
		response.writeHead(404).end('Not found');
	}
}).listen(4176, '127.0.0.1', () =>
	console.log('Demo server: http://127.0.0.1:4176/demo/'),
);
