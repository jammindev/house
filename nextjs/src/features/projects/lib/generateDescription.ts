// nextjs/src/features/projects/lib/generateDescription.ts

interface GenerateDescriptionResponse {
    success: boolean;
    description?: string;
    action?: 'generate' | 'update';
    error?: string;
}

export async function generateProjectDescription(
    projectId: string,
    action: 'generate' | 'update',
    additionalInstructions?: string
): Promise<GenerateDescriptionResponse> {
    try {
        const response = await fetch(`/api/projects/${projectId}/generate-description`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action,
                additionalInstructions
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            return {
                success: false,
                error: data.error || 'Failed to generate description',
            };
        }

        return {
            success: true,
            description: data.description,
            action: data.action,
        };
    } catch (error) {
        console.error('Error generating description:', error);
        return {
            success: false,
            error: 'Network error occurred',
        };
    }
}