import React, { useState } from 'react';
import {
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  StatusBar,
  Modal,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Swipeable, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { fetchProductBySku } from '../../services/scraper';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ListItem {
  id: string;
  sku: string;
  name: string;
  price: number | null; // numeric, pre-tax
  rawPrice: string;     // display string e.g. "$49.99"
  storeId: string;
  date: string;
}

export interface ItemList {
  id: string;
  name: string;
  items: ListItem[];
}

const STORAGE_KEY = 'itemLists';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function randomThreeDigitName(existing: string[]): string {
  let name: string;
  let attempts = 0;
  do {
    name = String(Math.floor(100 + Math.random() * 900));
    attempts++;
  } while (existing.includes(name) && attempts < 100);
  return name;
}

function parsePrice(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const n = parseFloat(raw.replace(/[^0-9.]/g, ''));
  return isNaN(n) ? null : n;
}

function listTotal(items: ListItem[]): string {
  const total = items.reduce((sum, item) => sum + (item.price ?? 0), 0);
  return `$${total.toFixed(2)}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ListScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const theme = {
    bg: colors.background,
    text: colors.text,
    card: colors.card,
    border: colors.border,
  };

  const [lists, setLists] = useState<ItemList[]>([]);
  const [currentListId, setCurrentListId] = useState<string | null>(null);
  const [storeId, setStoreId] = useState('071');

  // Modals
  const [showListPicker, setShowListPicker] = useState(false);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [addSkuInput, setAddSkuInput] = useState('');
  const [addingItem, setAddingItem] = useState(false);

  // Rename
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameInput, setRenameInput] = useState('');
  const [renamingListId, setRenamingListId] = useState<string | null>(null);

  const router = useRouter();

  // ── Load data on focus ──────────────────────────────────────────────────────
  useFocusEffect(
    React.useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    const [sid, raw] = await Promise.all([
      AsyncStorage.getItem('storeId'),
      AsyncStorage.getItem(STORAGE_KEY),
    ]);
    if (sid) setStoreId(sid);

    const parsed: ItemList[] = raw ? JSON.parse(raw) : [];
    setLists(parsed);

    if (parsed.length > 0) {
      setCurrentListId(prev =>
        parsed.find(l => l.id === prev) ? prev : parsed[0].id
      );
    } else {
      setCurrentListId(null);
    }
  };

  const saveLists = async (updated: ItemList[]) => {
    setLists(updated);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  // ── Current list ────────────────────────────────────────────────────────────
  const currentList = lists.find(l => l.id === currentListId) ?? null;

  // ── Create list (instant, random 3-digit name) ─────────────────────────────
  const handleCreateList = async () => {
    const name = randomThreeDigitName(lists.map(l => l.name));
    const newList: ItemList = { id: Date.now().toString(), name, items: [] };
    const updated = [...lists, newList];
    await saveLists(updated);
    setCurrentListId(newList.id);
  };

  // ── Rename list ─────────────────────────────────────────────────────────────
  const openRename = (listId: string) => {
    const list = lists.find(l => l.id === listId);
    if (!list) return;
    setRenamingListId(listId);
    setRenameInput(list.name);
    setShowRenameModal(true);
  };

  const handleRenameList = async () => {
    const name = renameInput.trim();
    if (!name) {
      Alert.alert('Name required', 'Please enter a name.');
      return;
    }
    const updated = lists.map(l => l.id === renamingListId ? { ...l, name } : l);
    await saveLists(updated);
    setShowRenameModal(false);
    setRenamingListId(null);
  };

  // ── Delete list ─────────────────────────────────────────────────────────────
  const handleDeleteList = () => {
    if (!currentList) return;
    Alert.alert(
      `Delete "${currentList.name}"?`,
      'This will permanently delete the list and all its items.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const updated = lists.filter(l => l.id !== currentListId);
            await saveLists(updated);
            setCurrentListId(updated.length > 0 ? updated[0].id : null);
          },
        },
      ]
    );
  };

  // ── Delete list from picker (swipe) ─────────────────────────────────────────
  const deleteListFromPicker = (listId: string) => {
    const list = lists.find(l => l.id === listId);
    Alert.alert(
      `Delete "${list?.name}"?`,
      'This will permanently delete the list and all its items.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const updated = lists.filter(l => l.id !== listId);
            await saveLists(updated);
            if (currentListId === listId) {
              setCurrentListId(updated.length > 0 ? updated[0].id : null);
            }
            if (updated.length === 0) setShowListPicker(false);
          },
        },
      ]
    );
  };

  // ── Delete all lists ───────────────────────────────────────────────────────
  const handleDeleteAllLists = () => {
    Alert.alert(
      'Delete All Lists?',
      `This will permanently delete all ${lists.length} list${lists.length !== 1 ? 's' : ''} and their items.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            await saveLists([]);
            setCurrentListId(null);
          },
        },
      ]
    );
  };

  // ── Add item by SKU ─────────────────────────────────────────────────────────
  const handleAddItem = async () => {
    const rawSku = addSkuInput.trim();
    if (!rawSku) {
      Alert.alert('SKU required', 'Please enter a SKU.');
      return;
    }
    if (!currentList) return;

    setAddingItem(true);
    try {
      const sid = await AsyncStorage.getItem('storeId') || storeId;
      const result = await fetchProductBySku(rawSku, sid);

      if (result.error) {
        Alert.alert('Product Not Found', `No product found for SKU: ${rawSku}`);
        return;
      }

      const price = parsePrice((result as any).sale_price || result.price);
      const newItem: ListItem = {
        id: Date.now().toString(),
        sku: result.sku || rawSku,
        name: result.name || rawSku,
        price,
        rawPrice: (result as any).sale_price || result.price || '—',
        storeId: sid,
        date: new Date().toISOString(),
      };

      const updated = lists.map(l =>
        l.id === currentListId
          ? { ...l, items: [...l.items, newItem] }
          : l
      );
      await saveLists(updated);
      setAddSkuInput('');
      setShowAddItemModal(false);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to fetch product.');
    } finally {
      setAddingItem(false);
    }
  };

  // ── Remove item (with confirmation — used by ✕ button) ─────────────────────
  const handleRemoveItem = (itemId: string) => {
    Alert.alert('Remove item?', 'Remove this item from the list?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const updated = lists.map(l =>
            l.id === currentListId
              ? { ...l, items: l.items.filter(i => i.id !== itemId) }
              : l
          );
          await saveLists(updated);
        },
      },
    ]);
  };

  // ── Remove item direct (no confirmation — used by swipe) ──────────────────
  const deleteItemDirect = async (itemId: string) => {
    const updated = lists.map(l =>
      l.id === currentListId
        ? { ...l, items: l.items.filter(i => i.id !== itemId) }
        : l
    );
    await saveLists(updated);
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />

      {/* ── Header ── */}
      <View style={styles.topBar}>
        <Text style={[styles.pageTitle, { color: theme.text }]}>Lists</Text>
        <View style={styles.topBarActions}>
          {lists.length >= 1 && (
            <TouchableOpacity
              onPress={handleDeleteAllLists}
              style={styles.iconBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="trash" size={22} color="#C00" />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={handleCreateList} style={styles.iconBtn}>
            <Ionicons name="add-circle-outline" size={28} color="#0173DF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── List selector + delete ── */}
      {lists.length > 0 && (
        <View style={[styles.listSelectorRow, { borderBottomColor: theme.border }]}>
          <TouchableOpacity
            style={[styles.listSelectorBtn, { borderColor: theme.border }]}
            onPress={() => setShowListPicker(true)}
            onLongPress={() => currentListId && openRename(currentListId)}
            delayLongPress={400}
          >
            <Text style={[styles.listSelectorText, { color: theme.text }]} numberOfLines={1}>
              {currentList?.name ?? 'Select list'}
            </Text>
            <Ionicons name="chevron-down" size={16} color={theme.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDeleteList} style={styles.iconBtn}>
            <Ionicons name="trash-outline" size={22} color="#C00" />
          </TouchableOpacity>
        </View>
      )}

      {/* ── Pre-tax total ── */}
      {currentList && (
        <View style={[styles.totalBar, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.totalLabel, { color: theme.text }]}>Pre-Tax Total</Text>
          <Text style={styles.totalValue}>{listTotal(currentList.items)}</Text>
        </View>
      )}

      {/* ── Item list ── */}
      {!currentList ? (
        <View style={styles.emptyState}>
          <Ionicons name="list-outline" size={60} color="#aaa" />
          <Text style={[styles.emptyText, { color: theme.text }]}>No lists yet</Text>
          <Text style={{ color: '#aaa', marginTop: 6 }}>Tap + to create your first list</Text>
        </View>
      ) : currentList.items.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="cart-outline" size={60} color="#aaa" />
          <Text style={[styles.emptyText, { color: theme.text }]}>List is empty</Text>
          <Text style={{ color: '#aaa', marginTop: 6 }}>Tap "Add Item" to add a product by SKU</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.itemList}>
          {currentList.items.map((item, idx) => (
            <Swipeable
              key={item.id}
              renderRightActions={() => (
                <TouchableOpacity
                  style={[styles.swipeDeleteBtn, { marginBottom: 10 }]}
                  onPress={() => deleteItemDirect(item.id)}
                >
                  <Ionicons name="trash" size={20} color="white" />
                  <Text style={styles.swipeDeleteText}>Delete</Text>
                </TouchableOpacity>
              )}
            >
              <TouchableOpacity
                activeOpacity={0.7}
                style={[styles.itemRow, { backgroundColor: theme.card, borderColor: theme.border }]}
                onPress={async () => {
                  await AsyncStorage.setItem('pendingSearch', item.sku);
                  router.push('/');
                }}
              >
                <View style={styles.itemIndex}>
                  <Text style={{ color: '#aaa', fontSize: 13 }}>{idx + 1}</Text>
                </View>
                <View style={styles.itemInfo}>
                  <Text style={[styles.itemName, { color: theme.text }]} numberOfLines={2}>
                    {item.name}
                  </Text>
                  <Text style={[styles.itemSku, { color: '#aaa' }]}>SKU: {item.sku}</Text>
                </View>
                <Text style={styles.itemPrice}>{item.rawPrice}</Text>
                <TouchableOpacity onPress={() => handleRemoveItem(item.id)} style={styles.removeBtn}>
                  <Ionicons name="close-circle-outline" size={22} color="#C00" />
                </TouchableOpacity>
              </TouchableOpacity>
            </Swipeable>
          ))}
        </ScrollView>
      )}

      {/* ── Add Item FAB ── */}
      {currentList && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => {
            setAddSkuInput('');
            setShowAddItemModal(true);
          }}
        >
          <Ionicons name="add" size={28} color="white" />
          <Text style={styles.fabText}>Add Item</Text>
        </TouchableOpacity>
      )}

      {/* ── New list FAB (top-right + button) is handled via handleCreateList directly */}

      {/* ── List picker modal (swipe-to-delete rows) ── */}
      <Modal visible={showListPicker} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Select List</Text>
            <Text style={styles.pickerHint}>Swipe left to delete • Long press name to rename</Text>
            <ScrollView style={styles.pickerScroll}>
              {lists.map(list => (
                <Swipeable
                  key={list.id}
                  renderRightActions={() => (
                    <TouchableOpacity
                      style={styles.swipeDeleteBtn}
                      onPress={() => deleteListFromPicker(list.id)}
                    >
                      <Ionicons name="trash" size={20} color="white" />
                      <Text style={styles.swipeDeleteText}>Delete</Text>
                    </TouchableOpacity>
                  )}
                >
                  <TouchableOpacity
                    style={[
                      styles.pickerRow,
                      { borderBottomColor: theme.border, backgroundColor: theme.card },
                      list.id === currentListId && styles.pickerRowActive,
                    ]}
                    onPress={() => {
                      setCurrentListId(list.id);
                      setShowListPicker(false);
                    }}
                  >
                    <Text style={[styles.pickerRowText, { color: theme.text }]}>{list.name}</Text>
                    <Text style={{ color: '#aaa' }}>{list.items.length} items</Text>
                    {list.id === currentListId && (
                      <Ionicons name="checkmark" size={18} color="#0173DF" />
                    )}
                  </TouchableOpacity>
                </Swipeable>
              ))}
            </ScrollView>
            {lists.length >= 2 && (
              <TouchableOpacity
                style={styles.deleteAllBtn}
                onPress={() => {
                  setShowListPicker(false);
                  // Small delay so the modal closes before the alert appears
                  setTimeout(handleDeleteAllLists, 300);
                }}
              >
                <Ionicons name="trash" size={16} color="#C00" />
                <Text style={styles.deleteAllBtnText}>Delete All Lists</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => setShowListPicker(false)}
            >
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Rename list modal ── */}
      <Modal visible={showRenameModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Rename List</Text>
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.border }]}
              placeholder="List name"
              placeholderTextColor="#aaa"
              value={renameInput}
              onChangeText={setRenameInput}
              onSubmitEditing={handleRenameList}
              autoFocus
              selectTextOnFocus
            />
            <TouchableOpacity style={styles.primaryBtn} onPress={handleRenameList}>
              <Text style={styles.primaryBtnText}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => setShowRenameModal(false)}
            >
              <Text style={styles.closeBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Add item by SKU modal ── */}
      <Modal visible={showAddItemModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Add Item</Text>
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.border }]}
              placeholder="Enter SKU"
              placeholderTextColor="#aaa"
              value={addSkuInput}
              onChangeText={setAddSkuInput}
              keyboardType="numeric"
              autoFocus
              onSubmitEditing={handleAddItem}
            />
            {addingItem ? (
              <ActivityIndicator size="large" color="#0173DF" style={{ marginVertical: 20 }} />
            ) : (
              <>
                <TouchableOpacity style={styles.primaryBtn} onPress={handleAddItem}>
                  <Text style={styles.primaryBtnText}>Add to List</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.closeBtn}
                  onPress={() => {
                    setAddSkuInput('');
                    setShowAddItemModal(false);
                  }}
                >
                  <Text style={styles.closeBtnText}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
    </GestureHandlerRootView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:       { flex: 1, paddingTop: 50 },
  topBar:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 8 },
  topBarActions:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pageTitle:       { fontSize: 24, fontWeight: 'bold' },
  iconBtn:         { padding: 6 },
  listSelectorRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 10, borderBottomWidth: 1, gap: 10 },
  listSelectorBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10 },
  listSelectorText:{ fontSize: 16, fontWeight: '600', flex: 1, marginRight: 8 },
  totalBar:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 20, marginTop: 12, padding: 14, borderRadius: 10, borderWidth: 1 },
  totalLabel:      { fontSize: 16, fontWeight: '600' },
  totalValue:      { fontSize: 22, fontWeight: 'bold', color: '#0173DF' },
  emptyState:      { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyText:       { fontSize: 18, fontWeight: '600' },
  itemList:        { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 100 },
  itemRow:         { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 10, gap: 10 },
  itemIndex:       { width: 24, alignItems: 'center' },
  itemInfo:        { flex: 1 },
  itemName:        { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  itemSku:         { fontSize: 12 },
  itemPrice:       { fontSize: 16, fontWeight: 'bold', color: '#C00', minWidth: 60, textAlign: 'right' },
  removeBtn:       { padding: 4 },
  fab:             { position: 'absolute', bottom: 24, right: 24, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#0173DF', paddingVertical: 14, paddingHorizontal: 20, borderRadius: 30, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4 },
  fabText:         { color: 'white', fontWeight: 'bold', fontSize: 16 },
  modalOverlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center' },
  modalBox:        { margin: 24, borderRadius: 12, padding: 24, gap: 12, maxHeight: '80%' },
  pickerScroll:    { maxHeight: 320, flexGrow: 0 },
  modalTitle:      { fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 4 },
  input:           { borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  primaryBtn:      { backgroundColor: '#0173DF', padding: 15, borderRadius: 10, alignItems: 'center' },
  primaryBtnText:  { color: 'white', fontWeight: 'bold', fontSize: 16 },
  closeBtn:        { padding: 14, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#ccc' },
  closeBtnText:    { fontWeight: 'bold', fontSize: 15, color: '#555' },
  pickerRow:       { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, borderBottomWidth: 1 },
  pickerRowActive: { opacity: 0.85 },
  pickerRowText:   { flex: 1, fontSize: 16, fontWeight: '500' },
  pickerHint:      { fontSize: 12, color: '#aaa', textAlign: 'center', marginBottom: 8 },
  swipeDeleteBtn:  { backgroundColor: '#C00', justifyContent: 'center', alignItems: 'center', width: 80, borderRadius: 6, marginVertical: 2, gap: 4 },
  swipeDeleteText: { color: 'white', fontSize: 12, fontWeight: '600' },
  deleteAllBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: '#C00' },
  deleteAllBtnText:{ color: '#C00', fontWeight: '600', fontSize: 14 },
});
