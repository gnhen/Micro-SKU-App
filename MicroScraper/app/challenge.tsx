import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { WebView } from 'react-native-webview';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getChallengeRequest, resolveChallengeRequest } from '@/services/challengeSession';
import { CHALLENGE_SIGNAL_SCRIPT, buildProductExtractionScript, isChallengeSignal } from '@/services/challengeWebViewUtils';

type ChallengeOutcomeStatus = 'solved' | 'cancelled' | 'error';

type ChallengeOutcome = {
  status: ChallengeOutcomeStatus;
  finalUrl?: string;
  reason?: string;
  userAgent?: string;
  productData?: any;
};

const normalizeParam = (value: string | string[] | undefined): string | null => {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] || null;
  return value;
};

export default function ChallengeScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const router = useRouter();
  const params = useLocalSearchParams<{ requestId?: string | string[] }>();
  const requestId = normalizeParam(params.requestId);

  const request = useMemo(() => {
    if (!requestId) return null;
    return getChallengeRequest(requestId);
  }, [requestId]);

  const challenge = request?.payload?.challenge || null;
  const searchedSku = request?.payload?.searchedSku || '';
  const initialUrl = challenge?.url || 'https://www.microcenter.com';

  const [currentUrl, setCurrentUrl] = useState(initialUrl);
  const [statusText, setStatusText] = useState('Verification in progress...');
  const [debugLog, setDebugLog] = useState<string>('Init.');
  const [loading, setLoading] = useState(true);
  const [detectedUserAgent, setDetectedUserAgent] = useState<string | undefined>(undefined);
  const [extractingProduct, setExtractingProduct] = useState(false);

  const webViewRef = useRef<any>(null);
  const resolvedRef = useRef(false);
  const challengeSeenRef = useRef(false);
  const shouldExtractOnLoadRef = useRef(false);
  const verificationTimeoutRef = useRef<any>(null);

  const finish = useCallback((status: ChallengeOutcomeStatus, extras: Partial<ChallengeOutcome> = {}) => {
    setDebugLog(prev => prev + ` | finish(${status})`);
    if (resolvedRef.current) return;
    resolvedRef.current = true;

    if (requestId) {
      resolveChallengeRequest(requestId, { status, ...extras });
    }

    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  }, [requestId, router]);

  useEffect(() => {
    // Failsafe timer: if Cloudflare completely blocks injected scripts (like on iOS),
    // we must guarantee we don't hang forever.
    startVerificationTimeout();
    
    return () => {
      if (verificationTimeoutRef.current) {
        clearTimeout(verificationTimeoutRef.current);
        verificationTimeoutRef.current = null;
      }
      if (!resolvedRef.current && requestId) {
        resolveChallengeRequest(requestId, { status: 'cancelled', reason: 'dismissed' });
      }
    };
    // EXPLICITLY removing dependencies so this only runs once on mount.
    // If router or startVerificationTimeout changes, it was thrashing and resetting the timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Use refs for values needed in the timeout to avoid recreating the callback and retriggering useEffect
  const currentUrlRef = useRef(initialUrl);
  const detectedUserAgentRef = useRef<string | undefined>(undefined);

  // Keep refs in sync with state
  useEffect(() => { currentUrlRef.current = currentUrl; }, [currentUrl]);
  useEffect(() => { detectedUserAgentRef.current = detectedUserAgent; }, [detectedUserAgent]);

  const startVerificationTimeout = useCallback(() => {
    if (verificationTimeoutRef.current) {
      setDebugLog(prev => prev + ` | timeout_running`);
      // Don't restart the timeout if already running
      return;
    }
    
    setDebugLog(prev => prev + ` | timeout_start`);

    verificationTimeoutRef.current = setTimeout(() => {
      setDebugLog(prev => prev + ` | timeout_fired`);
      finish('error', {
        reason: 'verificationTimeout',
        finalUrl: currentUrlRef.current,
        userAgent: detectedUserAgentRef.current,
      });
    }, 30000); // 30 seconds to allow for Cloudflare puzzle
  }, [finish]);

  const stopVerificationTimeout = useCallback(() => {
    if (verificationTimeoutRef.current) {
      setDebugLog(prev => prev + ` | timeout_stop`);
      clearTimeout(verificationTimeoutRef.current);
      verificationTimeoutRef.current = null;
    }
  }, []);

  const beginExtraction = useCallback(() => {
    if (resolvedRef.current || extractingProduct) return;
    setExtractingProduct(true);
    shouldExtractOnLoadRef.current = true;
    setStatusText('Collecting product details...');
    webViewRef.current?.injectJavaScript(buildProductExtractionScript(searchedSku));
  }, [extractingProduct, searchedSku]);

  const maybeResolveSolved = useCallback((url = '', title = '', hasChallenge = false) => {
    const challengeNow = isChallengeSignal(url, title, hasChallenge);
    if (challengeNow) {
      challengeSeenRef.current = true;
      setStatusText('Verification in progress...');
      startVerificationTimeout();
      return;
    }

    const isMicroCenterPage = /microcenter\.com/i.test(url);
    const inCorrectPath = url.includes('/product/') || url.includes('Ntt=') || url === 'https://www.microcenter.com/' || url === 'https://www.microcenter.com';
    
    if (isMicroCenterPage && inCorrectPath) {
      stopVerificationTimeout();
      beginExtraction();
    }
  }, [beginExtraction, startVerificationTimeout, stopVerificationTimeout]);

  const handleClose = () => {
    finish('cancelled', { reason: 'cancelledByUser', finalUrl: currentUrl });
  };

  if (!requestId || !request) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}> 
          <Text style={[styles.title, { color: colors.text }]}>Verification</Text>
        </View>
        <View style={styles.missingBody}>
          <Text style={[styles.missingText, { color: colors.text }]}>Challenge request not found.</Text>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()}>
            <Text style={styles.cancelBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}> 
      <View style={[styles.header, { borderBottomColor: colors.border }]}> 
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.text }]}>Micro Center Verification</Text>
          <Text style={[styles.subtitle, { color: colors.text }]} numberOfLines={2}>
            {searchedSku ? `SKU ${searchedSku}` : 'Complete challenge and return'}
          </Text>
        </View>
        <TouchableOpacity style={styles.cancelBtn} onPress={handleClose}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.statusBar, { borderBottomColor: colors.border }]}> 
        {loading ? <ActivityIndicator size="small" color={colors.tint} /> : null}
        <View style={{ flex: 1 }}>
          <Text style={[styles.statusText, { color: colors.text }]} numberOfLines={1}>{statusText}</Text>
          <Text style={{ fontSize: 9, color: 'gray' }} numberOfLines={2}>{debugLog}</Text>
        </View>
      </View>

      <WebView
        source={{ uri: initialUrl }}
        applicationNameForUserAgent={Platform.OS === 'ios' ? 'Version/17.0 Safari/604.1' : undefined}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        bounces={false}
        originWhitelist={['*']}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => {
          setLoading(false);
          if (shouldExtractOnLoadRef.current) {
            webViewRef.current?.injectJavaScript(buildProductExtractionScript(searchedSku));
          }
        }}
        onNavigationStateChange={(navState) => {
          const nextUrl = navState.url || '';
          setCurrentUrl(nextUrl);
        }}
        onMessage={(event) => {
          try {
            const message = JSON.parse(event.nativeEvent.data || '{}');
            if (message.type === 'pageSignals') {
              const signalUrl = String(message.url || currentUrl || '');
              const signalTitle = String(message.title || '');
              const hasChallenge = Boolean(message.hasChallenge);
              const signalUserAgent = typeof message.userAgent === 'string' ? message.userAgent : undefined;
              setCurrentUrl(signalUrl);
              if (signalUserAgent) {
                setDetectedUserAgent(signalUserAgent);
              }
              maybeResolveSolved(signalUrl, signalTitle, hasChallenge);
            } else if (message.type === 'productExtract') {
              if (message.status === 'ok' && message.data) {
                stopVerificationTimeout();
                shouldExtractOnLoadRef.current = false;
                finish('solved', {
                  finalUrl: message.data.url || currentUrl,
                  userAgent: detectedUserAgent,
                  productData: message.data,
                });
              } else if (message.status === 'noProductLink' || message.status === 'error') {
                stopVerificationTimeout();
                shouldExtractOnLoadRef.current = false;
                finish('error', {
                  reason: message.status,
                  finalUrl: currentUrl,
                  userAgent: detectedUserAgent,
                });
              } else if (message.status === 'noExactMatch' || message.status === 'skuMismatch') {
                stopVerificationTimeout();
                shouldExtractOnLoadRef.current = false;
                finish('error', {
                  reason: message.status,
                  finalUrl: currentUrl,
                  userAgent: detectedUserAgent,
                });
              }
            }
          } catch (err) {
            console.log('[challenge] message parse error', err);
          }
        }}
        onError={() => {
          setStatusText('WebView failed to load. Try again or cancel.');
        }}
        ref={webViewRef}
        injectedJavaScript={CHALLENGE_SIGNAL_SCRIPT}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 54,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 2,
    fontSize: 13,
    opacity: 0.75,
  },
  statusBar: {
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusText: {
    fontSize: 13,
    flex: 1,
  },
  cancelBtn: {
    backgroundColor: '#C00',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  cancelBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  missingBody: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 14,
  },
  missingText: {
    fontSize: 15,
  },
});
