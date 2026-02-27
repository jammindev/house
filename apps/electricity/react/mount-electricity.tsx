import type { ComponentProps } from 'react';

import ElectricityBoardNode from './ElectricityBoardNode';
import { mountWithJsonScriptProps, onDomReady } from '@/lib/mount';

type ElectricityBoardNodeProps = ComponentProps<typeof ElectricityBoardNode>;

onDomReady(() => {
  mountWithJsonScriptProps<ElectricityBoardNodeProps>(
    'electricity-board-root',
    'electricity-page-props',
    ElectricityBoardNode
  );
});
