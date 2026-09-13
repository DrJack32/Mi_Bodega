import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WineForm } from "@/components/WineForm";
import {
  InitialWineEntry,
  WineFormData,
  useWines,
} from "@/contexts/WineContext";

export default function AddWineScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { addWine, updateWine, getWine, storageLocations } = useWines();
  const params = useLocalSearchParams<{
    ocrData?: string;
    photoUri?: string;
    editId?: string;
    cloneId?: string;
  }>();

  const [initialValues, setInitialValues] = useState<Partial<WineFormData>>({});

  useEffect(() => {
    if (params.editId) {
      const wine = getWine(params.editId);
      if (wine) {
        const { id, createdAt, tastings, stock, ...rest } = wine;
        setInitialValues(rest);
      }
      return;
    }

    if (params.cloneId) {
      const source = getWine(params.cloneId);
      if (source) {
        setInitialValues({
          photos: [],
          name: source.name,
          winery: source.winery,
          vintage: "",
          type: source.type,
          country: source.country,
          region: source.region,
          denomination: source.denomination,
          grapes: source.grapes,
          agingCategory: source.agingCategory,
          agingMonths: source.agingMonths,
          alcohol: source.alcohol,
          volume: source.volume,
          coverZoom: 1,
          coverOffsetX: 0,
          coverOffsetY: 0,
          date: "",
          location: "",
          price: "",
          rating: 0,
          wouldRepeat: null,
          notes: "",
          isFavorite: false,
          ocrUsed: false,
        });
      }
      return;
    }

    let values: Partial<WineFormData> = {};

    if (params.ocrData) {
      try {
        const fields = JSON.parse(params.ocrData) as Partial<WineFormData>;
        values = { ...fields, ocrUsed: true };
      } catch {}
    }

    if (params.photoUri) {
      values.photos = [params.photoUri, ...(values.photos ?? [])];
    }

    setInitialValues(values);
  }, [getWine, params.cloneId, params.editId, params.ocrData, params.photoUri]);

  const handleSave = async (data: WineFormData, entry?: InitialWineEntry) => {
    if (params.editId) {
      await updateWine(params.editId, data);
    } else {
      await addWine(data, entry);
    }
    router.back();
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <WineForm
      initialValues={initialValues}
      isEditing={Boolean(params.editId)}
      storageLocations={storageLocations}
      onSave={handleSave}
      onCancel={() => router.back()}
    />
  );
}
