import React from 'react';
import { I18nProvider } from '@/lib/i18n/I18nProvider';

// Mock i18n dictionaries
vi.mock('@/lib/i18n/dictionaries/en.json', () => ({
    default: {
        'projects': {
            'ai': {
                'ask_ai': 'Ask AI',
                'how_can_i_help': 'How can I help with this project?',
                'welcome_message': 'How can I help with this project?'
            }
        }
    }
}));

vi.mock('@/lib/i18n/dictionaries/fr.json', () => ({
    default: {
        'projects': {
            'ai': {
                'ask_ai': 'Demander à l\'IA',
                'how_can_i_help': 'Comment puis-je vous aider avec ce projet?',
                'welcome_message': 'Comment puis-je vous aider avec ce projet?'
            }
        }
    }
}));

export function TestWrapper({ children }: { children: React.ReactNode }) {
    return (
        <I18nProvider>
            {children}
        </I18nProvider>
    );
}