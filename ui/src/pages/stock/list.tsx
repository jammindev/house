import type { ComponentProps } from 'react';

import StockList from '../../../../apps/stock/react/StockList';
import { mountWithJsonScriptProps, onDomReady } from '@/lib/mount';

type StockListProps = ComponentProps<typeof StockList>;

onDomReady(() => {
  mountWithJsonScriptProps<StockListProps>('stock-list-root', 'stock-list-props', StockList, {
    withToaster: true,
  });
});
