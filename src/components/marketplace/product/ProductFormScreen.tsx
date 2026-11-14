import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { Screen, StickyActionBar } from '../../ui';
import { useAction } from '../../../hooks/useAction';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { useFormState } from '../../../hooks/useFormState';
import { merchantApi } from '../../../lib/marketplace/api';
import { errorMessage, parseFieldErrors } from '../../../lib/marketplace/errors';
import { blankProduct, productFieldKey, productToForm, productToPayload, validateProduct } from '../../../lib/marketplace/productForm';
import { firstError } from '../../../lib/marketplace/validation';
import { ProductBasicsSection } from './ProductBasicsSection';
import { ProductInventorySection } from './ProductInventorySection';
import { ProductPricingSection } from './ProductPricingSection';
import { ProductSpecsSection } from './ProductSpecsSection';
import { ProductSupplySection } from './ProductSupplySection';

/** Create or edit a product. Drafts only need a title; publishing runs every rule (hand-off §8.1). */
export function ProductFormScreen({ productId }: { productId?: string }) {
  const { form, setForm, errors, setErrors, set } = useFormState(blankProduct);
  const { run, isBusy } = useAction();
  const [formError, setFormError] = useState('');
  const existing = useAsyncData(() => (productId ? merchantApi.product(productId) : Promise.resolve(undefined)), [productId], { errorText: 'Could not load this product.' });

  // Fill the form once the product arrives (edit mode only).
  useEffect(() => { if (existing.data) setForm(productToForm(existing.data)); }, [existing.data, setForm]);

  const status = existing.data?.status ?? 'draft';
  const loadingExisting = !!productId && existing.loading;
  const editing = !!productId;

  const save = async (target: 'published' | 'draft' | 'archived') => {
    const found = validateProduct(form, target === 'draft' ? 'draft' : 'publish');
    setErrors(found);
    if (Object.keys(found).length) { setFormError(firstError(found) ?? ''); return; }
    setFormError('');
    const payload = productToPayload(form, target);
    const saved = await run(`save:${target}`, async () => {
      try { return editing ? await merchantApi.updateProduct(productId!, payload) : await merchantApi.createProduct(payload); }
      catch (cause) {
        const fields = parseFieldErrors(cause);
        setErrors(Object.fromEntries(Object.entries(fields).map(([path, message]) => [productFieldKey(path), message])));
        setFormError(errorMessage(cause, 'The server rejected this product.'));
        throw cause;
      }
    }, { silent: true });
    if (saved) router.replace('/store/products' as never);
  };

  const sections = { form, errors, set };
  const actions = !editing || status === 'draft'
    ? [
      { title: 'Save as draft', variant: 'soft' as const, loading: isBusy('save:draft'), disabled: isBusy(), onPress: () => void save('draft') },
      { title: 'Publish', loading: isBusy('save:published'), disabled: isBusy(), onPress: () => void save('published') },
    ]
    : [{ title: 'Save changes', loading: isBusy('save:published') || isBusy('save:archived'), disabled: isBusy(), onPress: () => void save(status === 'archived' ? 'archived' : 'published') }];

  return <Screen title={editing ? 'Edit product' : 'Add product'} onBack={() => router.back()} loading={loadingExisting} error={editing && existing.error ? existing.error : ''} onRetry={() => void existing.reload()}
    footer={<StickyActionBar actions={actions} error={formError} />}>
    <ProductBasicsSection {...sections} />
    <ProductPricingSection {...sections} />
    <ProductSupplySection {...sections} />
    <ProductInventorySection {...sections} />
    <ProductSpecsSection {...sections} />
  </Screen>;
}
