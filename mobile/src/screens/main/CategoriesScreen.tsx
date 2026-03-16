import React, { useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../../store';
import { fetchCategories, fetchProducts, setSelectedCategory } from '../../store/slices/productsSlice';
import type { Category } from '../../types';

export default function CategoriesScreen() {
  const dispatch = useDispatch<AppDispatch>();
  const { categories, selectedCategory } = useSelector((state: RootState) => state.products);

  useEffect(() => {
    dispatch(fetchCategories());
  }, []);

  const handleCategoryPress = (category: Category) => {
    dispatch(setSelectedCategory(category.id));
    dispatch(fetchProducts({ category: category.name, limit: 50 }));
  };

  const renderCategory = ({ item }: { item: Category }) => (
    <TouchableOpacity
      style={[
        styles.categoryCard,
        selectedCategory === item.id && styles.selectedCard,
      ]}
      onPress={() => handleCategoryPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.categoryContent}>
        <Text style={[
          styles.categoryName,
          selectedCategory === item.id && styles.selectedText,
        ]}>
          {item.name}
        </Text>
        {item.description && (
          <Text style={styles.categoryDescription} numberOfLines={2}>
            {item.description}
          </Text>
        )}
        {item.productCount !== undefined && (
          <Text style={styles.productCount}>
            {item.productCount} {item.productCount === 1 ? 'product' : 'products'}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Categories</Text>
        <Text style={styles.subtitle}>Browse by category</Text>
      </View>

      <FlatList
        data={categories}
        renderItem={renderCategory}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        numColumns={2}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No categories available</Text>
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
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
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
  list: {
    padding: 8,
  },
  categoryCard: {
    flex: 1,
    margin: 8,
    padding: 16,
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  selectedCard: {
    borderColor: '#FF6B35',
  },
  categoryContent: {
    alignItems: 'center',
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  selectedText: {
    color: '#FF6B35',
  },
  categoryDescription: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  productCount: {
    fontSize: 12,
    color: '#999',
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
