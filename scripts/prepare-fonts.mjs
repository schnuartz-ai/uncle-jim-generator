import { readFile, writeFile } from 'node:fs/promises';
const regular=await readFile(new URL('../public/fonts/NotoSans-Regular.ttf',import.meta.url));
const bold=await readFile(new URL('../public/fonts/NotoSans-Bold.ttf',import.meta.url));
await writeFile(new URL('../src/pdf/font-data.json',import.meta.url),JSON.stringify({regular:regular.toString('base64'),bold:bold.toString('base64')}));
