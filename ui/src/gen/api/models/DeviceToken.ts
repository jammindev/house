/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Un jeton d'appareil, **sans son secret** — il n'existe qu'à l'émission.
 */
export type DeviceToken = {
    readonly id: string;
    /**
     * Device name, chosen by the user (« iPhone de Ben »).
     */
    name: string;
    readonly created_at: string;
    readonly last_used_at: string | null;
    readonly revoked_at: string | null;
    readonly is_revoked: boolean;
};

