/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Document } from '../models/Document';
import type { DocumentDetail } from '../models/DocumentDetail';
import type { PatchedDocument } from '../models/PatchedDocument';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class DocumentsService {
    /**
     * Document CRUD with filtering by type, interaction, and search.
     * @param ordering Which field to use when ordering the results.
     * @param search A search term.
     * @returns Document
     * @throws ApiError
     */
    public static documentsDocumentsList(
        ordering?: string,
        search?: string,
    ): CancelablePromise<Array<Document>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/documents/documents/',
            query: {
                'ordering': ordering,
                'search': search,
            },
        });
    }
    /**
     * Document CRUD with filtering by type, interaction, and search.
     * @param requestBody
     * @returns Document
     * @throws ApiError
     */
    public static documentsDocumentsCreate(
        requestBody: Document,
    ): CancelablePromise<Document> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/documents/documents/',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Document CRUD with filtering by type, interaction, and search.
     * @param id
     * @returns DocumentDetail
     * @throws ApiError
     */
    public static documentsDocumentsRetrieve(
        id: string,
    ): CancelablePromise<DocumentDetail> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/documents/documents/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * Document CRUD with filtering by type, interaction, and search.
     * @param id
     * @param requestBody
     * @returns Document
     * @throws ApiError
     */
    public static documentsDocumentsUpdate(
        id: string,
        requestBody: Document,
    ): CancelablePromise<Document> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/documents/documents/{id}/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Document CRUD with filtering by type, interaction, and search.
     * @param id
     * @param requestBody
     * @returns Document
     * @throws ApiError
     */
    public static documentsDocumentsPartialUpdate(
        id: string,
        requestBody?: PatchedDocument,
    ): CancelablePromise<Document> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/documents/documents/{id}/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Document CRUD with filtering by type, interaction, and search.
     * @param id
     * @returns void
     * @throws ApiError
     */
    public static documentsDocumentsDestroy(
        id: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/documents/documents/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * Re-run text extraction on this document and persist the result.
     * @param id
     * @param requestBody
     * @returns Document
     * @throws ApiError
     */
    public static documentsDocumentsReprocessOcrCreate(
        id: string,
        requestBody: Document,
    ): CancelablePromise<Document> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/documents/documents/{id}/reprocess_ocr/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Remplace les zones d'un document : `{"zone_ids": [...]}`.
     *
     * Un seul appel, et non `detach(ancienne)` + `attach(nouvelle)` enchaînés par le
     * client : ranger une photo passerait par un état intermédiaire sans zone, et le
     * client devrait connaître les anciens liens pour les défaire.
     *
     * Une liste vide **efface** les zones — c'est un geste explicite, jamais l'effet
     * de bord d'un enregistrement.
     * @param id
     * @param requestBody
     * @returns Document
     * @throws ApiError
     */
    public static documentsDocumentsSetZonesCreate(
        id: string,
        requestBody: Document,
    ): CancelablePromise<Document> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/documents/documents/{id}/set_zones/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Ajoute des zones à un lot de documents : `{document_ids, zone_ids}`.
     *
     * **Le lot ajoute, il n'écrase pas** — voir `services.add_documents_zones`.
     * Une liste de zones vide est donc refusée : ce serait une destruction de masse
     * déguisée en raccourci, et le geste unitaire existe pour ça.
     *
     * **Tout ou rien** : un document invisible (autre foyer, privé d'un autre
     * membre) refuse le lot entier. En ranger la moitié sans le dire laisserait
     * l'utilisateur croire son tri fait.
     * @param requestBody
     * @returns Document
     * @throws ApiError
     */
    public static documentsDocumentsBulkAddZonesCreate(
        requestBody: Document,
    ): CancelablePromise<Document> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/documents/documents/bulk_add_zones/',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Group documents by type with counts.
     * @returns Document
     * @throws ApiError
     */
    public static documentsDocumentsByTypeRetrieve(): CancelablePromise<Document> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/documents/documents/by_type/',
        });
    }
    /**
     * Combien de photos par intention, dont « à trier ».
     *
     * Un endpoint à part, et pas un bloc de la réponse de `triage/` : la galerie
     * affiche ces compteurs en permanence, et les obtenir en chargeant une fenêtre de
     * photos ferait payer un écran de lecture au prix d'un écran de tri. C'est la
     * même exigence que les badges du Contrôle — un compteur reste un `COUNT(*)`.
     * @returns Document
     * @throws ApiError
     */
    public static documentsDocumentsPurposeCountsRetrieve(): CancelablePromise<Document> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/documents/documents/purpose_counts/',
        });
    }
    /**
     * Pose une intention sur un lot de photos : `{document_ids, purpose, overwrite}`.
     *
     * **Le lot n'écrase jamais un choix déjà fait.** Une grappe dont certaines photos
     * portent déjà une intention est le cas normal, pas l'exception : elle se range
     * sans toucher au travail déjà fait, et la réponse dit combien ont été laissées.
     * Écraser reste possible, mais c'est un geste explicite (`overwrite: true`) — même
     * règle que l'éditeur de ventilation, qui ne détache jamais par effet de bord.
     *
     * Une intention vide est **refusée** : « détrier » trente photos d'un coup serait
     * une destruction de masse déguisée en raccourci, et le geste unitaire existe pour
     * ça (PATCH sur la photo).
     *
     * **Tout ou rien** sur les identifiants, comme `bulk_add_zones` : en ranger la
     * moitié sans le dire laisserait l'utilisateur croire son tri fait.
     * @param requestBody
     * @returns Document
     * @throws ApiError
     */
    public static documentsDocumentsSetPurposeCreate(
        requestBody: Document,
    ): CancelablePromise<Document> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/documents/documents/set_purpose/',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Les photos que personne n'a rangées, **par grappes de session**.
     *
     * Trente photos rapportées d'un week-end forment une session, pas trente
     * décisions : une file qui demande trente gestes ne se vide jamais, et une file
     * qu'on ne vide jamais cesse d'être lue au bout d'une semaine.
     *
     * La fenêtre est bornée (`TRIAGE_WINDOW`) parce que `DocumentViewSet` n'est pas
     * encore paginé : sans elle, ce panneau chargerait toute la photothèque du foyer
     * — l'intégralité, puisque l'introduction du champ n'a rien backfillé.
     * @returns Document
     * @throws ApiError
     */
    public static documentsDocumentsTriageRetrieve(): CancelablePromise<Document> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/documents/documents/triage/',
        });
    }
    /**
     * Document CRUD with filtering by type, interaction, and search.
     * @param formData
     * @returns Document
     * @throws ApiError
     */
    public static documentsDocumentsUploadCreate(
        formData: Document,
    ): CancelablePromise<Document> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/documents/documents/upload/',
            formData: formData,
            mediaType: 'multipart/form-data',
        });
    }
}
