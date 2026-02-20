import React from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { createWebComponent } from './createWebComponent';
import './styles.css';

interface AlertWrapperProps {
  variant?: 'default' | 'destructive';
  title?: string;
  description?: string;
}

const AlertWrapper: React.FC<AlertWrapperProps> = ({
  variant = 'default',
  title,
  description,
}) => {
  return (
    <Alert variant={variant}>
      {title ? <AlertTitle>{title}</AlertTitle> : null}
      {description ? (
        <AlertDescription>
          <p>{description}</p>
        </AlertDescription>
      ) : null}
    </Alert>
  );
};

export const { WebComponent: AlertElement, ReactComponent: AlertComponent } =
  createWebComponent<AlertWrapperProps>({
    component: AlertWrapper,
    tagName: 'ui-alert',
    propMapping: {
      variant: 'string',
      title: 'string',
      description: 'string',
    },
    defaultProps: {
      variant: 'default',
    },
  });

export default AlertElement;
