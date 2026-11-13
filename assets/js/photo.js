// FINORA — FOTO KONTAK
// Mengubah foto pilihan pengguna menjadi avatar persegi yang ringkas.

const MAX_FILE_BYTES = 12 * 1024 * 1024;
const OUTPUT_SIZE = 512;
const JPEG_QUALITY = 0.85;
const IMAGE_EXTENSION = /\.(avif|bmp|gif|heic|heif|jpe?g|png|webp)$/i;

export function validateImageFile(file) {
  if (!file) {
    return { valid: false, message: 'Pilih foto terlebih dahulu.' };
  }

  const hasImageType = String(file.type || '').startsWith('image/');
  const hasImageExtension = IMAGE_EXTENSION.test(String(file.name || ''));

  if (!hasImageType && !hasImageExtension) {
    return {
      valid: false,
      message: 'Berkas yang dipilih bukan gambar.'
    };
  }

  if (Number(file.size) > MAX_FILE_BYTES) {
    return {
      valid: false,
      message: 'Ukuran foto maksimal 12 MB.'
    };
  }

  return { valid: true, message: '' };
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () =>
      reject(new Error('Foto tidak dapat dibaca. Coba pilih foto lain.'));
    reader.readAsDataURL(file);
  });
}

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error('Format foto tidak didukung. Coba pilih foto lain.'));
    image.src = source;
  });
}

export async function fileToAvatarDataUrl(file) {
  const validation = validateImageFile(file);

  if (!validation.valid) {
    throw new Error(validation.message);
  }

  const source = await readFileAsDataUrl(file);
  const image = await loadImage(source);
  const width = Number(image.naturalWidth || image.width);
  const height = Number(image.naturalHeight || image.height);

  if (!width || !height) {
    throw new Error('Ukuran foto tidak dapat dibaca.');
  }

  const cropSize = Math.min(width, height);
  const sourceX = Math.max(0, (width - cropSize) / 2);
  const sourceY = Math.max(0, (height - cropSize) / 2);
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Foto tidak dapat diproses di perangkat ini.');
  }

  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  context.drawImage(
    image,
    sourceX,
    sourceY,
    cropSize,
    cropSize,
    0,
    0,
    OUTPUT_SIZE,
    OUTPUT_SIZE
  );

  const result = canvas.toDataURL('image/jpeg', JPEG_QUALITY);

  if (!result || result === 'data:,') {
    throw new Error('Foto gagal disiapkan. Coba pilih foto lain.');
  }

  return result;
}

export const PHOTO_LIMITS = {
  maxFileBytes: MAX_FILE_BYTES,
  outputSize: OUTPUT_SIZE
};
