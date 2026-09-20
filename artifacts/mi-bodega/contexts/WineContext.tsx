import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  createBackupArchive,
  inspectBackup as inspectBackupFile,
  restoreBackup as restoreBackupFile,
  type BackupPreview,
  type RestoreMode,
  type RestoreResult,
} from "@/lib/backup";
import {
  deleteManagedPhotos,
  persistPhoto,
  persistPhotos,
  pruneOrphanPhotos,
} from "@/lib/photoStorage";
import {
  DEFAULT_BACKUP_REMINDER,
  isBackupReminderDue,
  normalizeBackupReminder,
  type BackupReminder,
  type BackupReminderInterval,
} from "@/lib/backupReminder";
import {
  createStock,
  createTasting,
  moveWineStock,
  normalizeStorageLocations,
  normalizeWineRecords,
  syncWineSummary,
  type InitialWineEntry,
  type StockFormData,
  type TastingFormData,
  type Wine,
  type WineFormData,
  type WineStock,
  type WineStockMovement,
  type WineTasting,
  type WineType,
} from "@/lib/wineData";

export type {
  BackupPreview,
  InitialWineEntry,
  RestoreMode,
  RestoreResult,
  StockFormData,
  TastingFormData,
  Wine,
  WineFormData,
  WineStock,
  WineStockMovement,
  WineTasting,
  WineType,
};

const STORAGE_KEY = "@mi_bodega_wines_v1";
const LOCATIONS_KEY = "@mi_bodega_storage_locations_v1";
const RECOVERY_KEY = "@mi_bodega_wines_recovery_v1";
const BACKUP_REMINDER_KEY = "@mi_bodega_backup_reminder_v1";

interface WineContextValue {
  wines: Wine[];
  storageLocations: string[];
  isLoading: boolean;
  storageWarning: string | null;
  backupReminder: BackupReminder;
  backupReminderDue: boolean;
  addWine: (data: WineFormData, entry?: InitialWineEntry) => Promise<Wine>;
  updateWine: (id: string, data: Partial<WineFormData>) => Promise<void>;
  deleteWine: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  getWine: (id: string) => Wine | undefined;
  addTasting: (
    wineId: string,
    data: TastingFormData,
    stockEntryId?: string,
  ) => Promise<void>;
  addStock: (wineId: string, data: StockFormData) => Promise<void>;
  moveStock: (
    wineId: string,
    stockEntryId: string,
    destination: string,
    quantity: number,
  ) => Promise<void>;
  addStorageLocation: (location: string) => Promise<void>;
  removeStorageLocation: (location: string) => Promise<void>;
  setBackupReminderInterval: (
    interval: BackupReminderInterval,
  ) => Promise<void>;
  snoozeBackupReminder: () => Promise<void>;
  createBackup: () => ReturnType<typeof createBackupArchive>;
  inspectBackup: (uri: string, name: string) => Promise<BackupPreview>;
  restoreBackup: (
    preview: BackupPreview,
    mode: RestoreMode,
  ) => Promise<RestoreResult>;
}

type AppState = { wines: Wine[]; storageLocations: string[] };
type Mutation<T> = (current: AppState) => Promise<T>;

const WineContext = createContext<WineContextValue | null>(null);

function allPhotoUris(wines: Wine[]) {
  return wines.flatMap((wine) => wine.photos);
}

function newlyCreatedPhotos(before: string[], after: string[]) {
  const existing = new Set(before);
  return after.filter((uri) => !existing.has(uri));
}

function withLocation(locations: string[], candidate: string) {
  return normalizeStorageLocations([...locations, candidate]);
}

