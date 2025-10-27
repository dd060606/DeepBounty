// build.js
const { build } = require('esbuild');
const fs = require('fs');
const path = require('path');

const srcModule = path.resolve(__dirname, 'module.yml');
const outModule = path.resolve(__dirname, 'dist', 'module.yml');

build({
    entryPoints: ['src/index.ts'],
    // Bundle the dependencies, except for @deepbounty/sdk
    bundle: true,
    platform: 'node',
    outfile: 'dist/index.js',
    format: 'cjs',
    minify: true,
    external: ['@deepbounty/sdk'],
}).then(() => {
    // Ensure dist folder exists, then copy module.yml
    fs.mkdirSync(path.dirname(outModule), { recursive: true });
    if (fs.existsSync(srcModule)) {
        fs.copyFileSync(srcModule, outModule);
    }
}).catch(() => process.exit(1));
