import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const targetPath = resolve(__dirname, '../src/environments/environment.prod.ts');

const rawApiUrl = (
  process.env.API_URL ||
  process.env.NG_APP_API_URL ||
  ''
)
  .trim()
  .replace(/\/+$/, '');

if (!rawApiUrl) {
  console.warn(
    '[set-env] WARNING: API_URL / NG_APP_API_URL is not set. Defaulting to http://localhost:8000.'
  );
}

const apiUrl = rawApiUrl || 'http://localhost:8000';
const content = `export const environment = {
  production: true,
  apiUrl: ${JSON.stringify(apiUrl)},
};
`;

mkdirSync(dirname(targetPath), { recursive: true });
writeFileSync(targetPath, content, 'utf8');
console.log(`[set-env] Generated ${targetPath} with apiUrl=${apiUrl}`);
