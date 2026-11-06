let completed = false;

export function hasCompletedLaunchSplash() {
  return completed;
}

export function markLaunchSplashComplete() {
  completed = true;
}
