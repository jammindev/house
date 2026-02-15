// nextjs/src/features/projects/lib/pinterestApi.ts

interface PinterestApiPin {
    id: string;
    title: string;
    description?: string;
    media: {
        images: {
            [key: string]: {
                url: string;
                width: number;
                height: number;
            };
        };
    };
    board_id: string;
    board_name?: string;
    link?: string;
    created_at: string;
}

interface PinterestBoard {
    id: string;
    name: string;
    description?: string;
    pin_count?: number;
}

interface PinterestApiResponse {
    items: PinterestApiPin[];
    bookmark?: string;
}

export interface PinterestPin {
    id: string;
    title: string;
    description?: string;
    imageUrl: string;
    url: string;
    boardName?: string;
    createdAt: Date;
}

class PinterestApiClient {
    private baseUrl = 'https://api.pinterest.com/v5';
    private accessToken: string | null = null;

    constructor(accessToken?: string) {
        this.accessToken = accessToken || process.env.NEXT_PUBLIC_PINTEREST_ACCESS_TOKEN || null;
    }

    private async makeRequest<T>(endpoint: string): Promise<T> {
        if (!this.accessToken) {
            throw new Error('Pinterest access token is required');
        }

        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            headers: {
                'Authorization': `Bearer ${this.accessToken}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`Pinterest API error: ${response.status} - ${errorData.message || response.statusText}`);
        }

        return response.json();
    }

    /**
     * Extrait l'ID du board depuis une URL Pinterest
     * Exemples d'URLs supportées :
     * - https://pinterest.com/username/board-name/
     * - https://www.pinterest.com/username/board-name/
     * - https://pinterest.fr/username/board-name/
     */
    extractBoardIdFromUrl(url: string): string | null {
        try {
            const urlObj = new URL(url);
            const pathParts = urlObj.pathname.split('/').filter(Boolean);

            if (pathParts.length >= 2) {
                const username = pathParts[0];
                const boardName = pathParts[1];
                return `${username}/${boardName}`;
            }

            return null;
        } catch {
            return null;
        }
    }

    /**
     * Récupère les informations d'un board
     */
    async getBoard(boardId: string): Promise<PinterestBoard> {
        return this.makeRequest<PinterestBoard>(`/boards/${encodeURIComponent(boardId)}`);
    }

    /**
     * Récupère les pins d'un board
     */
    async getBoardPins(boardId: string, limit: number = 25): Promise<PinterestPin[]> {
        const response = await this.makeRequest<PinterestApiResponse>(
            `/boards/${encodeURIComponent(boardId)}/pins?page_size=${limit}&pin_fields=id,title,description,media,board_id,link,created_at`
        );

        return response.items.map(this.transformPin);
    }

    /**
     * Récupère les pins d'un board depuis une URL
     */
    async getBoardPinsFromUrl(boardUrl: string, limit: number = 25): Promise<PinterestPin[]> {
        const boardId = this.extractBoardIdFromUrl(boardUrl);
        if (!boardId) {
            throw new Error('Invalid Pinterest board URL format');
        }

        return this.getBoardPins(boardId, limit);
    }

    /**
     * Transforme un pin de l'API Pinterest vers notre format
     */
    private transformPin = (apiPin: PinterestApiPin): PinterestPin => {
        // Récupère la meilleure qualité d'image disponible
        const images = apiPin.media?.images || {};
        const imageUrl = images['736x']?.url ||
            images['564x']?.url ||
            images['474x']?.url ||
            images['236x']?.url ||
            images.orig?.url || '';

        return {
            id: apiPin.id,
            title: apiPin.title || 'Untitled',
            description: apiPin.description,
            imageUrl,
            url: apiPin.link || `https://pinterest.com/pin/${apiPin.id}`,
            boardName: apiPin.board_name,
            createdAt: new Date(apiPin.created_at),
        };
    };
}

// Instance par défaut
export const pinterestApi = new PinterestApiClient();

// Export de la classe pour usage personnalisé
export { PinterestApiClient };

// Fonction helper pour valider une URL Pinterest
export function isValidPinterestBoardUrl(url: string): boolean {
    try {
        const urlObj = new URL(url);
        const isValidDomain = /^(www\.)?pinterest\.(com|fr|co\.uk|de|es|it|jp|kr|ru|pt|com\.au)$/.test(urlObj.hostname);
        const pathParts = urlObj.pathname.split('/').filter(Boolean);

        return isValidDomain && pathParts.length >= 2;
    } catch {
        return false;
    }
}