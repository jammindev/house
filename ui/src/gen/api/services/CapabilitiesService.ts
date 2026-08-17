/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class CapabilitiesService {
    /**
     * ``GET /api/capabilities/`` — l'état des capacités optionnelles.
     *
     * **Pas household-scopé, et c'est structurant** : les clés se configurent par
     * instance (le ``.env`` *est* le BYOK du self-hoster), jamais par foyer. Une
     * saisie de clé par foyer ferait de ``get_llm_client()`` une décision
     * d'appelant — ce que ``apps/agent/llm.py`` interdit explicitement — et n'aurait
     * de sens que le jour où quelqu'un héberge des foyers tiers.
     *
     * Authentifié quand même : la liste dit quels réglages manquent, ce qui est une
     * cartographie utile à qui cherche une porte. Elle n'expose **jamais** la
     * valeur d'une clé, seulement son nom et le fait qu'elle soit posée.
     * @returns any No response body
     * @throws ApiError
     */
    public static capabilitiesRetrieve(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/capabilities/',
        });
    }
}
