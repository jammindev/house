// nextjs/src/features/interactions/components/SimpleFormFactory.tsx

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

import type { InteractionFormConfig } from "@interactions/types/formConfig";
import { formConfigurations } from "@interactions/configs/formConfigurations";

interface SimpleFormFactoryProps {
    formType: keyof typeof formConfigurations;
    onSubmit: (data: any) => void;
    zones: Array<{ id: string; name: string }>;
    projects?: Array<{ id: string; title: string }>;
}

/**
 * Composant simplifié pour démontrer l'architecture de formulaire factory
 */
export function SimpleFormFactory({
    formType,
    onSubmit,
    zones,
    projects = []
}: SimpleFormFactoryProps) {
    const config = formConfigurations[formType];

    const [formData, setFormData] = useState({
        subject: "",
        content: "",
        type: formType,
        status: config.status.defaultValue || null,
        occurredAt: new Date().toISOString().split('T')[0],
        zoneIds: [] as string[],
        projectId: null as string | null,
        tags: [] as string[],
        metadata: {} as Record<string, any>
    });

    const updateField = (field: string, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const updateMetadata = (key: string, value: any) => {
        setFormData(prev => ({
            ...prev,
            metadata: { ...prev.metadata, [key]: value }
        }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Ajouter les valeurs par défaut pour les champs cachés
        const finalData = {
            ...formData,
            type: config.type.defaultValue || formData.type,
            status: config.status.visible ? formData.status : config.status.defaultValue
        };

        onSubmit(finalData);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {/* En-tête */}
            {config.layout.showHeader && (
                <div className="text-center border-b pb-4">
                    <h2 className="text-lg font-semibold">
                        {formType === "note" && "📝 Nouvelle note"}
                        {formType === "task" && "✅ Nouvelle tâche"}
                        {formType === "quote" && "💰 Nouveau devis"}
                        {formType === "expense" && "🛒 Nouvel achat"}
                        {formType === "maintenance" && "🔧 Nouvelle intervention"}
                    </h2>
                </div>
            )}

            {/* Champs de base */}
            <div className="space-y-4">
                {/* Sujet */}
                {config.subject.visible && (
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            {config.subject.label}
                            {config.subject.required && <span className="text-red-500 ml-1">*</span>}
                        </label>
                        <Input
                            value={formData.subject}
                            onChange={(e) => updateField("subject", e.target.value)}
                            placeholder={config.subject.placeholder}
                            required={config.subject.required}
                        />
                    </div>
                )}

                {/* Contenu */}
                {config.content.visible && (
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            {config.content.label}
                            {config.content.required && <span className="text-red-500 ml-1">*</span>}
                        </label>
                        <Textarea
                            value={formData.content}
                            onChange={(e) => updateField("content", e.target.value)}
                            placeholder={config.content.placeholder}
                            required={config.content.required}
                            rows={3}
                        />
                    </div>
                )}

                {/* Statut */}
                {config.status.visible && config.status.options && (
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            {config.status.label}
                            {config.status.required && <span className="text-red-500 ml-1">*</span>}
                        </label>
                        <Select
                            value={formData.status || ""}
                            onValueChange={(value) => updateField("status", value)}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Choisir un statut..." />
                            </SelectTrigger>
                            <SelectContent>
                                {config.status.options.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}

                {/* Date */}
                {config.occurredAt.visible && (
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            {config.occurredAt.label}
                            {config.occurredAt.required && <span className="text-red-500 ml-1">*</span>}
                        </label>
                        <Input
                            type="date"
                            value={formData.occurredAt}
                            onChange={(e) => updateField("occurredAt", e.target.value)}
                            required={config.occurredAt.required}
                        />
                    </div>
                )}
            </div>

            {/* Relations */}
            {config.layout.groupFields && (
                <div className="space-y-4 border-t pt-4">
                    <h3 className="font-medium text-sm text-gray-700">Associations</h3>

                    {/* Zones */}
                    {config.zones.visible && (
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                {config.zones.label}
                                {config.zones.required && <span className="text-red-500 ml-1">*</span>}
                            </label>
                            <Select
                                value=""
                                onValueChange={(zoneId) => {
                                    if (!formData.zoneIds.includes(zoneId)) {
                                        updateField("zoneIds", [...formData.zoneIds, zoneId]);
                                    }
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Ajouter une zone..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {zones.map((zone) => (
                                        <SelectItem key={zone.id} value={zone.id}>
                                            {zone.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            {/* Zones sélectionnées */}
                            <div className="flex flex-wrap gap-2 mt-2">
                                {formData.zoneIds.map((zoneId) => {
                                    const zone = zones.find(z => z.id === zoneId);
                                    return zone ? (
                                        <span
                                            key={zoneId}
                                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                                        >
                                            {zone.name}
                                            <button
                                                type="button"
                                                className="ml-1.5 h-4 w-4 text-blue-400 hover:text-blue-600"
                                                onClick={() => {
                                                    updateField("zoneIds", formData.zoneIds.filter(id => id !== zoneId));
                                                }}
                                            >
                                                ×
                                            </button>
                                        </span>
                                    ) : null;
                                })}
                            </div>
                        </div>
                    )}

                    {/* Projet */}
                    {config.projects.visible && projects.length > 0 && (
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                {config.projects.label}
                            </label>
                            <Select
                                value={formData.projectId || ""}
                                onValueChange={(value) => updateField("projectId", value || null)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Choisir un projet..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="">Aucun projet</SelectItem>
                                    {projects.map((project) => (
                                        <SelectItem key={project.id} value={project.id}>
                                            {project.title}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                </div>
            )}

            {/* Métadonnées spécifiques */}
            {config.metadata && Object.keys(config.metadata).length > 0 && (
                <div className="space-y-4 border-t pt-4">
                    <h3 className="font-medium text-sm text-gray-700">Informations spécifiques</h3>

                    {/* Montant */}
                    {config.metadata.amount?.visible && (
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                {config.metadata.amount.label}
                                {config.metadata.amount.required && <span className="text-red-500 ml-1">*</span>}
                            </label>
                            <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={formData.metadata.amount || ""}
                                onChange={(e) => updateMetadata("amount", parseFloat(e.target.value) || 0)}
                                placeholder={config.metadata.amount.placeholder}
                                required={config.metadata.amount.required}
                            />
                        </div>
                    )}

                    {/* Priorité */}
                    {config.metadata.priority?.visible && config.metadata.priority.options && (
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                {config.metadata.priority.label}
                            </label>
                            <Select
                                value={formData.metadata.priority?.toString() || ""}
                                onValueChange={(value) => updateMetadata("priority", parseInt(value))}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Choisir une priorité..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {config.metadata.priority.options.map((option) => (
                                        <SelectItem key={option.value} value={option.value.toString()}>
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {/* Date d'échéance */}
                    {config.metadata.dueDate?.visible && (
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                {config.metadata.dueDate.label}
                            </label>
                            <Input
                                type="date"
                                value={formData.metadata.dueDate || ""}
                                onChange={(e) => updateMetadata("dueDate", e.target.value)}
                                placeholder={config.metadata.dueDate.placeholder}
                            />
                        </div>
                    )}

                    {/* Durée estimée */}
                    {config.metadata.estimatedDuration?.visible && (
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                {config.metadata.estimatedDuration.label}
                            </label>
                            <Input
                                value={formData.metadata.estimatedDuration || ""}
                                onChange={(e) => updateMetadata("estimatedDuration", e.target.value)}
                                placeholder={config.metadata.estimatedDuration.placeholder}
                            />
                        </div>
                    )}
                </div>
            )}

            {/* Actions */}
            {config.layout.showFooter && (
                <div className="flex gap-2 pt-4 border-t">
                    <Button type="submit" className="flex-1">
                        {config.actions.submitLabel}
                    </Button>

                    {config.actions.showCancel && (
                        <Button type="button" variant="outline" className="flex-1">
                            Annuler
                        </Button>
                    )}
                </div>
            )}
        </form>
    );
}

/**
 * Exemple d'utilisation :
 * 
 * ```tsx
 * <SimpleFormFactory
 *   formType="note"
 *   onSubmit={(data) => console.log(data)}
 *   zones={[
 *     { id: "1", name: "Cuisine" },
 *     { id: "2", name: "Salle de bain" }
 *   ]}
 *   projects={[
 *     { id: "1", title: "Rénovation étage" }
 *   ]}
 * />
 * ```
 */