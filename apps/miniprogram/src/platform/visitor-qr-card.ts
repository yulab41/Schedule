interface OffscreenImage {
  onload?: () => void;
  onerror?: () => void;
  src: string;
}

interface OffscreenCanvas {
  readonly width: number;
  readonly height: number;
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

export async function composeVisitorQrCard(imageSrc: string, groupName: string): Promise<string> {
  const runtime = wx as unknown as {
    createOffscreenCanvas?: (options: {
      type: '2d';
      width: number;
      height: number;
    }) => OffscreenCanvas;
  };
  const canvas = runtime.createOffscreenCanvas?.({ type: '2d', width: 720, height: 840 });
  if (!canvas) return imageSrc;
  const image = canvas.createImage();
  await new Promise<void>((resolve, reject) => {
    image.onload = resolve;
    image.onerror = () => reject(new Error('二维码图片无法合成'));
    image.src = imageSrc;
  });
  const context = canvas.getContext('2d');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, 720, 840);
  context.drawImage(image, 40, 40, 640, 640);
  context.fillStyle = '#17202a';
  context.font = '600 36px sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(groupName.trim() || '访客排班', 360, 755, 640);
  return canvas.toDataURL('image/png');
}
