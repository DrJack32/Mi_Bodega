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
  normalizeWineRecords,
  type Wine,
  type WineFormData,
  type WineType,
} from "@/lib/wineData";

export type {
  BackupPreview,
  RestoreMode,
  RestoreResult,
  Wine,
  WineFormData,
  WineType,
};

const STORAGE_KEY = "@mi_bodega_wines_v1";
const RECOVERY_KEY = "@mi_bodega_wines_recovery_v1";

interface WineContextValue {
  wines: Wine[];
  isLoading: boolean;
  storageWarning: string | null;
  addWine: (data: WineFormData) => Promise<Wine>;
  updateWine: (id: string, data: Partial<WineFormData>) => Promise<void>;
  deleteWine: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  getWine: (id: string) => Wine | undefined;
  createBackup: () => ReturnType<typeof createBackupArchive>;
  inspectBackup: (uri: string, name: string) => Promise<BackupPreview>;
  restoreBackup: (
    preview: BackupPreview,
    mode: RestoreMode,
  ) => Promise<RestoreResult>;
}

type Mutation<T> = (current: Wine[]) => Promise<T>;

const WineContext = createContext<WineContextValue | null>(null);

function allPhotoUris(wines: Wine[]) {
  return wines.flatMap((wine) => wine.photos);
}

function newlyCreatedPhotos(before: string[], after: string[]) {
  const existing = new Set(before);
  return after.filter((uri) => !existing.has(uri));
}

export function WineProvider({ children }: { children: React.ReactNode }) {
  const [wines, setWines] = useState<Wine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const winesRef = useRef<Wine[]>([]);
  const mutationQueue = useRef<Promise<void>>(Promise.resolve());
  const mountedRef = useRef(true);

  const setCurrentWines = useCallback((next: Wine[]) => {
    winesRef.current = next;
    if (mountedRef.current) setWines(next);
  }, []);

  const persist = useCallback(async (updated: Wine[]) => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }, []);

  const commit = useCallback(
    async (updated: Wine[]) => {
      await persist(updated);
      setCurrentWines(updated);
    },
    [persist, setCurrentWines],
  );

  const runMutation = useCallback(function enqueueMutation<T>(
    operation: Mutation<T>,
  ): Promise<T> {
    const task = mutationQueue.current.then(() => operation(winesRef.current));
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
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!raw) return;

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
              // Conservamos la referencia: borrar silenciosamente una foto impediria recuperarla.
              photos.push(uri);
              unavailableCount += 1;
            }
          }
          migrated.push({ ...wine, photos });
        }

        try {
          const needsNormalization =
            JSON.stringify(parsed) !== JSON.stringify(normalized);
          if (migratedCount > 0 || needsNormalization) await persist(migrated);
          if (!cancelled) setCurrentWines(migrated);
        } catch {
          deleteManagedPhotos(createdPhotoUris);
          if (!cancelled) {
            setCurrentWines(normalized);
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
  }, [persist, setCurrentWines]);

  const createBackup = useCallback(async () => {
    await mutationQueue.current;
    return createBackupArchive(winesRef.current);
  }, []);

  const inspectBackup = useCallback(async (uri: string, name: string) => {
    await mutationQueue.current;
    return inspectBackupFile(uri, name, winesRef.current);
  }, []);

  const restoreBackup = useCallback(
    (preview: BackupPreview, mode: RestoreMode) =>
      runMutation(async (current) => {
        const result = await restoreBackupFile(preview, current, mode);
        try {
          await commit(result.wines);
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
    (data: WineFormData): Promise<Wine> =>
      runMutation(async (current) => {
        const photos = await persistPhotos(data.photos);
        const createdPhotoUris = newlyCreatedPhotos(data.photos, photos);
        const wine: Wine = {
          ...data,
          photos,
          id: Crypto.randomUUID(),
          createdAt: new Date().toISOString(),
        };
        try {
          await commit([wine, ...current]);
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
        const original = current.find((wine) => wine.id === id);
        if (!original)
          throw new Error("El vino que quieres editar ya no existe.");

        const photos = data.photos
          ? await persistPhotos(data.photos)
          : original.photos;
        const createdPhotoUris = data.photos
          ? newlyCreatedPhotos(data.photos, photos)
          : [];
        const updated = current.map((wine) =>
          wine.id === id ? { ...wine, ...data, photos } : wine,
        );
        try {
          await commit(updated);
        } catch (error) {
          deleteManagedPhotos(createdPhotoUris);
          throw error;
        }
        pruneOrphanPhotos(allPhotoUris(updated));
      }),
    [commit, runMutation],
  );

  const deleteWine = useCallback(
    (id: string) =>
      runMutation(async (current) => {
        const updated = current.filter((wine) => wine.id !== id);
        await commit(updated);
        pruneOrphanPhotos(allPhotoUris(updated));
      }),
    [commit, runMutation],
  );

  const toggleFavorite = useCallback(
    (id: string) =>
      runMutation(async (current) => {
        const updated = current.map((wine) =>
          wine.id === id ? { ...wine, isFavorite: !wine.isFavorite } : wine,
        );
        await commit(updated);
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
        isLoading,
        storageWarning,
        addWine,
        updateWine,
        deleteWine,
        toggleFavorite,
        getWine,
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
