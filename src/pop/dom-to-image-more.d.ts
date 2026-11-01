declare module 'dom-to-image-more' {
  interface Options {
    filter?: (node: Node) => boolean;
    bgcolor?: string;
    width?: number;
    height?: number;
    style?: Record<string, string>;
    quality?: number;
    scale?: number;
    imagePlaceholder?: string;
    cacheBust?: boolean;
  }

  function toSvg(node: Node, options?: Options): Promise<string>;
  function toPng(node: Node, options?: Options): Promise<string>;
  function toJpeg(node: Node, options?: Options): Promise<string>;
  function toBlob(node: Node, options?: Options): Promise<Blob>;
  function toPixelData(node: Node, options?: Options): Promise<Uint8ClampedArray>;

  const domToImage: {
    toSvg: typeof toSvg;
    toPng: typeof toPng;
    toJpeg: typeof toJpeg;
    toBlob: typeof toBlob;
    toPixelData: typeof toPixelData;
  };

  export default domToImage;
}
