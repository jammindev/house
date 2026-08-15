import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';

import { SheetDialog } from '@/design-system/sheet-dialog';
import { Button } from '@/design-system/button';
import { Input } from '@/design-system/input';
import { FormField } from '@/design-system/form-field';
import ZonePicker from '@/features/zones/ZonePicker';
import { useCreateHunt, useUpdateHunt } from './hooks';
import type { Hunt } from '@/lib/api/games';

interface Props {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  existing?: Hunt;
}

interface DraftStep {
  key: string;
  zone: string | null;
  riddle: string;
}

function emptyStep(): DraftStep {
  // Pas de `Math.random()` ni de `Date.now()` dans une clé de rendu React : un id
  // qui change à chaque rendu remonte tout le sous-arbre. Un compteur suffit.
  counter += 1;
  return { key: `step-${counter}`, zone: null, riddle: '' };
}
let counter = 0;

/**
 * Composer une chasse : les pièces, leur ordre, les énigmes, le trésor.
 *
 * L'**ordre du tableau fait foi** — le serveur en déduit `position` et refuse de
 * le recevoir. Deux étapes au même rang rendraient « l'étape suivante »
 * dépendante du plan d'exécution PostgreSQL.
 */
export default function HuntComposerDialog({ open, onOpenChange, existing }: Props) {
  const { t } = useTranslation();
  const isEditing = Boolean(existing);
  const createMutation = useCreateHunt();
  const updateMutation = useUpdateHunt();

  const [name, setName] = React.useState('');
  const [treasure, setTreasure] = React.useState('');
  const [steps, setSteps] = React.useState<DraftStep[]>([]);

  React.useEffect(() => {
    if (!open) return;
    if (existing) {
      setName(existing.name);
      setTreasure(existing.treasure_text);
      setSteps(
        existing.steps.map((step, index) => ({
          key: `existing-${step.id}-${index}`,
          zone: step.zone,
          riddle: step.riddle,
        })),
      );
    } else {
      setName('');
      setTreasure('');
      setSteps([emptyStep(), emptyStep()]);
    }
  }, [open, existing]);

  const usable = steps.filter((step) => step.zone !== null);
  const canSubmit = name.trim().length > 0 && usable.length > 0;
  const isPending = createMutation.isPending || updateMutation.isPending;

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    const payload = {
      name: name.trim(),
      treasure_text: treasure.trim(),
      steps: usable.map((step) => ({ zone: step.zone as string, riddle: step.riddle.trim() })),
    };
    const done = () => onOpenChange(false);
    if (existing) {
      updateMutation.mutate({ id: existing.id, payload }, { onSuccess: done });
    } else {
      createMutation.mutate(payload, { onSuccess: done });
    }
  }

  function updateStep(key: string, patch: Partial<DraftStep>) {
    setSteps((current) =>
      current.map((step) => (step.key === key ? { ...step, ...patch } : step)),
    );
  }

  return (
    <SheetDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? t('games.editTitle') : t('games.newTitle')}
      description={t('games.composerHint')}
      size="l"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField htmlFor="hunt-name" label={t('games.fieldName')}>
          <Input
            id="hunt-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t('games.namePlaceholder')}
          />
        </FormField>

        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">{t('games.fieldSteps')}</p>
          {steps.map((step, index) => (
            <div key={step.key} className="rounded-lg border border-border p-3">
              <div className="flex items-center justify-between gap-2 pb-2">
                <span className="text-xs font-medium text-muted-foreground">
                  {t('games.stepNumber', { number: index + 1 })}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setSteps((current) => current.filter((item) => item.key !== step.key))
                  }
                  aria-label={t('games.removeStep')}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </Button>
              </div>
              <div className="space-y-2">
                <ZonePicker
                  id={`hunt-step-zone-${index}`}
                  value={step.zone}
                  onChange={(zoneId) => updateStep(step.key, { zone: zoneId })}
                  placeholder={t('games.pickRoom')}
                />
                <Input
                  value={step.riddle}
                  onChange={(event) => updateStep(step.key, { riddle: event.target.value })}
                  placeholder={t('games.riddlePlaceholder')}
                  aria-label={t('games.riddleLabel', { number: index + 1 })}
                />
              </div>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={() => setSteps((current) => [...current, emptyStep()])}
          >
            <Plus className="mr-2 h-4 w-4" aria-hidden />
            {t('games.addStep')}
          </Button>
        </div>

        <FormField htmlFor="hunt-treasure" label={t('games.fieldTreasure')}>
          <Input
            id="hunt-treasure"
            value={treasure}
            onChange={(event) => setTreasure(event.target.value)}
            placeholder={t('games.treasurePlaceholder')}
          />
        </FormField>

        <div className="flex justify-end gap-2 pt-2">
          {/* « Annuler » ne se désactive jamais pendant une mutation : si elle
              traîne, il faut pouvoir sortir du dialog. */}
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={!canSubmit || isPending}>
            {t('common.save')}
          </Button>
        </div>
      </form>
    </SheetDialog>
  );
}
