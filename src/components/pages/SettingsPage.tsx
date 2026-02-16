"use client";

import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Checkbox,
  Input,
  addToast,
  Code,
  Alert,
  Slider,
  Select,
  SelectItem,
  Switch,
} from "@heroui/react";
import { useState, useEffect, type ReactNode } from "react";
import {
  IconSettingsFilled,
  IconTrash,
  IconAlertTriangle,
  IconDeviceFloppy,
  IconRocket,
  IconPlayerPlay,
  IconLeaf,
  IconTargetArrow,
  IconClock,
  IconHourglass,
  IconGauge,
  IconApps,
} from "@tabler/icons-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useAppSettings, AppSettings, useAuth } from "../../hooks";
import { cn } from "@heroui/react";

const APP_CATEGORIES = [
  "Communication",
  "Meetings",
  "Media and Entertainment",
  "Docs and Writing",
  "Productivity and Planning",
  "Browsing and Research",
  "Development",
  "Design and Creative",
  "Data and Analytics",
  "Other",
];

const FOCUS_SENSITIVITY_OPTIONS = [
  { value: "3.0", label: "Low (3x baseline)" },
  { value: "2.0", label: "Medium (2x baseline)" },
  { value: "1.5", label: "High (1.5x baseline)" },
];

type SettingsCategory = "general" | "breaks-focus" | "account";

interface SettingRowProps {
  icon: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
}

