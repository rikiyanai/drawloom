import { build } from 'esbuild';
import { mkdir, cp, writeFile, readFile } from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const destination=process.argv[2];
if(!destination)throw Error('Provide the Studio tools/hatch-studio/drawloom-engine output directory.');
const outdir=path.resolve(destination);await mkdir(outdir,{recursive:true});
const bundle=await build({entryPoints:{'portrait-engine':path.join(root,'src/lib/photo-workspace/studio-engine.ts')},outdir,bundle:true,metafile:true,splitting:true,format:'esm',platform:'browser',target:'es2022',minify:true,legalComments:'eof',
  define:{'process.env.NEXT_PUBLIC_BASE_PATH':'STUDIO_ASSET_BASE','process.env.NEXT_PUBLIC_DRAWLOOM_PLANES':'"1"'},inject:[path.join(root,'scripts/studio-engine-assets.mjs')],logLevel:'info'});
for(const name of ['stnk20','teed','selfie-multiclass'])await cp(path.join(root,'public/models',name),path.join(outdir,'models',name),{recursive:true});
await writeFile(path.join(outdir,'build-manifest.json'),JSON.stringify({source:'src/lib/photo-workspace/studio-engine.ts',sourceSha256:createHash('sha256').update(await readFile(path.join(root,'src/lib/photo-workspace/studio-engine.ts'))).digest('hex'),files:Object.keys(bundle.metafile.outputs).map(file=>path.relative(outdir,path.resolve(file)).split(path.sep).join('/'))},null,2)+'\n');
await writeFile(path.join(outdir,'README.txt'),'Drawloom construction engine for native Studio controls. No editor or project store.\nRebuild from Drawloom with: node scripts/build-studio-engine.mjs <Studio tools/hatch-studio/drawloom-engine>\nPinned model licenses and provenance accompany each model.\n');
