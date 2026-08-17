/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Interaction } from '../models/Interaction';
import type { InteractionContact } from '../models/InteractionContact';
import type { InteractionDetail } from '../models/InteractionDetail';
import type { InteractionDocument } from '../models/InteractionDocument';
import type { InteractionStructure } from '../models/InteractionStructure';
import type { PaginatedInteractionList } from '../models/PaginatedInteractionList';
import type { PatchedInteraction } from '../models/PatchedInteraction';
import type { PatchedInteractionContact } from '../models/PatchedInteractionContact';
import type { PatchedInteractionDocument } from '../models/PatchedInteractionDocument';
import type { PatchedInteractionStructure } from '../models/PatchedInteractionStructure';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class InteractionsService {
    /**
     * @returns InteractionContact
     * @throws ApiError
     */
    public static interactionsInteractionContactsList(): CancelablePromise<Array<InteractionContact>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/interactions/interaction-contacts/',
        });
    }
    /**
     * @param requestBody
     * @returns InteractionContact
     * @throws ApiError
     */
    public static interactionsInteractionContactsCreate(
        requestBody: InteractionContact,
    ): CancelablePromise<InteractionContact> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/interactions/interaction-contacts/',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * @param id
     * @returns InteractionContact
     * @throws ApiError
     */
    public static interactionsInteractionContactsRetrieve(
        id: string,
    ): CancelablePromise<InteractionContact> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/interactions/interaction-contacts/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * @param id
     * @param requestBody
     * @returns InteractionContact
     * @throws ApiError
     */
    public static interactionsInteractionContactsUpdate(
        id: string,
        requestBody: InteractionContact,
    ): CancelablePromise<InteractionContact> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/interactions/interaction-contacts/{id}/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * @param id
     * @param requestBody
     * @returns InteractionContact
     * @throws ApiError
     */
    public static interactionsInteractionContactsPartialUpdate(
        id: string,
        requestBody?: PatchedInteractionContact,
    ): CancelablePromise<InteractionContact> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/interactions/interaction-contacts/{id}/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * @param id
     * @returns void
     * @throws ApiError
     */
    public static interactionsInteractionContactsDestroy(
        id: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/interactions/interaction-contacts/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * Interaction↔Document links, backed by the polymorphic DocumentLink.
     * @returns InteractionDocument
     * @throws ApiError
     */
    public static interactionsInteractionDocumentsList(): CancelablePromise<Array<InteractionDocument>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/interactions/interaction-documents/',
        });
    }
    /**
     * Interaction↔Document links, backed by the polymorphic DocumentLink.
     * @param requestBody
     * @returns InteractionDocument
     * @throws ApiError
     */
    public static interactionsInteractionDocumentsCreate(
        requestBody: InteractionDocument,
    ): CancelablePromise<InteractionDocument> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/interactions/interaction-documents/',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Interaction↔Document links, backed by the polymorphic DocumentLink.
     * @param id
     * @returns InteractionDocument
     * @throws ApiError
     */
    public static interactionsInteractionDocumentsRetrieve(
        id: string,
    ): CancelablePromise<InteractionDocument> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/interactions/interaction-documents/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * Interaction↔Document links, backed by the polymorphic DocumentLink.
     * @param id
     * @param requestBody
     * @returns InteractionDocument
     * @throws ApiError
     */
    public static interactionsInteractionDocumentsUpdate(
        id: string,
        requestBody: InteractionDocument,
    ): CancelablePromise<InteractionDocument> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/interactions/interaction-documents/{id}/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Interaction↔Document links, backed by the polymorphic DocumentLink.
     * @param id
     * @param requestBody
     * @returns InteractionDocument
     * @throws ApiError
     */
    public static interactionsInteractionDocumentsPartialUpdate(
        id: string,
        requestBody?: PatchedInteractionDocument,
    ): CancelablePromise<InteractionDocument> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/interactions/interaction-documents/{id}/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Interaction↔Document links, backed by the polymorphic DocumentLink.
     * @param id
     * @returns void
     * @throws ApiError
     */
    public static interactionsInteractionDocumentsDestroy(
        id: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/interactions/interaction-documents/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * @returns InteractionStructure
     * @throws ApiError
     */
    public static interactionsInteractionStructuresList(): CancelablePromise<Array<InteractionStructure>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/interactions/interaction-structures/',
        });
    }
    /**
     * @param requestBody
     * @returns InteractionStructure
     * @throws ApiError
     */
    public static interactionsInteractionStructuresCreate(
        requestBody: InteractionStructure,
    ): CancelablePromise<InteractionStructure> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/interactions/interaction-structures/',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * @param id
     * @returns InteractionStructure
     * @throws ApiError
     */
    public static interactionsInteractionStructuresRetrieve(
        id: string,
    ): CancelablePromise<InteractionStructure> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/interactions/interaction-structures/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * @param id
     * @param requestBody
     * @returns InteractionStructure
     * @throws ApiError
     */
    public static interactionsInteractionStructuresUpdate(
        id: string,
        requestBody: InteractionStructure,
    ): CancelablePromise<InteractionStructure> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/interactions/interaction-structures/{id}/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * @param id
     * @param requestBody
     * @returns InteractionStructure
     * @throws ApiError
     */
    public static interactionsInteractionStructuresPartialUpdate(
        id: string,
        requestBody?: PatchedInteractionStructure,
    ): CancelablePromise<InteractionStructure> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/interactions/interaction-structures/{id}/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * @param id
     * @returns void
     * @throws ApiError
     */
    public static interactionsInteractionStructuresDestroy(
        id: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/interactions/interaction-structures/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * Interaction CRUD with filtering by type, tags, zones, dates.
     * @param limit Number of results to return per page.
     * @param offset The initial index from which to return the results.
     * @param ordering Which field to use when ordering the results.
     * @param search A search term.
     * @returns PaginatedInteractionList
     * @throws ApiError
     */
    public static interactionsInteractionsList(
        limit?: number,
        offset?: number,
        ordering?: string,
        search?: string,
    ): CancelablePromise<PaginatedInteractionList> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/interactions/interactions/',
            query: {
                'limit': limit,
                'offset': offset,
                'ordering': ordering,
                'search': search,
            },
        });
    }
    /**
     * Interaction CRUD with filtering by type, tags, zones, dates.
     * @param requestBody
     * @returns Interaction
     * @throws ApiError
     */
    public static interactionsInteractionsCreate(
        requestBody: Interaction,
    ): CancelablePromise<Interaction> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/interactions/interactions/',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Interaction CRUD with filtering by type, tags, zones, dates.
     * @param id
     * @returns InteractionDetail
     * @throws ApiError
     */
    public static interactionsInteractionsRetrieve(
        id: string,
    ): CancelablePromise<InteractionDetail> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/interactions/interactions/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * Interaction CRUD with filtering by type, tags, zones, dates.
     * @param id
     * @param requestBody
     * @returns Interaction
     * @throws ApiError
     */
    public static interactionsInteractionsUpdate(
        id: string,
        requestBody: Interaction,
    ): CancelablePromise<Interaction> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/interactions/interactions/{id}/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Interaction CRUD with filtering by type, tags, zones, dates.
     * @param id
     * @param requestBody
     * @returns Interaction
     * @throws ApiError
     */
    public static interactionsInteractionsPartialUpdate(
        id: string,
        requestBody?: PatchedInteraction,
    ): CancelablePromise<Interaction> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/interactions/interactions/{id}/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Interaction CRUD with filtering by type, tags, zones, dates.
     * @param id
     * @returns void
     * @throws ApiError
     */
    public static interactionsInteractionsDestroy(
        id: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/interactions/interactions/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * PATCH /api/interactions/{id}/renovation/
     *
     * Edit a renovation log entry via the shared service. Every field optional;
     * zone_ids resyncs the M2M when provided.
     * @param id
     * @param requestBody
     * @returns Interaction
     * @throws ApiError
     */
    public static interactionsInteractionsRenovationPartialUpdate(
        id: string,
        requestBody?: PatchedInteraction,
    ): CancelablePromise<Interaction> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/interactions/interactions/{id}/renovation/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * POST /api/interactions/interactions/bulk-update/ — corriger un lot de dépenses.
     *
     * Body : ``{"ids": [...], "supplier": "…", "budget_id": "…"|null}``. Les deux
     * champs sont optionnels **mais pas simultanément** : une requête qui
     * n'exprime aucune intention ne peut pas répondre « 12 mises à jour ».
     *
     * Le lot est **atomique**. Un id inconnu, hors du foyer, ou qui n'est pas une
     * dépense fait échouer l'ensemble : écrire les huit ids valides en taisant
     * les quatre autres laisserait celui qui a lancé le lot sans moyen de savoir
     * ce qui a été fait, et aucun écran ne rattrape une écriture partielle.
     *
     * Et il applique **les mêmes règles que l'écriture unitaire** — catalogue de
     * fournisseurs, refus du budget global ou d'un autre foyer. Un chemin de
     * masse qui contournerait les validations du chemin unitaire serait une porte
     * ouverte sur des données que rien n'a vérifiées.
     * @param requestBody
     * @returns Interaction
     * @throws ApiError
     */
    public static interactionsInteractionsBulkUpdateCreate(
        requestBody: Interaction,
    ): CancelablePromise<Interaction> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/interactions/interactions/bulk-update/',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Group interactions by type with counts.
     * @returns Interaction
     * @throws ApiError
     */
    public static interactionsInteractionsByTypeRetrieve(): CancelablePromise<Interaction> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/interactions/interactions/by_type/',
        });
    }
    /**
     * POST /api/interactions/expenses/manual/
     *
     * Create an Interaction(type=expense) NOT linked to a domain object —
     * the user-typed `subject` is what gets stored. Used for ad-hoc expenses
     * (restaurant, cinema, gift…).
     * @param requestBody
     * @returns Interaction
     * @throws ApiError
     */
    public static interactionsInteractionsExpensesManualCreate(
        requestBody: Interaction,
    ): CancelablePromise<Interaction> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/interactions/interactions/expenses/manual/',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * GET /api/interactions/expenses/summary/?from=&to=&supplier=&kind=
     *
     * Aggregates expense interactions for the selected household over a
     * period. Defaults to the current calendar month when from/to are omitted.
     * @returns Interaction
     * @throws ApiError
     */
    public static interactionsInteractionsExpensesSummaryRetrieve(): CancelablePromise<Interaction> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/interactions/interactions/expenses/summary/',
        });
    }
    /**
     * POST /api/interactions/renovation/
     *
     * Create a renovation/decoration log entry (parcours 13): an Interaction
     * discriminated by metadata.kind="renovation", attachable to several zones
     * at once. Delegates to interactions.services.create_renovation_interaction.
     * @param requestBody
     * @returns Interaction
     * @throws ApiError
     */
    public static interactionsInteractionsRenovationCreate(
        requestBody: Interaction,
    ): CancelablePromise<Interaction> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/interactions/interactions/renovation/',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * GET /api/interactions/suppliers/ — le catalogue des fournisseurs du foyer.
     *
     * La table `Supplier`, dans l'ordre où elle sert : **le plus employé
     * d'abord**. Un tri alphabétique remettrait le magasin des courses
     * hebdomadaires derrière un achat unique d'il y a deux ans, ce qui rend le
     * select aussi lent à parcourir que le champ libre qu'il remplace.
     *
     * Le compte se calcule ici, en un `GROUP BY` sur la colonne texte, et n'est
     * **pas** dénormalisé sur la table : un compteur stocké est un compteur à
     * deux définitions dès la première suppression de dépense — même règle que le
     * « dépensé » d'un budget. Un fournisseur au catalogue mais jamais employé
     * (créé, puis la dépense annulée) sort avec `count: 0` et passe après les
     * autres ; il reste proposé, parce que l'avoir tapé une fois est déjà un
     * signe qu'on le retapera.
     *
     * Pas de pagination ni de recherche serveur : le filtrage se fait à la frappe
     * côté client, et un foyer compte ses fournisseurs en dizaines. Un
     * aller-retour par caractère coûterait plus cher que la liste entière.
     * @returns Interaction
     * @throws ApiError
     */
    public static interactionsInteractionsSuppliersRetrieve(): CancelablePromise<Interaction> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/interactions/interactions/suppliers/',
        });
    }
}
