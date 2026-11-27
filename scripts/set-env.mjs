import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const targetPath = resolve(__dirname, '../src/environments/environment.prod.ts');

const DEFAULT_PROD_API_URL = 'https://pale-graduation.onrender.com';

const rawApiUrl = (
  process.env.API_URL ||
  process.env.NG_APP_API_URL ||
  ''
)
  .trim()
  .replace(/\/+$/, '');

const apiUrl = rawApiUrl || DEFAULT_PROD_API_URL;
const content = `export const environment = {
  production: true,
  apiUrl: ${JSON.stringify(apiUrl)},
};
`;

mkdirSync(dirname(targetPath), { recursive: true });
writeFileSync(targetPath, content, 'utf8');
console.log(`[set-env] Generated ${targetPath} with apiUrl=${apiUrl}`);
