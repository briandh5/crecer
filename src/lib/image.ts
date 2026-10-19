/** Preparación de fotos en el navegador: se reducen y se convierten a JPEG antes de subirlas. */

export const MAX_PHOTO_SIDE = 1600;
const JPEG_QUALITY = 0.82;
const MAX_INPUT_BYTES = 30 * 1024 * 1024;

export class PhotoError extends Error {}

async function decode(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; close(): void }> {
  try {
    // Respeta la orientación EXIF (fotos del celular tomadas en vertical).
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.decoding = "async";
      img.src = url;
      await img.decode();
      return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => {} };
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

/** Devuelve un JPEG de, como máximo, 1600 px por lado (normalmente 150–400 KB). */
export async function preparePhoto(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new PhotoError("Ese archivo no es una imagen.");
  if (file.size > MAX_INPUT_BYTES) throw new PhotoError("La imagen es demasiado grande (máximo 30 MB).");

  let img;
  try {
    img = await decode(file);
  } catch {
    throw new PhotoError("No se pudo leer esa imagen. Prueba con una foto en formato JPG o PNG.");
  }
  try {
    const scale = Math.min(1, MAX_PHOTO_SIDE / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new PhotoError("Tu navegador no pudo procesar la imagen.");
    ctx.fillStyle = "#ffffff"; // los PNG con transparencia quedan sobre blanco
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img.source, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
    if (!blob) throw new PhotoError("No se pudo preparar la foto.");
    return blob;
  } finally {
    img.close();
  }
}
