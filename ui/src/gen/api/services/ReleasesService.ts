/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ChangelogEntry } from '../models/ChangelogEntry';
import type { PaginatedChangelogEntryList } from '../models/PaginatedChangelogEntryList';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class ReleasesService {
    /**
     * Liste des changements livrés en prod + état de la dernière génération.
     * @param changeType * `feat` - Nouveauté
     * * `fix` - Correction
     * * `perf` - Performance
     * @param limit Number of results to return per page.
     * @param module
     * @param offset The initial index from which to return the results.
     * @param ordering Which field to use when ordering the results.
     * @returns PaginatedChangelogEntryList
     * @throws ApiError
     */
    public static releasesChangelogList(
        changeType?: 'feat' | 'fix' | 'perf',
        limit?: number,
        module?: string,
        offset?: number,
        ordering?: string,
    ): CancelablePromise<PaginatedChangelogEntryList> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/releases/changelog/',
            query: {
                'change_type': changeType,
                'limit': limit,
                'module': module,
                'offset': offset,
                'ordering': ordering,
            },
        });
    }
    /**
     * Liste des changements livrés en prod + état de la dernière génération.
     * @param id A unique integer value identifying this Entrée de changelog.
     * @returns ChangelogEntry
     * @throws ApiError
     */
    public static releasesChangelogRetrieve(
        id: number,
    ): CancelablePromise<ChangelogEntry> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/releases/changelog/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * État live : SHA + date du tip de main à la dernière génération.
     * @returns ChangelogEntry
     * @throws ApiError
     */
    public static releasesChangelogStateRetrieve(): CancelablePromise<ChangelogEntry> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/releases/changelog/state/',
        });
    }
}
