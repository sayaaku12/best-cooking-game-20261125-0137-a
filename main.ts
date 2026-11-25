// Ember & Thyme — Rush Hour Kitchen: hand-in program (Node 22, stdlib only).
// Copies game/ + screenshots/ into the output dir and writes dossier.json
// with buildDossier from the kit's vendor/makefun-game.ts (unchanged).
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';

const caps = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 48 * 1024 * 1024,
  game_path_max_bytes: 1000,
};

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function countEntries(dir) {
  let files = 0, bytes = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      const sub = countEntries(full);
      files += sub.files; bytes += sub.bytes;
    } else if (entry.isFile()) {
      files += 1; bytes += statSync(full).size;
    }
  }
  return { files, bytes };
}

function handIn() {
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  const gameSrc = join(repoRoot, 'game');
  const shotsSrc = join(repoRoot, 'screenshots');
  if (!existsSync(gameSrc)) throw new Error('game/ is missing from the repository');
  if (!existsSync(shotsSrc)) throw new Error('screenshots/ is missing from the repository');
  cpSync(gameSrc, join(outDir, 'game'), { recursive: true });
  cpSync(shotsSrc, join(outDir, 'screenshots'), { recursive: true });
  const gameCount = countEntries(join(outDir, 'game'));
  const shotsCount = countEntries(join(outDir, 'screenshots'));
  const dossier = buildDossier(outDir, caps);
  if (dossier.length > 1.5 * 1024 * 1024) throw new Error('dossier.json exceeds the 1.5 MiB cap');
  writeFileSync(join(outDir, 'dossier.json'), dossier);
  console.log('hand-in OK');
  console.log('game files: ' + gameCount.files + ' (' + gameCount.bytes + ' bytes)');
  console.log('screenshots: ' + shotsCount.files + ' (' + shotsCount.bytes + ' bytes)');
  console.log('dossier.json sha256: ' + sha256(dossier));
  console.log('dossier.json bytes: ' + dossier.length);
}

handIn();
