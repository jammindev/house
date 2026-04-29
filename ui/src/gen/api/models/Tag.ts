/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { TagTypeEnum } from './TagTypeEnum';
export type Tag = {
    readonly id: string;
    readonly household: string;
    type?: TagTypeEnum;
    name: string;
    readonly created_at: string;
    readonly updated_at: string;
    readonly created_by: number | null;
    readonly updated_by: number | null;
};

