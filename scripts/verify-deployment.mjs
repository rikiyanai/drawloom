const [sha, endpoint = 'https://rikiworld.com/drawloom/'] = process.argv.slice(2);
if (!/^[a-f0-9]{40}$/.test(sha ?? '')) throw new Error('Provide the expected full source SHA');
const deadline = Date.now() + Number(process.env.DEPLOY_TIMEOUT_MS ?? 600000);
let lastError;
while (Date.now() < deadline) {
  try {
    const response = await fetch(new URL(`build-info.json?verify=${sha}-${Date.now()}`, endpoint), { cache: 'no-store', signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`Build receipt HTTP ${response.status}`);
    const receipt = await response.json();
    if (receipt.sha !== sha) throw new Error(`Still serving ${receipt.sha ?? 'an unknown SHA'}`);
    const page = await fetch(endpoint, { signal: AbortSignal.timeout(15000) });
    if (!page.ok) throw new Error(`App HTTP ${page.status}`);
    const html = await page.text();
    const assets = [...new Set([...html.matchAll(/(?:src|href)="([^" ]+\.(?:js|css)(?:\?[^" ]*)?)"/g)].map(match => match[1]))];
    if (!assets.length || !html.includes('drawloom')) throw new Error('Expected Drawloom page and assets');
    for (const asset of assets) {
      const result = await fetch(new URL(asset, endpoint), { method: 'HEAD', signal: AbortSignal.timeout(15000) });
      if (!result.ok) throw new Error(`Asset HTTP ${result.status}: ${asset}`);
    }
    console.log(`Verified ${sha} at ${endpoint} (${assets.length} assets)`);
    process.exit(0);
  } catch (error) { lastError = error; console.log(error.message); }
  await new Promise(resolve => setTimeout(resolve, Math.max(0, Math.min(10000, deadline - Date.now()))));
}
throw new Error(`Deployment did not become visible: ${lastError?.message}`);
