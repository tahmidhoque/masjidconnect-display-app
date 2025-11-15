/**
 * Remote Command Notification Component
 *
 * Displays notifications for remote control commands from the admin portal.
 * Uses NotificationBar component that matches the screen design style.
 */

import React from "react";
import NotificationBar from "./NotificationBar";

interface RemoteCommandNotificationProps {
  position?: "bottom-left" | "bottom-right" | "top-left" | "top-right";
}

const RemoteCommandNotification: React.FC<RemoteCommandNotificationProps> = ({
  position = "bottom-right",
}) => {
  return <NotificationBar types={["remote-command"]} />;
};

export default RemoteCommandNotification;
