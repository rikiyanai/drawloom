import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { staticServer } from './serve-static.mjs';

async function fixture(run) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'drawloom-static-'));
  const root = path.join(directory, 'out');
  await mkdir(path.join(root, '_next'), { recursive: true });
  await writeFile(path.join(root, 'index.html'), '<title>drawloom</title><script src="/drawloom/_next/app.js"></script>');
  await writeFile(path.join(root, '_next/app.js'), 'console.log("drawloom")');
  await writeFile(path.join(directory, 'private.txt'), 'must not be served');
  const server = staticServer(root).listen(0, '127.0.0.1');
  await once(server, 'listening');
  try { await run({ root, endpoint: `http://127.0.0.1:${server.address().port}/drawloom/` }); }
  finally { await new Promise(resolve => server.close(resolve)); await rm(directory, { recursive: true, force: true }); }
}

test('static export uses /drawloom for documents and assets, supports HEAD and rejects outside paths', () => fixture(async ({ endpoint }) => {
  assert.equal((await fetch(endpoint)).status, 200);
  const asset = await fetch(endpoint + '_next/app.js', { method: 'HEAD' });
  assert.equal(asset.status, 200);
  assert.match(asset.headers.get('content-type'), /javascript/);
  assert.equal(await asset.text(), '');
  assert.equal((await fetch(new URL('/_next/app.js', endpoint))).status, 404);
  assert.equal((await fetch(endpoint + '%2e%2e%5cprivate.txt')).status, 404);
  assert.equal((await fetch(endpoint + 'missing.js')).status, 404);
}));

function verify(sha, endpoint) {
  return new Promise(resolve => {
    const process = spawn(globalThis.process.execPath, ['scripts/verify-deployment.mjs', sha, endpoint], { env: { ...globalThis.process.env, DEPLOY_TIMEOUT_MS: '100' }, stdio: 'pipe' });
    let output = '';
    process.stdout.on('data', data => output += data);
    process.stderr.on('data', data => output += data);
    process.on('exit', code => resolve({ code, output }));
  });
}

test('public verification requires the exact source receipt and all app assets', () => fixture(async ({ root, endpoint }) => {
  const sha = 'a'.repeat(40);
  await writeFile(path.join(root, 'build-info.json'), JSON.stringify({ sha }));
  assert.equal((await verify(sha, endpoint)).code, 0);
  const stale = await verify('b'.repeat(40), endpoint);
  assert.notEqual(stale.code, 0);
  assert.match(stale.output, /Still serving/);
  await rm(path.join(root, '_next/app.js'));
  const missing = await verify(sha, endpoint);
  assert.notEqual(missing.code, 0);
  assert.match(missing.output, /Asset HTTP 404/);
}));
