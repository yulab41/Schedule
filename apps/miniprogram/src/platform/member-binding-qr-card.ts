interface BindingQrCardDetails {
  readonly employeeCode?: string;
  readonly expiresAt: string;
  readonly groupCode: string;
  readonly groupName: string;
  readonly realName: string;
}

interface OffscreenImage {
  onload?: () => void;
  onerror?: () => void;
  src: string;
}

interface OffscreenCanvas {
  createImage(): OffscreenImage;
  getContext(type: '2d'): {
    fillStyle: string;
    font: string;
    textAlign: string;
    textBaseline: string;
    fillRect(x: number, y: number, width: number, height: number): void;
    fillText(text: string, x: number, y: number, maxWidth?: number): void;
    drawImage(image: OffscreenImage, x: number, y: number, width: number, height: number): void;
  };
  toDataURL(type: 'image/png'): string;
}

export async function composeMemberBindingQrCard(
  imageSrc: string,
  details: BindingQrCardDetails,
): Promise<string> {
  const runtime = wx as unknown as {
    createOffscreenCanvas?: (options: {
      type: '2d';
      width: number;
      height: number;
    }) => OffscreenCanvas;
  };
  const canvas = runtime.createOffscreenCanvas?.({ type: '2d', width: 720, height: 1040 });
  if (!canvas) return imageSrc;
  const image = canvas.createImage();
  await new Promise<void>((resolve, reject) => {
    image.onload = resolve;
    image.onerror = () => reject(new Error('绑定二维码图片无法合成'));
    image.src = imageSrc;
  });
  const context = canvas.getContext('2d');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, 720, 1040);
  context.drawImage(image, 40, 30, 640, 640);
  context.textAlign = 'left';
  context.textBaseline = 'middle';
  context.fillStyle = '#17202a';
  context.font = '600 34px sans-serif';
  context.fillText(details.groupName, 54, 725, 612);
  context.font = '500 25px sans-serif';
  context.fillText(`群组码：${details.groupCode}`, 54, 785, 612);
  context.fillText(`姓名：${details.realName}`, 54, 830, 612);
  context.fillText(`工号：${details.employeeCode ?? '未设置'}`, 54, 875, 612);
  context.fillText(`有效至：${formatExpiry(details.expiresAt)}`, 54, 920, 612);
  context.fillStyle = '#b42318';
  context.font = '600 22px sans-serif';
  context.fillText('一次性微信绑定码，请勿公开', 54, 975, 612);
  return canvas.toDataURL('image/png');
}

function formatExpiry(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
