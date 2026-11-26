#!/usr/bin/env node
/**
 * Run each Cypress spec in its own process, in parallel (local).
 * Usage: npm run cy:run:parallel [-- --workers=4] [-- --browser=chrome]
 */
import { spawn } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { cpus } from 'node:os';

const args = process.argv.slice(2);
const opt = (name, def) =>
  args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? def;

const workers = Math.max(1, Number(opt('workers', Math.min(4, cpus().length))));
const browser = opt('browser', 'chrome');

function findSpecs(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return findSpecs(p);
    return p.endsWith('.cy.ts') ? [p] : [];
  });
}

const specs = findSpecs('cypress/e2e').sort();
if (!specs.length) {
  console.error('No specs found under cypress/e2e');
  process.exit(1);
}

console.log(`Running ${specs.length} spec(s) with ${workers} worker(s)\n`);

const runSpec = (spec) =>
  new Promise((resolve) => {
    const out = [];
    const child = spawn(
      'npx',
      ['cypress', 'run', '--e2e', '--browser', browser, '--spec', spec],
      { env: process.env },
    );
    child.stdout.on('data', (d) => out.push(d));
    child.stderr.on('data', (d) => out.push(d));
    child.on('close', (code) => {
      // Print each spec's output as one block so logs don't interleave.
      console.log(`\n===== ${spec} (exit ${code}) =====\n${Buffer.concat(out)}`);
      resolve({ spec, code });
    });
  });

const queue = [...specs];
const results = [];
await Promise.all(
  Array.from({ length: Math.min(workers, specs.length) }, async () => {
    while (queue.length) results.push(await runSpec(queue.shift()));
  }),
);

const failed = results.filter((r) => r.code !== 0);
console.log(`\nSummary: ${results.length - failed.length}/${results.length} passed`);
failed.forEach((f) => console.log(`  FAILED: ${f.spec}`));
process.exit(failed.length ? 1 : 0);
