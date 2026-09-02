import React, { useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ScrollView, TouchableOpacity, RefreshControl, SafeAreaView } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../../store';
import { fetchProducts } from '../../store/slices/productsSlice';
import ProductCard from '../../components/ProductCard';
import type { Product } from '../../types';

const FEATURED_CARDS = [
  {
    id: 'ghee',
    title: 'Madurai Ghee',
    subtitle: 'Freshly made by local farmers of Madurai',
    emoji: '🫙',
    accentColor: '#C8860A',
    bgColor: '#FFF8EC',
    borderColor: '#F0C96A',
  },
  {
    id: 'india',
    title: 'Products from India',
    subtitle: 'Buy at MRP price in India, delivered to your doorstep',
    emoji: '🌶️',
    accentColor: '#D94F2B',
    bgColor: '#FEF0EC',
    borderColor: '#F5B9A8',
  },
  {
    id: 'coffee',
    title: 'Kumbakonam Coffee',
    subtitle: 'Fresh ground coffee delivered at your doorstep',
    emoji: '☕',
    accentColor: '#4A2C17',
    bgColor: '#F5EDE8',
    borderColor: '#C49A7A',
  },
];

export default function HomeScreen() {
  const dispatch = useDispatch<AppDispatch>();
  const { items, loading } = useSelector((state: RootState) => state.products);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = () => {
    dispatch(fetchProducts({ featured: true, limit: 20 }));
  };

  const renderProduct = ({ item }: { item: Product }) => (
    <ProductCard
      product={item}
      onPress={() => {
        console.log('Product pressed:', item.id);
      }}
    />
  );

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={items}
        renderItem={renderProduct}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={loadProducts} />
        }
        ListHeaderComponent={
          <View>
            <View style={styles.header}>
              <Text style={styles.title}>Welcome to Saaga</Text>
              <Text style={styles.subtitle}>Fresh Indian groceries delivered to your door</Text>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.featuredScroll}
            >
              {FEATURED_CARDS.map((card) => (
                <TouchableOpacity
                  key={card.id}
                  activeOpacity={0.85}
                  style={[styles.featuredCard, { backgroundColor: card.bgColor, borderColor: card.borderColor }]}
                >
                  <View style={[styles.emojiContainer, { backgroundColor: card.accentColor }]}>
                    <Text style={styles.emojiText}>{card.emoji}</Text>
                  </View>
                  <View style={styles.cardContent}>
                    <Text style={[styles.cardTitle, { color: card.accentColor }]} numberOfLines={1}>
                      {card.title}
                    </Text>
                    <Text style={styles.cardSubtitle} numberOfLines={3}>
                      {card.subtitle}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.sectionTitle}>Featured Products</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              {loading ? 'Loading products...' : 'No products available'}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    padding: 16,
    paddingBottom: 12,
    backgroundColor: '#FFF',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
  featuredScroll: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFF',
    gap: 12,
  },
  featuredCard: {
    width: 180,
    borderRadius: 14,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  emojiContainer: {
    width: '100%',
    height: 96,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emojiText: {
    fontSize: 44,
  },
  cardContent: {
    padding: 12,
    paddingTop: 10,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#555',
    lineHeight: 17,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 4,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
});
