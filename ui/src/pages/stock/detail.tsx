import type { ComponentProps } from 'react';

import StockDetail from '../../../../apps/stock/react/StockDetail';
import { mountWithJsonScriptProps, onDomReady } from '@/lib/mount';

type StockDetailProps = ComponentProps<typeof StockDetail>;

onDomReady(() => {
  mountWithJsonScriptProps<StockDetailProps>('stock-detail-root', 'stock-detail-props', StockDetail, {
    withToaster: true,
  });
});
