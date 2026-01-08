/**
 * Notification Context
 *
 * Provides notification state to components that need to display notifications,
 * particularly for integrating notifications into the footer.
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";

export interface Notification {
  id: string;
  key?: string;
  type: "info" | "success" | "warning" | "error";
  title: string;
  message: string;
  icon?: ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
  progress?: number;
  autoHide?: number;
  onClose?: () => void;
}

interface NotificationContextType {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, "id">) => string;
  removeNotification: (id: string) => void;
  getCurrentNotification: () => Notification | null;
}

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined,
);

export const useNotifications = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (!context) {
    // Return a safe default instead of throwing, to handle cases where provider isn't available yet
    return {
      notifications: [],
      addNotification: () => "",
      removeNotification: () => {},
      getCurrentNotification: () => null,
    };
  }
  return context;
};

interface NotificationProviderProps {
  children: ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({
  children,
}) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = useCallback(
    (notification: Omit<Notification, "id">) => {
      const id = `notification-${Date.now()}-${Math.random()}`;
      const newNotification: Notification = {
        ...notification,
        id,
        autoHide: notification.autoHide ?? 3000,
      };

      setNotifications((prev) => {
        // If notification has a key, replace existing notification with same key
        if (notification.key) {
          return [
            ...prev.filter((n) => n.key !== notification.key),
            newNotification,
          ];
        }
        return [...prev, newNotification];
      });

      if (newNotification.autoHide && newNotification.autoHide > 0) {
        setTimeout(() => {
          removeNotification(id);
        }, newNotification.autoHide);
      }

      return id;
    },
    [],
  );

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const getCurrentNotification = useCallback(() => {
    return notifications.length > 0
      ? notifications[notifications.length - 1]
      : null;
  }, [notifications.length, notifications[notifications.length - 1]?.id]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        addNotification,
        removeNotification,
        getCurrentNotification,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};
