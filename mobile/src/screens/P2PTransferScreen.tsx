import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import {
  getCurrentNetworkLabelAsync,
  selectPeerFileAsync,
  simulatePeerTransferAsync,
} from '../services/PeerTransferService';
import { FontSize, FontWeight, Radius, Shadow, Spacing } from '../theme/tokens';
import { trigger as triggerHaptic } from '../haptics/HapticEngine';
import type { PeerTransferSession, PeerTransferProgress } from '../types';

export function P2PTransferScreen() {
  const { colors, isDark } = useTheme();
  const [session, setSession] = useState<PeerTransferSession | null>(null);
  const [networkLabel, setNetworkLabel] = useState('Detecting network…');
  const [transferProgress, setTransferProgress] = useState<PeerTransferProgress | null>(null);
  const [isTransferring, setIsTransferring] = useState(false);

  const loadNetwork = useCallback(async () => {
    const label = await getCurrentNetworkLabelAsync();
    setNetworkLabel(label);
  }, []);

  const onSelectFile = useCallback(async () => {
    const selected = await selectPeerFileAsync();
    if (selected) {
      setSession(selected);
      setTransferProgress(null);
      setNetworkLabel(await getCurrentNetworkLabelAsync());
    }
  }, []);

  const onStartTransfer = useCallback(async () => {
    if (!session) {
      return;
    }

    // Success pattern (three pulses) when user confirms transfer
    await triggerHaptic('success');
    setIsTransferring(true);
    const completed = await simulatePeerTransferAsync(session, (progress) => {
      setTransferProgress(progress);
    });
    setSession(completed);
    setIsTransferring(false);
  }, [session]);

  useEffect(() => {
    loadNetwork();
  }, [loadNetwork]);

  const summary = useMemo(() => {
    if (!session) {
      return 'Select a file to begin a secure nearby transfer session.';
    }
    return `Ready to transfer ${session.fileName} to a nearby device using chunked delivery.`;
  }, [session]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}> 
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={[styles.container, { backgroundColor: colors.surface }]}> 
        <Text style={[styles.header, { color: colors.text }]}>Distributed P2P File Sharing</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Simulated nearby transfer flow with chunked transfer progress and device readiness metadata.</Text>
      </View>
      <View style={[styles.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}> 
        <Text style={[styles.label, { color: colors.textSecondary }]}>Network</Text>
        <Text style={[styles.value, { color: colors.text }]}>{networkLabel}</Text>
        <Text style={[styles.label, { color: colors.textSecondary, marginTop: Spacing.sm }]}>Session</Text>
        <Text style={[styles.value, { color: colors.text }]}>{summary}</Text>
        <Pressable
          onPress={onSelectFile}
          style={({ pressed }) => [styles.actionButton, { backgroundColor: pressed ? colors.primaryLight : colors.primary }]}
        >
          <Text style={[styles.actionText, { color: colors.textInverse }]}>Select file</Text>
        </Pressable>
        {session ? (
          <View style={styles.statusGroup}> 
            <Text style={[styles.label, { color: colors.textSecondary }]}>Selected file</Text>
            <Text style={[styles.value, { color: colors.text }]}>{session.fileName}</Text>
            <Text style={[styles.meta, { color: colors.textSecondary }]}>Size: {Math.max(session.size, 0)} bytes • {session.totalChunks} chunks</Text>
            <View style={styles.progressTrack}> 
              <View style={[styles.progressFill, { width: `${transferProgress?.progress ?? 0}%`, backgroundColor: colors.primary }]} />
            </View>
            <Text style={[styles.progressText, { color: colors.textSecondary }]}>
              {transferProgress ? `${transferProgress.progress}% complete` : 'Transfer not started'}
            </Text>
            <Pressable
              onPress={onStartTransfer}
              disabled={isTransferring}
              style={({ pressed }) => [
                styles.actionButton,
                {
                  backgroundColor: isTransferring ? colors.border : pressed ? colors.primaryLight : colors.primary,
                },
              ]}
            >
              {isTransferring ? (
                <ActivityIndicator color={colors.textInverse} />
              ) : (
                <Text style={[styles.actionText, { color: colors.textInverse }]}>Start transfer</Text>
              )}
            </Pressable>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: {
    padding: Spacing.base,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  header: {
    fontSize: FontSize['3xl'],
    fontWeight: FontWeight.extrabold,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: FontSize.base,
    lineHeight: 22,
  },
  card: {
    margin: Spacing.base,
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.base,
  },
  label: {
    fontSize: FontSize.xs,
    textTransform: 'uppercase',
    marginBottom: Spacing.xs,
  },
  value: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.medium,
  },
  meta: {
    fontSize: FontSize.sm,
    marginTop: Spacing.xs,
  },
  statusGroup: {
    marginTop: Spacing.lg,
    gap: Spacing.sm,
  },
  progressTrack: {
    height: 10,
    borderRadius: Radius.full,
    backgroundColor: '#d1d5db',
    overflow: 'hidden',
    marginTop: Spacing.sm,
  },
  progressFill: {
    height: '100%',
  },
  progressText: {
    marginTop: Spacing.xs,
    fontSize: FontSize.xs,
  },
  actionButton: {
    marginTop: Spacing.lg,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  actionText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
});
