// frontend/src/electricity/mount-electricity.tsx
import type { ComponentProps } from 'react';

import ElectricityBoardNode from '@/electricity/ElectricityBoardNode';
import { mountWithJsonScriptProps, onDomReady } from '@/lib/mount';

type ElectricityBoardNodeProps = ComponentProps<typeof ElectricityBoardNode>;

onDomReady(() => {
  mountWithJsonScriptProps<ElectricityBoardNodeProps>(
    'electricity-board-root',
    'electricity-page-props',
    ElectricityBoardNode
  );
});
