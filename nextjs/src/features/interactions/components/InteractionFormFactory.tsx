// nextjs/src/features/interactions/components/InteractionFormFactory.tsx

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
import { Badge } from "@/components/ui/badge";
import { X, Plus } from "lucide-react";

import type {
    InteractionFormConfig,
    InteractionFormData,
    InteractionFormFactoryProps,
    InteractionFormField
} from "@interactions/types/formConfig";
import {
    shouldShowField,
    getFormDefaults
} from "@interactions/configs/formConfigurations";

// Composant Label simple
function Label({ htmlFor, children, className = "" }: {
    htmlFor?: string;
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <label htmlFor={htmlFor} className={`text-sm font-medium leading-none ${className}`}>
            {children}
        </label>
    );
}

/**
 * Composant factory pour créer des formulaires d'interaction configurables
 */
export function InteractionFormFactory({
    formType,
    config: configOverride,
    defaultValues,
    onSubmit,
    onCancel,
    zones,
    projects,
    submitting = false,
    errors = {}
}: InteractionFormFactoryProps) {
    // Récupération de la configuration
    const baseConfig = getFormConfiguration(formType);
    const config: InteractionFormConfig = { ...baseConfig, ...configOverride };

    // État du formulaire
    const [formData, setFormData] = useState<InteractionFormData>(() => {
        const defaults = getFormDefaults(config);
        return {
            subject: "",
            content: "",
            type: formType,
            status: null,
            occurred_at: new Date().toISOString().split('T')[0],
            zone_ids: [],
            project_id: null,
            tag_ids: [],
            contact_ids: [],
            structure_ids: [],
            metadata: {},
            documents: [],
            ...defaults,
            ...defaultValues
        };
    });

    const [tags, setTags] = useState<string[]>([]);
    const [currentTag, setCurrentTag] = useState("");

    // Fonction pour mettre à jour les données du formulaire
    const updateFormData = (field: keyof InteractionFormData, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    // Fonction pour mettre à jour les métadonnées
    const updateMetadata = (key: string, value: any) => {
        setFormData(prev => ({
            ...prev,
            metadata: { ...prev.metadata, [key]: value }
        }));
    };

    // Gestion des tags
    const addTag = () => {
        if (currentTag.trim() && !tags.includes(currentTag.trim())) {
            const newTags = [...tags, currentTag.trim()];
            setTags(newTags);
            setCurrentTag("");
            // Ici on pourrait mapper vers des IDs de tags si nécessaire
        }
    };

    const removeTag = (tagToRemove: string) => {
        const newTags = tags.filter(tag => tag !== tagToRemove);
        setTags(newTags);
    };

    // Gestion de la soumission
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const finalData: InteractionFormData = {
            ...formData,
            // Convertir les tags en string array pour l'instant
            tag_ids: tags, // TODO: mapper vers de vrais IDs
        };

        onSubmit(finalData);
    };

    // Fonction pour rendre un champ selon sa configuration
    const renderField = (fieldName: keyof InteractionFormData, fieldConfig: InteractionFormField) => {
        if (!shouldShowField(fieldConfig)) {
            return null;
        }

        const value = formData[fieldName as keyof typeof formData];
        const error = errors[fieldName];

        switch (fieldName) {
            case "subject":
                return (
                    <div key={fieldName} className="space-y-2">
                        <Label htmlFor={fieldName}>
                            {fieldConfig.label || "Sujet"}
                            {fieldConfig.required && <span className="text-red-500 ml-1">*</span>}
                        </Label>
                        <Input
                            id={fieldName}
                            value={value as string}
                            onChange={(e) => updateFormData(fieldName, e.target.value)}
                            placeholder={fieldConfig.placeholder}
                            required={fieldConfig.required}
                            disabled={fieldConfig.disabled}
                        />
                        {error && <p className="text-sm text-red-500">{error}</p>}
                        {fieldConfig.helpText && (
                            <p className="text-sm text-gray-500">{fieldConfig.helpText}</p>
                        )}
                    </div>
                );

            case "content":
                return (
                    <div key={fieldName} className="space-y-2">
                        <Label htmlFor={fieldName}>
                            {fieldConfig.label || "Description"}
                            {fieldConfig.required && <span className="text-red-500 ml-1">*</span>}
                        </Label>
                        <Textarea
                            id={fieldName}
                            value={value as string}
                            onChange={(e) => updateFormData(fieldName, e.target.value)}
                            placeholder={fieldConfig.placeholder}
                            required={fieldConfig.required}
                            disabled={fieldConfig.disabled}
                            rows={4}
                        />
                        {error && <p className="text-sm text-red-500">{error}</p>}
                        {fieldConfig.helpText && (
                            <p className="text-sm text-gray-500">{fieldConfig.helpText}</p>
                        )}
                    </div>
                );

            case "status":
                if (!fieldConfig.options) return null;
                return (
                    <div key={fieldName} className="space-y-2">
                        <Label htmlFor={fieldName}>
                            {fieldConfig.label || "Statut"}
                            {fieldConfig.required && <span className="text-red-500 ml-1">*</span>}
                        </Label>
                        <Select
                            value={value as string || ""}
                            onValueChange={(value) => updateFormData(fieldName, value)}
                            disabled={fieldConfig.disabled}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder={fieldConfig.placeholder || "Choisir un statut"} />
                            </SelectTrigger>
                            <SelectContent>
                                {fieldConfig.options.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {error && <p className="text-sm text-red-500">{error}</p>}
                    </div>
                );

            case "occurred_at":
                return (
                    <div key={fieldName} className="space-y-2">
                        <Label htmlFor={fieldName}>
                            {fieldConfig.label || "Date"}
                            {fieldConfig.required && <span className="text-red-500 ml-1">*</span>}
                        </Label>
                        <Input
                            id={fieldName}
                            type="date"
                            value={value as string}
                            onChange={(e) => updateFormData(fieldName, e.target.value)}
                            required={fieldConfig.required}
                            disabled={fieldConfig.disabled}
                        />
                        {error && <p className="text-sm text-red-500">{error}</p>}
                    </div>
                );

            case "zones":
                return (
                    <div key={fieldName} className="space-y-2">
                        <Label htmlFor={fieldName}>
                            {fieldConfig.label || "Zones"}
                            {fieldConfig.required && <span className="text-red-500 ml-1">*</span>}
                        </Label>
                        <Select
                            value=""
                            onValueChange={(zoneId) => {
                                const currentZones = formData.zone_ids || [];
                                if (!currentZones.includes(zoneId)) {
                                    updateFormData("zone_ids", [...currentZones, zoneId]);
                                }
                            }}
                            disabled={fieldConfig.disabled}
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
                        <div className="flex flex-wrap gap-2">
                            {(formData.zone_ids || []).map((zoneId) => {
                                const zone = zones.find(z => z.id === zoneId);
                                return zone ? (
                                    <Badge key={zoneId} variant="secondary" className="flex items-center gap-1">
                                        {zone.name}
                                        <X
                                            className="h-3 w-3 cursor-pointer"
                                            onClick={() => {
                                                const newZones = formData.zone_ids.filter(id => id !== zoneId);
                                                updateFormData("zone_ids", newZones);
                                            }}
                                        />
                                    </Badge>
                                ) : null;
                            })}
                        </div>
                        {error && <p className="text-sm text-red-500">{error}</p>}
                    </div>
                );

            case "projects":
                if (!projects) return null;
                return (
                    <div key={fieldName} className="space-y-2">
                        <Label htmlFor={fieldName}>
                            {fieldConfig.label || "Projet"}
                            {fieldConfig.required && <span className="text-red-500 ml-1">*</span>}
                        </Label>
                        <Select
                            value={formData.project_id || ""}
                            onValueChange={(value) => updateFormData("project_id", value || null)}
                            disabled={fieldConfig.disabled}
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
                        {error && <p className="text-sm text-red-500">{error}</p>}
                    </div>
                );

            case "tags":
                return (
                    <div key={fieldName} className="space-y-2">
                        <Label htmlFor={fieldName}>
                            {fieldConfig.label || "Tags"}
                            {fieldConfig.required && <span className="text-red-500 ml-1">*</span>}
                        </Label>
                        <div className="flex gap-2">
                            <Input
                                value={currentTag}
                                onChange={(e) => setCurrentTag(e.target.value)}
                                placeholder={fieldConfig.placeholder || "Ajouter un tag..."}
                                disabled={fieldConfig.disabled}
                                onKeyPress={(e) => {
                                    if (e.key === "Enter") {
                                        e.preventDefault();
                                        addTag();
                                    }
                                }}
                            />
                            <Button type="button" variant="outline" size="sm" onClick={addTag}>
                                <Plus className="h-4 w-4" />
                            </Button>
                        </div>

                        {/* Tags affichés */}
                        <div className="flex flex-wrap gap-2">
                            {tags.map((tag) => (
                                <Badge key={tag} variant="outline" className="flex items-center gap-1">
                                    {tag}
                                    <X
                                        className="h-3 w-3 cursor-pointer"
                                        onClick={() => removeTag(tag)}
                                    />
                                </Badge>
                            ))}
                        </div>
                        {error && <p className="text-sm text-red-500">{error}</p>}
                    </div>
                );

            default:
                return null;
        }
    };

    // Fonction pour rendre les champs de métadonnées
    const renderMetadataField = (fieldName: string, fieldConfig: InteractionFormField) => {
        if (!shouldShowField(fieldConfig)) {
            return null;
        }

        const value = formData.metadata[fieldName];
        const error = errors[`metadata.${fieldName}`];

        switch (fieldName) {
            case "amount":
                return (
                    <div key={fieldName} className="space-y-2">
                        <Label htmlFor={`metadata_${fieldName}`}>
                            {fieldConfig.label || "Montant"}
                            {fieldConfig.required && <span className="text-red-500 ml-1">*</span>}
                        </Label>
                        <Input
                            id={`metadata_${fieldName}`}
                            type="number"
                            step="0.01"
                            min={fieldConfig.validation?.min || 0}
                            value={value || ""}
                            onChange={(e) => updateMetadata(fieldName, parseFloat(e.target.value) || 0)}
                            placeholder={fieldConfig.placeholder}
                            required={fieldConfig.required}
                            disabled={fieldConfig.disabled}
                        />
                        {error && <p className="text-sm text-red-500">{error}</p>}
                    </div>
                );

            case "priority":
                if (!fieldConfig.options) return null;
                return (
                    <div key={fieldName} className="space-y-2">
                        <Label htmlFor={`metadata_${fieldName}`}>
                            {fieldConfig.label || "Priorité"}
                            {fieldConfig.required && <span className="text-red-500 ml-1">*</span>}
                        </Label>
                        <Select
                            value={value?.toString() || ""}
                            onValueChange={(value) => updateMetadata(fieldName, parseInt(value))}
                            disabled={fieldConfig.disabled}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder={fieldConfig.placeholder} />
                            </SelectTrigger>
                            <SelectContent>
                                {fieldConfig.options.map((option) => (
                                    <SelectItem key={option.value} value={option.value.toString()}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {error && <p className="text-sm text-red-500">{error}</p>}
                    </div>
                );

            default:
                // Champ texte générique
                return (
                    <div key={fieldName} className="space-y-2">
                        <Label htmlFor={`metadata_${fieldName}`}>
                            {fieldConfig.label || fieldName}
                            {fieldConfig.required && <span className="text-red-500 ml-1">*</span>}
                        </Label>
                        <Input
                            id={`metadata_${fieldName}`}
                            value={value || ""}
                            onChange={(e) => updateMetadata(fieldName, e.target.value)}
                            placeholder={fieldConfig.placeholder}
                            required={fieldConfig.required}
                            disabled={fieldConfig.disabled}
                        />
                        {error && <p className="text-sm text-red-500">{error}</p>}
                    </div>
                );
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {config.layout.showHeader && (
                <div className="text-center border-b pb-4">
                    <h2 className="text-lg font-semibold">
                        {formType === "note" && "Nouvelle note"}
                        {formType === "task" && "Nouvelle tâche"}
                        {formType === "quote" && "Nouveau devis"}
                        {formType === "expense" && "Nouvelle dépense"}
                        {formType === "maintenance" && "Nouvelle intervention"}
                    </h2>
                </div>
            )}

            {/* Champs de base */}
            <div className="space-y-4">
                {renderField("subject", config.subject)}
                {renderField("content", config.content)}
                {renderField("status", config.status)}
                {renderField("occurred_at", config.occurredAt)}
            </div>

            {/* Relations */}
            {config.layout.groupFields && (
                <div className="space-y-4 border-t pt-4">
                    <h3 className="font-medium text-sm text-gray-700">Associations</h3>
                    {renderField("zones", config.zones)}
                    {renderField("projects", config.projects)}
                    {renderField("tags", config.tags)}
                </div>
            )}

            {/* Métadonnées spécifiques */}
            {config.metadata && Object.keys(config.metadata).length > 0 && (
                <div className="space-y-4 border-t pt-4">
                    <h3 className="font-medium text-sm text-gray-700">Informations spécifiques</h3>
                    {Object.entries(config.metadata).map(([fieldName, fieldConfig]) =>
                        renderMetadataField(fieldName, fieldConfig!)
                    )}
                </div>
            )}

            {/* Actions */}
            {config.layout.showFooter && (
                <div className="flex flex-col sm:flex-row gap-2 pt-4 border-t">
                    <Button type="submit" disabled={submitting} className="flex-1">
                        {submitting ? "Enregistrement..." : config.actions.submitLabel}
                    </Button>

                    {config.actions.showCancel && onCancel && (
                        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
                            Annuler
                        </Button>
                    )}

                    {config.actions.showReset && (
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setFormData(getFormDefaults(config))}
                        >
                            Réinitialiser
                        </Button>
                    )}
                </div>
            )}
        </form>
    );
}