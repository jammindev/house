import type { ComponentProps } from 'react';

import StockForm from '../../../../apps/stock/react/StockForm';
import { mountWithJsonScriptProps, onDomReady } from '@/lib/mount';

type StockFormProps = ComponentProps<typeof StockForm>;

onDomReady(() => {
  mountWithJsonScriptProps<StockFormProps>('stock-form-root', 'stock-form-props', StockForm, {
    withToaster: true,
  });
});
