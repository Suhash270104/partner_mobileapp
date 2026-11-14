import { useState } from 'react';
import { Image, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Badge, IconButton, IconTile, Text, ToggleRow, palette } from '../ui';
import { priceText } from '../../lib/marketplace/format';
import type { Product } from '../../lib/marketplace/types';

export interface ProductCardProps {
  product: Product; canEdit: boolean; busy?: boolean;
  onOpen: () => void; onMore: () => void; onStock: (input: { inStock?: boolean; stockQuantity?: number }) => void;
}

/** Catalogue row: photo, price, inline stock quantity (amber when low), accepting-enquiries switch, edit and menu. */
export function ProductCard({ product, canEdit, busy, onOpen, onMore, onStock }: ProductCardProps) {
  // While typing, show the draft; otherwise always show the saved quantity.
  const [draft, setDraft] = useState<string | null>(null);
  const qty = draft ?? String(product.stockQuantity ?? 0);
  const low = product.isLowStock && (product.stockQuantity ?? 0) > 0;
  const out = product.status === 'published' && (product.stockQuantity ?? 0) === 0 && product.priceType !== 'on_request';
  const commit = () => {
    const n = Number(qty);
    setDraft(null);
    if (!Number.isInteger(n) || n < 0) return;
    if (n !== product.stockQuantity) onStock({ stockQuantity: n });
  };
  const discount = product.discountPercentage && product.priceType === 'fixed' ? `${product.discountPercentage}% off` : '';
  return <View style={[s.card, busy && { opacity: 0.6 }]}>
    <Pressable onPress={onOpen} style={s.top} accessibilityRole="button" accessibilityLabel={`Open ${product.title}`}>
      {product.photos?.[0] ? <Image source={{ uri: product.photos[0] }} style={s.photo} /> : <IconTile icon="image" size={72} />}
      <View style={s.info}>
        <Text style={s.title} numberOfLines={2}>{product.title}</Text>
        <Text style={s.sub} numberOfLines={1}>{[product.category, product.sku].filter(Boolean).join(' · ')}</Text>
        <Text style={s.price}>{priceText(product)}</Text>
        <View style={s.badges}>
          {product.status === 'draft' ? <Badge label="Draft" tone="amber" /> : null}
          {product.status === 'archived' ? <Badge label="Archived" tone="slate" /> : null}
          {discount ? <Badge label={discount} tone="green" /> : null}
          {out ? <Badge label="Out of stock" tone="red" /> : null}
        </View>
      </View>
    </Pressable>
    <View style={s.bottom}>
      <View style={s.stock}>
        <Text style={s.stockLabel}>Stock</Text>
        <TextInput value={qty} onChangeText={setDraft} onEndEditing={commit} onSubmitEditing={commit} editable={canEdit} keyboardType="numeric" selectTextOnFocus
          accessibilityLabel={`Stock quantity for ${product.title}`} style={[s.stockInput, low && s.stockLow]} />
        {low ? <Text style={s.lowText}>Low</Text> : null}
      </View>
      {canEdit ? <><IconButton icon="edit" label="Edit product" onPress={onOpen} /><IconButton icon="more" label="More actions" onPress={onMore} /></> : null}
    </View>
    {canEdit ? <ToggleRow label="Accepting enquiries" value={product.inStock !== false} onChange={value => onStock({ inStock: value })} /> : null}
  </View>;
}

const s = StyleSheet.create({
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: palette.line, borderRadius: 18, padding: 12, gap: 8 },
  top: { flexDirection: 'row', gap: 12 }, photo: { width: 72, height: 72, borderRadius: 14, backgroundColor: palette.greenSoft },
  info: { flex: 1, minWidth: 0, gap: 3 }, title: { color: palette.ink, fontSize: 15, fontWeight: '800', lineHeight: 20 }, sub: { color: palette.muted, fontSize: 12 },
  price: { color: palette.green, fontSize: 15, fontWeight: '800' }, badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  bottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  stock: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }, stockLabel: { color: palette.body, fontSize: 13, fontWeight: '700' },
  stockInput: { minWidth: 72, height: 40, borderRadius: 12, borderWidth: 1.5, borderColor: palette.line, textAlign: 'center', color: palette.ink, fontSize: 15, fontWeight: '800', backgroundColor: '#fff' },
  stockLow: { borderColor: '#e6b34d', backgroundColor: palette.amberSoft }, lowText: { color: palette.amber, fontSize: 12, fontWeight: '800' },
});
