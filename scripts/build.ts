import 'zx/globals';

import { build } from 'tsup';

fs.removeSync('dist');

await build({
	entry: ['src/index.ts'],
	splitting: false,
	sourcemap: true,
	dts: true,
	format: ['cjs', 'esm'],
	outExtension(ctx) {
		if (ctx.format === 'cjs') {
			return {
				dts: '.d.cts',
				js: '.cjs',
			};
		}
		return {
			dts: '.d.ts',
			js: '.js',
		};
	},
});

fs.copyFileSync('package.json', 'dist/package.json');
fs.copyFileSync('README.md', 'dist/README.md');
