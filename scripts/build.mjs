// CLI를 단일 파일로 번들하고 mermaid를 자산 폴더로 복사한다. 플러그인 사용자는 npm install을 하지 않기 때문이다.
import { copyFile, mkdir } from 'node:fs/promises';
import { build } from 'esbuild';

await build({
  entryPoints: ['skills/docent/scripts/src/docent.mjs'],
  outfile: 'skills/docent/scripts/dist/docent.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  // Playwright는 번들하지 않고 런타임에 설치된 곳에서 불러온다(lib/playwright.mjs)
  external: ['playwright', 'playwright-core'],
  legalComments: 'none',
  banner: {
    // 번들 안의 CommonJS 의존성(yaml 등)이 require('process') 같은 내장 모듈을 쓸 수 있게 한다.
    js: [
      '// 생성 파일입니다. 직접 고치지 말고 npm run build로 다시 만드세요.',
      "import { createRequire as __docentCreateRequire } from 'node:module';",
      'const require = __docentCreateRequire(import.meta.url);',
    ].join('\n'),
  },
  logLevel: 'warning',
});

await mkdir('skills/docent/assets', { recursive: true });
await copyFile('node_modules/mermaid/dist/mermaid.min.js', 'skills/docent/assets/mermaid.min.js');
await copyFile('node_modules/medium-zoom/dist/medium-zoom.min.js', 'skills/docent/assets/zoom.min.js');
console.log('번들 완료: skills/docent/scripts/dist/docent.mjs, skills/docent/assets/{mermaid,zoom}.min.js');
