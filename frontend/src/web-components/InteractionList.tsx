import React from 'react';

import InteractionList from '@/components/features/InteractionList';
import { createWebComponent } from './createWebComponent';
import './styles.css';

interface InteractionListWrapperProps {
  title?: string;
  type?: string;
  status?: string;
  limit?: number;
  household_id?: string;
  empty_message?: string;
}

const InteractionListWrapper: React.FC<InteractionListWrapperProps> = ({
  household_id,
  empty_message,
  ...props
}) => (
  <InteractionList
    {...props}
    householdId={household_id}
    emptyMessage={empty_message}
  />
);

export const {
  WebComponent: InteractionListElement,
  ReactComponent: InteractionListComponent,
} = createWebComponent<InteractionListWrapperProps>({
  component: InteractionListWrapper,
  tagName: 'ui-interaction-list',
  propMapping: {
    title: 'string',
    type: 'string',
    status: 'string',
    limit: 'number',
    household_id: 'string',
    empty_message: 'string',
  },
  defaultProps: {
    limit: 8,
    title: 'Latest interactions',
    empty_message: 'No interactions found for this filter.',
  },
});

export default InteractionListElement;
