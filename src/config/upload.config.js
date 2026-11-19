export const uploadConfig = Object.freeze({
  maxFileSize: 25 * 1024 * 1024,
  allowedMimeTypes: [
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ],
  limits: {
    files: 5,
    fields: 10
  }
});
