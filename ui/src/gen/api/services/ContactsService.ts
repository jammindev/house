/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Address } from '../models/Address';
import type { Contact } from '../models/Contact';
import type { Email } from '../models/Email';
import type { PatchedAddress } from '../models/PatchedAddress';
import type { PatchedContact } from '../models/PatchedContact';
import type { PatchedEmail } from '../models/PatchedEmail';
import type { PatchedPhone } from '../models/PatchedPhone';
import type { Phone } from '../models/Phone';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class ContactsService {
    /**
     * @returns Address
     * @throws ApiError
     */
    public static contactsAddressesList(): CancelablePromise<Array<Address>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/contacts/addresses/',
        });
    }
    /**
     * @param requestBody
     * @returns Address
     * @throws ApiError
     */
    public static contactsAddressesCreate(
        requestBody: Address,
    ): CancelablePromise<Address> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/contacts/addresses/',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * @param id A UUID string identifying this address.
     * @returns Address
     * @throws ApiError
     */
    public static contactsAddressesRetrieve(
        id: string,
    ): CancelablePromise<Address> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/contacts/addresses/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * @param id A UUID string identifying this address.
     * @param requestBody
     * @returns Address
     * @throws ApiError
     */
    public static contactsAddressesUpdate(
        id: string,
        requestBody: Address,
    ): CancelablePromise<Address> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/contacts/addresses/{id}/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * @param id A UUID string identifying this address.
     * @param requestBody
     * @returns Address
     * @throws ApiError
     */
    public static contactsAddressesPartialUpdate(
        id: string,
        requestBody?: PatchedAddress,
    ): CancelablePromise<Address> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/contacts/addresses/{id}/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * @param id A UUID string identifying this address.
     * @returns void
     * @throws ApiError
     */
    public static contactsAddressesDestroy(
        id: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/contacts/addresses/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * @returns Contact
     * @throws ApiError
     */
    public static contactsContactsList(): CancelablePromise<Array<Contact>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/contacts/contacts/',
        });
    }
    /**
     * @param requestBody
     * @returns Contact
     * @throws ApiError
     */
    public static contactsContactsCreate(
        requestBody: Contact,
    ): CancelablePromise<Contact> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/contacts/contacts/',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * @param id A UUID string identifying this contact.
     * @returns Contact
     * @throws ApiError
     */
    public static contactsContactsRetrieve(
        id: string,
    ): CancelablePromise<Contact> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/contacts/contacts/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * @param id A UUID string identifying this contact.
     * @param requestBody
     * @returns Contact
     * @throws ApiError
     */
    public static contactsContactsUpdate(
        id: string,
        requestBody: Contact,
    ): CancelablePromise<Contact> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/contacts/contacts/{id}/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * @param id A UUID string identifying this contact.
     * @param requestBody
     * @returns Contact
     * @throws ApiError
     */
    public static contactsContactsPartialUpdate(
        id: string,
        requestBody?: PatchedContact,
    ): CancelablePromise<Contact> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/contacts/contacts/{id}/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * @param id A UUID string identifying this contact.
     * @returns void
     * @throws ApiError
     */
    public static contactsContactsDestroy(
        id: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/contacts/contacts/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * @returns Email
     * @throws ApiError
     */
    public static contactsEmailsList(): CancelablePromise<Array<Email>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/contacts/emails/',
        });
    }
    /**
     * @param requestBody
     * @returns Email
     * @throws ApiError
     */
    public static contactsEmailsCreate(
        requestBody: Email,
    ): CancelablePromise<Email> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/contacts/emails/',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * @param id A UUID string identifying this email.
     * @returns Email
     * @throws ApiError
     */
    public static contactsEmailsRetrieve(
        id: string,
    ): CancelablePromise<Email> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/contacts/emails/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * @param id A UUID string identifying this email.
     * @param requestBody
     * @returns Email
     * @throws ApiError
     */
    public static contactsEmailsUpdate(
        id: string,
        requestBody: Email,
    ): CancelablePromise<Email> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/contacts/emails/{id}/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * @param id A UUID string identifying this email.
     * @param requestBody
     * @returns Email
     * @throws ApiError
     */
    public static contactsEmailsPartialUpdate(
        id: string,
        requestBody?: PatchedEmail,
    ): CancelablePromise<Email> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/contacts/emails/{id}/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * @param id A UUID string identifying this email.
     * @returns void
     * @throws ApiError
     */
    public static contactsEmailsDestroy(
        id: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/contacts/emails/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * @returns Phone
     * @throws ApiError
     */
    public static contactsPhonesList(): CancelablePromise<Array<Phone>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/contacts/phones/',
        });
    }
    /**
     * @param requestBody
     * @returns Phone
     * @throws ApiError
     */
    public static contactsPhonesCreate(
        requestBody: Phone,
    ): CancelablePromise<Phone> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/contacts/phones/',
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * @param id A UUID string identifying this phone.
     * @returns Phone
     * @throws ApiError
     */
    public static contactsPhonesRetrieve(
        id: string,
    ): CancelablePromise<Phone> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/contacts/phones/{id}/',
            path: {
                'id': id,
            },
        });
    }
    /**
     * @param id A UUID string identifying this phone.
     * @param requestBody
     * @returns Phone
     * @throws ApiError
     */
    public static contactsPhonesUpdate(
        id: string,
        requestBody: Phone,
    ): CancelablePromise<Phone> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/contacts/phones/{id}/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * @param id A UUID string identifying this phone.
     * @param requestBody
     * @returns Phone
     * @throws ApiError
     */
    public static contactsPhonesPartialUpdate(
        id: string,
        requestBody?: PatchedPhone,
    ): CancelablePromise<Phone> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/contacts/phones/{id}/',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
        });
    }
    /**
     * @param id A UUID string identifying this phone.
     * @returns void
     * @throws ApiError
     */
    public static contactsPhonesDestroy(
        id: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/contacts/phones/{id}/',
            path: {
                'id': id,
            },
        });
    }
}
