// nextjs/src/components/dev/ZIndexDebugger.tsx
"use client";

import { useState } from 'react';
import { Z_INDEX, Z_INDEX_CLASSES } from '@/lib/design-tokens';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

/**
 * Development tool to visualize z-index layers
 * Only render this in development mode
 */
export function ZIndexDebugger() {
    const [isVisible, setIsVisible] = useState(false);
    console.log(process.env.NODE_ENV)
    if (process.env.NODE_ENV !== 'development') {
        return null;
    }

    const layers = [
        { name: 'Base', value: Z_INDEX.base, category: 'base' },
        { name: 'Content Raised', value: Z_INDEX.content.raised, category: 'content' },
        { name: 'Content Sticky', value: Z_INDEX.content.sticky, category: 'content' },
        { name: 'Interactive Dropdown', value: Z_INDEX.interactive.dropdown, category: 'interactive' },
        { name: 'Interactive Tooltip', value: Z_INDEX.interactive.tooltip, category: 'interactive' },
        { name: 'Interactive Popover', value: Z_INDEX.interactive.popover, category: 'interactive' },
        { name: 'Nav Header', value: Z_INDEX.navigation.header, category: 'navigation' },
        { name: 'Nav Sidebar', value: Z_INDEX.navigation.sidebar, category: 'navigation' },
        { name: 'Nav Mobile Menu', value: Z_INDEX.navigation.mobileMenu, category: 'navigation' },
        { name: 'Overlay Backdrop', value: Z_INDEX.overlay.backdrop, category: 'overlay' },
        { name: 'Overlay Modal', value: Z_INDEX.overlay.modal, category: 'overlay' },
        { name: 'Overlay Sheet', value: Z_INDEX.overlay.sheet, category: 'overlay' },
        { name: 'Overlay Drawer', value: Z_INDEX.overlay.drawer, category: 'overlay' },
        { name: 'System Toast', value: Z_INDEX.system.toast, category: 'system' },
        { name: 'System Loading', value: Z_INDEX.system.loading, category: 'system' },
        { name: 'System Debug', value: Z_INDEX.system.debug, category: 'system' },
        { name: 'Emergency', value: Z_INDEX.emergency, category: 'emergency' },
    ];

    const getCategoryColor = (category: string) => {
        switch (category) {
            case 'content': return 'bg-blue-100 border-blue-300';
            case 'interactive': return 'bg-green-100 border-green-300';
            case 'navigation': return 'bg-yellow-100 border-yellow-300';
            case 'overlay': return 'bg-purple-100 border-purple-300';
            case 'system': return 'bg-red-100 border-red-300';
            case 'emergency': return 'bg-orange-100 border-orange-300';
            default: return 'bg-gray-100 border-gray-300';
        }
    };

    return (
        <>
            {/* Toggle Button */}
            <Button
                onClick={() => setIsVisible(!isVisible)}
                className="fixed bottom-4 left-4 z-[9998] bg-black text-white hover:bg-gray-800"
                size="sm"
            >
                {isVisible ? 'Hide' : 'Show'} Z-Index
            </Button>

            {/* Debug Panel */}
            {isVisible && (
                <div className="fixed bottom-16 left-4 z-[9999] max-h-[80vh] w-80 overflow-y-auto rounded-lg bg-white p-4 shadow-2xl border">
                    <h3 className="font-bold text-lg mb-4">Z-Index Layers</h3>

                    <div className="space-y-2">
                        {layers.map((layer) => (
                            <Card
                                key={layer.name}
                                className={`p-2 text-xs ${getCategoryColor(layer.category)}`}
                            >
                                <div className="flex justify-between items-center">
                                    <span className="font-medium">{layer.name}</span>
                                    <span className="font-mono bg-white px-1 rounded">
                                        {layer.value}
                                    </span>
                                </div>
                                <div className="text-gray-600 mt-1">
                                    Category: {layer.category}
                                </div>
                            </Card>
                        ))}
                    </div>

                    <div className="mt-4 p-2 bg-gray-50 rounded text-xs">
                        <p className="font-medium mb-1">Legend:</p>
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-blue-100 border border-blue-300 rounded"></div>
                                <span>Content</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-green-100 border border-green-300 rounded"></div>
                                <span>Interactive</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-yellow-100 border border-yellow-300 rounded"></div>
                                <span>Navigation</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-purple-100 border border-purple-300 rounded"></div>
                                <span>Overlay</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-red-100 border border-red-300 rounded"></div>
                                <span>System</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-orange-100 border border-orange-300 rounded"></div>
                                <span>Emergency</span>
                            </div>
                        </div>
                    </div>

                    <Button
                        onClick={() => setIsVisible(false)}
                        variant="outline"
                        size="sm"
                        className="w-full mt-4"
                    >
                        Close
                    </Button>
                </div>
            )}

            {/* Visual Layer Indicators - Only show when debug is active */}
            {isVisible && (
                <div className="pointer-events-none">
                    {layers.slice(1).map((layer, index) => (
                        <div
                            key={layer.name}
                            className={`fixed inset-0 border-2 border-dashed opacity-20`}
                            style={{
                                zIndex: layer.value,
                                borderColor: getCategoryColor(layer.category).split(' ')[1].replace('border-', '').replace('-300', ''),
                                margin: `${index * 2}px`,
                            }}
                        />
                    ))}
                </div>
            )}
        </>
    );
}