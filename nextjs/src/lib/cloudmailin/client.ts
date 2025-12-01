// nextjs/src/lib/cloudmailin/client.ts
/**
 * CloudMailin API client for managing inbound emails and webhooks
 */

export interface CloudMailinDomain {
    id: string;
    name: string;
    status: string;
    created_at: string;
    updated_at: string;
}

export interface CloudMailinWebhook {
    id: string;
    name: string;
    target: {
        url: string;
        secret?: string;
    };
    enabled: boolean;
    events: string[];
    created_at: string;
    updated_at: string;
}

export interface CloudMailinAddress {
    id: string;
    email_address: string;
    domain_name: string;
    enabled: boolean;
    created_at: string;
    updated_at: string;
}

export class CloudMailinClient {
    private apiKey: string;
    private baseUrl = 'https://api.cloudmailin.com/api/v0.1';

    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }

    private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
        const url = `${this.baseUrl}${endpoint}`;

        const response = await fetch(url, {
            ...options,
            headers: {
                'Authorization': `Basic ${Buffer.from(`${this.apiKey}:`).toString('base64')}`,
                'Content-Type': 'application/json',
                ...options.headers,
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`CloudMailin API error: ${response.status} ${errorText}`);
        }

        return response.json();
    }

    /**
     * Get all domains associated with the account
     */
    async getDomains(): Promise<CloudMailinDomain[]> {
        const response = await this.request<CloudMailinDomain[]>('/domains');
        return response;
    }

    /**
     * Get all email addresses
     */
    async getAddresses(): Promise<CloudMailinAddress[]> {
        const response = await this.request<CloudMailinAddress[]>('/addresses');
        return response;
    }

    /**
     * Create a new email address
     */
    async createAddress(data: {
        email_address: string;
        domain_id?: string;
        target?: {
            url: string;
            secret?: string;
        };
    }): Promise<CloudMailinAddress> {
        return this.request<CloudMailinAddress>('/addresses', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    /**
     * Update an existing email address
     */
    async updateAddress(addressId: string, data: {
        enabled?: boolean;
        target?: {
            url: string;
            secret?: string;
        };
    }): Promise<CloudMailinAddress> {
        return this.request<CloudMailinAddress>(`/addresses/${addressId}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    }

    /**
     * Delete an email address
     */
    async deleteAddress(addressId: string): Promise<void> {
        await this.request<void>(`/addresses/${addressId}`, {
            method: 'DELETE',
        });
    }

    /**
     * Get account information
     */
    async getAccountInfo(): Promise<{
        username: string;
        plan: string;
        emails_received: number;
        emails_forwarded: number;
        quota_limit?: number;
    }> {
        return this.request<any>('/account');
    }
}

let cachedClient: CloudMailinClient | null = null;

export function getCloudMailinClient(): CloudMailinClient {
    if (cachedClient) {
        return cachedClient;
    }

    const apiKey = process.env.CLOUDMAILIN_API_KEY;
    if (!apiKey) {
        throw new Error('CLOUDMAILIN_API_KEY is not configured');
    }

    cachedClient = new CloudMailinClient(apiKey);
    return cachedClient;
}
