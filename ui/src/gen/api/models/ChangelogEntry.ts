/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ChangeTypeEnum } from './ChangeTypeEnum';
export type ChangelogEntry = {
    readonly id: number;
    commit_sha: string;
    pr_number?: number | null;
    /**
     * Scope du commit conventionnel (ex: 'projects'), ou 'general'.
     */
    module: string;
    change_type: ChangeTypeEnum;
    /**
     * Phrase FR lisible, repolie par l'IA.
     */
    summary: string;
    /**
     * Sujet du commit d'origine.
     */
    raw_subject: string;
    committed_at: string;
};

