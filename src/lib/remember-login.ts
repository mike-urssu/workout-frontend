import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = { on: 'login.rememberUsername', username: 'login.username' };

/** "아이디 기억": the checkbox and the saved username live outside the auth token, so logging out keeps them. */
export const rememberLogin = {
  async load() {
    const [on, username] = await Promise.all([AsyncStorage.getItem(KEYS.on), AsyncStorage.getItem(KEYS.username)]);
    return { on: on === '1', username: on === '1' ? (username ?? '') : '' };
  },
  setOn: (on: boolean) => (on ? AsyncStorage.setItem(KEYS.on, '1') : AsyncStorage.multiRemove([KEYS.on, KEYS.username])),
  saveUsername: (username: string) => AsyncStorage.setItem(KEYS.username, username),
};
