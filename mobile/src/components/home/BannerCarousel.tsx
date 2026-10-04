import React, { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { BannerSlide } from '../../data/catalogModels';

interface Props {
  slides: BannerSlide[];
  height?: number;
  style?: ViewStyle;
  imageBorderRadius?: number;
  gap?: number;
}

export default function BannerCarousel({
  slides,
  height = 210,
  style,
  imageBorderRadius = 20,
  gap = 10,
}: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [cardWidth, setCardWidth] = useState(0);
  const listRef = useRef<FlatList<BannerSlide>>(null);
  const slotWidth = cardWidth + gap;

  const canLoop = slides.length > 1;
  const loopedSlides = canLoop ? [slides[slides.length - 1], ...slides, slides[0]] : slides;

  const onLayout = (e: LayoutChangeEvent) => {
    const width = e.nativeEvent.layout.width;
    if (width > 0 && width !== cardWidth) setCardWidth(width);
  };

  const getItemLayout = (_: unknown, index: number) => ({
    length: slotWidth,
    offset: slotWidth * index,
    index,
  });

  useEffect(() => {
    if (!canLoop || !slotWidth) return undefined;
    const timer = setInterval(() => {
      const nextLoopedIndex = activeIndex + 2;
      listRef.current?.scrollToOffset({ offset: slotWidth * nextLoopedIndex, animated: true });
    }, 3500);
    return () => clearInterval(timer);
  }, [canLoop, slotWidth, activeIndex]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!slotWidth || !canLoop) return;
    const loopedIndex = Math.round(e.nativeEvent.contentOffset.x / slotWidth);
    if (loopedIndex <= 0) {
      listRef.current?.scrollToOffset({ offset: slotWidth * slides.length, animated: false });
      setActiveIndex(slides.length - 1);
    } else if (loopedIndex >= slides.length + 1) {
      listRef.current?.scrollToOffset({ offset: slotWidth, animated: false });
      setActiveIndex(0);
    } else {
      setActiveIndex(loopedIndex - 1);
    }
  };

  return (
    <View style={[styles.wrapper, style]} onLayout={onLayout}>
      {cardWidth > 0 && (
        <FlatList
          ref={listRef}
          data={loopedSlides}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={slotWidth}
          snapToAlignment="start"
          decelerationRate="fast"
          initialScrollIndex={canLoop ? 1 : 0}
          getItemLayout={getItemLayout}
          onMomentumScrollEnd={onScroll}
          renderItem={({ item }) => (
            <Image
              source={{ uri: item.imageUri }}
              style={{ width: cardWidth, height, marginRight: gap, borderRadius: imageBorderRadius }}
              resizeMode="cover"
            />
          )}
        />
      )}
      {slides.length > 1 && (
        <View style={styles.dotsRow}>
          {slides.map((slide, index) => (
            <View
              key={slide.id}
              style={[styles.dot, index === activeIndex && styles.dotActive]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: 16,
    position: 'relative',
  },
  dotsRow: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  dotActive: {
    backgroundColor: '#FFFFFF',
  },
});
