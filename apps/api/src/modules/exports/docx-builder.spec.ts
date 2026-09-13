import { describe, expect, it } from 'vitest';

import { buildHeadNeckDocx, buildHeadNeckDocumentXml } from './docx-builder.js';

const september = {
  year: 2026,
  month: 9,
  firstDuty: [
    {
      memberName: '甲医生',
      tokens: [
        { text: 1 },
        { text: 7 },
        { text: 13, weekend: true },
        { text: 19, weekend: true },
        { text: 25 },
      ],
    },
    {
      memberName: '乙医生',
      absenceTypes: ['进修'],
      tokens: [
        { text: '-' as const },
        { text: '-' as const },
        { text: '-' as const },
        { text: '-' as const },
        { text: '-' as const },
      ],
    },
  ],
  roster: [
    { first: '甲医生', second: '丙医生' },
    { first: '乙医生', second: '丁医生' },
  ],
  thirdDuty: ['戊医生', '己医生'] as readonly [string, string],
};

describe('head-neck DOCX builder', () => {
  it('writes the approved page geometry, distributed columns, underline and absence subscript', () => {
    const xml = buildHeadNeckDocumentXml([september]);
    expect(xml).toContain('<w:pgSz w:w="11906" w:h="16838"/>');
    expect(xml).toContain('<w:pgMar w:top="1020" w:right="1361" w:bottom="907" w:left="1587"');
    expect(xml).toContain('<w:spacing w:before="0" w:after="120"');
    expect(xml).toContain('<w:gridCol w:w="1971"/><w:gridCol w:w="994"/>');
    expect(xml).toContain(
      '<w:gridCol w:w="851"/><w:gridCol w:w="1983"/><w:gridCol w:w="1417"/><w:gridCol w:w="4507"/>',
    );
    expect(xml).toContain('<w:u w:val="single"/>');
    expect(xml).toContain('<w:vertAlign w:val="subscript"/>');
    expect(xml).toContain('<w:t xml:space="preserve">进修</w:t>');
  });

  it('creates one hard page break between every month and a standard DOCX archive', async () => {
    const xml = buildHeadNeckDocumentXml(
      Array.from({ length: 12 }, (_, index) => ({ ...september, month: index + 1 })),
    );
    expect(xml.match(/<w:br w:type="page"\/>/gu)).toHaveLength(11);
    const file = await buildHeadNeckDocx([september]);
    expect(file.subarray(0, 4).toString('hex')).toBe('504b0304');
  });
});
