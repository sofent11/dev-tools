export type ToastTone = 'success' | 'error' | 'info';

export interface ToastPayload {
  title: string;
  description?: string;
  tone?: ToastTone;
}

export const notifyToast = ({ title, description, tone = 'info' }: ToastPayload) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('devtoolbox-toast', {
    detail: { title, description, tone },
  }));
};
