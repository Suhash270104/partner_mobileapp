// Allowed next steps for orders and returns (hand-off §10). The server enforces the same transitions.

export type StepNeeds = 'courier' | 'reason' | null;
export interface FulfilmentStep { label: string; to: string; needs: StepNeeds; icon: string; danger?: boolean }

export const ORDER_STEPS: Record<string, FulfilmentStep[]> = {
  placed: [
    { label: 'Accept order', to: 'accepted', needs: null, icon: 'check' },
    { label: 'Reject order', to: 'cancelled', needs: 'reason', icon: 'x', danger: true },
  ],
  accepted: [
    { label: 'Start preparation', to: 'in_preparation', needs: null, icon: 'clock' },
    { label: 'Dispatch & ship', to: 'shipped', needs: 'courier', icon: 'send' },
    { label: 'Cancel order', to: 'cancelled', needs: 'reason', icon: 'x', danger: true },
  ],
  in_preparation: [
    { label: 'Dispatch & ship', to: 'shipped', needs: 'courier', icon: 'send' },
    { label: 'Cancel order', to: 'cancelled', needs: 'reason', icon: 'x', danger: true },
  ],
  shipped: [{ label: 'Mark delivered', to: 'delivered', needs: null, icon: 'checkCheck' }],
};

export const RETURN_STEPS: Record<string, FulfilmentStep[]> = {
  requested: [
    { label: 'Approve return', to: 'approved', needs: null, icon: 'check' },
    { label: 'Reject return', to: 'rejected', needs: 'reason', icon: 'x', danger: true },
  ],
  approved: [{ label: 'Schedule pickup', to: 'pickup_scheduled', needs: 'courier', icon: 'calendar' }],
  pickup_scheduled: [{ label: 'Mark picked up', to: 'picked_up', needs: null, icon: 'check' }],
  picked_up: [{ label: 'Complete return', to: 'completed', needs: null, icon: 'checkCheck' }],
  completed: [{ label: 'Mark refunded', to: 'refunded', needs: null, icon: 'rupee' }],
};

/** Tracking numbers allow letters, digits and hyphens (hand-off §10). */
export const isTrackingNumber = (value: string) => /^[A-Za-z0-9-]{4,40}$/.test(value.trim());
