// nextjs/src/app/app/(pages)/usePageLayoutConfig.ts
'use client';

import { useCallback, useEffect } from 'react';
import { usePageLayout } from './layout';
import type { PageAction } from '@/components/layout/AppPageLayout';

export type PageLayoutConfig = {
  title?: string;
  subtitle?: string;
  context?: string;
  hideBackButton?: boolean;
  actions?: PageAction[];
  className?: string;
  contentClassName?: string;
  loading?: boolean;
};

/**
 * Retourne une fonction permettant de configurer le layout dynamiquement.
 * Si `initialConfig` est fourni, il est appliqué immédiatement.
 */
export function usePageLayoutConfig(initialConfig?: PageLayoutConfig) {
  const {
    setTitle,
    setSubtitle,
    setContext,
    setActions,
    setHideBackButton,
    setClassName,
    setContentClassName,
    setLoading,
  } = usePageLayout();

  const applyConfig = useCallback(
    (config: PageLayoutConfig) => {
      if (Object.prototype.hasOwnProperty.call(config, 'title')) {
        setTitle(config.title ?? '');
      }

      if (Object.prototype.hasOwnProperty.call(config, 'subtitle')) {
        setSubtitle(config.subtitle);
        setSubtitle("");
      }

      if (Object.prototype.hasOwnProperty.call(config, 'context')) {
        setContext(config.context);
      }

      if (Object.prototype.hasOwnProperty.call(config, 'actions')) {
        setActions(config.actions);
      }

      if (Object.prototype.hasOwnProperty.call(config, 'hideBackButton')) {
        setHideBackButton(!!config.hideBackButton);
      }

      if (Object.prototype.hasOwnProperty.call(config, 'className')) {
        setClassName(config.className);
      }

      if (Object.prototype.hasOwnProperty.call(config, 'contentClassName')) {
        setContentClassName(config.contentClassName);
      }

      if (Object.prototype.hasOwnProperty.call(config, 'loading')) {
        setLoading(!!config.loading);
      }
    },
    [
      setActions,
      setContext,
      setHideBackButton,
      setSubtitle,
      setTitle,
      setClassName,
      setContentClassName,
      setLoading,
    ],
  );

  useEffect(() => {
    if (!initialConfig) return;
    applyConfig(initialConfig);
  }, [
    applyConfig,
    initialConfig?.title,
    initialConfig?.subtitle,
    initialConfig?.context,
    initialConfig?.hideBackButton,
    initialConfig?.actions,
    initialConfig?.className,
    initialConfig?.contentClassName,
    initialConfig?.loading,
    initialConfig,
  ]);

  return applyConfig;
}
