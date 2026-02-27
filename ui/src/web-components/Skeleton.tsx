import React from 'react';
import { Skeleton } from '@/design-system/skeleton';
import { cn } from '@/lib/utils';
import { createWebComponent } from './createWebComponent';
import './styles.css';

interface SkeletonWrapperProps {
  width?: string;
  height?: string;
  circle?: boolean;
}

const SkeletonWrapper: React.FC<SkeletonWrapperProps> = ({
  width = '100%',
  height = '16px',
  circle = false,
}) => {
  return (
    <Skeleton
      className={cn(circle && 'rounded-full')}
      style={{ width, height }}
    />
  );
};

export const {
  WebComponent: SkeletonElement,
  ReactComponent: SkeletonComponent,
} = createWebComponent<SkeletonWrapperProps>({
  component: SkeletonWrapper,
  tagName: 'ui-skeleton',
  propMapping: {
    width: 'string',
    height: 'string',
    circle: 'boolean',
  },
});

export default SkeletonElement;
