import type { InteractionContact, InteractionStructure } from "@interactions/types";

export function formatContactLabel(contact: InteractionContact) {
  const first = contact.first_name?.trim() ?? "";
  const last = contact.last_name?.trim() ?? "";
  const base = `${first} ${last}`.trim() || contact.structure?.name?.trim() || contact.id;

  const details: string[] = [];
  const position = contact.position?.trim();
  if (position) {
    details.push(position);
  }
  const structureName = contact.structure?.name?.trim();
  if (structureName) {
    const structureType = contact.structure?.type?.trim();
    details.push(structureType ? `${structureName} (${structureType})` : structureName);
  }

  return details.length ? `${base} • ${details.join(" • ")}` : base;
}

export function formatStructureLabel(structure: InteractionStructure) {
  const name = structure.name?.trim() ?? "";
  if (!name) return structure.id;
  const type = structure.type?.trim();
  return type ? `${name} (${type})` : name;
}
