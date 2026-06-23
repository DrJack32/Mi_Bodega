import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WineForm } from '@/components/WineForm';
import { WineFormData, useWines } from '@/contexts/WineContext';

export default function AddWineScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { addWine, updateWine, getWine } = useWines();
  const params = useLocalSearchParams<{ ocrData?: string; photoUri?: string; editId?: string }>();

  const [initialValues, setInitialValues] = useState<Partial<WineFormData>>({});

  useEffect(() => {
    if (params.editId) {
      const wine = getWine(params.editId);
      if (wine) {
        const { id, createdAt, ...rest } = wine;
        setInitialValues(rest);
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
  }, [params.editId, params.ocrData, params.photoUri]);

  const handleSave = async (data: WineFormData) => {
    if (params.editId) {
      await updateWine(params.editId, data);
    } else {
      await addWine(data);
    }
    router.back();
  };

  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  return (
    <WineForm
      initialValues={initialValues}
      onSave={handleSave}
      onCancel={() => router.back()}
    />
  );
}
