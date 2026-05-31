import React, { useState } from 'react';
import { SafeAreaView, StatusBar } from 'react-native';
import { ImageCropperEditor } from '../components/image/ImageCropperEditor';
import { useTheme } from '../theme/ThemeProvider';

export interface ImageEditorScreenProps {
  imageUri?: string;
  imageWidth?: number;
  imageHeight?: number;
  fileSize?: number;
  mode?: 'avatar' | 'banner';
  onComplete?: (uri: string) => void;
  onBack?: () => void;
}

export function ImageEditorScreen({
  imageUri = 'mock://editor-preview',
  imageWidth = 1200,
  imageHeight = 900,
  fileSize = 850_000,
  mode = 'avatar',
  onComplete,
  onBack,
}: ImageEditorScreenProps) {
  const { isDark } = useTheme();
  const [saved, setSaved] = useState(false);

  const aspectRatio = mode === 'banner' ? 16 / 9 : 1;

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <ImageCropperEditor
        imageUri={imageUri}
        imageWidth={imageWidth}
        imageHeight={imageHeight}
        fileSize={fileSize}
        aspectRatio={aspectRatio}
        onCancel={onBack}
        onSave={(result) => {
          setSaved(true);
          onComplete?.(result.uri);
        }}
      />
    </SafeAreaView>
  );
}
