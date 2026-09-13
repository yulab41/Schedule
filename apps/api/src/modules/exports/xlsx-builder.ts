import { PassThrough } from 'node:stream';

import archiver from 'archiver';

export async function buildXlsx(
  rows: readonly (readonly (number | string | null)[])[],
  sheetName: string,
): Promise<Buffer> {
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
  archive.append(relationships(), { name: '_rels/.rels' });
  archive.append(workbook(sheetName), { name: 'xl/workbook.xml' });
  archive.append(workbookRelationships(), { name: 'xl/_rels/workbook.xml.rels' });
  archive.append(styles(), { name: 'xl/styles.xml' });
  archive.append(worksheet(rows), { name: 'xl/worksheets/sheet1.xml' });
  await archive.finalize();
  await completed;
  return Buffer.concat(chunks);
}

function worksheet(rows: readonly (readonly (number | string | null)[])[]): string {
  const body = rows
    .map(
      (row, rowIndex) =>
        `<row r="${rowIndex + 1}">${row
          .map((value, columnIndex) => cell(value, columnIndex, rowIndex))
          .join('')}</row>`,
    )
    .join('');
  const columnCount = Math.max(1, ...rows.map((row) => row.length));
  return xml(
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${columnName(columnCount)}${Math.max(1, rows.length)}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="${columnCount}" width="16" customWidth="1"/></cols><sheetData>${body}</sheetData><autoFilter ref="A1:${columnName(columnCount)}${Math.max(1, rows.length)}"/></worksheet>`,
  );
}

function cell(value: number | string | null, columnIndex: number, rowIndex: number): string {
  const reference = `${columnName(columnIndex + 1)}${rowIndex + 1}`;
  if (typeof value === 'number')
    return `<c r="${reference}" s="${rowIndex === 0 ? 1 : 0}"><v>${value}</v></c>`;
  const text = value === null ? '' : escapeXml(String(value));
  return `<c r="${reference}" t="inlineStr" s="${rowIndex === 0 ? 1 : 0}"><is><t xml:space="preserve">${text}</t></is></c>`;
}

function columnName(index: number): string {
  let value = index;
  let result = '';
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function xml(body: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${body}`;
}
function contentTypes(): string {
  return xml(
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
  );
}
function relationships(): string {
  return xml(
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
  );
}
function workbook(name: string): string {
  return xml(
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${escapeXml(name.slice(0, 31))}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
  );
}
function workbookRelationships(): string {
  return xml(
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
  );
}
function styles(): string {
  return xml(
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Microsoft YaHei"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Microsoft YaHei"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1769AA"/><bgColor indexed="64"/></patternFill></fill><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs></styleSheet>',
  );
}
