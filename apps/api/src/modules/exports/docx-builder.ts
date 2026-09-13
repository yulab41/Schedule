import { PassThrough } from 'node:stream';

import archiver from 'archiver';

export interface DutyToken {
  readonly text: number | '-';
  readonly weekend?: boolean;
}

export interface DutyRow {
  readonly absenceTypes?: readonly string[];
  readonly memberName: string;
  readonly tokens: readonly DutyToken[];
}

export interface HeadNeckDocxPage {
  readonly firstDuty: readonly DutyRow[];
  readonly month: number;
  readonly roster: readonly { readonly first: string; readonly second: string }[];
  readonly thirdDuty: readonly [string, string];
  readonly year: number;
}

const NS =
  'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

export async function buildHeadNeckDocx(pages: readonly HeadNeckDocxPage[]): Promise<Buffer> {
  if (pages.length === 0) throw new Error('DOCX requires at least one month page.');
  const output = new PassThrough();
  const chunks: Buffer[] = [];
  output.on('data', (chunk: Buffer) => chunks.push(chunk));
  const completed = new Promise<void>((resolve, reject) => {
    output.on('end', resolve);
    output.on('error', reject);
  });
  const archive = archiver('zip', { zlib: { level: 6 } });
  archive.on('error', (error) => output.destroy(error));
  archive.pipe(output);
  archive.append(contentTypes(), { name: '[Content_Types].xml' });
  archive.append(packageRelationships(), { name: '_rels/.rels' });
  archive.append(documentRelationships(), { name: 'word/_rels/document.xml.rels' });
  archive.append(styles(), { name: 'word/styles.xml' });
  archive.append(settings(), { name: 'word/settings.xml' });
  archive.append(buildHeadNeckDocumentXml(pages), { name: 'word/document.xml' });
  archive.append(coreProperties(), { name: 'docProps/core.xml' });
  archive.append(appProperties(), { name: 'docProps/app.xml' });
  await archive.finalize();
  await completed;
  return Buffer.concat(chunks);
}

export function buildHeadNeckDocumentXml(pages: readonly HeadNeckDocxPage[]): string {
  const body = pages
    .map((page, index) => `${index === 0 ? '' : pageBreak()}${monthPage(page)}`)
    .join('');
  return xml(
    `<w:document ${NS}><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1020" w:right="1361" w:bottom="907" w:left="1587" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`,
  );
}

function monthPage(page: HeadNeckDocxPage): string {
  const maxColumns = Math.max(5, ...page.firstDuty.map((row) => row.tokens.length));
  const topWidths = [1971, ...Array.from({ length: maxColumns }, (_, i) => (i === 0 ? 994 : 995))];
  const topRows = page.firstDuty
    .map((row) => {
      const values = [
        nameCell(row),
        ...Array.from({ length: maxColumns }, (_, i) => tokenCell(row.tokens[i])),
      ];
      return tableRow(values, 669);
    })
    .join('');
  const roster = page.roster.slice(0, 7);
  const rosterRows = [
    tableRow(
      [
        textCell('一值', 15, 'left'),
        ...roster.map((item) => textCell(item.first, 14)),
        ...emptyCells(7 - roster.length),
      ],
      748,
    ),
    tableRow(
      [
        textCell('二值', 15, 'left'),
        ...roster.map((item) => textCell(item.second, 14)),
        ...emptyCells(7 - roster.length),
      ],
      748,
    ),
  ].join('');
  const third = tableRow(
    [
      textCell('三值', 20, 'left'),
      textCell(page.thirdDuty[0], 20),
      textCell(page.thirdDuty[1], 20),
      textCell('', 20),
    ],
    709,
  );
  return [
    paragraph(`${page.year} 头颈值班 ${String(page.month).padStart(2, '0')} 月`, 24, 'center', {
      before: 200,
      after: 160,
    }),
    paragraph('一值', 22, 'left', { after: 120 }),
    table(topWidths, topRows, 'center'),
    breakParagraph(5),
    table([1020, 1106, 1106, 1106, 1106, 1106, 1106, 1106], rosterRows, 'left'),
    breakParagraph(1),
    table([851, 1983, 1417, 4507], third, 'left'),
  ].join('');
}

