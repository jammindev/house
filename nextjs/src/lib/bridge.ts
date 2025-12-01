/**
 * Bridge API Helper
 * 
 * Utility functions for interacting with Bridge Banking API
 * Bridge is a French banking API (used by Bankin') that allows secure access
 * to bank accounts and transactions with user consent (DSP2 compliant).
 */

export interface BridgeError {
    type: string;
    message: string;
    documentation_url?: string;
}

export interface BridgeUser {
    uuid: string;
    external_user_id?: string;
    created_at: string;
}

export interface BridgeAccount {
    id: number;
    name: string;
    balance: number;
    updated_at: string;
    last_refresh_status: string;
    type: string;
    currency_code: string;
    item_id: number;
    provider_id: number;
    data_access: string;
    pro: boolean;
    iban?: string;
    paused: boolean;
}

export interface BridgeTransaction {
    id: number;
    clean_description?: string;
    provider_description?: string;
    description: string; // We'll map clean_description || provider_description to this
    amount: number;
    date: string;
    booking_date?: string;
    transaction_date?: string;
    value_date?: string;
    updated_at: string;
    currency_code: string;
    deleted: boolean;
    operation_type: string;
    account_id: number;
    future: boolean;
    category?: {
        id: number;
        name: string;
    } | null;
}

export interface BridgeConnectSession {
    uuid: string;
    redirect_url?: string;
    connect_url?: string;
    url?: string;
    created_at: string;
}

/**
 * Generic function to call Bridge API with proper headers
 */
export async function bridgeFetch(
    path: string,
    options: RequestInit = {}
): Promise<any> {
    // Validate required environment variables
    if (!process.env.BRIDGE_CLIENT_ID || !process.env.BRIDGE_CLIENT_SECRET || !process.env.BRIDGE_VERSION) {
        console.error('Bridge API configuration error:', {
            hasClientId: !!process.env.BRIDGE_CLIENT_ID,
            hasClientSecret: !!process.env.BRIDGE_CLIENT_SECRET,
            hasVersion: !!process.env.BRIDGE_VERSION,
        });
        throw new Error('Bridge API credentials not configured properly');
    }

    const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Bridge-Version': process.env.BRIDGE_VERSION,
        'Client-Id': process.env.BRIDGE_CLIENT_ID,
        'Client-Secret': process.env.BRIDGE_CLIENT_SECRET,
        ...(options.headers || {}),
    };

    const url = `${process.env.BRIDGE_API_BASE}${path}`;

    console.log(`Bridge API Call: ${options.method || 'GET'} ${url}`, {
        hasAuth: !!process.env.BRIDGE_CLIENT_ID,
        hasSecret: !!process.env.BRIDGE_CLIENT_SECRET,
        version: process.env.BRIDGE_VERSION,
    }); const res = await fetch(url, {
        ...options,
        headers,
    });

    if (!res.ok) {
        let errorData: any;
        try {
            errorData = await res.json();
        } catch {
            errorData = { message: await res.text() };
        }

        console.error(`Bridge API Error: ${res.status}`, errorData);

        // Bridge API returns structured error objects
        const errorMessage = errorData.message || errorData.code || `HTTP ${res.status}`;
        throw new Error(`Bridge API Error: ${errorMessage}`);
    }

    const data = await res.json();
    console.log(`Bridge API Success: ${options.method || 'GET'} ${path}`, {
        status: res.status,
        hasData: !!data,
        dataKeys: data ? Object.keys(data) : []
    });

    return data;
}

/**
 * Create or get existing Bridge user
 */
