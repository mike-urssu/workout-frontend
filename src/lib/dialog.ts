import { Alert, Platform } from 'react-native';

import { ApiError } from '@/api/client';

/** Alert.alert has no buttons on web, so use the browser dialogs there. */
export const notify = (message: string) =>
  Platform.OS === 'web' ? window.alert(message) : Alert.alert(message);

export const confirm = (title: string, ok: string, message?: string) =>
  Platform.OS === 'web'
    ? Promise.resolve(window.confirm(message ? `${title}\n${message}` : title))
    : new Promise<boolean>((resolve) =>
        Alert.alert(title, message, [
          { text: '취소', style: 'cancel', onPress: () => resolve(false) },
          { text: ok, style: 'destructive', onPress: () => resolve(true) },
        ], { cancelable: true, onDismiss: () => resolve(false) }));

/** Message for an API failure; 401 is already routed to the login screen by `request`. */
export const errorMessage = (e: unknown) => {
  if (!(e instanceof ApiError)) return '알 수 없는 오류가 발생했습니다.';
  if (e.code === 'WORKOUT_SESSION_NOT_EDITABLE' || e.code === 'WORKOUT_SESSION_ALREADY_COMPLETED')
    return '6시간이 지나 운동이 자동으로 완료되었어요.';
  if (e.code === 'WORKOUT_SESSION_NOT_FOUND') return '이미 취소된 운동이에요.';
  return e.message;
};
