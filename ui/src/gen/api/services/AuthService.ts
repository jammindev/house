/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { TokenObtainPair } from '../models/TokenObtainPair';
import type { TokenRefresh } from '../models/TokenRefresh';
import type { TokenVerify } from '../models/TokenVerify';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class AuthService {
    /**
     * JWT login that also opens a Django session.
     *
     * Le SPA s'authentifie via `Authorization: Bearer <jwt>`, mais les requêtes
     * `<img src=...>` et `<a href=...>` vers `/media/...` partent sans ce header
     * (le navigateur n'envoie automatiquement que les cookies). Sans session,
     * `serve_protected_media` voit AnonymousUser → 401.
     *
     * Poser un cookie sessionid au moment du login JWT permet aux requêtes
     * natives de transporter l'auth. Les appels API gardent leur Bearer header.
     * @param requestBody
     * @returns TokenObtainPair
     * @throws ApiError
     */
    public static authTokenCreate(
        requestBody: TokenObtainPair,
    ): CancelablePromise<TokenObtainPair> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/auth/token/',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Takes a refresh type JSON web token and returns an access type JSON web
     * token if the refresh token is valid.
     * @param requestBody
     * @returns TokenRefresh
     * @throws ApiError
     */
    public static authTokenRefreshCreate(
        requestBody: TokenRefresh,
    ): CancelablePromise<TokenRefresh> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/auth/token/refresh/',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Takes a token and indicates if it is valid.  This view provides no
     * information about a token's fitness for a particular use.
     * @param requestBody
     * @returns TokenVerify
     * @throws ApiError
     */
    public static authTokenVerifyCreate(
        requestBody: TokenVerify,
    ): CancelablePromise<TokenVerify> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/auth/token/verify/',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
}
