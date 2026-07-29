/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { NotificationTypeEnum } from './NotificationTypeEnum';
export type Notification = {
    readonly id: string;
    readonly type: NotificationTypeEnum;
    readonly title: string;
    readonly body: string;
    readonly payload: any;
    /**
     * In-app path this notification leads to. Per-row and not per-type: 'Bob finished Mow the lawn' points at that task, which a map keyed by type cannot express.
     */
    readonly url: string;
    readonly is_read: boolean;
    readonly read_at: string | null;
    readonly created_at: string;
};

