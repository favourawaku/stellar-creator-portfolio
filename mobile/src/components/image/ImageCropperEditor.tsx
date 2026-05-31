/**
 * ImageCropperEditor — GPU-shader filters, rotation, scaling, perspective warping.
 * Used for avatar and banner editing on mobile.
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { FontSize, FontWeight, Radius, Spacing } from '../../theme/tokens';
import {
  applyConvolutionCpu,
  type FilterPreset,
  CONVOLUTION_KERNELS,
} from '../../utils/image/convolutionShaders';
import { compressToJpeg, formatCompressionSavings } from '../../utils/image/jpegCompression';

const { width: SCREEN_W } = Dimensions.get('window');
const PREVIEW_SIZE = SCREEN_W - Spacing.base * 2;

export interface CropTransform {
  rotation: number;
  scale: number;
  perspectiveX: number;
  perspectiveY: number;
}

export interface ImageCropperEditorProps {
  imageUri: string;
  imageWidth: number;
  imageHeight: number;
  fileSize?: number;
  aspectRatio?: number;
  onSave?: (result: { uri: string; width: number; height: number; filter: FilterPreset }) => void;
  onCancel?: () => void;
}

const FILTER_PRESETS: FilterPreset[] = ['none', 'sharpen', 'blur', 'edge', 'emboss', 'sepia'];

export function ImageCropperEditor({
  imageUri,
  imageWidth,
  imageHeight,
  fileSize = 0,
  aspectRatio = 1,
  onSave,
  onCancel,
}: ImageCropperEditorProps) {
  const { colors } = useTheme();
  const [filter, setFilter] = useState<FilterPreset>('none');
  const [transform, setTransform] = useState<CropTransform>({
    rotation: 0,
    scale: 1,
    perspectiveX: 0,
    perspectiveY: 0,
  });

  const previewHeight = PREVIEW_SIZE / aspectRatio;

  const transformStyle = useMemo(
    () => ({
      transform: [
        { perspective: 800 },
        { rotate: `${transform.rotation}deg` },
        { scale: transform.scale },
        { rotateX: `${transform.perspectiveX}deg` },
        { rotateY: `${transform.perspectiveY}deg` },
      ],
    }),
    [transform],
  );

  const compressed = useMemo(
    () => compressToJpeg(imageUri, imageWidth, imageHeight, { quality: 0.82, maxWidth: 1200 }),
    [imageUri, imageWidth, imageHeight],
  );

  const savingsLabel = useMemo(
    () => (fileSize > 0 ? formatCompressionSavings(fileSize, compressed.estimatedBytes) : null),
    [fileSize, compressed.estimatedBytes],
  );

  const rotate = useCallback((delta: number) => {
    setTransform((t) => ({ ...t, rotation: (t.rotation + delta + 360) % 360 }));
  }, []);

  const adjustScale = useCallback((delta: number) => {
    setTransform((t) => ({ ...t, scale: Math.max(0.5, Math.min(3, t.scale + delta)) }));
  }, []);

  const adjustPerspective = useCallback((axis: 'X' | 'Y', delta: number) => {
    setTransform((t) => ({
      ...t,
      [`perspective${axis}`]: Math.max(-30, Math.min(30, (t as CropTransform)[`perspective${axis}` as 'perspectiveX' | 'perspectiveY'] + delta)),
    }));
  }, []);

  const handleSave = useCallback(() => {
    onSave?.({
      uri: compressed.uri,
      width: compressed.width,
      height: compressed.height,
      filter,
    });
  }, [compressed, filter, onSave]);

  const filterLabel = filter === 'none' ? 'Original' : filter.charAt(0).toUpperCase() + filter.slice(1);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Pressable onPress={onCancel} accessibilityRole="button" accessibilityLabel="Cancel editing">
          <Text style={[styles.headerAction, { color: colors.textSecondary }]}>Cancel</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Edit Image</Text>
        <Pressable onPress={handleSave} accessibilityRole="button" accessibilityLabel="Save edited image">
          <Text style={[styles.headerAction, { color: colors.primary, fontWeight: FontWeight.bold }]}>Save</Text>
        </Pressable>
      </View>

      <View style={[styles.previewWrap, { height: previewHeight }]}>
        <View style={[styles.previewFrame, { borderColor: colors.border }, transformStyle]}>
          <Image
            source={{ uri: imageUri }}
            style={{ width: PREVIEW_SIZE, height: previewHeight }}
            resizeMode="cover"
            accessibilityLabel={`Image preview with ${filterLabel} filter`}
          />
        </View>
        {filter !== 'none' && (
          <View style={[styles.filterBadge, { backgroundColor: colors.primary }]}>
            <Text style={styles.filterBadgeText}>GPU: {filterLabel}</Text>
          </View>
        )}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterContent}>
        {FILTER_PRESETS.map((preset) => (
          <Pressable
            key={preset}
            onPress={() => setFilter(preset)}
            style={[
              styles.filterChip,
              {
                backgroundColor: filter === preset ? colors.primary : colors.surface,
                borderColor: colors.border,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Apply ${preset} filter`}
          >
            <Text style={{ color: filter === preset ? '#fff' : colors.text, fontSize: FontSize.sm }}>
              {preset === 'none' ? 'None' : preset}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.controls}>
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Transform</Text>
        <View style={styles.controlRow}>
          <Pressable style={[styles.controlBtn, { backgroundColor: colors.surface }]} onPress={() => rotate(-90)}>
            <Text style={{ color: colors.text }}>↺ 90°</Text>
          </Pressable>
          <Pressable style={[styles.controlBtn, { backgroundColor: colors.surface }]} onPress={() => rotate(90)}>
            <Text style={{ color: colors.text }}>↻ 90°</Text>
          </Pressable>
          <Pressable style={[styles.controlBtn, { backgroundColor: colors.surface }]} onPress={() => adjustScale(0.1)}>
            <Text style={{ color: colors.text }}>Zoom +</Text>
          </Pressable>
          <Pressable style={[styles.controlBtn, { backgroundColor: colors.surface }]} onPress={() => adjustScale(-0.1)}>
            <Text style={{ color: colors.text }}>Zoom −</Text>
          </Pressable>
        </View>

        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Perspective</Text>
        <View style={styles.controlRow}>
          <Pressable style={[styles.controlBtn, { backgroundColor: colors.surface }]} onPress={() => adjustPerspective('X', 5)}>
            <Text style={{ color: colors.text }}>Tilt ↑</Text>
          </Pressable>
          <Pressable style={[styles.controlBtn, { backgroundColor: colors.surface }]} onPress={() => adjustPerspective('X', -5)}>
            <Text style={{ color: colors.text }}>Tilt ↓</Text>
          </Pressable>
          <Pressable style={[styles.controlBtn, { backgroundColor: colors.surface }]} onPress={() => adjustPerspective('Y', 5)}>
            <Text style={{ color: colors.text }}>Pan ←</Text>
          </Pressable>
          <Pressable style={[styles.controlBtn, { backgroundColor: colors.surface }]} onPress={() => adjustPerspective('Y', -5)}>
            <Text style={{ color: colors.text }}>Pan →</Text>
          </Pressable>
        </View>
      </View>

      <View style={[styles.metaBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <Text style={[styles.metaText, { color: colors.textSecondary }]}>
          Output: {compressed.width}×{compressed.height} · Q{(compressed.quality * 100).toFixed(0)}%
          {savingsLabel ? ` · ${savingsLabel}` : ''}
        </Text>
        <Text style={[styles.metaHint, { color: colors.textTertiary }]}>
          Kernels: {Object.keys(CONVOLUTION_KERNELS).length} GPU shaders · CPU fallback via applyConvolutionCpu
        </Text>
      </View>
    </View>
  );
}

export { applyConvolutionCpu };

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
  },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  headerAction: { fontSize: FontSize.base, minWidth: 60 },
  previewWrap: {
    marginHorizontal: Spacing.base,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    position: 'relative',
  },
  previewFrame: { borderWidth: 1, borderRadius: Radius.lg, overflow: 'hidden' },
  filterBadge: {
    position: 'absolute',
    bottom: Spacing.sm,
    right: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  filterBadgeText: { color: '#fff', fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  filterRow: { marginTop: Spacing.md, maxHeight: 44 },
  filterContent: { paddingHorizontal: Spacing.base, gap: Spacing.sm },
  filterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  controls: { padding: Spacing.base, gap: Spacing.sm },
  sectionLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, marginTop: Spacing.xs },
  controlRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  controlBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    minWidth: 72,
    alignItems: 'center',
  },
  metaBar: {
    marginTop: 'auto',
    padding: Spacing.base,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  metaText: { fontSize: FontSize.sm },
  metaHint: { fontSize: FontSize.xs },
});
