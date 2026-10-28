// @vitest-environment node
import { ESLint } from 'eslint';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';

/**
 * Proves that the Atomic Design rules in eslint.config.mjs actually fire. Each case lints a
 * virtual file at a given path that imports real modules from the app.
 */
const webDir = fileURLToPath(new URL('..', import.meta.url));
let eslint: ESLint;

beforeAll(() => {
  eslint = new ESLint({ cwd: webDir });
});

async function boundaryErrors(filePath: string, source: string): Promise<string[]> {
  const [result] = await eslint.lintText(`${source}\nexport {};\n`, { filePath });
  return (result?.messages ?? [])
    .filter((message) => message.ruleId?.startsWith('boundaries/'))
    .map((message) => message.ruleId as string);
}

const importButton = "import { Button } from '@/components/atoms/Button';";
const importButtonFile = "import { Button } from '@/components/atoms/Button/Button';";

describe('Atomic Design import rules', { timeout: 60_000 }, () => {
  it('forbids an atom importing another atom', async () => {
    expect(await boundaryErrors('src/components/atoms/Badge/Badge.tsx', importButton)).toEqual([
      'boundaries/dependencies',
    ]);
  });

  it('allows a molecule to import an atom through its index', async () => {
    expect(await boundaryErrors('src/components/molecules/Field/Field.tsx', importButton)).toEqual(
      [],
    );
  });

  it("forbids importing an atom's internal file instead of its index", async () => {
    expect(
      await boundaryErrors('src/components/molecules/Field/Field.tsx', importButtonFile),
    ).toEqual(['boundaries/dependencies']);
  });

  it.each(['organisms/Sidebar/Sidebar.tsx', 'templates/AppShell/AppShell.tsx'])(
    'allows %s to import an atom',
    async (file) => {
      expect(await boundaryErrors(`src/components/${file}`, importButton)).toEqual([]);
    },
  );

  it('allows pages to import components through their index only', async () => {
    expect(await boundaryErrors('src/app/jobs/page.tsx', importButton)).toEqual([]);
    expect(await boundaryErrors('src/app/jobs/page.tsx', importButtonFile)).toEqual([
      'boundaries/dependencies',
    ]);
  });

  it('allows every level to use lib helpers and external packages', async () => {
    const source = "import { cn } from '@/lib/cn';\nimport { useState } from 'react';";
    expect(await boundaryErrors('src/components/atoms/Badge/Badge.tsx', source)).toEqual([]);
  });

  it('keeps lib free of components', async () => {
    expect(await boundaryErrors('src/lib/format.ts', importButton)).toEqual([
      'boundaries/dependencies',
    ]);
  });

  it('rejects files outside the known folders', async () => {
    expect(await boundaryErrors('src/utils/helper.ts', '')).toEqual([
      'boundaries/no-unknown-files',
    ]);
  });
});
