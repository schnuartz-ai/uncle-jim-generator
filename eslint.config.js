import js from '@eslint/js';
import ts from 'typescript-eslint';
export default ts.config({ignores:['dist/**','node_modules/**','research/**','output/**','tmp/**','public/**']}, js.configs.recommended, ...ts.configs.recommended, {
  files:['**/*.{ts,tsx,js,mjs}'],
  languageOptions:{globals:{URL:'readonly',console:'readonly',process:'readonly',Buffer:'readonly',setTimeout:'readonly',clearTimeout:'readonly',fetch:'readonly',self:'readonly',navigator:'readonly',document:'readonly',window:'readonly',Worker:'readonly',Blob:'readonly',caches:'readonly',location:'readonly'}},
});
