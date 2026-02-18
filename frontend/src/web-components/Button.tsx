import React from 'react';
import { Button } from '@/components/ui/button';
import type { ButtonProps } from '@/components/ui/button';
import { createWebComponent } from './createWebComponent';
import './styles.css';

interface ButtonWrapperProps extends Omit<ButtonProps, 'children'> {
  text?: string;
  children?: React.ReactNode;
}

const ButtonWrapper: React.FC<ButtonWrapperProps> = ({ text, children, ...props }) => (
  <Button {...props}>{text || children}</Button>
);

export const { WebComponent: ButtonElement, ReactComponent: ButtonComponent } = 
  createWebComponent<ButtonWrapperProps>({
    component: ButtonWrapper,
    tagName: 'ui-button',
    propMapping: {
      variant: 'string',
      size: 'string',
      disabled: 'boolean',
      type: 'string',
      text: 'string',
    },
    defaultProps: {
      variant: 'default',
      size: 'default',
      type: 'button',
    },
    events: {
      onClick: 'ui-click',
    },
  });

export default ButtonElement;
