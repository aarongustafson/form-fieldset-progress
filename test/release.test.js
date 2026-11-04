import { execFileSync } from 'node:child_process';
import {
	copyFileSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

let fixture;

function createFixture(pkg, demo) {
	fixture = mkdtempSync(join(tmpdir(), 'fieldset-progress-release-'));
	const root = join(fixture, 'component');
	mkdirSync(join(root, 'scripts'), { recursive: true });
	mkdirSync(join(root, 'demo'));
	copyFileSync(
		resolve('scripts/update-demo-versions.js'),
		join(root, 'scripts/update-demo-versions.js'),
	);
	writeFileSync(join(root, 'package.json'), JSON.stringify(pkg));
	writeFileSync(join(root, 'demo/esm.html'), demo);
	return root;
}

afterEach(() => {
	if (fixture) rmSync(fixture, { recursive: true, force: true });
	fixture = undefined;
});

describe('template release automation', () => {
	it('preserves the version and postversion hooks with their supporting files', () => {
		const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
		expect(pkg.scripts.version).toBe(
			'node scripts/update-demo-versions.js && git add demo/esm.html',
		);
		expect(pkg.scripts.postversion).toBe('git push --follow-tags');
		const demo = readFileSync('demo/esm.html', 'utf8');
		expect(demo).toContain(
			`https://esm.sh/${pkg.name}@${pkg.version}/form-fieldset-progress.js`,
		);
		expect(demo).not.toContain('COMPONENT-NAME');
	});

	it('updates pinned demo URLs without changing unrelated content or the package version', () => {
		const pkg = {
			name: '@aarongustafson/form-fieldset-progress',
			version: '0.2.0',
			type: 'module',
		};
		const demo = [
			'https://esm.sh/@aarongustafson/form-fieldset-progress@0.0.1/form-fieldset-progress.js?bundle&target=es2022',
			'https://esm.sh/@aarongustafson/form-fieldset-progress@0.1.0/form-fieldset-progress.css',
			'https://esm.sh/@aarongustafson/other-component@0.0.1/define.js',
			'Keep this authored content.',
		].join('\n');
		const root = createFixture(pkg, demo);
		execFileSync(
			process.execPath,
			[join(root, 'scripts/update-demo-versions.js')],
			{ cwd: root },
		);
		expect(readFileSync(join(root, 'demo/esm.html'), 'utf8')).toBe(
			demo
				.replace('progress@0.0.1/', 'progress@0.2.0/')
				.replace('progress@0.1.0/', 'progress@0.2.0/'),
		);
		expect(readFileSync(join(root, 'package.json'), 'utf8')).toBe(
			JSON.stringify(pkg),
		);
	});

	it('stages the updated demo and pushes the version commit and tag to an isolated local remote', () => {
		const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
		const root = createFixture(
			{
				name: pkg.name,
				version: '0.0.1',
				type: 'module',
				scripts: {
					version: pkg.scripts.version,
					postversion: pkg.scripts.postversion,
				},
			},
			readFileSync('demo/esm.html', 'utf8').replaceAll(
				`${pkg.name}@${pkg.version}/`,
				`${pkg.name}@0.0.1/`,
			),
		);
		const git = (...args) =>
			execFileSync('git', args, {
				cwd: root,
				encoding: 'utf8',
				stdio: 'pipe',
			}).trim();
		git('init', '--initial-branch=main');
		git('config', 'user.name', 'Release test');
		git('config', 'user.email', 'release-test@example.invalid');
		git('config', 'commit.gpgsign', 'false');
		git('config', 'tag.gpgsign', 'false');
		const trailer =
			'Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>';
		git('add', 'package.json', 'scripts', 'demo');
		git('commit', '-m', 'Initial fixture', '-m', trailer);
		const remote = join(fixture, 'origin.git');
		git('init', '--bare', remote);
		git('remote', 'add', 'origin', remote);
		git('push', '--set-upstream', 'origin', 'main');
		execFileSync(
			'npm',
			[
				'version',
				'minor',
				'--sign-git-tag=false',
				'--message',
				`Release %s\n\n${trailer}`,
			],
			{ cwd: root, stdio: 'pipe' },
		);
		expect(
			JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
				.version,
		).toBe('0.1.0');
		expect(git('show', 'HEAD:demo/esm.html')).toContain(
			`${pkg.name}@0.1.0/form-fieldset-progress.js`,
		);
		expect(git('status', '--porcelain')).toBe('');
		expect(
			git('ls-remote', 'origin', 'refs/heads/main').split(/\s/)[0],
		).toBe(git('rev-parse', 'HEAD'));
		expect(
			git('ls-remote', 'origin', 'refs/tags/v0.1.0^{}').split(/\s/)[0],
		).toBe(git('rev-parse', 'HEAD'));
	});
});
