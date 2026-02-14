import { View, Text, ScrollView, StyleSheet, TouchableOpacity, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import React, { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Colors } from '@/constants/theme';

export default function HistoryScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const colors = Colors[colorScheme ?? 'light'];
  const theme = {
    bg: colors.background,
    text: colors.text,
    border: colors.border,
    cardBg: colors.card,
  };

  const [history, setHistory] = useState<any[]>([]);

  useFocusEffect(
    () => {
      loadHistory();
    }
  );

  const loadHistory = async () => {
    try {
      const savedHistory = await AsyncStorage.getItem('searchHistory');
      if (savedHistory) {
        setHistory(JSON.parse(savedHistory));
      }
    } catch (error) {
      console.error('Error loading history:', error);
    }
  };

  const clearHistory = async () => {
    try {
      await AsyncStorage.removeItem('searchHistory');
      setHistory([]);
    } catch (error) {
      console.error('Error clearing history:', error);
    }
  };

  const handleHistoryItemPress = async (sku: string) => {
    try {
      // Store the SKU to search
      await AsyncStorage.setItem('pendingSearch', sku);
      // Navigate to scan tab
      router.push('/');
    } catch (error) {
      console.error('Error navigating to item:', error);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />
      <ScrollView contentContainerStyle={[styles.scrollContent, { backgroundColor: colors.background }]}>
        <Text style={[styles.header, { color: colors.text }]}>Search History</Text>
        
        {history.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.text }]}>No search history yet</Text>
        ) : (
          <>
            <TouchableOpacity style={styles.clearButton} onPress={clearHistory}>
              <Text style={styles.clearButtonText}>Clear History</Text>
            </TouchableOpacity>
            
            {history.map((item, index) => (
              <TouchableOpacity 
                key={index} 
                style={[styles.historyItem, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => handleHistoryItemPress(item.sku)}
              >
                <Text selectable style={[styles.itemName, { color: colors.text }]}>{item.name}</Text>
                <Text selectable style={[styles.itemSku, { color: colors.text }]}>SKU: {item.sku}</Text>
                <Text selectable style={[styles.itemPrice, { color: '#C00' }]}>{item.price}</Text>
                <Text selectable style={[styles.itemDate, { color: colors.text }]}>{new Date(item.date).toLocaleDateString()}</Text>
              </TouchableOpacity>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 20 },
  header: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  emptyText: { fontSize: 16, textAlign: 'center', marginTop: 40 },
  clearButton: { backgroundColor: '#C00', padding: 10, borderRadius: 8, marginBottom: 20 },
  clearButtonText: { color: '#fff', textAlign: 'center', fontWeight: '600' },
  historyItem: { padding: 15, borderWidth: 1, borderRadius: 8, marginBottom: 10 },
  itemName: { fontSize: 16, fontWeight: '600', marginBottom: 5 },
  itemSku: { fontSize: 14, marginBottom: 3 },
  itemPrice: { fontSize: 18, fontWeight: 'bold', marginBottom: 3 },
  itemDate: { fontSize: 12, opacity: 0.7 },
});
