interface RuntimeStyleProbeRect {
  readonly width?: number;
}

interface RuntimeStyleProbeQuery {
  exec(): void;
  select(selector: string): {
    boundingClientRect(
      callback: (rect: RuntimeStyleProbeRect | undefined) => void,
    ): RuntimeStyleProbeQuery;
  };
}

interface RuntimeStyleProbeInstance {
  createSelectorQuery(): RuntimeStyleProbeQuery;
  triggerEvent(name: string, detail: Readonly<Record<string, unknown>>): void;
}

Component({
  lifetimes: {
    ready(this: RuntimeStyleProbeInstance): void {
      try {
        const query = this.createSelectorQuery();
        query
          .select('.runtime-style-probe__meter')
          .boundingClientRect((rect) => {
            this.triggerEvent('measure', {
              width:
                typeof rect?.width === 'number' && Number.isFinite(rect.width)
                  ? Math.round(rect.width * 100) / 100
                  : undefined,
            });
          })
          .exec();
      } catch {
        this.triggerEvent('measure', {});
      }
    },
  },
});
