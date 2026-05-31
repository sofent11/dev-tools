export type ToastTone = 'success' | 'error' | 'info';

export interface ToastPayload {
  title: string;
  description?: string;
  tone?: ToastTone;
  actionLabel?: string;
  onAction?: () => void;
}

export const notifyToast = ({ title, description, tone = 'info', actionLabel, onAction }: ToastPayload) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('devtoolbox-toast', {
    detail: { title, description, tone, actionLabel, onAction },
  }));
};
