import React from 'react';
import { Badge } from '@/components/ui/badge';
import type { BadgeProps } from '@/components/ui/badge';
import { createWebComponent } from './createWebComponent';
import './styles.css';

interface BadgeWrapperProps extends Omit<BadgeProps, 'children'> {
  text?: string;
  children?: React.ReactNode;
}

const BadgeWrapper: React.FC<BadgeWrapperProps> = ({ text, children, ...props }) => (
  <Badge {...props}>{text || children}</Badge>
);

export const { WebComponent: BadgeElement, ReactComponent: BadgeComponent } =
  createWebComponent<BadgeWrapperProps>({
    component: BadgeWrapper,
    tagName: 'ui-badge',
    propMapping: {
      variant: 'string',
      text: 'string',
    },
    defaultProps: {
      variant: 'default',
    },
  });

export default BadgeElement;
