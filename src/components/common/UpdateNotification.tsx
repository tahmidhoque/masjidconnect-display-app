import React from "react";
import { Alert, Snackbar, Button } from "@mui/material";

interface UpdateNotificationProps {
  position?: {
    vertical: "top" | "bottom";
    horizontal: "left" | "right" | "center";
  };
}

const UpdateNotification: React.FC<UpdateNotificationProps> = ({
  position = { vertical: "bottom", horizontal: "right" },
}) => {
  // TODO: Implement update notification with Redux when Electron updater functionality is needed
  // For now, return null to prevent Context errors
  return null;

  // Original implementation commented out until we implement updater in Redux:
  /*
  const { updateAvailable, updateMessage, restartApp } = useUpdater();

  // Only show notification if there's an update available
  if (!updateAvailable) {
    return null;
  }

  // Check if the update is already downloaded
  const isDownloaded = updateMessage.includes('Update downloaded');

  // Action button for restarting the app
  const action = isDownloaded ? (
    <Button 
      color="inherit" 
      size="small" 
      onClick={restartApp}
    >
      Restart Now
    </Button>
  ) : null;

  return (
    <Snackbar
      open={updateAvailable}
      anchorOrigin={position}
      sx={{ 
        '& .MuiPaper-root': { 
          minWidth: '300px',
          maxWidth: '500px'
        }
      }}
    >
      <Alert 
        severity="info" 
        action={action}
      >
        {isDownloaded 
          ? 'An update has been downloaded and is ready to install.' 
          : 'A new update is available and downloading.'}
      </Alert>
    </Snackbar>
  );
  */
};

export default UpdateNotification;
