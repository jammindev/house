// nextjs/src/components/demo/ZIndexDemo.tsx
"use client";

import { useState } from 'react';
import { useZIndex } from '@/hooks/useZIndex';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

/**
 * Composant de démonstration pour illustrer l'utilisation du système z-index
 */
export function ZIndexDemo() {
    const { zClass, zIndex } = useZIndex();
    const [showModal, setShowModal] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const [showTooltip, setShowTooltip] = useState(false);

    return (
        <div className="p-8 space-y-6">
            <h2 className="text-2xl font-bold mb-4">Démonstration du système Z-Index</h2>

            {/* Contrôles */}
            <div className="flex gap-4 flex-wrap">
                <Button
                    onClick={() => setShowModal(true)}
                    variant="default"
                >
                    Ouvrir Modal (z-{zIndex.overlay.modal})
                </Button>

                <Button
                    onClick={() => setShowDropdown(!showDropdown)}
                    variant="outline"
                >
                    Toggle Dropdown (z-{zIndex.interactive.dropdown})
                </Button>

                <div className="relative">
                    <Button
                        onMouseEnter={() => setShowTooltip(true)}
                        onMouseLeave={() => setShowTooltip(false)}
                        variant="ghost"
                    >
                        Hover pour Tooltip (z-{zIndex.interactive.tooltip})
                    </Button>

                    {showTooltip && (
                        <div className={`
              absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2
              px-3 py-1 bg-gray-900 text-white text-sm rounded
              whitespace-nowrap ${zClass.interactive.tooltip}
            `}>
                            Je suis un tooltip !
                            <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                        </div>
                    )}
                </div>
            </div>

            {/* Éléments avec différents z-index */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className={`p-4 ${zClass.base}`}>
                    <h3 className="font-semibold">Base Layer (z-{zIndex.base})</h3>
                    <p className="text-sm text-gray-600">Contenu normal de la page</p>
                </Card>

                <Card className={`p-4 ${zClass.content.raised} shadow-lg`}>
                    <h3 className="font-semibold">Raised Content (z-{zIndex.content.raised})</h3>
                    <p className="text-sm text-gray-600">Cartes avec ombres</p>
                </Card>

                <Card className={`p-4 ${zClass.content.sticky} border-2 border-blue-500`}>
                    <h3 className="font-semibold">Sticky Content (z-{zIndex.content.sticky})</h3>
                    <p className="text-sm text-gray-600">Headers collants</p>
                </Card>
            </div>

            {/* Dropdown */}
            {showDropdown && (
                <div className="relative">
                    <div className={`
            absolute top-12 left-4 w-48 bg-white border rounded-lg shadow-lg p-2
            ${zClass.interactive.dropdown}
          `}>
                        <div className="text-sm font-medium mb-2">Menu Dropdown</div>
                        <div className="space-y-1">
                            <button className="w-full text-left px-2 py-1 hover:bg-gray-100 rounded">Option 1</button>
                            <button className="w-full text-left px-2 py-1 hover:bg-gray-100 rounded">Option 2</button>
                            <button className="w-full text-left px-2 py-1 hover:bg-gray-100 rounded">Option 3</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <>
                    {/* Backdrop */}
                    <div
                        className={`fixed inset-0 bg-black/50 ${zClass.overlay.backdrop}`}
                        onClick={() => setShowModal(false)}
                    />

                    {/* Modal Content */}
                    <div className={`
            fixed inset-4 md:inset-auto md:top-1/2 md:left-1/2 md:transform md:-translate-x-1/2 md:-translate-y-1/2
            md:w-96 bg-white rounded-lg shadow-2xl ${zClass.overlay.modal}
          `}>
                        <div className="p-6">
                            <h3 className="text-xl font-bold mb-4">Modal Exemple</h3>
                            <p className="text-gray-600 mb-6">
                                Cette modal utilise z-{zIndex.overlay.modal} pour être au-dessus du backdrop (z-{zIndex.overlay.backdrop}).
                            </p>

                            <div className="flex justify-end gap-3">
                                <Button variant="outline" onClick={() => setShowModal(false)}>
                                    Annuler
                                </Button>
                                <Button onClick={() => setShowModal(false)}>
                                    OK
                                </Button>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* Information sur le système */}
            <Card className="p-4 bg-blue-50 border-blue-200">
                <h3 className="font-semibold text-blue-900 mb-2">Informations Z-Index</h3>
                <div className="text-sm text-blue-800 space-y-1">
                    <p>• Base: {zIndex.base}</p>
                    <p>• Content Raised: {zIndex.content.raised}</p>
                    <p>• Content Sticky: {zIndex.content.sticky}</p>
                    <p>• Interactive Dropdown: {zIndex.interactive.dropdown}</p>
                    <p>• Interactive Tooltip: {zIndex.interactive.tooltip}</p>
                    <p>• Overlay Backdrop: {zIndex.overlay.backdrop}</p>
                    <p>• Overlay Modal: {zIndex.overlay.modal}</p>
                    <p>• System Toast: {zIndex.system.toast}</p>
                    <p>• Emergency: {zIndex.emergency}</p>
                </div>
            </Card>

            {/* Instructions */}
            <Card className="p-4 bg-green-50 border-green-200">
                <h3 className="font-semibold text-green-900 mb-2">Comment utiliser</h3>
                <div className="text-sm text-green-800 space-y-2">
                    <p>1. <strong>Import</strong>: <code className="bg-green-100 px-1 rounded">import &#123; useZIndex &#125; from '@/hooks/useZIndex';</code></p>
                    <p>2. <strong>Hook</strong>: <code className="bg-green-100 px-1 rounded">const &#123; zClass, zIndex &#125; = useZIndex();</code></p>
                    <p>3. <strong>Usage</strong>: <code className="bg-green-100 px-1 rounded">className=&#123;zClass.overlay.modal&#125;</code></p>
                    <p>4. <strong>Debug</strong>: Utilisez le bouton "Show Z-Index" en bas à gauche (développement uniquement)</p>
                </div>
            </Card>
        </div>
    );
}