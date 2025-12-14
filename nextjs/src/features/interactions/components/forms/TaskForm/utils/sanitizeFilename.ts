export const sanitizeFilename = (value: string) => value.replace(/[^0-9a-zA-Z._-]/g, "_");

