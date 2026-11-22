import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';

const sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error('Expected a complete source commit SHA');
await writeFile('out/build-info.json', JSON.stringify({ sha, builtAt: new Date().toISOString() }) + '\n');
console.log(`Build receipt: ${sha}`);