function nameCell(row: DutyRow): string {
  const normal = run(row.memberName, 22);
  const suffix =
    (row.absenceTypes ?? []).length === 0 ? '' : run(row.absenceTypes!.join('、'), 16, false, true);
  return cell(paragraphRuns(normal + suffix, 'left'));
}

function tokenCell(token: DutyToken | undefined): string {
  return textCell(token?.text ?? '', 16, 'center', token?.weekend === true);
}

function textCell(
  text: string | number,
  size: number,
  align: 'left' | 'center' = 'center',
  underline = false,
): string {
  return cell(paragraphRuns(run(String(text), size, underline), align));
}

function emptyCells(count: number): string[] {
  return Array.from({ length: count }, () => textCell('', 14));
}

function table(widths: readonly number[], rows: string, alignment: 'left' | 'center'): string {
  return `<w:tbl><w:tblPr><w:jc w:val="${alignment}"/><w:tblLayout w:type="fixed"/><w:tblBorders>${['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map((x) => `<w:${x} w:val="nil"/>`).join('')}</w:tblBorders></w:tblPr><w:tblGrid>${widths.map((w) => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>${rows}</w:tbl>`;
}

function tableRow(cells: readonly string[], height: number): string {
  return `<w:tr><w:trPr><w:trHeight w:val="${height}" w:hRule="exact"/></w:trPr>${cells.join('')}</w:tr>`;
}

function cell(content: string): string {
  return `<w:tc><w:tcPr><w:vAlign w:val="center"/><w:tcMar><w:top w:w="0" w:type="dxa"/><w:start w:w="0" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:end w:w="0" w:type="dxa"/></w:tcMar></w:tcPr>${content}</w:tc>`;
}

function paragraph(
  text: string,
  size: number,
  align: 'left' | 'center',
  spacing: { before?: number; after?: number } = {},
): string {
  return paragraphRuns(run(text, size), align, spacing);
}

function paragraphRuns(
  content: string,
  align: 'left' | 'center',
  spacing: { before?: number; after?: number } = {},
): string {
  return `<w:p><w:pPr><w:jc w:val="${align}"/><w:spacing w:before="${spacing.before ?? 0}" w:after="${spacing.after ?? 0}" w:line="240" w:lineRule="auto"/></w:pPr>${content}</w:p>`;
}

function run(text: string, size: number, underline = false, subscript = false): string {
  return `<w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="宋体"/><w:color w:val="000000"/><w:sz w:val="${size * 2}"/><w:szCs w:val="${size * 2}"/>${underline ? '<w:u w:val="single"/>' : ''}${subscript ? '<w:vertAlign w:val="subscript"/>' : ''}</w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
}

function pageBreak(): string {
  return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
}

function breakParagraph(lines: number): string {
  return `<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:r>${'<w:br/>'.repeat(lines)}</w:r></w:p>`;
}

function xml(body: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${body}`;
}
function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}
function contentTypes(): string {
  return xml(
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>',
  );
}
function packageRelationships(): string {
  return xml(
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>',
  );
}
function documentRelationships(): string {
  return xml(
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/></Relationships>',
  );
}
function styles(): string {
  return xml(
    `<w:styles ${NS}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="宋体"/><w:sz w:val="32"/><w:szCs w:val="32"/></w:rPr></w:rPrDefault><w:pPrDefault/></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:qFormat/></w:style></w:styles>`,
  );
}
function settings(): string {
  return xml(`<w:settings ${NS}><w:compat/><w:defaultTabStop w:val="708"/></w:settings>`);
}
function coreProperties(): string {
  return xml(
    '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>头颈值班表</dc:title></cp:coreProperties>',
  );
}
function appProperties(): string {
  return xml(
    '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Schedule</Application></Properties>',
  );
}
