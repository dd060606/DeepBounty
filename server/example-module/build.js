// build.js
const { build } = require('esbuild');

build({
    entryPoints: ['src/index.ts'],
    //Bundle the dependencies, except for @deepbounty/sdk
    bundle: true,
    platform: 'node',
    outfile: 'dist/index.js',
    format: 'cjs',
    minify: true,
    external: ['@deepbounty/sdk'],
}).catch(() => process.exit(1));
