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

interface WineContextValue {
  wines: Wine[];
  isLoading: boolean;
  addWine: (data: WineFormData) => Promise<Wine>;
  updateWine: (id: string, data: Partial<WineFormData>) => Promise<void>;
  deleteWine: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  getWine: (id: string) => Wine | undefined;
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
    <WineContext.Provider value={{ wines, isLoading, addWine, updateWine, deleteWine, toggleFavorite, getWine }}>
      {children}
    </WineContext.Provider>
  );
}

export function useWines() {
  const ctx = useContext(WineContext);
  if (!ctx) throw new Error('useWines must be used within WineProvider');
  return ctx;
}
