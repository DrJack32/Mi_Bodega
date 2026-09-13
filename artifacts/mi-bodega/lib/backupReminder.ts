export const BACKUP_REMINDER_INTERVALS = [0, 7, 14, 30, 60] as const;
export type BackupReminderInterval = (typeof BACKUP_REMINDER_INTERVALS)[number];

export type BackupReminder = {
  intervalDays: BackupReminderInterval;
  lastBackupAt: string | null;
  lastReminderAt: string | null;
};

export const DEFAULT_BACKUP_REMINDER: BackupReminder = {
  intervalDays: 30,
  lastBackupAt: null,
  lastReminderAt: null,
};

function validDate(value: unknown) {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) return null;
  return value;
}

export function normalizeBackupReminder(value: unknown): BackupReminder {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return DEFAULT_BACKUP_REMINDER;
  }
  const record = value as Record<string, unknown>;
  const intervalDays = BACKUP_REMINDER_INTERVALS.includes(
    record.intervalDays as BackupReminderInterval,
  )
    ? (record.intervalDays as BackupReminderInterval)
    : DEFAULT_BACKUP_REMINDER.intervalDays;
  return {
    intervalDays,
    lastBackupAt: validDate(record.lastBackupAt),
    lastReminderAt: validDate(record.lastReminderAt),
  };
}

export function isBackupReminderDue(
  reminder: BackupReminder,
  hasData: boolean,
  now = Date.now(),
) {
  if (!hasData || reminder.intervalDays === 0) return false;
  const intervalMs = reminder.intervalDays * 24 * 60 * 60 * 1000;
  const backupAt = reminder.lastBackupAt
    ? Date.parse(reminder.lastBackupAt)
    : 0;
  if (backupAt > 0 && now - backupAt < intervalMs) return false;

  // Si se pospone un aviso vencido, lo repetimos tres días después, no cada vez
  // que se abre la aplicación.
  const reminderAt = reminder.lastReminderAt
    ? Date.parse(reminder.lastReminderAt)
    : 0;
  return reminderAt === 0 || now - reminderAt >= 3 * 24 * 60 * 60 * 1000;
}
