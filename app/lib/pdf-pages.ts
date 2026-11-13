const RENDER_WIDTH = 1224;

export async function pdfPageImages(bytes: ArrayBuffer) {
  const { getDocumentProxy } = await import("unpdf");
  const doc = await getDocumentProxy(new Uint8Array(bytes));
  try {
    const pages: string[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const viewport = page.getViewport({ scale: RENDER_WIDTH / page.getViewport({ scale: 1 }).width });
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const context = canvas.getContext("2d")!;
      context.fillStyle = "#fff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvas, canvasContext: context, viewport }).promise;
      pages.push(canvas.toDataURL());
    }
    return pages;
  } finally {
    await doc.loadingTask.destroy();
  }
}
