/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Household } from '../models/Household';
import type { HouseholdDetail } from '../models/HouseholdDetail';
import type { HouseholdInvitation } from '../models/HouseholdInvitation';
import type { PatchedHousehold } from '../models/PatchedHousehold';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class HouseholdsService {
    /**
     * ViewSet for household CRUD operations.
     *
     * List: Returns households the user is a member of
     * Create: Creates new household and enrolls user as owner
     * Retrieve: Gets household details with members
     * Update: Only owners can update
     * Delete: Only owners can delete
     * @returns Household
     * @throws ApiError
     */
    public static householdsList(): CancelablePromise<Array<Household>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/households/',
        });
    }
    /**
     * Create household and enroll creator as owner.
     * Mimics create_household_with_owner RPC from Supabase.
     * @param requestBody
     * @returns Household
     * @throws ApiError
     */
    public static householdsCreate(
        requestBody: Household,
    ): CancelablePromise<Household> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/households/',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * ViewSet for household CRUD operations.
     *
     * List: Returns households the user is a member of
     * Create: Creates new household and enrolls user as owner
     * Retrieve: Gets household details with members
     * Update: Only owners can update
     * Delete: Only owners can delete
     * @param id
     * @returns HouseholdDetail
     * @throws ApiError
     */
    public static householdsRetrieve(
        id: string,
    ): CancelablePromise<HouseholdDetail> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/households/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * ViewSet for household CRUD operations.
     *
     * List: Returns households the user is a member of
     * Create: Creates new household and enrolls user as owner
     * Retrieve: Gets household details with members
     * Update: Only owners can update
     * Delete: Only owners can delete
     * @param id
     * @param requestBody
     * @returns Household
     * @throws ApiError
     */
    public static householdsUpdate(
        id: string,
        requestBody: Household,
    ): CancelablePromise<Household> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/households/{id}/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * ViewSet for household CRUD operations.
     *
     * List: Returns households the user is a member of
     * Create: Creates new household and enrolls user as owner
     * Retrieve: Gets household details with members
     * Update: Only owners can update
     * Delete: Only owners can delete
     * @param id
     * @param requestBody
     * @returns Household
     * @throws ApiError
     */
    public static householdsPartialUpdate(
        id: string,
        requestBody?: PatchedHousehold,
    ): CancelablePromise<Household> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/households/{id}/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Soft-delete: mark as archived instead of removing from DB.
     * Only owners can archive (enforced by get_permissions).
     * @param id
     * @returns void
     * @throws ApiError
     */
    public static householdsDestroy(
        id: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/households/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * Pending invitation links of this household (owner only) — to copy or revoke.
     * @param id
     * @returns Household
     * @throws ApiError
     */
    public static householdsInvitationsRetrieve2(
        id: string,
    ): CancelablePromise<Household> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/households/{id}/invitations/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * Create an invitation link for this household.
     *
     * `email` is **optional** — the owner shares the returned `join_url`
     * themselves, so a link addressed to nobody in particular is legitimate.
     * When the address does have a House account, an in-app notification goes
     * out on top of the link.
     * @param id
     * @param requestBody
     * @returns Household
     * @throws ApiError
     */
    public static householdsInviteCreate(
        id: string,
        requestBody: Household,
    ): CancelablePromise<Household> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/households/{id}/invite/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Leave a household.
     * Prevents last owner from leaving (mimics Supabase leave_household RPC).
     * @param id
     * @param requestBody
     * @returns Household
     * @throws ApiError
     */
    public static householdsLeaveCreate(
        id: string,
        requestBody: Household,
    ): CancelablePromise<Household> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/households/{id}/leave/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Get all members of a household.
     * @param id
     * @returns Household
     * @throws ApiError
     */
    public static householdsMembersRetrieve(
        id: string,
    ): CancelablePromise<Household> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/households/{id}/members/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * Remove a member from household (owner only).
     * @param id
     * @param requestBody
     * @returns Household
     * @throws ApiError
     */
    public static householdsRemoveMemberCreate(
        id: string,
        requestBody: Household,
    ): CancelablePromise<Household> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/households/{id}/remove_member/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Kill a shared link (owner only). A leaked link must be stoppable.
     * @param id
     * @param requestBody
     * @returns Household
     * @throws ApiError
     */
    public static householdsRevokeInvitationCreate(
        id: string,
        requestBody: Household,
    ): CancelablePromise<Household> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/households/{id}/revoke-invitation/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Update a member role in household (owner only).
     * @param id
     * @param requestBody
     * @returns Household
     * @throws ApiError
     */
    public static householdsUpdateRoleCreate(
        id: string,
        requestBody: Household,
    ): CancelablePromise<Household> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/households/{id}/update_role/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Get members of the active household (resolved by middleware, no ID required).
     * @returns Household
     * @throws ApiError
     */
    public static householdsActiveMembersRetrieve(): CancelablePromise<Household> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/households/active-members/',
        });
    }
    /**
     * ViewSet for the invited user to list, accept, or decline pending invitations.
     * Only the invited user sees their own invitations.
     * @returns HouseholdInvitation
     * @throws ApiError
     */
    public static householdsInvitationsList(): CancelablePromise<Array<HouseholdInvitation>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/households/invitations/',
        });
    }
    /**
     * ViewSet for the invited user to list, accept, or decline pending invitations.
     * Only the invited user sees their own invitations.
     * @param id
     * @returns HouseholdInvitation
     * @throws ApiError
     */
    public static householdsInvitationsRetrieve(
        id: string,
    ): CancelablePromise<HouseholdInvitation> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/households/invitations/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * Accept an invitation.
     * Body: {"switch": true} optionally switches active_household_id to the new household.
     * @param id
     * @param requestBody
     * @returns HouseholdInvitation
     * @throws ApiError
     */
    public static householdsInvitationsAcceptCreate(
        id: string,
        requestBody?: HouseholdInvitation,
    ): CancelablePromise<HouseholdInvitation> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/households/invitations/{id}/accept/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Decline an invitation.
     * @param id
     * @param requestBody
     * @returns HouseholdInvitation
     * @throws ApiError
     */
    public static householdsInvitationsDeclineCreate(
        id: string,
        requestBody?: HouseholdInvitation,
    ): CancelablePromise<HouseholdInvitation> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/households/invitations/{id}/decline/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Public endpoint behind a shared invitation link — `/api/households/join/<token>/`.
     *
     * GET  previews the invitation so the visitor knows what they are joining.
     * POST joins: creates the account when nobody is logged in, or enrolls the
     * current user when somebody is.
     *
     * Deliberately `AllowAny`: the token *is* the credential. It is 32 random bytes
     * and single-use, and the endpoint is throttled per IP.
     * @param token
     * @returns any No response body
     * @throws ApiError
     */
    public static householdsJoinRetrieve(
        token: string,
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/households/join/{token}/',
            path: {
                'token': token,
            },
        });
    }
    /**
     * Public endpoint behind a shared invitation link — `/api/households/join/<token>/`.
     *
     * GET  previews the invitation so the visitor knows what they are joining.
     * POST joins: creates the account when nobody is logged in, or enrolls the
     * current user when somebody is.
     *
     * Deliberately `AllowAny`: the token *is* the credential. It is 32 random bytes
     * and single-use, and the endpoint is throttled per IP.
     * @param token
     * @returns any No response body
     * @throws ApiError
     */
    public static householdsJoinCreate(
        token: string,
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/households/join/{token}/',
            path: {
                'token': token,
            },
        });
    }
    /**
     * Switch the active household for the current user.
     * @param requestBody
     * @returns Household
     * @throws ApiError
     */
    public static householdsSwitchCreate(
        requestBody: Household,
    ): CancelablePromise<Household> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/households/switch/',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
}
