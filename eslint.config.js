import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier/flat';

export default tseslint.config(
	{ ignores: ['**/dist/**', '**/node_modules/**', 'backend/src/generated/**'] },
	...tseslint.configs.recommended,
	prettier,
	{
		rules: {
			'@typescript-eslint/no-explicit-any': 'error',
			'@typescript-eslint/consistent-type-imports': 'error',
			'@typescript-eslint/naming-convention': [
				'error',
				{
					selector: ['variableLike', 'import', 'classProperty', 'parameterProperty'],
					format: null,
					leadingUnderscore: 'allow',
					custom: { regex: '^.{2,}$', match: true },
				},
				{
					selector: ['typeAlias', 'typeParameter'],
					format: ['PascalCase'],
					prefix: ['T'],
					custom: { regex: '^[A-Z][A-Za-z0-9]*$', match: true },
				},
				{
					selector: 'interface',
					format: ['PascalCase'],
					prefix: ['I'],
					custom: { regex: '^[A-Z][A-Za-z0-9]*$', match: true },
				},
				{
					selector: 'enum',
					format: ['PascalCase'],
					prefix: ['E'],
					custom: { regex: '^[A-Z][A-Za-z0-9]*$', match: true },
				},
			],
			'no-restricted-syntax': [
				'error',
				{
					selector: 'ImportSpecifier[local.name=/^_*.$/]',
					message: 'Use a descriptive local import name with at least two characters.',
				},
			],
			curly: ['error', 'all'],
			eqeqeq: ['error', 'always'],
			'one-var': ['error', 'never'],
			'max-statements-per-line': ['error', { max: 1 }],
		},
	},
	{
		files: [
			'backend/src/**/*.ts',
			'backend/test/**/*.ts',
			'frontend/src/**/*.{ts,tsx}',
			'contracts/src/**/*.ts',
		],
		languageOptions: {
			parserOptions: {
				project: [
					'./backend/tsconfig.test.json',
					'./frontend/tsconfig.json',
					'./contracts/tsconfig.json',
				],
				tsconfigRootDir: import.meta.dirname,
			},
		},
		rules: {
			'@typescript-eslint/no-floating-promises': 'error',
			'@typescript-eslint/no-misused-promises': 'error',
		},
	},
	{
		files: ['backend/src/**/*.ts', 'frontend/src/**/*.{ts,tsx}', 'contracts/src/**/*.ts'],
		rules: {
			'no-restricted-imports': [
				'error',
				{
					patterns: [
						{
							regex: '^(?:\\.\\./|\\./[^/]+/)',
							message:
								'Use workspace-local @app/... across source directories; keep ./... for siblings.',
						},
						{
							regex: '^@app/.*\\.(?:[cm]?[jt]sx?)$',
							message:
								'Use extensionless @app/... imports; the build resolves ESM extensions.',
						},
						{
							regex: '^@/',
							message: 'Use @app/... instead of the legacy @/... alias.',
						},
					],
				},
			],
		},
	},
	{
		files: ['backend/test/**/*.ts'],
		rules: {
			'no-restricted-imports': [
				'error',
				{
					patterns: [
						{
							regex: '^(?:\\.\\./)+src/',
							message:
								'Import backend source through @app/... from integration tests.',
						},
						{
							regex: '^@app/.*\\.(?:[cm]?js|[cm]?ts)$',
							message: 'Use extensionless @app/... imports.',
						},
					],
				},
			],
		},
	},
	{
		...reactHooks.configs.flat.recommended,
		files: ['frontend/src/**/*.{ts,tsx}'],
	},
);
