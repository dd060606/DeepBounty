import fs from 'fs';
import path from 'path';
import yaml from 'yaml';
import { build } from 'esbuild';

const cwd = process.cwd();
const modulesDir = path.join(cwd, 'modules');

// Look for module manifest file
function findManifest(moduleDir) {
    const candidates = ['module.yaml', 'module.yml']
        .map((f) => path.join(moduleDir, f));
    return candidates.find((p) => fs.existsSync(p)) || null;
}

function ensureDir(dir) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function buildOne(moduleDir) {
    const name = path.basename(moduleDir);
    const manifestPath = findManifest(moduleDir);
    // Check if manifest exists, otherwise it's not a valid module
    if (!manifestPath) {
        console.warn(`[build-modules] ${name}: manifest not found, ignored.`);
        return false;
    }

    const manifest = yaml.parse(fs.readFileSync(manifestPath, 'utf8')) || {};

    // Default source file: index.ts at module root
    const sources = [path.join(moduleDir, 'index.ts'), path.join(moduleDir, 'src', 'index.ts')];
    // Check if source file exists
    const entrySource = sources.find((p) => fs.existsSync(p));
    if (!entrySource) {
        console.warn(`[build-modules] ${name}: no source found (index.ts), ignored.`);
        return false;
    }

    // Output based on the manifest (default dist/index.js)
    let entryOut = typeof manifest.entry === 'string' && manifest.entry.endsWith('.js')
        ? manifest.entry
        : 'dist/index.js';

    const outfile = path.join(moduleDir, entryOut);
    ensureDir(path.dirname(outfile));

    console.log(`[build-modules] ${name}: ${path.relative(moduleDir, entrySource)} -> ${path.relative(moduleDir, outfile)}`);

    // Build with esbuild
    await build({
        entryPoints: [entrySource],
        outfile,
        platform: 'node',
        target: 'node22',
        format: 'cjs',
        sourcemap: false,
        bundle: false,
        logLevel: 'info',
        // Do not bundle dependencies
        external: [],
    });

    return true;
}

async function main() {
    if (!fs.existsSync(modulesDir)) {
        console.warn(`[build-modules] Module directory not found: ${modulesDir}`);
        return;
    }
    // Read all entries in modules directory
    const entries = fs.readdirSync(modulesDir);
    let ok = 0, ko = 0;
    for (const d of entries) {
        const moduleDir = path.join(modulesDir, d);
        if (!fs.statSync(moduleDir).isDirectory()) continue;
        try {
            // Build the module
            const res = await buildOne(moduleDir);
            if (res) ok++; else ko++;
        } catch (e) {
            console.error(`[build-modules] ${d}: compilation failed`, e);
            ko++;
        }
    }
    console.log(`[build-modules] Finished. Success: ${ok}, Failures: ${ko}`);
}

main().catch((e) => {
    console.error('[build-modules] Fatal error', e);
    process.exit(1);
});
