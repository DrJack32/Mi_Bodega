# Mi Bodega Personal

Diario personal de vinos para móvil (iOS/Android). Permite añadir vinos con foto y escáner OCR de etiqueta, valorarlos, marcarlos como favoritos y ver estadísticas de tu colección.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — API server (puerto 5000/8080)
- `pnpm --filter @workspace/mi-bodega run dev` — Expo app (via Expo Go o web)
- `pnpm run typecheck` — typecheck global

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Mobile: Expo SDK 54, expo-router, React Native 0.81
- API: Express 5 (para proxy OCR)
- Persistencia: AsyncStorage (@react-native-async-storage/async-storage)
- OCR: OCR.space free API (apikey="helloworld", 500 req/día gratis)
- Build: esbuild (API server CJS bundle)

## Where things live

- `artifacts/mi-bodega/` — app Expo
  - `app/(tabs)/` — pantallas principales (Bodega, Favoritos, Estadísticas)
  - `app/add-wine.tsx` — añadir/editar vino (modal)
  - `app/scan.tsx` — escáner OCR de etiqueta
  - `app/wine/[id].tsx` — detalle del vino
  - `contexts/WineContext.tsx` — CRUD wines con AsyncStorage
  - `components/WineCard.tsx` — tarjeta de vino en lista
  - `components/WineForm.tsx` — formulario completo
  - `constants/colors.ts` — paleta vino (vino/dorado/crema) + dark mode
- `artifacts/api-server/` — Express server
  - `src/routes/ocr.ts` — proxy a OCR.space + parseWineFields()

## Product

- **Biblioteca**: listado de vinos con búsqueda y filtros por tipo y ordenación
- **Añadir vino**: formulario completo (fotos, datos básicos, cata personal, notas)
- **Escáner OCR**: fotografía la etiqueta, extrae añada, alcohol, tipo, país, uvas, DO
- **Favoritos**: colección filtrada de vinos marcados con corazón
- **Estadísticas**: total, puntuación media, precio medio, breakdown por tipo y país

## User preferences

- Idioma de la UI: español
- OCR gratuito (sin APIs de pago)
- Sin backend de base de datos — solo AsyncStorage

## Architecture decisions

- AsyncStorage en cliente, no base de datos servidor — adecuado para diario personal sin sincronización multi-dispositivo
- OCR.space free tier ("helloworld" key): 500 peticiones/día, sin registro. Para mayor uso, el usuario puede obtener una clave gratuita en ocr.space
- `parseWineFields()` en el servidor (Express) para extraer campos de texto OCR usando regex
- Paleta de colores: vino (#7B2D3E), dorado (#C4974A), crema (#F7F3EF) con soporte dark mode completo

## Gotchas

- La clave "helloworld" de OCR.space tiene límite de 1MB por imagen y 500 req/día. Comprimir imágenes (quality: 0.7) antes de enviar.
- `express.json({ limit: "10mb" })` necesario para recibir base64 de imágenes
- Los tabs usan Tabs clásicos de expo-router (sin NativeTabs/LiquidGlass para mayor compatibilidad web)

## Pointers

- Ver `pnpm-workspace` skill para estructura del monorepo
