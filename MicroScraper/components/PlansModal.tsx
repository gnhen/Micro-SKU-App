import React, { useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, ScrollView,
  Image, StyleSheet, Dimensions, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GestureHandlerRootView, PinchGestureHandler, PanGestureHandler } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { Plan, getPlansForDepartment, getAllPlans } from '@/constants/plansData';
import type { Department } from '@/contexts/SettingsContext';

interface Props {
  visible: boolean;
  onClose: () => void;
  department: Department;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function PlansModal({ visible, onClose, department }: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [fullScreenImage, setFullScreenImage] = useState<number | null>(null);

  // Pinch / pan shared values for fullscreen zoom
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const resetImageTransform = () => {
    scale.value = 1;
    savedScale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
  };

  const onPinchGesture = (event: any) => {
    scale.value = savedScale.value * event.nativeEvent.scale;
  };

  const onPinchEnd = () => {
    savedScale.value = scale.value;
    if (scale.value < 1) {
      scale.value = withSpring(1);
      savedScale.value = 1;
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
      savedTranslateX.value = 0;
      savedTranslateY.value = 0;
    }
  };

  const onPanGesture = (event: any) => {
    if (scale.value > 1) {
      translateX.value = savedTranslateX.value + event.nativeEvent.translationX;
      translateY.value = savedTranslateY.value + event.nativeEvent.translationY;
    }
  };

  const onPanEnd = () => {
    savedTranslateX.value = translateX.value;
    savedTranslateY.value = translateY.value;
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const theme = {
    bg: colors.background,
    text: colors.text,
    card: colors.card,
    border: colors.border,
  };

  const deptPlans = getPlansForDepartment(department);
  const allPlans = getAllPlans();
  const displayedPlans = showAll ? allPlans : deptPlans;
  const canShowAll = !showAll && deptPlans.length < allPlans.length;

  const handleClose = () => {
    setSelectedPlan(null);
    setShowAll(false);
    setFullScreenImage(null);
    resetImageTransform();
    onClose();
  };

  const handleBack = () => {
    setSelectedPlan(null);
  };

  const handleOpenFullscreen = (img: number) => {
    resetImageTransform();
    setFullScreenImage(img);
  };

  const handleCloseFullscreen = () => {
    resetImageTransform();
    setFullScreenImage(null);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <View style={[styles.container, { backgroundColor: theme.bg }]}>
        <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />

        {/* ── Header ── */}
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          {selectedPlan ? (
            <TouchableOpacity style={styles.headerBtn} onPress={handleBack}>
              <Ionicons name="chevron-back" size={26} color="#0173DF" />
            </TouchableOpacity>
          ) : (
            <View style={styles.headerBtn} />
          )}

          <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>
            {selectedPlan ? selectedPlan.name : 'Plans'}
          </Text>

          <TouchableOpacity style={styles.headerBtn} onPress={handleClose}>
            <Ionicons name="close" size={26} color={theme.text} />
          </TouchableOpacity>
        </View>

        {selectedPlan ? (
          /* ── Image Gallery View ── */
          <ScrollView contentContainerStyle={styles.galleryContent}>
            {selectedPlan.images.map((img, idx) => (
              <TouchableOpacity key={idx} onPress={() => handleOpenFullscreen(img as number)} activeOpacity={0.85}>
                <Image
                  source={img}
                  style={styles.planPageImage}
                  resizeMode="contain"
                />
              </TouchableOpacity>
            ))}
            <View style={{ height: 30 }} />
          </ScrollView>
        ) : (
          /* ── Plan List View ── */
          <ScrollView contentContainerStyle={styles.listContent}>
            {displayedPlans.map((plan) => (
              <TouchableOpacity
                key={plan.name}
                style={[styles.planRow, { borderBottomColor: theme.border }]}
                onPress={() => setSelectedPlan(plan)}
              >
                <Text style={[styles.planName, { color: theme.text }]}>{plan.name}</Text>
                <View style={styles.planMeta}>
                  <Text style={styles.pageCount}>{plan.images.length} pages</Text>
                  <Ionicons name="chevron-forward" size={18} color="#aaa" />
                </View>
              </TouchableOpacity>
            ))}

            {canShowAll && (
              <TouchableOpacity
                style={styles.showAllBtn}
                onPress={() => setShowAll(true)}
              >
                <Ionicons name="documents-outline" size={18} color="#0173DF" />
                <Text style={styles.showAllText}>Show All Plans</Text>
              </TouchableOpacity>
            )}

            <View style={{ height: 40 }} />
          </ScrollView>
        )}
      </View>

      {/* ── Fullscreen Zoom Modal ── */}
      <Modal
        visible={fullScreenImage !== null}
        transparent
        onRequestClose={handleCloseFullscreen}
      >
        <GestureHandlerRootView style={styles.fullScreenContainer}>
          <PanGestureHandler
            onGestureEvent={onPanGesture}
            onEnded={onPanEnd}
            simultaneousHandlers={['pinch']}
          >
            <Animated.View style={{ flex: 1, width: '100%' }}>
              <PinchGestureHandler
                onGestureEvent={onPinchGesture}
                onEnded={onPinchEnd}
                simultaneousHandlers={['pan']}
              >
                <Animated.View style={[styles.fullScreenTouchable, animatedStyle]}>
                  {fullScreenImage !== null && (
                    <Image
                      source={fullScreenImage}
                      style={styles.fullScreenImage}
                      resizeMode="contain"
                    />
                  )}
                </Animated.View>
              </PinchGestureHandler>
            </Animated.View>
          </PanGestureHandler>
          <TouchableOpacity style={styles.closeBtn} onPress={handleCloseFullscreen}>
            <Ionicons name="close" size={50} color="white" />
          </TouchableOpacity>
        </GestureHandlerRootView>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 50,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerBtn: {
    width: 40,
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginHorizontal: 4,
  },
  listContent: {
    paddingTop: 8,
  },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  planName: {
    fontSize: 17,
    fontWeight: '500',
    flex: 1,
    marginRight: 8,
  },
  planMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pageCount: {
    fontSize: 13,
    color: '#aaa',
  },
  showAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 24,
    marginHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#0173DF',
  },
  showAllText: {
    color: '#0173DF',
    fontSize: 16,
    fontWeight: '600',
  },
  galleryContent: {
    paddingHorizontal: 0,
    paddingTop: 8,
  },
  planPageImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * 1.294,  // ~letter ratio (8.5 x 11)
    marginBottom: 4,
    backgroundColor: '#f0f0f0',
  },
  fullScreenContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.98)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenTouchable: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  closeBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 25,
    padding: 5,
  },
});
