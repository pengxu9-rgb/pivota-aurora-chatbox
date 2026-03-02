const DEFAULT_MAX_EDGE = 1024;
const DEFAULT_QUALITY = 0.8;
const DEFAULT_MAX_FILE_SIZE = 512 * 1024; // 512KB target

export interface CompressImageOptions {
  maxEdge?: number;
  quality?: number;
  maxFileSize?: number;
  mimeType?: 'image/jpeg' | 'image/webp';
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error('Canvas toBlob failed'));
        resolve(blob);
      },
      mimeType,
      quality,
    );
  });
}

export async function compressImage(
  file: File,
  options: CompressImageOptions = {},
): Promise<File> {
  const {
    maxEdge = DEFAULT_MAX_EDGE,
    quality = DEFAULT_QUALITY,
    maxFileSize = DEFAULT_MAX_FILE_SIZE,
    mimeType = 'image/jpeg',
  } = options;

  if (file.size <= maxFileSize && file.type === mimeType) {
    return file;
  }

  const img = await loadImage(file);
  const { naturalWidth: w, naturalHeight: h } = img;

  let targetW = w;
  let targetH = h;
  const longestEdge = Math.max(w, h);
  if (longestEdge > maxEdge) {
    const scale = maxEdge / longestEdge;
    targetW = Math.round(w * scale);
    targetH = Math.round(h * scale);
  }

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  ctx.drawImage(img, 0, 0, targetW, targetH);

  let blob = await canvasToBlob(canvas, mimeType, quality);

  if (blob.size > maxFileSize && quality > 0.5) {
    blob = await canvasToBlob(canvas, mimeType, 0.6);
  }

  const ext = mimeType === 'image/webp' ? '.webp' : '.jpg';
  const baseName = file.name?.replace(/\.[^.]+$/, '') || 'photo';
  return new File([blob], `${baseName}${ext}`, { type: mimeType, lastModified: Date.now() });
}