export async function getOrCreateBridgeUser(externalUserId: string): Promise<string> {
    // Check localStorage first for existing Bridge user mapping
    const storageKey = `bridge_user_uuid_${externalUserId}`;
    const existingUuid = localStorage.getItem(storageKey);
    
    if (existingUuid) {
        console.log('Using existing Bridge user UUID from localStorage:', existingUuid);
        return existingUuid;
    }

    try {
        // Try to create a new user
        const data: BridgeUser = await bridgeFetch('/aggregation/users', {
            method: 'POST',
            body: JSON.stringify({
                external_user_id: externalUserId,
            }),
        });

        console.log('New Bridge user created:', data.uuid);

        // Save the mapping in localStorage
        localStorage.setItem(storageKey, data.uuid);

        return data.uuid;
    } catch (error: any) {
        // If error is 409 (Conflict), user already exists
        if (error.message.includes('409')) {
            console.log('Bridge user already exists with 409 conflict');
            
            // Check if we have any existing UUID in localStorage for any user
            // This handles the case where we had the hardcoded UUID before
            const allBridgeKeys = Object.keys(localStorage).filter(key => key.startsWith('bridge_user_uuid_'));
            
            if (allBridgeKeys.length > 0) {
                // Use the first existing UUID we find
                const existingUuidFromStorage = localStorage.getItem(allBridgeKeys[0]);
                if (existingUuidFromStorage) {
                    console.log('Using existing UUID from localStorage:', existingUuidFromStorage);
                    // Save it for this specific user too
                    localStorage.setItem(storageKey, existingUuidFromStorage);
                    return existingUuidFromStorage;
                }
            }
            
            // Fallback: if we still have the hardcoded UUID and it works, use it
            const fallbackUuid = '47f5a83c-3075-43fe-a63a-d0c6ac088879';
            console.log('Using fallback UUID and saving to localStorage:', fallbackUuid);
            localStorage.setItem(storageKey, fallbackUuid);
            return fallbackUuid;
        }

        // Re-throw other errors
        throw error;
    }
}

/**
 * Get authorization token for a Bridge user
 */
export async function getBridgeAccessToken(bridgeUserUuid: string): Promise<string> {
    const data = await bridgeFetch('/aggregation/authorization/token', {
        method: 'POST',
        body: JSON.stringify({
            user_uuid: bridgeUserUuid,
        }),
    });

    if (!data.access_token) {
        throw new Error('No access token received from Bridge API');
    }

    return data.access_token;
}

/**
 * Create a Bridge Connect session
 */
export async function createBridgeConnectSession(
    accessToken: string,
    userEmail: string
): Promise<string> {
    const requestBody: any = {
        user_email: userEmail,
    };

    // For development: skip callback_url since localhost is not allowed
    // In production, you would configure a proper domain
    const callbackUrl = process.env.BRIDGE_CONNECT_CALLBACK_URL;
    const isLocalhost = callbackUrl?.includes('localhost');
    
    if (callbackUrl && !isLocalhost) {
        requestBody.callback_url = callbackUrl;
        console.log('Using callback URL:', callbackUrl);
    } else {
        console.log('Skipping callback URL (localhost not allowed by Bridge). User will need to return manually.');
    }

    const data: BridgeConnectSession = await bridgeFetch('/aggregation/connect-sessions', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(requestBody),
    });

    // Bridge API can return different field names depending on version
    const redirectUrl = data.redirect_url || data.connect_url || data.url;

    if (!redirectUrl) {
        throw new Error('No redirect URL received from Bridge Connect session');
    }

    return redirectUrl;
}

/**
 * Get bank accounts for a Bridge user
 */
export async function getBridgeAccounts(accessToken: string): Promise<BridgeAccount[]> {
    const data = await bridgeFetch('/aggregation/accounts', {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    });

    // Bridge API returns paginated results in 'resources' array
    return Array.isArray(data.resources) ? data.resources : (Array.isArray(data) ? data : []);
}

/**
 * Get transactions for a Bridge user
 */
export async function getBridgeTransactions(
    accessToken: string,
    options: {
        since?: string; // ISO date string (yyyy-MM-dd)
        until?: string; // ISO date string (yyyy-MM-dd)
        limit?: number; // 1-500, default 50
        after?: string; // Cursor for pagination
    } = {}
): Promise<BridgeTransaction[]> {
    const params = new URLSearchParams();
    if (options.since) params.append('since', options.since);
    if (options.until) params.append('until', options.until);
    if (options.limit) {
        // Ensure limit is within Bridge API constraints (1-500)
        const limit = Math.min(Math.max(options.limit, 1), 500);
        params.append('limit', limit.toString());
    }
    if (options.after) params.append('after', options.after);

    const queryString = params.toString();
    const path = `/aggregation/transactions${queryString ? `?${queryString}` : ''}`;

    const data = await bridgeFetch(path, {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    });

    // Bridge API returns paginated results in 'resources' array
    return Array.isArray(data.resources) ? data.resources : (Array.isArray(data) ? data : []);
}