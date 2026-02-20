import React from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';

type PropType = string | boolean | number | object | undefined;

interface WebComponentConfig<P extends Record<string, any>> {
  /**
   * Le composant React à wrapper
   */
  component: React.ComponentType<P>;
  
  /**
   * Nom du custom element (ex: 'ui-button')
   */
  tagName: string;
  
  /**
   * Map des attributs HTML → props React
   * Si une valeur est 'boolean', l'attribut est traité comme flag (présence/absence)
   * Si 'json', l'attribut est parsé comme JSON
   */
  propMapping: Record<string, 'string' | 'boolean' | 'number' | 'json'>;
  
  /**
   * Props par défaut
   */
  defaultProps?: Partial<P>;
  
  /**
   * Events customs à dispatcher
   * Ex: { onClick: 'ui-click' } → composant onClick dispatch 'ui-click'
   */
  events?: Record<string, string>;
}

/**
 * Factory générique pour créer des Web Components depuis des composants React
 */
export function createWebComponent<P extends Record<string, any>>(
  config: WebComponentConfig<P>
) {
  const { component: Component, tagName, propMapping, defaultProps = {}, events = {} } = config;

  class GenericWebComponent extends HTMLElement {
    private root: Root | null = null;
    private mountPoint: HTMLDivElement | null = null;
    private initialSlotContent = '';

    static get observedAttributes() {
      return Object.keys(propMapping);
    }

    connectedCallback() {
      // Capture initial light DOM content once (before mounting React)
      // so we don't accidentally read the internal mount node as children.
      this.initialSlotContent = this.innerHTML.trim();
      this.innerHTML = '';

      this.mountPoint = document.createElement('div');
      this.appendChild(this.mountPoint);
      this.root = createRoot(this.mountPoint);
      this.render();
    }

    disconnectedCallback() {
      this.root?.unmount();
      this.root = null;
      this.mountPoint = null;
    }

    attributeChangedCallback() {
      this.render();
    }

    private getPropsFromAttributes(): P {
      const props: Record<string, PropType> = { ...defaultProps };

      // Parse les attributs HTML en props React
      Object.entries(propMapping).forEach(([attrName, type]) => {
        const attrValue = this.getAttribute(attrName);

        switch (type) {
          case 'boolean':
            props[attrName] = this.hasAttribute(attrName);
            break;
          case 'number':
            props[attrName] = attrValue ? parseFloat(attrValue) : undefined;
            break;
          case 'json':
            try {
              props[attrName] = attrValue ? JSON.parse(attrValue) : undefined;
            } catch (e) {
              console.error(`Failed to parse JSON for ${attrName}:`, e);
            }
            break;
          case 'string':
          default:
            props[attrName] = attrValue || undefined;
        }
      });

      // Ajoute les event handlers qui dispatchent des CustomEvents
      Object.entries(events).forEach(([propName, eventName]) => {
        props[propName] = ((...args: any[]) => {
          this.dispatchEvent(
            new CustomEvent(eventName, {
              bubbles: true,
              detail: args,
            })
          );
        }) as any;
      });

      // Slot content (innerHTML) comme children
      const slotContent = this.initialSlotContent;
      if (slotContent && !props.children) {
        props.children = slotContent;
      }

      return props as P;
    }

    private render() {
      if (!this.root) return;

      const props = this.getPropsFromAttributes();
      
      this.root.render(
        <Component {...props} />
      );
    }
  }

  // Enregistre le Web Component si pas déjà fait
  if (typeof window !== 'undefined' && !customElements.get(tagName)) {
    customElements.define(tagName, GenericWebComponent);
  }

  // Retourne aussi le composant React pour usage direct
  return {
    WebComponent: GenericWebComponent,
    ReactComponent: Component,
  };
}
