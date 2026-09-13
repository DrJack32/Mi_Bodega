import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_BACKUP_REMINDER,
  isBackupReminderDue,
  normalizeBackupReminder,
} from "../lib/backupReminder";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse("2026-09-13T12:00:00.000Z");

test("el recordatorio viene activado cada 30 días", () => {
  assert.deepEqual(normalizeBackupReminder(null), DEFAULT_BACKUP_REMINDER);
  assert.equal(isBackupReminderDue(DEFAULT_BACKUP_REMINDER, true, NOW), true);
  assert.equal(isBackupReminderDue(DEFAULT_BACKUP_REMINDER, false, NOW), false);
});

test("respeta la última copia y el aplazamiento de tres días", () => {
  const recentBackup = {
    intervalDays: 30 as const,
    lastBackupAt: new Date(NOW - 10 * DAY).toISOString(),
    lastReminderAt: null,
  };
  assert.equal(isBackupReminderDue(recentBackup, true, NOW), false);

  const overdue = {
    intervalDays: 30 as const,
    lastBackupAt: new Date(NOW - 31 * DAY).toISOString(),
    lastReminderAt: new Date(NOW - 2 * DAY).toISOString(),
  };
  assert.equal(isBackupReminderDue(overdue, true, NOW), false);
  assert.equal(isBackupReminderDue({ ...overdue, lastReminderAt: new Date(NOW - 3 * DAY).toISOString() }, true, NOW), true);
});

test("permite desactivar los avisos", () => {
  assert.equal(
    isBackupReminderDue({ intervalDays: 0, lastBackupAt: null, lastReminderAt: null }, true, NOW),
    false,
  );
});
