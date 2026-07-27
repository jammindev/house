/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Serializer for zones.
 *
 * Les compteurs de contenu (`equipment_count`, `open_task_count`,
 * `active_project_count`, `children_count`) sont lus depuis l'annotation posée
 * par ``zones.queries.with_content_counts`` — c'est le chemin normal. Le repli
 * par requête n'existe que pour les instances non annotées (création, détail
 * récupéré via `get_object`) ; il ne doit jamais devenir le chemin d'une liste,
 * sinon on retombe sur un N+1 par zone.
 */
export type Zone = {
    readonly id: string;
    readonly household: string;
    name: string;
    parent?: string | null;
    readonly parent_name: string;
    note?: string;
    surface?: string | null;
    /**
     * Hex color code for zone display
     */
    color?: string;
    readonly position: number;
    readonly full_path: string;
    readonly depth: string;
    readonly children_count: string;
    readonly equipment_count: string;
    readonly open_task_count: string;
    readonly active_project_count: string;
    readonly created_at: string;
    readonly updated_at: string;
    readonly created_by: number | null;
    readonly updated_by: number | null;
};

