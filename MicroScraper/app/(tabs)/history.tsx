import { Text, ScrollView, StyleSheet, TouchableOpacity, StatusBar, Alert, TextInput, RefreshControl } from 'react-native';
import SelectableText from '@/components/SelectableText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import React, { useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Colors } from '@/constants/theme';
import { Swipeable, GestureHandlerRootView } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      loadHistory();
    }, [])
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

  const onRefresh = async () => {
    setRefreshing(true);
    await loadHistory();
    setRefreshing(false);
  };

  const clearHistory = async () => {
    Alert.alert('Are you sure?', 'Clear all history?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes',
        style: 'destructive',
        onPress: async () => {
          try {
            await AsyncStorage.removeItem('searchHistory');
            setHistory([]);
          } catch (error) {
            console.error('Error clearing history:', error);
          }
        },
      },
    ]);
  };

  const deleteHistoryItem = async (sku: string) => {
    try {
      const updated = history.filter(item => item.sku !== sku);
      await AsyncStorage.setItem('searchHistory', JSON.stringify(updated));
      setHistory(updated);
    } catch (error) {
      console.error('Error deleting history item:', error);
    }
  };

  const handleHistoryItemPress = async (sku: string) => {
    try {
      await AsyncStorage.setItem('pendingSearch', sku);
      router.push('/');
    } catch (error) {
      console.error('Error navigating to item:', error);
    }
  };

  const filteredHistory = history.filter((item) => {
    const haystack = `${item.name || ''} ${item.sku || ''}`.toLowerCase();
    return haystack.includes(searchQuery.trim().toLowerCase());
  });

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
        <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { backgroundColor: colors.background }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.tint} />}
        >
          <Text style={[styles.header, { color: colors.text }]}>Search History</Text>

          <TextInput
            style={[styles.searchInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.card }]}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search history"
            placeholderTextColor="#888"
            autoCorrect={false}
          />

          {history.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.text }]}>No search history yet</Text>
          ) : (
            <>
              <Text style={styles.swipeHint}>Swipe left to delete an item</Text>
              <TouchableOpacity style={styles.clearButton} onPress={clearHistory}>
                <Text style={styles.clearButtonText}>Clear All History</Text>
              </TouchableOpacity>

              {filteredHistory.map((item, index) => (
                <Swipeable
                  key={index}
                  renderRightActions={() => (
                    <TouchableOpacity
                      style={styles.swipeDeleteBtn}
                      onPress={() => deleteHistoryItem(item.sku)}
                    >
                      <Ionicons name="trash" size={20} color="white" />
                      <Text style={styles.swipeDeleteText}>Delete</Text>
                    </TouchableOpacity>
                  )}
                >
                  <TouchableOpacity
                    style={[styles.historyItem, { backgroundColor: colors.card, borderColor: colors.border }]}
                    onPress={() => handleHistoryItemPress(item.sku)}
                  >
                    <SelectableText style={[styles.itemName, { color: colors.text }]}>{item.name}</SelectableText>
                    <SelectableText style={[styles.itemSku, { color: colors.text }]}>SKU: {item.sku}</SelectableText>
                    <SelectableText style={[styles.itemPrice, { color: '#C00' }]}>{item.price}</SelectableText>
                    <SelectableText style={[styles.itemDate, { color: colors.text }]}>{new Date(item.date).toLocaleDateString()}</SelectableText>
                  </TouchableOpacity>
                </Swipeable>
              ))}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1 },
  scrollContent:   { padding: 20 },
  header:          { fontSize: 24, fontWeight: 'bold', marginBottom: 8 },
  swipeHint:       { fontSize: 12, color: '#aaa', marginBottom: 12 },
  emptyText:       { fontSize: 16, textAlign: 'center', marginTop: 40 },
  clearButton:     { backgroundColor: '#C00', padding: 10, borderRadius: 8, marginBottom: 20 },
  clearButtonText: { color: '#fff', textAlign: 'center', fontWeight: '600' },
  searchInput:     { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 14 },
  historyItem:     { padding: 15, borderWidth: 1, borderRadius: 8, marginBottom: 10 },
  itemName:        { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  itemSku:         { fontSize: 14, marginBottom: 2 },
  itemPrice:       { fontSize: 14, fontWeight: '500', marginBottom: 2 },
  itemDate:        { fontSize: 12, color: '#999' },
  swipeDeleteBtn:  { backgroundColor: '#C00', justifyContent: 'center', alignItems: 'center', width: 80, borderRadius: 8, marginBottom: 10, gap: 4 },
  swipeDeleteText: { color: 'white', fontSize: 12, fontWeight: '600' },
});