export function WineProvider({ children }: { children: React.ReactNode }) {
  const [wines, setWines] = useState<Wine[]>([]);
  const [storageLocations, setStorageLocations] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const [backupReminder, setBackupReminder] = useState<BackupReminder>(
    DEFAULT_BACKUP_REMINDER,
  );
  const backupReminderRef = useRef<BackupReminder>(DEFAULT_BACKUP_REMINDER);
  const stateRef = useRef<AppState>({ wines: [], storageLocations: [] });
  const mutationQueue = useRef<Promise<void>>(Promise.resolve());
  const mountedRef = useRef(true);

  const setCurrentState = useCallback((next: AppState) => {
    stateRef.current = next;
    if (mountedRef.current) {
      setWines(next.wines);
      setStorageLocations(next.storageLocations);
    }
  }, []);

  const persist = useCallback(async (next: AppState) => {
    await AsyncStorage.multiSet([
      [STORAGE_KEY, JSON.stringify(next.wines)],
      [LOCATIONS_KEY, JSON.stringify(next.storageLocations)],
    ]);
  }, []);

  const commit = useCallback(
    async (next: AppState) => {
      await persist(next);
      setCurrentState(next);
    },
    [persist, setCurrentState],
  );

  const runMutation = useCallback(function enqueueMutation<T>(
    operation: Mutation<T>,
  ): Promise<T> {
    const task = mutationQueue.current.then(() => operation(stateRef.current));
    mutationQueue.current = task.then(
      () => undefined,
      () => undefined,
    );
    return task;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;

    async function load() {
      try {
        const values = await AsyncStorage.multiGet([
          STORAGE_KEY,
          LOCATIONS_KEY,
          BACKUP_REMINDER_KEY,
        ]);
        const raw = values[0][1];
        const rawLocations = values[1][1];
        const rawReminder = values[2][1];
        try {
          const reminder = normalizeBackupReminder(
            rawReminder ? JSON.parse(rawReminder) : null,
          );
          backupReminderRef.current = reminder;
          if (!cancelled) setBackupReminder(reminder);
        } catch {
          backupReminderRef.current = DEFAULT_BACKUP_REMINDER;
          if (!cancelled) setBackupReminder(DEFAULT_BACKUP_REMINDER);
        }
        let locations: string[] = [];
        try {
          locations = normalizeStorageLocations(
            rawLocations ? JSON.parse(rawLocations) : [],
          );
        } catch {
          setStorageWarning(
            "No se pudieron leer las ubicaciones preparadas. Los vinos se han conservado.",
          );
        }

        if (!raw) {
          if (!cancelled)
            setCurrentState({ wines: [], storageLocations: locations });
          return;
        }

        let parsed: unknown;
        let normalized: Wine[];
        try {
          parsed = JSON.parse(raw);
          normalized = normalizeWineRecords(parsed);
        } catch {
          let recoverySaved = false;
          try {
            await AsyncStorage.setItem(RECOVERY_KEY, raw);
            recoverySaved = true;
          } catch {
            // El valor original sigue en su clave mientras no se guarden datos nuevos.
          }
          if (!cancelled) {
            setStorageWarning(
              recoverySaved
                ? "Los datos guardados no se pueden leer. Se ha reservado una copia interna para facilitar su recuperacion."
                : "Los datos guardados no se pueden leer. No se han sobrescrito para facilitar su recuperacion.",
            );
          }
          return;
        }

        let migratedCount = 0;
        let unavailableCount = 0;
        const createdPhotoUris: string[] = [];
        const migrated: Wine[] = [];

        for (const wine of normalized) {
          const photos: string[] = [];
          for (const uri of wine.photos) {
            try {
              const persisted = await persistPhoto(uri);
              photos.push(persisted);
              if (persisted !== uri) {
                migratedCount += 1;
                createdPhotoUris.push(persisted);
              }
            } catch {
              photos.push(uri);
              unavailableCount += 1;
            }
          }
          migrated.push({ ...wine, photos });
        }

        const next = { wines: migrated, storageLocations: locations };
        try {
          const needsNormalization =
            JSON.stringify(parsed) !== JSON.stringify(normalized);
          if (migratedCount > 0 || needsNormalization) await persist(next);
          if (!cancelled) setCurrentState(next);
        } catch {
          deleteManagedPhotos(createdPhotoUris);
          if (!cancelled) {
            setCurrentState({ wines: normalized, storageLocations: locations });
            setStorageWarning(
              "No se pudieron consolidar las fotografias en el almacenamiento permanente.",
            );
          }
          return;
        }

        if (!cancelled && unavailableCount > 0) {
          setStorageWarning(
            `${unavailableCount === 1 ? "Una fotografia guardada no esta disponible" : `${unavailableCount} fotografias guardadas no estan disponibles`}. Los vinos se han conservado.`,
          );
        }
      } catch {
        if (!cancelled) {
          setStorageWarning(
            "No se pudo acceder al almacenamiento local. No se ha modificado ningun dato.",
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
      mountedRef.current = false;
    };
  }, [persist, setCurrentState]);

  const createBackup = useCallback(async () => {
    await mutationQueue.current;
    const result = await createBackupArchive(
      stateRef.current.wines,
      stateRef.current.storageLocations,
    );
    const reminder = {
      ...backupReminderRef.current,
      lastBackupAt: new Date().toISOString(),
      lastReminderAt: null,
    };
    backupReminderRef.current = reminder;
    setBackupReminder(reminder);
    void AsyncStorage.setItem(
      BACKUP_REMINDER_KEY,
      JSON.stringify(reminder),
    ).catch(() => {});
    return result;
  }, []);

  const setBackupReminderInterval = useCallback(
    async (intervalDays: BackupReminderInterval) => {
      const reminder: BackupReminder = {
        ...backupReminderRef.current,
        intervalDays,
        lastReminderAt: null,
      };
      await AsyncStorage.setItem(BACKUP_REMINDER_KEY, JSON.stringify(reminder));
      backupReminderRef.current = reminder;
      setBackupReminder(reminder);
    },
    [],
  );

  const snoozeBackupReminder = useCallback(async () => {
    const reminder: BackupReminder = {
      ...backupReminderRef.current,
      lastReminderAt: new Date().toISOString(),
    };
    await AsyncStorage.setItem(BACKUP_REMINDER_KEY, JSON.stringify(reminder));
    backupReminderRef.current = reminder;
    setBackupReminder(reminder);
  }, []);

  const inspectBackup = useCallback(async (uri: string, name: string) => {
    await mutationQueue.current;
    return inspectBackupFile(uri, name, stateRef.current.wines);
  }, []);

  const restoreBackup = useCallback(
    (preview: BackupPreview, mode: RestoreMode) =>
      runMutation(async (current) => {
        const result = await restoreBackupFile(
          preview,
          current.wines,
          current.storageLocations,
          mode,
        );
        try {
          await commit({
            wines: result.wines,
            storageLocations: result.storageLocations,
          });
        } catch (error) {
          deleteManagedPhotos(result.createdPhotoUris);
          throw error;
        }
        pruneOrphanPhotos(allPhotoUris(result.wines));
        return result;
      }),
    [commit, runMutation],
  );

  const addWine = useCallback(
    (data: WineFormData, entry: InitialWineEntry = { kind: "tasted" }) =>
      runMutation(async (current) => {
        const photos = await persistPhotos(data.photos);
        const createdPhotoUris = newlyCreatedPhotos(data.photos, photos);
        const tasting =
          entry.kind === "tasted"
            ? createTasting({
                date: data.date,
                location: data.location,
                price: data.price,
                rating: data.rating,
                wouldRepeat: data.wouldRepeat,
                notes: data.notes,
                quantity: 1,
                fromStock: false,
              })
            : null;
        const stock =
          entry.kind === "cellar"
            ? createStock({
                location: entry.location,
                quantity: entry.quantity,
                price: entry.price,
              })
            : null;
        const wine = syncWineSummary({
          ...data,
          photos,
          id: Crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          tastings: tasting ? [tasting] : [],
          stock: stock ? [stock] : [],
          stockMovements: [],
        });
        const locations =
          stock && stock.location
            ? withLocation(current.storageLocations, stock.location)
            : current.storageLocations;
        try {
          await commit({
            wines: [wine, ...current.wines],
            storageLocations: locations,
          });
          return wine;
        } catch (error) {
          deleteManagedPhotos(createdPhotoUris);
          throw error;
        }
      }),
    [commit, runMutation],
  );

  const updateWine = useCallback(
    (id: string, data: Partial<WineFormData>) =>
      runMutation(async (current) => {
        const original = current.wines.find((wine) => wine.id === id);
        if (!original)
          throw new Error("El vino que quieres editar ya no existe.");

        const photos = data.photos
          ? await persistPhotos(data.photos)
          : original.photos;
        const createdPhotoUris = data.photos
          ? newlyCreatedPhotos(data.photos, photos)
          : [];
        const latest = original.tastings[0];
        const updatesTasting =
          latest &&
          ["date", "location", "price", "rating", "wouldRepeat", "notes"].some(
            (key) => key in data,
          );
        const tastings = updatesTasting
          ? [
              {
                ...latest,
                date: data.date ?? latest.date,
                location: data.location ?? latest.location,
                price: data.price ?? latest.price,
                rating: data.rating ?? latest.rating,
                wouldRepeat:
                  "wouldRepeat" in data
                    ? (data.wouldRepeat ?? null)
                    : latest.wouldRepeat,
                notes: data.notes ?? latest.notes,
              },
              ...original.tastings.slice(1),
            ]
          : original.tastings;
        const updated = current.wines.map((wine) =>
          wine.id === id
            ? syncWineSummary({ ...wine, ...data, photos, tastings })
            : wine,
        );
        try {
          await commit({ ...current, wines: updated });
        } catch (error) {
          deleteManagedPhotos(createdPhotoUris);
          throw error;
        }
        pruneOrphanPhotos(allPhotoUris(updated));
      }),
    [commit, runMutation],
  );

  const addTasting = useCallback(
    (wineId: string, data: TastingFormData, stockEntryId?: string) =>
      runMutation(async (current) => {
        const target = current.wines.find((wine) => wine.id === wineId);
        if (!target) throw new Error("El vino ya no existe.");
        let stock = target.stock;
        if (stockEntryId) {
          const entry = stock.find((item) => item.id === stockEntryId);
          if (!entry || entry.quantity < data.quantity) {
            throw new Error(
              "Ya no quedan suficientes botellas en esa ubicacion.",
            );
          }
          stock = stock.map((item) =>
            item.id === stockEntryId
              ? { ...item, quantity: item.quantity - data.quantity }
              : item,
          );
        }
        const tasting = createTasting({
          ...data,
          fromStock: Boolean(stockEntryId),
        });
        const updated = current.wines.map((wine) =>
          wine.id === wineId
            ? syncWineSummary({
                ...wine,
                stock,
                tastings: [tasting, ...wine.tastings],
              })
            : wine,
        );
        await commit({ ...current, wines: updated });
      }),
    [commit, runMutation],
  );

  const addStock = useCallback(
    (wineId: string, data: StockFormData) =>
      runMutation(async (current) => {
        const target = current.wines.find((wine) => wine.id === wineId);
        if (!target) throw new Error("El vino ya no existe.");
        const entry = createStock(data);
        const updated = current.wines.map((wine) =>
          wine.id === wineId
            ? { ...wine, stock: [entry, ...wine.stock] }
            : wine,
        );
        const locations = withLocation(
          current.storageLocations,
          entry.location,
        );
        await commit({ wines: updated, storageLocations: locations });
      }),
    [commit, runMutation],
  );

  const moveStock = useCallback(
    (
      wineId: string,
      stockEntryId: string,
      destination: string,
      quantity: number,
    ) =>
      runMutation(async (current) => {
        const target = current.wines.find((wine) => wine.id === wineId);
        if (!target) throw new Error("El vino ya no existe.");
        const moved = moveWineStock(
          target,
          stockEntryId,
          destination,
          quantity,
        );
        const updated = current.wines.map((wine) =>
          wine.id === wineId ? moved : wine,
        );
        const locations = withLocation(current.storageLocations, destination);
        await commit({ wines: updated, storageLocations: locations });
      }),
    [commit, runMutation],
  );

  const addStorageLocation = useCallback(
    (location: string) =>
      runMutation(async (current) => {
        const locations = withLocation(current.storageLocations, location);
        if (locations.length === current.storageLocations.length) return;
        await commit({ ...current, storageLocations: locations });
      }),
    [commit, runMutation],
  );

  const removeStorageLocation = useCallback(
    (location: string) =>
      runMutation(async (current) => {
        const locations = current.storageLocations.filter(
          (item) =>
            item.toLocaleLowerCase("es") !== location.toLocaleLowerCase("es"),
        );
        await commit({ ...current, storageLocations: locations });
      }),
    [commit, runMutation],
  );

  const deleteWine = useCallback(
    (id: string) =>
      runMutation(async (current) => {
        const updated = current.wines.filter((wine) => wine.id !== id);
        await commit({ ...current, wines: updated });
        pruneOrphanPhotos(allPhotoUris(updated));
      }),
    [commit, runMutation],
  );

  const toggleFavorite = useCallback(
    (id: string) =>
      runMutation(async (current) => {
        const updated = current.wines.map((wine) =>
          wine.id === id ? { ...wine, isFavorite: !wine.isFavorite } : wine,
        );
        await commit({ ...current, wines: updated });
      }),
    [commit, runMutation],
  );

  const getWine = useCallback(
    (id: string) => wines.find((wine) => wine.id === id),
    [wines],
  );

  return (
    <WineContext.Provider
      value={{
        wines,
        storageLocations,
        isLoading,
        storageWarning,
        backupReminder,
        backupReminderDue: isBackupReminderDue(
          backupReminder,
          wines.length > 0,
        ),
        addWine,
        updateWine,
        deleteWine,
        toggleFavorite,
        getWine,
        addTasting,
        addStock,
        moveStock,
        addStorageLocation,
        removeStorageLocation,
        setBackupReminderInterval,
        snoozeBackupReminder,
        createBackup,
        inspectBackup,
        restoreBackup,
      }}
    >
      {isLoading ? null : children}
    </WineContext.Provider>
  );
}

export function useWines() {
  const context = useContext(WineContext);
  if (!context) throw new Error("useWines must be used within WineProvider");
  return context;
}
