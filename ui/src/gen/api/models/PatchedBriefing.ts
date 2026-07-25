/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { BriefingTypeEnum } from './BriefingTypeEnum';
import type { ChannelEnum } from './ChannelEnum';
/**
 * Read/write serializer for a briefing rule.
 *
 * ``created_by`` is the creator (owner of a private briefing). It is set by the
 * service on create and never rewritten, so it is read-only here.
 */
export type PatchedBriefing = {
    readonly id?: string;
    readonly household?: string;
    title?: string;
    prompt?: string;
    condition?: string;
    channel?: ChannelEnum;
    briefing_type?: BriefingTypeEnum;
    is_private?: boolean;
    is_active?: boolean;
    send_times?: Array<string>;
    weekdays?: Array<number>;
    readonly next_send_at?: string;
    readonly last_send?: string;
    readonly created_at?: string;
    readonly updated_at?: string;
    readonly created_by?: number | null;
    readonly created_by_name?: string;
};

