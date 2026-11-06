import { isRunningInExpoGo } from 'expo';
import Constants, { AppOwnership } from 'expo-constants';

export function isExpoGo(): boolean {
  return isRunningInExpoGo() || Constants.appOwnership === AppOwnership.Expo;
}
