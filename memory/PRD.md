# Mi Bodega Personal — PRD

## Problem statement
"Vamos a revisar esta app." App existente (migrada desde Replit) = diario personal de vinos.
Objetivo de esta sesión: revisar y **arrancar la app en web automáticamente** (el workflow no la levantaba) y dejar base para añadir/mejorar funcionalidades.

## Stack
- Monorepo pnpm. App móvil: Expo SDK 54 / React Native 0.81 / expo-router (React Native Web para web).
- Persistencia cliente: AsyncStorage (sin BD de servidor).
- OCR de etiquetas: proxy a OCR.space (key "helloworld") + parseo regex.

## Arquitectura en Emergent (esta sesión)
El supervisor de Emergent espera `/app/frontend` (puerto 3000) y `/app/backend` (puerto 8001, uvicorn). Se adaptó:
- **/app/backend/server.py**: FastAPI con `POST /api/ocr` (portado del Express `routes/ocr.ts`, incl. `parse_wine_fields`) y `GET /api/health`. Corre en el programa `backend` del supervisor.
- **/app/frontend/**: lanzador. `start-expo-web.sh` sirve el export web estático (`/app/artifacts/mi-bodega/dist`) en el puerto 3000 vía `serve-static.js` (con fallback SPA). Corre en el programa `frontend`.
- La app Expo original sigue intacta en `/app/artifacts/mi-bodega`.
- OCR base URL: `scan.tsx` usa `EXPO_PUBLIC_DOMAIN` → llamadas a `https://<preview>/api/ocr` que el ingress rutea al 8001.

### Por qué export estático (no dev server)
El límite de inotify del contenedor (`max_user_watches=12288`, sin permiso para subirlo) y sin watchman hace que el Metro dev server falle con ENOSPC. Se sirve un build estático estable.

### Rebuild web tras cambios de código
```
cd /app/artifacts/mi-bodega && \
EXPO_PUBLIC_DOMAIN=313fe69c-0ee6-4106-9924-e70da315f732.preview.emergentagent.com \
pnpm exec expo export --platform web --output-dir dist
```
(`start-expo-web.sh` también reconstruye `dist/` si no existe.)

## Estado (2026-06-27)
- ✅ App carga y renderiza en web (cabecera "Mi Bodega", filtros, estado vacío, tabs Bodega/Favoritos/Estadísticas).
- ✅ Backend FastAPI OCR responde (`/api/health` ok, `/api/ocr` valida input). Llamada real a OCR.space no probada con imagen.
- ✅ Ambos servicios autostart por supervisor.

## Pantallas/funcionalidad
- Bodega (listado + búsqueda + filtros por tipo y orden), Añadir vino (form + OCR), Escáner OCR, Detalle vino, Favoritos, Estadísticas.

## CI: APK automático (2026-06-27)
- `.github/workflows/build-apk.yml`: en cada push a main/master (o manual via workflow_dispatch) compila un APK Android instalable y lo sube como artifact `mi-bodega-android-apk` (pestaña Actions, retención 30 días).
- Pasos: setup pnpm/Node20/Java17/Android SDK → instala NDK 27.1.12297006 + CMake 3.22.1 → `pnpm install` → `expo prebuild --platform android` → `gradlew assembleRelease` (arm64-v8a, armeabi-v7a).
- APK = **release firmado con el keystore debug** (default de la plantilla Expo: `release { signingConfig signingConfigs.debug }`), por lo que es autónomo (no necesita Metro) e instalable sin credenciales. Un APK debug puro NO sirve (requiere dev server).
- `EXPO_PUBLIC_DOMAIN` se inyecta en el bundle (env del job) → apunta al preview para que el OCR funcione mientras el preview esté activo. Resto de la app funciona offline (AsyncStorage).
- Validado localmente: `expo prebuild` OK y firma release=debug confirmada. El build nativo completo solo corre en GitHub Actions (~20-40 min).
- `app.json`: añadido `android.package = com.drjack32.mibodega`. `android/` e `ios/` ignorados en git (CI los regenera).
- Repo destino: https://github.com/DrJack32/Mi_Bodega/

## Backlog / Next Action Items
- [ ] Nota: el workflow corre en CADA push a main (~30 min/cada Save to GitHub). Se puede limitar con `paths:` o usar solo `workflow_dispatch` si se quiere ahorrar minutos.
- [ ] El usuario quiere "añadir/mejorar una funcionalidad" — pendiente de definir cuál.
- [ ] Probar flujo OCR end-to-end con una etiqueta real desde web (image-picker en web usa galería).
- [ ] Hot reload en web no disponible (límite inotify); cada cambio requiere re-export.
- [ ] Opcional: hardcode del preview domain en scripts → parametrizar si cambia el dominio.
