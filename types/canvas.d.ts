declare module "canvas" {
  export function createCanvas(
    width: number,
    height: number
  ): {
    getContext(type: "2d"): CanvasRenderingContext2D | null;
    toBuffer(mime: string, options?: { quality?: number }): Buffer;
  };
}
