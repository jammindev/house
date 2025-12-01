// nextjs/src/lib/mailersend/client.ts
/**
 * MailerSend API client for managing inbound emails and webhooks
 */

export interface MailerSendDomain {
    id: string;
    name: string;
    domain_settings: {
        send_paused: boolean;
        track_clicks: boolean;
        track_opens: boolean;
        track_unsubscribe: boolean;
        track_content: boolean;
    };
}

export interface MailerSendWebhook {
    id: string;
    name: string;
    url: string;
    events: string[];
    enabled: boolean;
}

export class MailerSendClient {
    private apiToken: string;
    private baseUrl = 'https://api.mailersend.com/v1';

    constructor(apiToken?: string) {
        this.apiToken = apiToken || process.env.MAILERSEND_API_TOKEN || '';
        if (!this.apiToken) {
            throw new Error('MailerSend API token is required');
        }
    }

    private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
        const url = `${this.baseUrl}${endpoint}`;

        const response = await fetch(url, {
            ...options,
            headers: {
                'Authorization': `Bearer ${this.apiToken}`,
                'Content-Type': 'application/json',
                ...options.headers,
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`MailerSend API error: ${response.status} ${errorText}`);
        }

        return response.json();
    }

    /**
     * Get all configured domains
     */
    async getDomains(): Promise<MailerSendDomain[]> {
        const response = await this.request<{ data: MailerSendDomain[] }>('/email-domains');
        return response.data;
    }

    /**
     * Get all configured webhooks
     */
    async getWebhooks(): Promise<MailerSendWebhook[]> {
        const response = await this.request<{ data: MailerSendWebhook[] }>('/webhooks');
        return response.data;
    }

    /**
     * Create a new webhook for inbound emails
     */
    async createWebhook(data: {
        name: string;
        url: string;
        events?: string[];
        enabled?: boolean;
    }): Promise<MailerSendWebhook> {
        return this.request<MailerSendWebhook>('/webhooks', {
            method: 'POST',
            body: JSON.stringify({
                events: ['activity.inbound'],
                enabled: true,
                ...data,
            }),
        });
    }

    /**
     * Update an existing webhook
     */
    async updateWebhook(webhookId: string, data: Partial<MailerSendWebhook>): Promise<MailerSendWebhook> {
        return this.request<MailerSendWebhook>(`/webhooks/${webhookId}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    }

    /**
     * Delete a webhook
     */
    async deleteWebhook(webhookId: string): Promise<void> {
        await this.request(`/webhooks/${webhookId}`, {
            method: 'DELETE',
        });
    }
}

// Export singleton instance
export const mailersendClient = new MailerSendClient();