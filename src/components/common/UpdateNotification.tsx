/**
 * Update Notification Component
 *
 * Displays notifications for OTA updates.
 * Uses NotificationBar component that matches the screen design style.
 */

import React from 'react';
import NotificationBar from './NotificationBar';

interface UpdateNotificationProps {
  position?: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
}

const UpdateNotification: React.FC<UpdateNotificationProps> = ({
  position = 'top-right',
}) => {
  return <NotificationBar types={['update']} />;
};

export default UpdateNotification;
