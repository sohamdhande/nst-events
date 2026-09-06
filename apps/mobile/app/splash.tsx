import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, SafeAreaView, StatusBar, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppTheme } from '../src/store/theme-store';
import { useAuthStore } from '../src/store/auth';

export default function SplashScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  
  const token = useAuthStore((state) => state.accessToken);
  const [bootText, setBootText] = useState('RESTORING CACHED SESSION...');
  const [bootPct, setBootPct] = useState(24);
  const progressAnim = useState(new Animated.Value(0.24))[0];

  useEffect(() => {
    const steps = [
      { text: 'MOUNTING SECURE ENCLAVE...', pct: 48 },
      { text: 'VERIFYING DEVICE IDENT-KEY...', pct: 72 },
      { text: 'INITIALIZING ATTENDANCE NODE...', pct: 90 },
      { text: 'HANDSHAKE COMPLETE. ROUTING...', pct: 100 },
    ];

    let current = 0;
    const interval = setInterval(() => {
      if (current < steps.length) {
        setBootText(steps[current].text);
        setBootPct(steps[current].pct);
        Animated.timing(progressAnim, {
          toValue: steps[current].pct / 100,
          duration: 250,
          useNativeDriver: false,
        }).start();
        current++;
      } else {
        clearInterval(interval);
        setTimeout(() => {
          if (token) {
            router.replace('/(app)');
          } else {
            router.replace('/(auth)');
          }
        }, 300);
      }
    }, 350);

    return () => clearInterval(interval);
  }, [token]);

  const styles = useMemo(() => StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.surface,
    },
    container: {
      flex: 1,
      paddingHorizontal: theme.spacing.base,
      justifyContent: 'space-between',
      paddingVertical: theme.spacing.md,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingBottom: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.borderHairline,
    },
    badgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    pingDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.colors.secondary,
    },
    headerMonoText: {
      fontFamily: theme.typography.monoBold,
      fontSize: 10,
      letterSpacing: 0.8,
      color: theme.colors.primary,
      textTransform: 'uppercase',
    },
    statusPill: {
      backgroundColor: theme.colors.surfaceContainerHigh,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 2,
    },
    statusPillText: {
      fontFamily: theme.typography.monoBold,
      fontSize: 10,
      letterSpacing: 0.8,
      color: theme.colors.primary,
    },
    centerContainer: {
      marginVertical: 'auto',
      width: '100%',
    },
    coordRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 6,
    },
    coordText: {
      fontFamily: theme.typography.monoMedium,
      fontSize: 10,
      color: theme.colors.onSurfaceVariant,
      opacity: 0.7,
    },
    monumentBox: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.primary,
      padding: theme.spacing.lg,
    },
    monumentHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.borderHairline,
      paddingBottom: 8,
      marginBottom: 12,
    },
    monumentHeaderTag: {
      fontFamily: theme.typography.monoBold,
      fontSize: 10,
      color: theme.colors.secondary,
      letterSpacing: 0.8,
    },
    monumentHeaderLoc: {
      fontFamily: theme.typography.monoMedium,
      fontSize: 10,
      color: theme.colors.onSurfaceVariant,
    },
    titleText: {
      fontFamily: theme.typography.syneExtraBold,
      fontSize: 42,
      lineHeight: 44,
      color: theme.colors.primary,
      letterSpacing: -1.5,
      textTransform: 'uppercase',
    },
    subtitleBox: {
      marginTop: 12,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: theme.colors.borderHairline,
    },
    subtitleMain: {
      fontFamily: theme.typography.interSemiBold,
      fontSize: 13,
      color: theme.colors.primary,
      textTransform: 'uppercase',
    },
    subtitleSub: {
      fontFamily: theme.typography.monoMedium,
      fontSize: 11,
      color: theme.colors.onSurfaceVariant,
      marginTop: 2,
    },
    cryptoBox: {
      marginTop: 14,
      paddingTop: 8,
      borderTopWidth: 1,
      borderStyle: 'dashed',
      borderTopColor: theme.colors.outlineVariant,
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    cryptoTag: {
      fontFamily: theme.typography.monoBold,
      fontSize: 10,
      color: theme.colors.primary,
    },
    cryptoHash: {
      fontFamily: theme.typography.monoMedium,
      fontSize: 10,
      color: theme.colors.onSurfaceVariant,
    },
    subscriptRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 6,
    },
    footer: {
      gap: 8,
    },
    logRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    logText: {
      fontFamily: theme.typography.monoMedium,
      fontSize: 12,
      color: theme.colors.primary,
      textTransform: 'uppercase',
    },
    logPct: {
      fontFamily: theme.typography.monoBold,
      fontSize: 12,
      color: theme.colors.primary,
    },
    progressTrack: {
      height: 6,
      backgroundColor: theme.colors.surfaceContainerHigh,
      borderWidth: 1,
      borderColor: theme.colors.primary,
    },
    progressBar: {
      height: '100%',
      backgroundColor: theme.colors.primary,
    },
    diagnosticsRow: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
      marginTop: 4,
    },
    diagnosticItem: {
      flex: 1,
      backgroundColor: theme.colors.surfaceContainerLow,
      borderWidth: 1,
      borderColor: theme.colors.borderHairline,
      paddingVertical: 6,
      paddingHorizontal: 8,
    },
    diagnosticText: {
      fontFamily: theme.typography.monoBold,
      fontSize: 10,
      color: theme.colors.onSurfaceVariant,
    },
  }), [theme]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={theme.colors.surface} />
      <View style={styles.container}>
        {/* Header Metadata */}
        <View style={styles.header}>
          <View style={styles.badgeRow}>
            <View style={styles.pingDot} />
            <Text style={styles.headerMonoText}>SYS.BOOT // V1.0.4</Text>
          </View>
          <View style={styles.statusPill}>
            <Text style={styles.statusPillText}>[INITIALIZING]</Text>
          </View>
        </View>

        {/* Center Editorial Monument */}
        <View style={styles.centerContainer}>
          <View style={styles.coordRow}>
            <Text style={styles.coordText}>+ NODE: DEL-01</Text>
            <Text style={styles.coordText}>[28.5355° N, 77.3910° E]</Text>
          </View>

          <View style={styles.monumentBox}>
            <View style={styles.monumentHeader}>
              <Text style={styles.monumentHeaderTag}>TECHNICAL CAMPUS ECOSYSTEM</Text>
              <Text style={styles.monumentHeaderLoc}>LOC: 0x4F92</Text>
            </View>

            <Text style={styles.titleText}>NST{'\n'}EVENTS</Text>

            <View style={styles.subtitleBox}>
              <Text style={styles.subtitleMain}>Newton School of Technology</Text>
              <Text style={styles.subtitleSub}>ATTENDANCE TERMINAL // OPERATIONAL PROTOCOL</Text>
            </View>

            <View style={styles.cryptoBox}>
              <Text style={styles.cryptoTag}>TEE ENCLAVE: ACTIVE</Text>
              <Text style={styles.cryptoHash}>HASH: 7F...C88A</Text>
            </View>
          </View>

          <View style={styles.subscriptRow}>
            <Text style={styles.coordText}>SEC-LEVEL: ALPHA</Text>
            <Text style={styles.coordText}>CADET IDENT-AUTH</Text>
          </View>
        </View>

        {/* Footer Diagnostics */}
        <View style={styles.footer}>
          <View style={styles.logRow}>
            <Text style={styles.logText}>{bootText}</Text>
            <Text style={styles.logPct}>{bootPct}%</Text>
          </View>

          <View style={styles.progressTrack}>
            <Animated.View
              style={[
                styles.progressBar,
                {
                  width: progressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
          </View>

          <View style={styles.diagnosticsRow}>
            <View style={styles.diagnosticItem}>
              <Text style={styles.diagnosticText}>GATEWAY: ESTABLISHED</Text>
            </View>
            <View style={styles.diagnosticItem}>
              <Text style={styles.diagnosticText}>AUTH: HSM VALIDATED</Text>
            </View>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
