#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(
	readFileSync(join(rootDir, 'package.json'), 'utf-8'),
);
const version = packageJson.version;
const packageName = packageJson.name;
const esmPath = join(rootDir, 'demo', 'esm.html');
let esmContent = readFileSync(esmPath, 'utf-8');

esmContent = esmContent.replace(
	new RegExp(
		`${packageName}@[0-9.]+(?:-[0-9A-Za-z.-]+)?(?:[+][0-9A-Za-z.-]+)?/`,
		'g',
	),
	`${packageName}@${version}/`,
);

writeFileSync(esmPath, esmContent, 'utf-8');
console.log(`Updated demo/esm.html to version ${version}`);
