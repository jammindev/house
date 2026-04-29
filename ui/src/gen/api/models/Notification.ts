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
    readonly is_read: boolean;
    readonly read_at: string | null;
    readonly created_at: string;
};

