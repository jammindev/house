/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { PatchedUser } from '../models/PatchedUser';
import type { User } from '../models/User';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class AccountsService {
    /**
     * Login endpoint that creates a Django authenticated session.
     * @returns any No response body
     * @throws ApiError
     */
    public static accountsAuthLoginCreate(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/accounts/auth/login/',
        });
    }
    /**
     * Logout endpoint that clears the Django authenticated session.
     * @returns any No response body
     * @throws ApiError
     */
    public static accountsAuthLogoutCreate(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/accounts/auth/logout/',
        });
    }
    /**
     * Request a password reset email.
     *
     * POST /api/accounts/auth/password-reset/
     * Body: { email }
     *
     * Always returns 200 — never reveals whether the email exists in the database.
     * If a user with that email exists, an email is sent with a reset link.
     * @returns any No response body
     * @throws ApiError
     */
    public static accountsAuthPasswordResetCreate(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/accounts/auth/password-reset/',
        });
    }
    /**
     * Confirm a password reset with token + new password.
     *
     * POST /api/accounts/auth/password-reset/confirm/
     * Body: { uid, token, new_password }
     * @returns any No response body
     * @throws ApiError
     */
    public static accountsAuthPasswordResetConfirmCreate(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/accounts/auth/password-reset/confirm/',
        });
    }
    /**
     * Lightweight me endpoint for SPA auth context.
     * @returns any No response body
     * @throws ApiError
     */
    public static accountsMeRetrieve(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/accounts/me/',
        });
    }
    /**
     * ViewSet for user CRUD operations.
     * @returns User
     * @throws ApiError
     */
    public static accountsUsersList(): CancelablePromise<Array<User>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/accounts/users/',
        });
    }
    /**
     * ViewSet for user CRUD operations.
     * @param requestBody
     * @returns User
     * @throws ApiError
     */
    public static accountsUsersCreate(
        requestBody: User,
    ): CancelablePromise<User> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/accounts/users/',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * ViewSet for user CRUD operations.
     * @param id A unique integer value identifying this user.
     * @returns User
     * @throws ApiError
     */
    public static accountsUsersRetrieve(
        id: number,
    ): CancelablePromise<User> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/accounts/users/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * ViewSet for user CRUD operations.
     * @param id A unique integer value identifying this user.
     * @param requestBody
     * @returns User
     * @throws ApiError
     */
    public static accountsUsersUpdate(
        id: number,
        requestBody: User,
    ): CancelablePromise<User> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/accounts/users/{id}/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * ViewSet for user CRUD operations.
     * @param id A unique integer value identifying this user.
     * @param requestBody
     * @returns User
     * @throws ApiError
     */
    public static accountsUsersPartialUpdate(
        id: number,
        requestBody?: PatchedUser,
    ): CancelablePromise<User> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/accounts/users/{id}/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * ViewSet for user CRUD operations.
     * @param id A unique integer value identifying this user.
     * @returns void
     * @throws ApiError
     */
    public static accountsUsersDestroy(
        id: number,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/accounts/users/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * Generate a short-lived impersonation token for the target user.
     *
     * POST /api/accounts/users/{id}/impersonate/
     * Only accessible to staff users.
     * @param id A unique integer value identifying this user.
     * @param requestBody
     * @returns User
     * @throws ApiError
     */
    public static accountsUsersImpersonateCreate(
        id: number,
        requestBody: User,
    ): CancelablePromise<User> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/accounts/users/{id}/impersonate/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Return or update the current authenticated user.
     * @returns User
     * @throws ApiError
     */
    public static accountsUsersMeRetrieve(): CancelablePromise<User> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/accounts/users/me/',
        });
    }
    /**
     * Return or update the current authenticated user.
     * @param requestBody
     * @returns User
     * @throws ApiError
     */
    public static accountsUsersMePartialUpdate(
        requestBody?: PatchedUser,
    ): CancelablePromise<User> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/accounts/users/me/',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * Upload or delete the current user's avatar image.
     *
     * POST  /api/accounts/users/me/avatar/  — upload (multipart, field: avatar)
     * DELETE /api/accounts/users/me/avatar/ — remove
     * @param formData
     * @returns User
     * @throws ApiError
     */
    public static accountsUsersMeAvatarCreate(
        formData: User,
    ): CancelablePromise<User> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/accounts/users/me/avatar/',
            formData: formData,
            mediaType: 'multipart/form-data',
        });
    }
    /**
     * Upload or delete the current user's avatar image.
     *
     * POST  /api/accounts/users/me/avatar/  — upload (multipart, field: avatar)
     * DELETE /api/accounts/users/me/avatar/ — remove
     * @returns void
     * @throws ApiError
     */
    public static accountsUsersMeAvatarDestroy(): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/accounts/users/me/avatar/',
        });
    }
    /**
     * Change the current user's password.
     *
     * POST /api/accounts/users/me/change-password/
     * Body: { new_password, confirm_password }
     * @param requestBody
     * @returns User
     * @throws ApiError
     */
    public static accountsUsersMeChangePasswordCreate(
        requestBody: User,
    ): CancelablePromise<User> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/accounts/users/me/change-password/',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
}
