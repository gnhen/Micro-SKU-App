/**
 * Shared hook for background Cloudflare challenge solving.
 * Extracts the hidden-WebView + timer + ref pattern shared by
 * index.tsx (Scan) and list.tsx (List) screens.
 *
 * Usage:
 *   const { solver, hiddenWebView } = useChallengeSolver();
 *   const result = await solver.solve(challenge, searchedSku);
 *   // result: { status: 'solved' | 'failed', finalUrl?, userAgent? }
 *   // hiddenWebView: <View>...</View> to render in the component
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { WebView } from 'react-native-webview';
import { Platform, View } from 'react-native';
import { CHALLENGE_SIGNAL_SCRIPT, isChallengeSignal } from '@/services/challengeWebViewUtils';
import { setScraperUserAgent } from '@/services/scraper';

export type ChallengeResult = {
  status: 'solved' | 'failed';
  finalUrl?: string;
  userAgent?: string | null;
  reason?: string;
};

const TIMEOUT_MS = 6500;

interface UseChallengeSolverReturn {
  /** Call to solve a challenge in the background. Returns a promise. */
  solve: (challenge: any, searchedSku: string) => Promise<ChallengeResult>;
  /** Render the hidden WebView. Must be placed inside the component's JSX. */
  hiddenWebView: React.ReactNode | null;
  /** Whether a solver is currently active (WebView is mounted). */
  isActive: boolean;
}

export function useChallengeSolver(): UseChallengeSolverReturn {
  const [challengeData, setChallengeData] = useState<{ url: string; searchedSku: string } | null>(null);

  const resolverRef = useRef<((result: ChallengeResult) => void) | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userAgentRef = useRef<string | null>(null);
  const isActive = challengeData !== null;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const solve = useCallback(async (challenge: any, searchedSku: string): Promise<ChallengeResult> => {
    const fallbackUrl = `https://www.microcenter.com/search/search_results.aspx?Ntt=${encodeURIComponent(searchedSku)}&searchButton=search&storeid=071`;
    const startUrl = challenge?.url || fallbackUrl;

    return new Promise((resolve) => {
      userAgentRef.current = null;
      resolverRef.current = resolve;
      setChallengeData({ url: startUrl, searchedSku });

      timerRef.current = setTimeout(() => {
        setChallengeData(null);
        resolve({ status: 'failed', reason: 'timeout' });
      }, TIMEOUT_MS);
    });
  }, []);

  const handleMessage = useCallback((event: { nativeEvent: { data: string } }) => {
    if (!resolverRef.current) return;
    try {
      const message = JSON.parse(event.nativeEvent.data || '{}');
      if (message.type !== 'pageSignals') return;

      const signalUrl = String(message.url || '');
      const signalTitle = String(message.title || '');
      const hasChallenge = Boolean(message.hasChallenge);

      if (typeof message.userAgent === 'string' && message.userAgent.trim()) {
        userAgentRef.current = message.userAgent;
      }

      if (!/microcenter\.com/i.test(signalUrl)) return;
      if (isChallengeSignal(signalUrl, signalTitle, hasChallenge)) return;

      // Check if the URL matches the searched SKU or is a product page
      if (challengeData?.searchedSku) {
        const normalizedUrl = decodeURIComponent(signalUrl);
        const hasMatchingSearchSku = normalizedUrl.includes(`Ntt=${challengeData.searchedSku}`) || normalizedUrl.includes(`ntt=${challengeData.searchedSku}`);
        const isProductPage = /\/product\/\d+\//i.test(signalUrl);
        if (!hasMatchingSearchSku && !isProductPage) return;
      }

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;

      // Update the scraper's runtime UA so subsequent requests use the solved UA
      if (userAgentRef.current) {
        setScraperUserAgent(userAgentRef.current);
      }

      resolverRef.current!({ status: 'solved', finalUrl: signalUrl, userAgent: userAgentRef.current });
      resolverRef.current = null;
      setChallengeData(null);
    } catch {
      // Ignore parse errors
    }
  }, [challengeData]);

  const handleError = useCallback(() => {
    if (!resolverRef.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    resolverRef.current!({ status: 'failed', reason: 'webviewError' });
    resolverRef.current = null;
    setChallengeData(null);
  }, []);

  const hiddenWebView = challengeData ? (
    <View style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}>
      <WebView
        source={{ uri: challengeData.url }}
        applicationNameForUserAgent={Platform.OS === 'ios' ? 'Version/17.0 Safari/604.1' : undefined}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        originWhitelist={['*']}
        injectedJavaScript={CHALLENGE_SIGNAL_SCRIPT}
        onMessage={handleMessage}
        onError={handleError}
      />
    </View>
  ) : null;

  return { solve, hiddenWebView, isActive };
}
