import React from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/design-system/card';
import { createWebComponent } from './createWebComponent';
import './styles.css';

interface CardWrapperProps {
  title?: string;
  description?: string;
  content?: string;
  footer?: string;
}

const CardWrapper: React.FC<CardWrapperProps> = ({
  title,
  description,
  content,
  footer,
}) => {
  return (
    <Card>
      {(title || description) && (
        <CardHeader>
          {title ? <CardTitle className="text-base">{title}</CardTitle> : null}
          {description ? <CardDescription>{description}</CardDescription> : null}
        </CardHeader>
      )}

      {content ? (
        <CardContent>
          <p className="text-sm">{content}</p>
        </CardContent>
      ) : null}

      {footer ? (
        <CardFooter>
          <p className="text-xs text-muted-foreground">{footer}</p>
        </CardFooter>
      ) : null}
    </Card>
  );
};

export const { WebComponent: CardElement, ReactComponent: CardComponent } =
  createWebComponent<CardWrapperProps>({
    component: CardWrapper,
    tagName: 'ui-card',
    propMapping: {
      title: 'string',
      description: 'string',
      content: 'string',
      footer: 'string',
    },
  });

export default CardElement;
