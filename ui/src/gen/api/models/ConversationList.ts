/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Lightweight row for the conversation list (no messages).
 *
 * ``last_message_preview`` (the newest message's text, annotated in the view)
 * lets the sidebar show a one-line snippet under the title — a recency cue à la
 * ChatGPT/Claude without loading the whole thread.
 */
export type ConversationList = {
    readonly id: string;
    readonly title: string;
    readonly last_message_at: string | null;
    readonly created_at: string;
    readonly message_count: number;
    readonly last_message_preview: string;
};

