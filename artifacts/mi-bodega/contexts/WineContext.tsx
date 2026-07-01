import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

export type WineType = 'tinto' | 'blanco' | 'rosado' | 'espumoso' | 'generoso' | 'dulce' | 'orange' | 'otro';

export interface Wine {
  id: string;
  photos: string[];
  name: string;
  winery: string;
  vintage: string;
  type: WineType;
  country: string;
  region: string;
  denomination: string;
  grapes: string;
  alcohol: string;
  volume: string;
  date: string;
  location: string;
  price: string;
  rating: number;
  wouldRepeat: boolean | null;
  notes: string;
  isFavorite: boolean;
  createdAt: string;
  ocrUsed: boolean;
}

export type WineFormData = Omit<Wine, 'id' | 'createdAt'>;

const STORAGE_KEY = '@mi_bodega_wines_v1';
const BACKUP_VERSION = 1;

type BackupFile = {
  app: 'mi-bodega';
  version: number;
  exportedAt: string;
  wines: Wine[];
};

interface WineContextValue {
  wines: Wine[];
  isLoading: boolean;
  addWine: (data: WineFormData) => Promise<Wine>;
  updateWine: (id: string, data: Partial<WineFormData>) => Promise<void>;
  deleteWine: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  getWine: (id: string) => Wine | undefined;
  createBackup: () => string;
  restoreBackup: (raw: string) => Promise<number>;
}

const WineContext = createContext<WineContextValue | null>(null);

export function WineProvider({ children }: { children: React.ReactNode }) {
  const [wines, setWines] = useState<Wine[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        try {
          setWines(JSON.parse(raw) as Wine[]);
        } catch {
          setWines([]);
        }
      }
      setIsLoading(false);
    });
  }, []);

  const persist = useCallback(async (updated: Wine[]) => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }, []);

  const createBackup = useCallback(() => {
    const backup: BackupFile = {
      app: 'mi-bodega',
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      wines,
    };
    return JSON.stringify(backup, null, 2);
  }, [wines]);

  const restoreBackup = useCallback(async (raw: string) => {
    const parsed = JSON.parse(raw) as Partial<BackupFile> | Wine[];
    const nextWines = Array.isArray(parsed) ? parsed : parsed.wines;

    if (!Array.isArray(nextWines)) {
      throw new Error('El archivo no contiene una copia valida de Mi Bodega.');
    }

    const cleaned = nextWines.map((wine) => ({
      ...wine,
      photos: Array.isArray(wine.photos) ? wine.photos : [],
      rating: Number(wine.rating || 0),
      wouldRepeat: typeof wine.wouldRepeat === 'boolean' ? wine.wouldRepeat : null,
      isFavorite: Boolean(wine.isFavorite),
      ocrUsed: Boolean(wine.ocrUsed),
      createdAt: wine.createdAt || new Date().toISOString(),
      id: wine.id || Date.now().toString() + Math.random().toString(36).substring(2, 9),
    })) as Wine[];

    setWines(cleaned);
    await persist(cleaned);
    return cleaned.length;
  }, [persist]);

  const addWine = useCallback(async (data: WineFormData): Promise<Wine> => {
    const wine: Wine = {
      ...data,
      id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
      createdAt: new Date().toISOString(),
    };
    const updated = [wine, ...wines];
    setWines(updated);
    await persist(updated);
    return wine;
  }, [wines, persist]);

  const updateWine = useCallback(async (id: string, data: Partial<WineFormData>) => {
    const updated = wines.map(w => w.id === id ? { ...w, ...data } : w);
    setWines(updated);
    await persist(updated);
  }, [wines, persist]);

  const deleteWine = useCallback(async (id: string) => {
    const updated = wines.filter(w => w.id !== id);
    setWines(updated);
    await persist(updated);
  }, [wines, persist]);

  const toggleFavorite = useCallback(async (id: string) => {
    const updated = wines.map(w => w.id === id ? { ...w, isFavorite: !w.isFavorite } : w);
    setWines(updated);
    await persist(updated);
  }, [wines, persist]);

  const getWine = useCallback((id: string) => wines.find(w => w.id === id), [wines]);

  return (
    <WineContext.Provider value={{ wines, isLoading, addWine, updateWine, deleteWine, toggleFavorite, getWine, createBackup, restoreBackup }}>
      {children}
    </WineContext.Provider>
  );
}

export function useWines() {
  const ctx = useContext(WineContext);
  if (!ctx) throw new Error('useWines must be used within WineProvider');
  return ctx;
}
