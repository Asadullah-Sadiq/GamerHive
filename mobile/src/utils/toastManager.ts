type ToastType = 'info' | 'success' | 'error';

interface ToastData {
  id: string;
  type: ToastType;
  title: string;
  message: string;
  onPress?: () => void;
}

type ToastListener = (toast: ToastData | null) => void;

class ToastManager {
  private listeners: ToastListener[] = [];
  private currentToast: ToastData | null = null;
  private toastIdCounter = 0;

  subscribe(listener: ToastListener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach(listener => listener(this.currentToast));
  }

  show(type: ToastType, title: string, message: string, onPress?: () => void) {
    const toast: ToastData = {
      id: `toast-${++this.toastIdCounter}`,
      type,
      title,
      message,
      onPress,
    };

    this.currentToast = toast;
    this.notify();
  }

  hide() {
    this.currentToast = null;
    this.notify();
  }

  info(title: string, message: string, onPress?: () => void) {
    this.show('info', title, message, onPress);
  }

  success(title: string, message: string, onPress?: () => void) {
    this.show('success', title, message, onPress);
  }

  error(title: string, message: string, onPress?: () => void) {
    this.show('error', title, message, onPress);
  }
}

export const toastManager = new ToastManager();

