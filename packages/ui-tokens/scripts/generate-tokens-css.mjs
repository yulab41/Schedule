import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { tokenGroups } from '../src/tokens.ts';

// tokens.css and tokens.wxss are checked-in artifacts derived from tokens.ts;
// editing token values never requires touching either stylesheet by hand.
function kebabCase(name) {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

function formatCssValue(group, value) {
  switch (group.format) {
    case 'hex':
      return String(value).toLowerCase();
    case 'px':
      return `${String(value)}px`;
    default:
      return String(value);
  }
}

function renderTokensStylesheet(selector) {
  const groupBlocks = tokenGroups.map((group) =>
    Object.entries(group.tokens)
      .map(
        ([name, value]) =>
          `  ${group.cssPrefix}${kebabCase(name)}: ${formatCssValue(group, value)};`,
      )
      .join('\n'),
  );
  return `${selector} {\n${groupBlocks.join('\n\n')}\n}\n`;
}

function readFormat() {
  const argument = process.argv.find((value) => value.startsWith('--format='));
  const format = argument?.slice('--format='.length) ?? 'css';
  if (format !== 'css' && format !== 'wxss') {
    throw new Error('format must be css or wxss');
  }
  return format;
}

const sourceDirectory = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const stylesheets = {
  css: renderTokensStylesheet(':root'),
  wxss: renderTokensStylesheet('page'),
};

// --stdout keeps the parity test read-only; without it the file is regenerated.
if (process.argv.includes('--stdout')) {
  process.stdout.write(stylesheets[readFormat()]);
} else {
  for (const [format, stylesheet] of Object.entries(stylesheets)) {
    const outputPath = join(sourceDirectory, `tokens.${format}`);
    writeFileSync(outputPath, stylesheet, 'utf8');
    console.log(`Regenerated ${outputPath}`);
  }
}
