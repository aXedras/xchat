/**
 * Decodes an image File and re-encodes it as a downscaled JPEG data URL.
 * The resulting base64 stays small regardless of the source image size.
 */
export const fileToResizedDataUrl = (
  file: File,
  maxDimension = 256,
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const scale = Math.min(
        1,
        maxDimension / Math.max(image.width, image.height),
      );
      const width = Math.max(1, Math.round(image.width * scale));
      const height = Math.max(1, Math.round(image.height * scale));

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("Canvas context unavailable"));
        return;
      }

      context.drawImage(image, 0, 0, width, height);

      try {
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      } catch (error) {
        reject(error);
      }
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to decode image"));
    };

    image.src = objectUrl;
  });
};

/**
 * Validates if a file is an image with proper size
 */
export const validateImageFile = (
  file: File,
): { valid: boolean; message?: string } => {
  // Check if file is an image
  if (!file.type.startsWith("image/")) {
    return { valid: false, message: "File must be an image" };
  }

  // Check if file size is less than 5MB
  const maxSize = 5 * 1024 * 1024; // 5MB
  if (file.size > maxSize) {
    return { valid: false, message: "Image must be less than 5MB" };
  }

  return { valid: true };
};
