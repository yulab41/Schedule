import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { tokenGroups } from '../src/tokens.ts';

// tokens.css is a checked-in artifact derived from tokens.ts; editing token values
// never requires touching the stylesheet by hand.
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

function renderTokensCss() {
  const groupBlocks = tokenGroups.map((group) =>
    Object.entries(group.tokens)
      .map(
        ([name, value]) =>
          `  ${group.cssPrefix}${kebabCase(name)}: ${formatCssValue(group, value)};`,
      )
      .join('\n'),
  );
  return `:root {\n${groupBlocks.join('\n\n')}\n}\n`;
}

const outputPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'tokens.css');

// --stdout keeps the parity test read-only; without it the file is regenerated.
if (process.argv.includes('--stdout')) {
  process.stdout.write(renderTokensCss());
} else {
  writeFileSync(outputPath, renderTokensCss(), 'utf8');
  console.log(`Regenerated ${outputPath}`);
}
