import eslintConfig from '@open-wc/eslint-config';
import eslintConfigPrettier from 'eslint-config-prettier';

export default [
	...eslintConfig,
	eslintConfigPrettier,
	{
		files: ['demo/code-examples.js'],
		rules: {
			'import-x/no-unresolved': ['error', { ignore: ['^https://'] }],
		},
	},
	{
		ignores: [
			'node_modules/**',
			'coverage/**',
			'**/*.html',
			'**/*.ts',
			'test-results/**',
			'playwright-report/**',
			'_site/**',
		],
	},
];
