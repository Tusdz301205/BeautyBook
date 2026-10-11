import React, { useState } from 'react';
import { FlatList, Image, LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { BannerSlide } from '../../data/catalogModels';
import { radius, space, type } from '../../theme';

interface Props {
  slides: BannerSlide[];
  height?: number;
  style?: ViewStyle;
  imageBorderRadius?: number;
  label?: string;
}

/** Swipe-only gallery: no auto-advance, so motion is always user initiated. */
export default function BannerCarousel({ slides, height = 240, style, imageBorderRadius = 0, label = 'Ảnh' }: Props) {
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState(0);
  const onLayout = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.width;
    if (next > 0 && next !== width) setWidth(next);
  };
  const onScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (width) setActive(Math.round(event.nativeEvent.contentOffset.x / width));
  };
  return (
    <View style={[{ height }, style]} onLayout={onLayout}>
      {width > 0 ? (
        <FlatList
          data={slides}
          keyExtractor={(item) => item.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScrollEnd}
          renderItem={({ item, index }) => (
            <Image source={{ uri: item.imageUri }} accessibilityLabel={`${label} ${index + 1}/${slides.length}`} style={{ width, height, borderRadius: imageBorderRadius }} resizeMode="cover" />
          )}
        />
      ) : null}
      {slides.length > 1 ? <View style={styles.counter}><Text style={styles.counterText}>{active + 1}/{slides.length}</Text></View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  counter: { position: 'absolute', right: space.md, bottom: space.md, backgroundColor: 'rgba(42,31,38,0.72)', borderRadius: radius.pill, paddingHorizontal: space.sm + 2, paddingVertical: 3 },
  counterText: { ...type.caption, color: '#FFFFFF', fontVariant: ['tabular-nums'] },
});
