import { useCallback } from 'react';
import { Howl } from 'howler';

import notificationDing from '../assets/sound/notification_sound.mp3';

const DEFAULT_SOUND = notificationDing; //--> TODO custom sound add here

export const useNotificationSound = (soundUrl: string = DEFAULT_SOUND) => {
  const playSound = useCallback(() => {
    try {
      const sound = new Howl({
        src: [soundUrl],
        volume: 0.5,
      });
      sound.play();
    } catch (error) {
      console.warn('Could not play notification sound:', error);
    }
  }, [soundUrl]);

  return playSound;
};
