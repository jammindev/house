import { readFileSync, statSync } from 'node:fs';

const manifest = JSON.parse(readFileSync('static/react/.vite/manifest.json', 'utf8'));
const entries = [
  ['documents', 'src/pages/documents/list.tsx', 130],
  ['document-new', 'src/pages/documents/new.tsx', 130],
  ['document-detail', 'src/pages/documents/detail.tsx', 160],
];

const failures = entries.flatMap(([name, key, limit]) => {
  const entry = manifest[key];
  if (!entry?.file) {
    return [`Missing manifest entry for ${name}`];
  }

  const sizeKb = statSync(`static/react/${entry.file}`).size / 1024;
  return sizeKb > limit
    ? [`${name} bundle ${sizeKb.toFixed(1)}KB exceeds ${limit}KB`]
    : [];
});

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('Document bundle budget OK');
