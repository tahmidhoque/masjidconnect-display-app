import { useState, useEffect, useCallback } from "react";
import { factoryResetService } from "../services/factoryResetService";
import logger from "../utils/logger";

interface UseFactoryResetResult {
  isModalOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
  confirmReset: () => Promise<void>;
  isResetting: boolean;
}

/**
 * Custom hook for factory reset functionality
 *
 * Handles keyboard shortcuts and modal state management
 * Keyboard shortcut: Ctrl+Shift+R (or Cmd+Shift+R on Mac)
 */
export const useFactoryReset = (): UseFactoryResetResult => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // Open modal
  const openModal = useCallback(() => {
    if (factoryResetService.canPerformReset()) {
      logger.info("🔓 Factory reset modal opened");
      setIsModalOpen(true);
    } else {
      logger.warn("❌ Factory reset not available");
    }
  }, []);

  // Close modal
  const closeModal = useCallback(() => {
    logger.info("🔒 Factory reset modal closed");
    setIsModalOpen(false);
  }, []);

  // Confirm reset
  const confirmReset = useCallback(async () => {
    try {
      setIsResetting(true);
      logger.info("🚀 Factory reset confirmed by user");

      await factoryResetService.performFactoryReset();

      // If we reach here, something went wrong (should have reloaded)
      setIsResetting(false);
      setIsModalOpen(false);
    } catch (error) {
      logger.error("❌ Factory reset failed", { error });
      setIsResetting(false);
      // Keep modal open to show error or allow retry
    }
  }, []);

  // Keyboard shortcut handler
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Check for Ctrl+Shift+R (or Cmd+Shift+R on Mac)
      const isModifierPressed = event.ctrlKey || event.metaKey;
      const isShiftPressed = event.shiftKey;
      const isRKey = event.key === "R" || event.key === "r";

      if (isModifierPressed && isShiftPressed && isRKey) {
        event.preventDefault();
        event.stopPropagation();

        logger.info(
          "⌨️ Factory reset keyboard shortcut triggered: Ctrl+Shift+R",
        );

        if (!isModalOpen && !isResetting) {
          openModal();
        }
      }
    },
    [isModalOpen, isResetting, openModal],
  );

  // Set up keyboard event listeners
  useEffect(() => {
    const handleKeyDownEvent = (event: KeyboardEvent) => {
      handleKeyDown(event);
    };

    // Add event listener to document
    document.addEventListener("keydown", handleKeyDownEvent, true);

    // Cleanup
    return () => {
      document.removeEventListener("keydown", handleKeyDownEvent, true);
    };
  }, [handleKeyDown]);

  // Log keyboard shortcut availability on mount
  useEffect(() => {
    logger.info(
      "🎹 Factory reset keyboard shortcut active: Ctrl+Shift+R (or Cmd+Shift+R on Mac)",
    );

    return () => {
      logger.info("🎹 Factory reset keyboard shortcut deactivated");
    };
  }, []);

  // Debug logging for modal state changes
  useEffect(() => {
    if (isModalOpen) {
      logger.info("📱 Factory reset modal state: OPEN");
    }
  }, [isModalOpen]);

  useEffect(() => {
    if (isResetting) {
      logger.info("⏳ Factory reset state: IN PROGRESS");
    }
  }, [isResetting]);

  return {
    isModalOpen,
    openModal,
    closeModal,
    confirmReset,
    isResetting,
  };
};

export default useFactoryReset;
