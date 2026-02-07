import { View, Text, ScrollView, StyleSheet, TouchableOpacity, StatusBar } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import React, { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';

export default function HistoryScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const isDark = colorScheme === 'dark';
  const theme = {
    bg: isDark ? '#000' : '#fff',
    text: isDark ? '#fff' : '#000',
    border: isDark ? '#333' : '#ccc',
    cardBg: isDark ? '#111' : '#f9f9f9',
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
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={[styles.header, { color: theme.text }]}>Search History</Text>
        
        {history.length === 0 ? (
          <Text style={[styles.emptyText, { color: theme.text }]}>No search history yet</Text>
        ) : (
          <>
            <TouchableOpacity style={styles.clearButton} onPress={clearHistory}>
              <Text style={styles.clearButtonText}>Clear History</Text>
            </TouchableOpacity>
            
            {history.map((item, index) => (
              <TouchableOpacity 
                key={index} 
                style={[styles.historyItem, { backgroundColor: theme.cardBg, borderColor: theme.border }]}
                onPress={() => handleHistoryItemPress(item.sku)}
              >
                <Text style={[styles.itemName, { color: theme.text }]}>{item.name}</Text>
                <Text style={[styles.itemSku, { color: theme.text }]}>SKU: {item.sku}</Text>
                <Text style={[styles.itemPrice, { color: '#C00' }]}>{item.price}</Text>
                <Text style={[styles.itemDate, { color: theme.text }]}>{new Date(item.date).toLocaleDateString()}</Text>
              </TouchableOpacity>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 50 },
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
