import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Switch,
  FormControlLabel,
  TextField,
  Button,
  Grid,
  Alert,
  Paper,
  Divider,
} from "@mui/material";
import StorageIcon from "@mui/icons-material/Storage";
import DeleteIcon from "@mui/icons-material/Delete";
import RefreshIcon from "@mui/icons-material/Refresh";
import offlineStorage from "../../services/offlineStorageService";
import logger from "../../utils/logger";

interface OfflineSettingsState {
  enabled: boolean;
  maxCacheSize: number; // in MB
  syncFrequency: number; // in minutes
  contentTTL: number; // in hours
  prayerTimesTTL: number; // in days
  eventsTTL: number; // in hours
}

const STORAGE_KEY = "offline_settings";

const OfflineSettings: React.FC = () => {
  const [settings, setSettings] = useState<OfflineSettingsState>({
    enabled: true,
    maxCacheSize: 500, // 500MB default
    syncFrequency: 5, // 5 minutes
    contentTTL: 24, // 24 hours
    prayerTimesTTL: 7, // 7 days
    eventsTTL: 24, // 24 hours
  });

  const [storageStats, setStorageStats] = useState<{
    itemCount: number;
    estimatedSize: number;
    byType: Record<string, number>;
    expiredCount: number;
  } | null>(null);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Load settings from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setSettings({ ...settings, ...parsed });
      }
    } catch (error) {
      logger.error("[OfflineSettings] Error loading settings", { error });
    }
  }, []);

  // Load storage statistics
  useEffect(() => {
    loadStorageStats();
  }, []);

  const loadStorageStats = async () => {
    try {
      const stats = await offlineStorage.getStorageStats();
      setStorageStats(stats);
    } catch (error) {
      logger.error("[OfflineSettings] Error loading storage stats", { error });
    }
  };

  const handleSettingChange = (key: keyof OfflineSettingsState, value: any) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);

    // Save to localStorage
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
    } catch (error) {
      logger.error("[OfflineSettings] Error saving settings", { error });
    }
  };

  const handleClearCache = async (
    type?: "content" | "prayer-times" | "events" | "announcements" | "images",
  ) => {
    setLoading(true);
    setMessage(null);

    try {
      if (type) {
        await offlineStorage.clearType(type);
        setMessage({ type: "success", text: `Cleared ${type} cache` });
      } else {
        await offlineStorage.clearAll();
        setMessage({ type: "success", text: "Cleared all cache" });
      }
      await loadStorageStats();
    } catch (error) {
      logger.error("[OfflineSettings] Error clearing cache", { error });
      setMessage({ type: "error", text: "Failed to clear cache" });
    } finally {
      setLoading(false);
    }
  };

  const handleClearExpired = async () => {
    setLoading(true);
    setMessage(null);

    try {
      await offlineStorage.clearExpiredContent();
      setMessage({ type: "success", text: "Cleared expired cache entries" });
      await loadStorageStats();
    } catch (error) {
      logger.error("[OfflineSettings] Error clearing expired cache", { error });
      setMessage({ type: "error", text: "Failed to clear expired cache" });
    } finally {
      setLoading(false);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Box sx={{ display: "flex", alignItems: "center", mb: 3 }}>
        <StorageIcon sx={{ mr: 1 }} />
        <Typography variant="h6">Offline Mode Settings</Typography>
      </Box>

      {message && (
        <Alert
          severity={message.type}
          sx={{ mb: 2 }}
          onClose={() => setMessage(null)}
        >
          {message.text}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Enable/Disable Offline Mode */}
        <Grid item xs={12}>
          <FormControlLabel
            control={
              <Switch
                checked={settings.enabled}
                onChange={(e) =>
                  handleSettingChange("enabled", e.target.checked)
                }
              />
            }
            label="Enable Offline Mode"
          />
          <Typography
            variant="caption"
            color="text.secondary"
            display="block"
            sx={{ mt: 0.5 }}
          >
            When enabled, content will be cached for offline viewing
          </Typography>
        </Grid>

        <Divider sx={{ width: "100%", my: 2 }} />

        {/* Cache Configuration */}
        <Grid item xs={12}>
          <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
            Cache Configuration
          </Typography>
        </Grid>

        <Grid item xs={12} sm={6}>
          <TextField
            label="Maximum Cache Size (MB)"
            type="number"
            value={settings.maxCacheSize}
            onChange={(e) =>
              handleSettingChange(
                "maxCacheSize",
                parseInt(e.target.value) || 500,
              )
            }
            fullWidth
            inputProps={{ min: 50, max: 5000 }}
          />
        </Grid>

        <Grid item xs={12} sm={6}>
          <TextField
            label="Sync Frequency (minutes)"
            type="number"
            value={settings.syncFrequency}
            onChange={(e) =>
              handleSettingChange(
                "syncFrequency",
                parseInt(e.target.value) || 5,
              )
            }
            fullWidth
            inputProps={{ min: 1, max: 60 }}
          />
        </Grid>

        <Grid item xs={12} sm={4}>
          <TextField
            label="Content TTL (hours)"
            type="number"
            value={settings.contentTTL}
            onChange={(e) =>
              handleSettingChange("contentTTL", parseInt(e.target.value) || 24)
            }
            fullWidth
            inputProps={{ min: 1, max: 168 }}
          />
        </Grid>

        <Grid item xs={12} sm={4}>
          <TextField
            label="Prayer Times TTL (days)"
            type="number"
            value={settings.prayerTimesTTL}
            onChange={(e) =>
              handleSettingChange(
                "prayerTimesTTL",
                parseInt(e.target.value) || 7,
              )
            }
            fullWidth
            inputProps={{ min: 1, max: 30 }}
          />
        </Grid>

        <Grid item xs={12} sm={4}>
          <TextField
            label="Events TTL (hours)"
            type="number"
            value={settings.eventsTTL}
            onChange={(e) =>
              handleSettingChange("eventsTTL", parseInt(e.target.value) || 24)
            }
            fullWidth
            inputProps={{ min: 1, max: 168 }}
          />
        </Grid>

        <Divider sx={{ width: "100%", my: 2 }} />

        {/* Storage Statistics */}
        {storageStats && (
          <>
            <Grid item xs={12}>
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                Storage Statistics
              </Typography>
            </Grid>

            <Grid item xs={12} sm={6}>
              <Typography variant="body2" color="text.secondary">
                Total Items: {storageStats.itemCount}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Estimated Size: {formatBytes(storageStats.estimatedSize)}
              </Typography>
              {storageStats.expiredCount > 0 && (
                <Typography variant="body2" color="warning.main">
                  Expired Items: {storageStats.expiredCount}
                </Typography>
              )}
            </Grid>

            <Grid item xs={12} sm={6}>
              <Typography variant="body2" fontWeight="bold" gutterBottom>
                By Type:
              </Typography>
              {Object.entries(storageStats.byType).map(([type, count]) => (
                <Typography key={type} variant="body2" color="text.secondary">
                  {type}: {count} items
                </Typography>
              ))}
            </Grid>
          </>
        )}

        <Divider sx={{ width: "100%", my: 2 }} />

        {/* Cache Management Actions */}
        <Grid item xs={12}>
          <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
            Cache Management
          </Typography>
        </Grid>

        <Grid item xs={12}>
          <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={loadStorageStats}
              disabled={loading}
            >
              Refresh Stats
            </Button>

            <Button
              variant="outlined"
              color="warning"
              startIcon={<DeleteIcon />}
              onClick={handleClearExpired}
              disabled={loading}
            >
              Clear Expired
            </Button>

            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={() => handleClearCache()}
              disabled={loading}
            >
              Clear All Cache
            </Button>
          </Box>
        </Grid>

        {/* Selective Cache Clearing */}
        <Grid item xs={12}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Clear by Type:
          </Typography>
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mt: 1 }}>
            {(
              [
                "content",
                "prayer-times",
                "events",
                "announcements",
                "images",
              ] as const
            ).map((type) => (
              <Button
                key={type}
                size="small"
                variant="outlined"
                onClick={() => handleClearCache(type)}
                disabled={loading}
              >
                Clear {type}
              </Button>
            ))}
          </Box>
        </Grid>
      </Grid>
    </Paper>
  );
};

export default OfflineSettings;

