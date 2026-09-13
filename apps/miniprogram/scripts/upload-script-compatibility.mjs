import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const sdkRoot = path.dirname(require.resolve('miniprogram-ci/package.json'));
const { bableCompile } = require(
  path.join(sdkRoot, 'dist/modules/corecompiler/summer/plugins/script_task/babel_script_task.js'),
);
const { getBabelHelperDepMap } = require(path.join(sdkRoot, 'dist/utils/babel_helper.js'));

// Use the pinned upload SDK, including its shipped helper inventory, not Node's Babel runtime.
export async function compileUploadScript(sourceCode, filename) {
  const result = await bableCompile(
    filename,
    { sourceCode, inputMap: false },
    {
      enhance: true,
      babelRoot: '@babel/runtime',
    },
  );
  const helpers = getBabelHelperDepMap();
  const imports = [...result.code.matchAll(/require\("([^"]+)"\)/gu)].map((match) => match[1]);
  for (const imported of imports) {
    const name = imported.split('@babel/runtime/helpers/')[1];
    if (
      name === undefined ||
      !Object.hasOwn(helpers, name) ||
      !existsSync(path.join(sdkRoot, 'dist/vendor/babel_runtime/helpers', name + '.js'))
    ) {
      throw new Error('Upload script has an unpackageable runtime dependency: ' + imported);
    }
  }
  return result.code;
}

export function requireUploadHelper(imported) {
  const name = imported.split('@babel/runtime/helpers/')[1];
  if (!name || !Object.hasOwn(getBabelHelperDepMap(), name)) {
    throw new Error('Unknown upload runtime helper: ' + imported);
  }
  return require(path.join(sdkRoot, 'dist/vendor/babel_runtime/helpers', name + '.js'));
}
