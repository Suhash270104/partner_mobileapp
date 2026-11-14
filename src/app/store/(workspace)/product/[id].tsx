import { useLocalSearchParams } from 'expo-router';
import { ProductFormScreen } from '../../../../components/marketplace/product/ProductFormScreen';

export default function EditProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ProductFormScreen productId={String(id)} />;
}
