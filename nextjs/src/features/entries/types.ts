export type ZoneOption = {
  id: string;
  name: string;
  parent_id?: string | null;
};

export type Entry = { id: string; raw_text: string; created_at: string; household_id?: string };
export type EntryFileType = "document" | "photo";
export type EntryFile = {
  id: string;
  entry_id: string;
  storage_path: string;
  mime_type: string | null;
  type: EntryFileType;
};
export type Preview = { url: string; kind: "image" | "pdf" };
