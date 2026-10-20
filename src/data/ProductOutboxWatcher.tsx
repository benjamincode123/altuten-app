import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { useAuth } from '../auth/AuthContext';
import { flushProductSubmissions } from './productSubmissionOutbox';

/**
 * Retries queued product submissions. Uploads are fire-and-forget from the add
 * screen, so without this a submission queued on a dead connection would sit
 * on disk untouched.
 *
 * Triggers on sign-in and whenever the app returns to the foreground, which is
 * when connectivity has most likely changed. The app has no network-state
 * library, and adding one just for this is not worth a native dependency.
 */
export function ProductOutboxWatcher() {
  const { user } = useAuth();
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    if (!user) return;
    void flushProductSubmissions();
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    const sub = AppState.addEventListener('change', (next) => {
      const wasBackground = appStateRef.current !== 'active';
      appStateRef.current = next;
      if (next === 'active' && wasBackground) {
        void flushProductSubmissions();
      }
    });
    return () => sub.remove();
  }, [user?.id]);

  return null;
}
