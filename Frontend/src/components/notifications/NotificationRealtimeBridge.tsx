import { useCallback, useEffect, useMemo, useRef } from 'react';

import { showToast } from '../common/Toast/toastService';
import { useAppDispatch, useAppSelector } from '../../redux/hooks';
import { baseApi } from '../../redux/slices/api/baseApi';
import {
  useGetNotificationPreferencesQuery,
} from '../../redux/slices/notifications/notificationsApi';

type WindowWithWebkitAudio = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext;
};

interface NotificationSocketPayload {
  event: string;
  notification?: {
    id?: string;
    title: string;
    body: string;
    category: string;
  };
  preferences?: {
    sound_enabled?: boolean;
    browser_notification_enabled?: boolean;
    popup_toast_enabled?: boolean;
    category?: {
      sound?: boolean;
    };
  };
}

function resolveWsUrl(tenantId: string, salonId: string, userId: string): string {
  const baseUrl = import.meta.env.VITE_BASE_URL || '/api/v1';
  const origin = window.location.origin;
  const absoluteBase = baseUrl.startsWith('http') ? baseUrl : `${origin}${baseUrl}`;
  const url = new URL(absoluteBase);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = `${url.pathname.replace(/\/$/, '')}/ws/${tenantId}/${salonId}`;
  url.searchParams.set('user_id', userId);
  return url.toString();
}

const NotificationRealtimeBridge = () => {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const token = useAppSelector((state) => state.auth.token);
  const orgId = useAppSelector((state) => state.auth.orgId);
  const selectedSalonId = useAppSelector((state) => state.auth.selectedSalonId);
  const audioContextRef = useRef<AudioContext | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const lastSoundRef = useRef<{ key: string; playedAt: number } | null>(null);
  const { data: preferencesData } = useGetNotificationPreferencesQuery(undefined, {
    skip: !token,
  });

  const socketUrl = useMemo(() => {
    if (!token || !user?.id) return null;
    const tenantId = selectedSalonId || orgId || 'system';
    const salonId = selectedSalonId || orgId || 'system';
    return resolveWsUrl(tenantId, salonId, user.id);
  }, [orgId, selectedSalonId, token, user?.id]);

  useEffect(() => {
    const unlockAudio = () => {
      const AudioContextCtor = window.AudioContext || (window as WindowWithWebkitAudio).webkitAudioContext;
      if (!AudioContextCtor) return;
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContextCtor();
      }
      audioContextRef.current.resume().catch(() => undefined);
    };

    window.addEventListener('pointerdown', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
  }, []);

  const playNotificationSound = useCallback((eventKey: string) => {
    const now = Date.now();
    if (lastSoundRef.current?.key === eventKey && now - lastSoundRef.current.playedAt < 1500) {
      return;
    }
    lastSoundRef.current = { key: eventKey, playedAt: now };

    const AudioContextCtor = window.AudioContext || (window as WindowWithWebkitAudio).webkitAudioContext;
    if (!AudioContextCtor) return;
    const audioContext = audioContextRef.current ?? new AudioContextCtor();
    audioContextRef.current = audioContext;
    if (audioContext.state === 'suspended') {
      audioContext.resume().catch(() => undefined);
    }

    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.18, audioContext.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.35);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.36);
  }, []);

  useEffect(() => {
    if (!socketUrl) return;
    let socket: WebSocket | null = null;
    let closedByEffect = false;
    let reconnectAttempts = 0;

    const connect = () => {
      socket = new WebSocket(socketUrl);
      socket.onopen = () => {
        reconnectAttempts = 0;
      };
      socket.onclose = () => {
        if (closedByEffect) return;
        const delay = Math.min(30000, 1000 * 2 ** reconnectAttempts);
        reconnectAttempts += 1;
        reconnectTimerRef.current = window.setTimeout(connect, delay);
      };
      socket.onerror = () => {
        socket?.close();
      };
      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data) as NotificationSocketPayload;
          if (payload.event !== 'NOTIFICATION_CREATED' && payload.event !== 'NOTIFICATION_BADGE_UPDATED') {
            return;
          }
          dispatch(baseApi.util.invalidateTags(['Notifications', 'Dashboard']));
          if (payload.event !== 'NOTIFICATION_CREATED' || !payload.notification) {
            return;
          }

          const savedPreferences = preferencesData?.data;
          const eventPreferences = payload.preferences;
          const soundEnabled =
            eventPreferences?.sound_enabled ??
            savedPreferences?.sound_enabled ??
            true;
          const categorySoundEnabled = eventPreferences?.category?.sound ?? true;
          if (soundEnabled && categorySoundEnabled) {
            const eventKey = payload.notification.id || `${payload.notification.title}:${payload.notification.body}:${payload.notification.category}`;
            playNotificationSound(eventKey);
          }

          const popupEnabled =
            eventPreferences?.popup_toast_enabled ??
            savedPreferences?.popup_toast_enabled ??
            true;
          if (popupEnabled) {
            showToast('info', `${payload.notification.title}: ${payload.notification.body}`);
          }

          const browserEnabled =
            eventPreferences?.browser_notification_enabled ??
            savedPreferences?.browser_notification_enabled ??
            true;
          if (browserEnabled && 'Notification' in window) {
            if (Notification.permission === 'granted') {
              new Notification(payload.notification.title, { body: payload.notification.body });
            } else if (Notification.permission === 'default') {
              Notification.requestPermission().catch(() => undefined);
            }
          }
        } catch {
          // Ignore non-notification websocket payloads.
        }
      };
    };

    connect();
    return () => {
      closedByEffect = true;
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
      }
      socket?.close();
    };
  }, [dispatch, playNotificationSound, preferencesData?.data, socketUrl]);

  return null;
};

export default NotificationRealtimeBridge;