function SettingRow({ icon, title, description, children }: SettingRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
      <div className="flex items-center gap-4 min-w-0 flex-1">
        <div className="bg-white/10 rounded-md p-1.5 shrink-0 text-foreground/70">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="font-medium">{title}</p>
          <p className="text-sm text-foreground/60">{description}</p>
        </div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

const SettingsPage = () => {
  const {
    settings: appSettings,
    updateSettings,
    loading: settingsLoading,
  } = useAppSettings();
  const { deleteUser, signOut } = useAuth();
  const [localSettings, setLocalSettings] = useState<AppSettings | null>(null);
  const [originalSettings, setOriginalSettings] = useState<AppSettings | null>(
    null
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showUnsavedChangesModal, setShowUnsavedChangesModal] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [showAutoPauseOptionsModal, setShowAutoPauseOptionsModal] =
    useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [activeCategory, setActiveCategory] =
    useState<SettingsCategory>("general");

  const closeWindow = () => {
    getCurrentWindow().close();
  };

  useEffect(() => {
    if (appSettings) {
      setLocalSettings(appSettings);
      setOriginalSettings(appSettings);
    }
  }, [appSettings]);

  const hasChanges =
    localSettings && originalSettings
      ? JSON.stringify(localSettings) !== JSON.stringify(originalSettings)
      : false;

  const handleSave = async (closeAfterSave = false) => {
    if (!localSettings) return;

    setIsSaving(true);
    try {
      await updateSettings(localSettings);
      setOriginalSettings({ ...localSettings });

      addToast({
        title: "Settings saved successfully",
        description: "Your preferences have been updated.",
        color: "success",
        timeout: 5000,
        variant: "flat",
      });

      if (closeAfterSave) {
        closeWindow();
      }
    } catch (error) {
      console.error("Error saving settings:", error);
      addToast({
        title: "Error saving settings",
        description: "Please try again later.",
        color: "danger",
        timeout: 5000,
        variant: "flat",
      });
    } finally {
      setIsSaving(false);
      setShowUnsavedChangesModal(false);
    }
  };

  const handleDeleteAccount = () => {
    setShowDeleteConfirmModal(true);
  };

  const handleConfirmDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      await deleteUser();

      addToast({
        title: "Account deleted successfully",
        description: "Your account and all data have been permanently removed.",
        color: "success",
        timeout: 10000,
        variant: "flat",
      });

      setShowDeleteConfirmModal(false);
      setDeleteConfirmText("");
      closeWindow();

      await signOut();
    } catch (error) {
      console.error("Error deleting account:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Please try again later or contact support.";

      addToast({
        title: "Error deleting account",
        description: errorMessage,
        color: "danger",
        timeout: 10000,
        variant: "flat",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCloseDeleteConfirm = () => {
    if (!isDeleting) {
      setShowDeleteConfirmModal(false);
      setDeleteConfirmText("");
    }
  };

  const isDeleteConfirmValid = deleteConfirmText === "DELETE MY ACCOUNT";

  const handleClose = () => {
    if (!isSaving && !isDeleting) {
      if (hasChanges) {
        setShowUnsavedChangesModal(true);
      } else {
        closeWindow();
      }
    }
  };

  const handleLeaveWithoutSaving = () => {
    if (originalSettings) {
      setLocalSettings({ ...originalSettings });
    }
    setShowUnsavedChangesModal(false);
    closeWindow();
  };

  const handleSaveAndLeave = async () => {
    await handleSave(true);
  };

  const disabled = isSaving || isDeleting || settingsLoading;

  const navItems: { id: SettingsCategory; label: string; icon: ReactNode }[] = [
    { id: "general", label: "General", icon: <IconSettingsFilled className="h-4 w-4" /> },
    { id: "breaks-focus", label: "Breaks & Focus", icon: <IconLeaf className="h-4 w-4" /> },
    { id: "account", label: "Account", icon: <IconTrash className="h-4 w-4" /> },
  ];

  return (
    <>
      <div className="flex h-dvh w-full bg-content1">
        {/* Sidebar - full height from top to bottom */}
        <div className="pt-4 pl-4 pb-4 shrink-0 self-stretch flex flex-col min-h-0">
          <aside className="w-[240px] flex-1 min-h-0 rounded-xl bg-background py-4 px-3 overflow-y-auto">
              <nav className="space-y-1">
                {navItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveCategory(item.id)}
                    className={cn(
                      "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-left transition-colors text-sm",
                      activeCategory === item.id
                        ? "bg-content1 border border-white/10"
                        : "hover:bg-content1/50"
                    )}
                  >
                    <div className="bg-primary-500/20 rounded-md p-1.5 flex items-center justify-center text-primary shrink-0">
                      {item.icon}
                    </div>
                    <span className="font-medium truncate">{item.label}</span>
                  </button>
                ))}
              </nav>
            </aside>
          </div>

        {/* Content + Footer */}
        <div className="flex flex-col flex-1 min-h-0">
          <main className="flex-1 overflow-y-auto">
            <div className="p-6">
              {activeCategory === "general" && (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold">Application</h3>
                  <div>
                    <SettingRow
                      icon={<IconRocket className="h-5 w-5" />}
                      title="Start on boot"
                      description="Launch CogniVibe when you log in"
                    >
                      <Switch
                        isSelected={localSettings?.should_start_on_boot ?? false}
                        onValueChange={(value) =>
                          setLocalSettings((prev) =>
                            prev ? { ...prev, should_start_on_boot: value } : null
                          )
                        }
                        isDisabled={disabled}
                        size="sm"
                      />
                    </SettingRow>
                    <SettingRow
                      icon={<IconPlayerPlay className="h-5 w-5" />}
                      title="Auto start monitoring"
                      description="Begin measuring automatically when the app opens"
                    >
                      <Switch
                        isSelected={
                          localSettings?.should_autostart_measuring ?? false
                        }
                        onValueChange={(value) =>
                          setLocalSettings((prev) =>
                            prev
                              ? { ...prev, should_autostart_measuring: value }
                              : null
                          )
                        }
                        isDisabled={disabled}
                        size="sm"
                      />
                    </SettingRow>
                  </div>
                </div>
              )}

              {activeCategory === "breaks-focus" && (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold">Break nudges</h3>
                  <div>
                    <SettingRow
                      icon={<IconLeaf className="h-5 w-5" />}
                      title="Break nudges"
                      description="Get reminded to take breaks based on your cognitive load"
                    >
                      <Switch
                        isSelected={localSettings?.break_nudge_enabled ?? true}
                        onValueChange={(value) =>
                          setLocalSettings((prev) =>
                            prev ? { ...prev, break_nudge_enabled: value } : null
                          )
                        }
                        isDisabled={disabled}
                        size="sm"
                      />
                    </SettingRow>

                    {localSettings?.break_nudge_enabled && (
                      <>
                        <SettingRow
                          icon={<IconClock className="h-5 w-5" />}
                          title={`Break after ${localSettings?.break_interval_minutes ?? 90} min`}
                          description="Minutes of work before a break is suggested"
                        >
                          <Slider
                            step={10}
                            minValue={30}
                            maxValue={180}
                            value={localSettings?.break_interval_minutes ?? 90}
                            onChange={(value) =>
                              setLocalSettings((prev) =>
                                prev
                                  ? { ...prev, break_interval_minutes: value as number }
                                  : null
                              )
                            }
                            isDisabled={disabled}
                            size="sm"
                            className="w-32"
                          />
                        </SettingRow>
                        <SettingRow
                          icon={<IconHourglass className="h-5 w-5" />}
                          title={`Break duration ${localSettings?.break_duration_seconds ?? 120} sec`}
                          description="Length of each break in seconds"
                        >
                          <Slider
                            step={30}
                            minValue={30}
                            maxValue={300}
                            value={localSettings?.break_duration_seconds ?? 120}
                            onChange={(value) =>
                              setLocalSettings((prev) =>
                                prev
                                  ? { ...prev, break_duration_seconds: value as number }
                                  : null
                              )
                            }
                            isDisabled={disabled}
                            size="sm"
                            className="w-32"
                          />
                        </SettingRow>
                        <SettingRow
                          icon={<IconGauge className="h-5 w-5" />}
                          title={`Score threshold ${localSettings?.break_score_threshold ?? 70}`}
                          description="Cognitive load level that triggers a break"
                        >
                          <Slider
                            step={5}
                            minValue={50}
                            maxValue={90}
                            value={localSettings?.break_score_threshold ?? 70}
                            onChange={(value) =>
                              setLocalSettings((prev) =>
                                prev
                                  ? { ...prev, break_score_threshold: value as number }
                                  : null
                              )
                            }
                            isDisabled={disabled}
                            size="sm"
                            className="w-32"
                          />
                        </SettingRow>
                        <SettingRow
                          icon={<IconApps className="h-5 w-5" />}
                          title="Auto-pause during"
                          description="Pause break reminders when using these app types"
                        >
                          <Button
                            size="sm"
                            variant="flat"
                            className="btn-plain"
                            onPress={() => setShowAutoPauseOptionsModal(true)}
                            isDisabled={disabled}
                          >
                            Options...
                          </Button>
                        </SettingRow>
                      </>
                    )}
                  </div>

                  <h3 className="text-lg font-semibold pt-2">Focus nudges</h3>
                  <div>
                    <SettingRow
                      icon={<IconTargetArrow className="h-5 w-5" />}
                      title="Focus nudges"
                      description="Get nudged to start focus sessions when you're in flow"
                    >
                      <Switch
                        isSelected={localSettings?.focus_nudge_enabled ?? true}
                        onValueChange={(value) =>
                          setLocalSettings((prev) =>
                            prev ? { ...prev, focus_nudge_enabled: value } : null
                          )
                        }
                        isDisabled={disabled}
                        size="sm"
                      />
                    </SettingRow>

                    {localSettings?.focus_nudge_enabled && (
                      <div className="py-4 first:pt-0 last:pb-0">
                        <div className="flex items-center gap-4 min-w-0 flex-1">
                          <div className="bg-white/10 rounded-md p-1.5 shrink-0 text-foreground/70">
                            <IconTargetArrow className="h-5 w-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium">Focus sensitivity</p>
                            <p className="text-sm text-foreground/60">
                              How quickly focus nudges trigger
                            </p>
                          </div>
                          <div className="shrink-0">
                            <Select
                              selectedKeys={[
                                String(localSettings?.focus_nudge_sensitivity ?? 2.0),
                              ]}
                              onSelectionChange={(keys) => {
                                const val = Array.from(keys)[0] as string;
                                setLocalSettings((prev) =>
                                  prev
                                    ? { ...prev, focus_nudge_sensitivity: parseFloat(val) }
                                    : null
                                );
                              }}
                              isDisabled={disabled}
                              size="sm"
                              className="w-44"
                            >
                              {FOCUS_SENSITIVITY_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </Select>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeCategory === "account" && (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold">Danger Zone</h3>
                  <div>
                    <SettingRow
                      icon={<IconTrash className="h-5 w-5" />}
                      title="Delete account"
                      description="Permanently remove your account and all data"
                    >
                      <Button
                        className="btn-plain"
                        color="danger"
                        variant="ghost"
                        startContent={
                          !isDeleting ? (
                            <IconTrash className="h-4 w-4" />
                          ) : undefined
                        }
                        onPress={handleDeleteAccount}
                        isDisabled={isSaving || isDeleting}
                        isLoading={isDeleting}
                        size="sm"
                      >
                        {isDeleting ? "Deleting Account..." : "Delete Account"}
                      </Button>
                    </SettingRow>
                  </div>
                </div>
              )}
            </div>
          </main>

          {/* Footer */}
          <footer className="shrink-0 flex justify-end gap-2 px-6 py-4">
          <Button
            color="default"
            variant="light"
            onPress={handleClose}
            isDisabled={isSaving || isDeleting}
          >
            Cancel
          </Button>
          <Button
            color="primary"
            className="text-white"
            onPress={() => handleSave(true)}
            isDisabled={!hasChanges || isSaving || isDeleting}
            isLoading={isSaving}
            startContent={
              !isSaving ? (
                <IconDeviceFloppy className="h-4 w-4" />
              ) : undefined
            }
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
          </footer>
        </div>
      </div>

      {/* Auto-pause Options Modal */}
      <Modal
        isOpen={showAutoPauseOptionsModal}
        onOpenChange={setShowAutoPauseOptionsModal}
        placement="center"
        size="md"
      >
        <ModalContent>
          {() => (
            <>
              <ModalHeader>Auto-pause during</ModalHeader>
              <ModalBody>
                <p className="text-sm text-default-500 mb-4">
                  Pause break reminders when using apps in these categories.
                </p>
                <div className="flex flex-wrap gap-2">
                  {APP_CATEGORIES.map((cat) => (
                    <Checkbox
                      key={cat}
                      size="sm"
                      isSelected={
                        localSettings?.break_auto_pause_categories?.includes(cat) ?? false
                      }
                      onValueChange={(checked) =>
                        setLocalSettings((prev) => {
                          if (!prev) return null;
                          const cats = prev.break_auto_pause_categories ?? [];
                          return {
                            ...prev,
                            break_auto_pause_categories: checked
                              ? [...cats, cat]
                              : cats.filter((c) => c !== cat),
                          };
                        })
                      }
                      isDisabled={disabled}
                    >
                      {cat}
                    </Checkbox>
                  ))}
                </div>
              </ModalBody>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Unsaved Changes Confirmation Modal */}
      <Modal
        isOpen={showUnsavedChangesModal}
        onOpenChange={() => setShowUnsavedChangesModal(false)}
        placement="center"
        size="md"
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex items-center">
                <IconAlertTriangle className="h-6 w-6 mr-2 text-warning" />
                Unsaved Changes
              </ModalHeader>
              <ModalBody>
                <p>You have unsaved changes. What would you like to do?</p>
              </ModalBody>
              <ModalFooter className="justify-between">
                <Button color="default" variant="light" onPress={onClose}>
                  Cancel
                </Button>
                <Button
                  color="danger"
                  variant="light"
                  onPress={handleLeaveWithoutSaving}
                >
                  Leave Without Saving
                </Button>
                <Button
                  color="primary"
                  onPress={handleSaveAndLeave}
                  isLoading={isSaving}
                  isDisabled={isSaving}
                >
                  {isSaving ? "Saving..." : "Save & Leave"}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Delete Account Confirmation Modal */}
      <Modal
        isOpen={showDeleteConfirmModal}
        onOpenChange={handleCloseDeleteConfirm}
        placement="center"
        size="md"
        isDismissable={!isDeleting}
        isKeyboardDismissDisabled={isDeleting}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex items-center">
                <IconTrash className="h-6 w-6 mr-2 text-danger" />
                Confirm Account Deletion
              </ModalHeader>
              <ModalBody>
                <div className="space-y-4">
                  <Alert color="danger" className="mb-4" hideIcon>
                    Are you sure you want to delete your account? This action is
                    irreversible and will permanently remove all your data.
                  </Alert>

                  <div>
                    <span className="flex items-center mb-2 gap-1">
                      <p className="text-sm font-medium">
                        To confirm deletion, please type
                      </p>
                      <Code color="danger" size="sm">
                        DELETE MY ACCOUNT
                      </Code>
                    </span>
                    <Input
                      value={deleteConfirmText}
                      onValueChange={setDeleteConfirmText}
                      placeholder="DELETE MY ACCOUNT"
                      isDisabled={isDeleting}
                      onCopy={(e) => e.preventDefault()}
                      onPaste={(e) => e.preventDefault()}
                      onCut={(e) => e.preventDefault()}
                      onDrop={(e) => e.preventDefault()}
                      autoComplete="off"
                      spellCheck="false"
                    />
                  </div>
                </div>
              </ModalBody>
              <ModalFooter>
                <Button
                  color="default"
                  variant="light"
                  onPress={onClose}
                  isDisabled={isDeleting}
                >
                  Cancel
                </Button>
                <Button
                  className="btn-plain"
                  color="danger"
                  onPress={handleConfirmDeleteAccount}
                  isDisabled={!isDeleteConfirmValid || isDeleting}
                  isLoading={isDeleting}
                  startContent={
                    !isDeleting ? <IconTrash className="h-4 w-4" /> : undefined
                  }
                >
                  {isDeleting ? "Deleting Account..." : "Delete Account"}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
};

export default SettingsPage;
