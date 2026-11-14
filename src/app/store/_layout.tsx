import { Stack } from 'expo-router';

// /store/register and /store/blocked sit outside the workspace group because they have no tab bar and no store yet.
export default function StoreLayout() {
  return <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />;
}
