import { beforeEach, describe, expect, it, vi } from "vitest";

const imageCompressionMock = vi.hoisted(() => vi.fn());
vi.mock("browser-image-compression", () => ({
  default: imageCompressionMock,
}));

const pdfSaveMock = vi.hoisted(() => vi.fn());
const pdfLoadMock = vi.hoisted(() => vi.fn());
vi.mock("pdf-lib", () => ({
  PDFDocument: {
    load: pdfLoadMock,
  },
}));

import {
  buildDocumentMetadata,
  compressFileForUpload,
  ensureExtension,
  shouldCompressImage,
  shouldCompressPdf,
} from "./fileCompression";

const createFile = (size: number, name: string, type: string) =>
  new File([new Uint8Array(size)], name, { type, lastModified: Date.now() });

beforeEach(() => {
  vi.clearAllMocks();
  imageCompressionMock.mockResolvedValue(
    createFile(75_000, "compressed.webp", "image/webp")
  );
  pdfSaveMock.mockResolvedValue(new Uint8Array(120_000));
  pdfLoadMock.mockResolvedValue({ save: pdfSaveMock });
});

describe("shouldCompressImage", () => {
  it("returns true for large raster images", () => {
    const file = createFile(400_000, "photo.jpg", "image/jpeg");
    expect(shouldCompressImage(file)).toBe(true);
  });

  it("returns false for SVG or small files", () => {
    const svg = createFile(600_000, "vector.svg", "image/svg+xml");
    const tiny = createFile(10_000, "tiny.jpg", "image/jpeg");
    expect(shouldCompressImage(svg)).toBe(false);
    expect(shouldCompressImage(tiny)).toBe(false);
  });
});

describe("shouldCompressPdf", () => {
  it("returns true for large pdf files", () => {
    const pdf = createFile(600_000, "doc.pdf", "application/pdf");
    expect(shouldCompressPdf(pdf)).toBe(true);
  });
});

describe("ensureExtension", () => {
  it("replaces extension when needed", () => {
    expect(ensureExtension("photo.jpeg", "webp")).toBe("photo.webp");
    expect(ensureExtension("report", "pdf")).toBe("report.pdf");
  });
});

describe("compressFileForUpload", () => {
  it("compresses large images to webp", async () => {
    const original = createFile(500_000, "camera.png", "image/png");
    const result = await compressFileForUpload(original);
    const metadata = buildDocumentMetadata(original, result);

    expect(imageCompressionMock).toHaveBeenCalled();
    expect(result.wasCompressed).toBe(true);
    expect(result.file.type).toBe("image/webp");
    expect(result.file.name).toBe("camera.webp");
    expect(result.details?.algorithm).toBe("image/webp");
    expect(result.details?.originalBytes).toBe(500_000);
    expect(metadata.compression).not.toBeNull();
    expect(metadata.size).toBe(result.file.size);
  });

  it("compresses pdf files via pdf-lib", async () => {
    const pdf = createFile(700_000, "report.pdf", "application/pdf");
    const result = await compressFileForUpload(pdf);

    expect(pdfLoadMock).toHaveBeenCalled();
    expect(pdfSaveMock).toHaveBeenCalled();
    expect(result.wasCompressed).toBe(true);
    expect(result.details?.algorithm).toBe("pdf/object-stream");
  });

  it("returns original file when compression not needed", async () => {
    const tiny = createFile(10_000, "note.txt", "text/plain");
    const result = await compressFileForUpload(tiny);
    const metadata = buildDocumentMetadata(tiny, result);

    expect(imageCompressionMock).not.toHaveBeenCalled();
    expect(pdfLoadMock).not.toHaveBeenCalled();
    expect(result.wasCompressed).toBe(false);
    expect(result.file).toBe(tiny);
    expect(metadata.compression).toBeNull();
    expect(metadata.originalName).toBe("note.txt");
  });
});
