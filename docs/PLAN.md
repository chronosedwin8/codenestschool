# CodeNest School — Plan de Trabajo (fork conceptual de Kodable)

Plataforma de programación para niños (4–12+), 30 mundos / 600 actividades, inspirada en Kodable (UI/UX) y CodeCombat (progresión), construida sobre la experiencia técnica de **BeSmart / Codexia** (`C:\Users\eortiz\Desktop\BeSmart`, mismo repo que `chronosedwin8/codexialab`).

Repositorio destino: `C:\Users\eortiz\Desktop\codenestschool` → `https://github.com/chronosedwin8/codenestschool.git`.

---

## 0. Estado (2026-09-09)

El currículo está completo: **600 actividades en 30 mundos**, y las 600 se validan cada vez que se compila el contenido. La comprobación que importa es que cada solución de referencia se simula y tiene que otorgar las tres estrellas, en cada lenguaje que la actividad declare; una actividad cuya solución óptima no llega a tres estrellas es imposible de terminar y un niño que lo intente veinte veces no va a entender por qué.

| Grupo | Mundos | Editor | Estado |
|---|---|---|---|
| Exploradores 4–6 | 1–10 | fichas | 200 actividades, narradas |
| Creadores 7–9 | 11–20 | Blockly | 200 actividades, narradas |
| Hackers 10–12+ | 21–30 | Monaco (JS y Python) | 200 actividades, narradas |

- **Narración:** 1.917 clips de ElevenLabs, ninguno pendiente. **No hay Web Speech** (§2): un clip que falta es un error de contenido y `validate-content` lo rechaza.
- **Verificación:** `npx tsx scripts/validate-content.ts` valida las 600; `npx tsx scripts/smoke-play.ts <mundos>` las juega contra el servidor de verdad, con alta de tutor, PIN del niño, sesión y estrellas recalculadas por el servidor. Las dos cosas hacen falta: el validador simula en memoria y el smoke test es el que encontró que el editor y el generador contaban las líneas de un programa de forma distinta, lo que hacía imposible la tercera estrella de los mundos 21 al 30.
- **Herramientas de autoría:** `scripts/inspect-activity.ts` dibuja un tablero y ejecuta su solución paso a paso.

Cambios de alcance decididos durante la construcción, cada uno con su motivo en el código:

| Qué | Por qué |
|---|---|
| Sin Web Speech (§2) | La voz del navegador no es un respaldo para quien no lee: es otra experiencia, y peor. |
| Mundo 25 pasa de `async/await` a eventos y funciones como valores | La API del juego es síncrona: no hay nada que esperar, y un `await` decorativo enseñaría a escribir una palabra que no hace nada. |
| Mundo 28 hace seguimiento de pared y no camino más corto | Un algoritmo de ruta óptima necesita ver el mapa entero, y el Fuzz solo ve la casilla de delante. Seguir la pared es el algoritmo que de verdad se usa sin mapa. |
| Casilla `puente` y `fuzz.repararPuente()` | El editor de bloques ya ofrecía la pieza y el simulador no conocía el comando: el mundo 13 habría fallado en cuanto un niño la arrastrara. |
| `bloquesIniciales` en la configuración | El mundo 19 entrega el programa montado en el área de trabajo; sin eso, "arregla la pieza que está mal" no se puede plantear. |
| El número del bucle de bloques pasa a un hueco de valor | Con el número escrito dentro del bloque, ninguna variable puede gobernar un bucle, y el mundo 12 no tendría nada que enseñar. |

---

## 1. Contexto

- **Problema:** Codexia cubre 6–12 años con 10 mundos de programación y 7 materias extra. No tiene la capa "prelectores 4–6" estilo Kodable (fichas gigantes, cero texto, fuzzes), ni un pipeline formal de voz ElevenLabs con fallback, ni el volumen de 600 actividades en 3 grupos de edad. Además arrastra deuda: 8 `PrismaClient`, sin migraciones Prisma, sin tests, sin rate-limit, claves hardcodeadas, cero assets visuales.
- **Objetivo:** producto nuevo y limpio (monorepo) que reutilice lo probado en Codexia y añada: 3 grupos × 10 mundos, editor de fichas drag&drop (M1–10), Blockly (M11–20), Monaco (M21–30), motor Phaser isométrico 2.5D, audio ElevenLabs pre-renderizado (sin Web Speech, ver §2), telemetría particionada.
- **Resultado esperado de esta sesión:** plan aprobado y FASE 1 ejecutada (estructura monorepo, `schema.prisma`, `scripts/generate-voiceover.ts`), con pausa para aprobación antes de Fastify / FASE 2.

## 2. Decisiones tomadas (confirmadas con el usuario)

| Decisión | Elección |
|---|---|
| Reuso de BeSmart | **Portar módulos selectivamente** a un monorepo limpio (no clonar). |
| Editor Mundos 1–10 | **Barra de comandos propia drag&drop** (fichas tipo Kodable). Blockly solo M11–20, Monaco M21–30. |
| Nombres | Modelos Prisma en inglés, **tablas/columnas en español** (convención Codexia). |
| PostgreSQL | **Docker `postgres:15-alpine` puerto 5433** (`docker-compose.yml`). PG 17 local queda para Codexia. |
| Package manager | **npm workspaces** (npm 11.9 / Node 24.14; sin pnpm). |
| Python M21–30 | **Transpiler propio de subconjunto Python→JS** (`packages/shared/src/runtime/pylite/`), sin Pyodide. Async (M25) y try/catch (M27) solo en JS. |
| Audio en Git | **Git LFS** para `*.mp3` (git-lfs 3.7.1 instalado). `manifest.json` versionado normal. |
| Deps extra autorizadas | `@fastify/rate-limit`, `pino-pretty` (solo dev). **No** `@vueuse/core` → drag&drop con Pointer Events propios. Sin `dotenv` (Node 24 `process.loadEnvFile`). |
| Idioma | Español (Colombia). Comandos del juego en español (`avanzar`, `repararPuente`). `TZ=America/Bogota`. |
| Comercial (añadido) | **Homepage pública optimizada para SEO** con todos los beneficios; **portal del cliente completo**; **pasarela Mercado Pago**; **planes Personal, Padres y Escuela** (Escuela = **$12.000.000 COP/año**). Precios de Personal y Padres: **por confirmar** (Codexia usaba Individual $2.000.000/año y Prueba 24 h $10.000; se proponen esos como punto de partida, configurables por env). |
| Audio (revisado 2026-09-09) | **Toda la voz es grabada con ElevenLabs; sin Web Speech.** La voz del navegador lee los signos de puntuación, se equivoca con los nombres de los Fuzzes y suena distinta en cada aparato: para un niño que no lee no es un respaldo, es otra experiencia. En su lugar, un clip que falta es un error de contenido: `validate-content` rechaza cualquier clave de audio que no tenga MP3 en el manifest, y el almacén de audio la anota en `clipsQueFaltan` y avisa por consola. Coste medido de los mundos 1–10: 697 clips y 46.524 caracteres. |

## 3. Referencia técnica: qué se porta de BeSmart/Codexia

Rutas bajo `C:\Users\eortiz\Desktop\BeSmart\`.

| Pieza de Codexia | Archivo | Uso en CodeNest |
|---|---|---|
| Esquema Prisma (User/Classroom/World/Level/Session/Submission/Hint/Achievement/Store/Inventory, Ley 1581) | `backend/prisma/schema.prisma` | Base del nuevo esquema; Level→Activity, + grupos de edad, audio, tutores, progreso, métricas. |
| Telemetría particionada por mes + vista `v_progreso_aula` | `database/schema.sql:189-246` | Migración SQL manual de Prisma + `crear_particion_mes()` + partición DEFAULT. |
| Pipeline ElevenLabs offline (TTS, SFX, voz UI) | `backend/scripts/generate-audio.mjs`, `generate-sfx.mjs`, `generate-voz-ui-preescolar.mjs` | Patrón de `scripts/generate-voiceover.ts`. Voces probadas: Jessica `cgSgspJ2msm6clMCkdW9`, Alice `Xb7hH8MSUJpSbSDYk0k2`. **⚠ Esos scripts tienen la API key hardcodeada como fallback (11 scripts) y la contraseña de PG en 47: NO copiar; rotar la clave de ElevenLabs.** |
| Slug determinista frase→MP3 | `frontend/src/composables/vozBank.ts` (`slugFrase`) | Para el pool de clips UI/celebración compartidos. |
| Sandbox Web Worker (`new Function`, Proxy de API permitida, tope, timeout 5 s, colisiones) | `frontend/src/workers/codeRunner.worker.ts` | Se porta y generaliza en `packages/shared/src/runtime/GridSimulator.ts` (puro) + worker delgado. |
| Runner de flechas (modo "rodar hasta chocar", detección de bucles) | `frontend/src/workers/arrowRunner.worker.ts` | Semántica del `modoMovimiento: 'rodar'` de Kodable. |
| Orquestación worker→renderer, objetivos, estrellas (`max_bloques` vs `max_instrucciones`), `countProgramSize` | `frontend/src/composables/useLevelRunner.ts` | `useActivityRunner.ts`; estrellas se mueven a shared (servidor recalcula). |
| `IRenderer` + `PhaserRenderer` (grid, tween por acción) + `GameCanvas.vue` (ciclo de vida Phaser, `Scale.FIT`, teardown) | `frontend/src/game/types.ts`, `PhaserRenderer.ts`, `components/GameCanvas.vue` | Se conserva `IRenderer` y el ciclo de vida; renderer reescrito isométrico con sprites. |
| Blockly: toolbox filtrado por `bloques_disponibles`, bloques en español, generador que devuelve string, filtro de eventos, tema | `frontend/src/components/EditorBloques.vue` | Se porta; se cambia a imports `blockly/core` + `msg/es` y renderer `zelos`. |
| Monaco: tema, completion provider `heroe.*`, `automaticLayout` | `frontend/src/components/EditorTexto.vue` | Se porta; se añade `fuzz.d.ts` para IntelliSense real. |
| Vite: `worker.format 'es'`, `manualChunks` phaser/monaco/blockly, `optimizeDeps.exclude monaco`, proxy `/api` | `frontend/vite.config.ts` | Copiar y pasar `manualChunks` a función + carga diferida por ruta. |
| Audio: canal único de voz, clips de ánimo/éxito, `speak()` Web Speech es-CO | `frontend/src/composables/useAudio.ts`, `useVoz.ts` | Reescrito como store Pinia con Howler (voz/sfx/música). **Sin `speechSynthesis`**: decisión revisada, ver §2. |
| `assetUrl()` (BASE_URL) | `frontend/src/utils/asset.ts` | Copiar tal cual. |
| UI infantil: `CelebrationModal.vue` (confeti, estrellas, recompensas), `StarRating.vue`, `MascotaGuia.vue`, `MapaMundo.vue`, `AvatarConfig.vue` (paper-doll SVG), `StoreView.vue` | `frontend/src/components/*`, `views/StoreView.vue` | Base de `PanelEstrellas`, `MapaMundo`, `TiendaFuzz`, `FuzzAvatar` (SVG, sin assets). |
| Login/registro con consentimiento Ley 1581 | `frontend/src/views/LoginView.vue`, `backend/src/routes/auth.ts` | Flujo tutor→niño; se sustituye el guest `POST /preescolar` (inseguro) por cuentas de niño creadas por tutor + PIN de imágenes. |
| Motor de logros (`checkAndGrantAchievements`, condiciones JSONB, recompensas con ítem) | `backend/src/routes/sessions.ts:154-216`, `scripts/seed-logros.mjs`, `seed-tienda.mjs` | Se porta a `services/achievements.ts`. |
| Fastify 4: jwt, cors, helmet, static, zod `safeParse`→400, pino, bcrypt; `setErrorHandler`/SPA fallback | `backend/src/server.ts`, `routes/*` | Misma estructura pero con **un solo** `plugins/prisma.ts`, capa `services/`, tests vitest, rate-limit, `JWT_SECRET` obligatorio. |
| Formato de nivel v2 + helper `lvl()` + validador de soluciones | `backend/scripts/seed-world1.mjs`, `validate-solutions.mjs` | Formato v3 (§8), helpers por concepto, `validate-content.ts`. |
| Docker multi-stage Node 24 + entrypoint; `.gitattributes` (eol=lf, binarios) | `Dockerfile`, `docker-entrypoint.sh`, `.gitattributes` | Adaptar a `apps/*` al desplegar; `.gitattributes` copiar + reglas LFS. |
| Homepage estática (8 páginas), SEO (canonical, OG/Twitter, JSON-LD `EducationalOrganization`, `FAQPage`, `Offer` por plan, breadcrumbs), demo jugable vanilla JS, reveal/counters | `homepage/*.html`, `homepage/js/{main,demo}.js`, `homepage/css/styles.css` | **Se porta** a `apps/homepage` con contenido/beneficios de CodeNest, paleta infantil y `sitemap.xml`/`robots.txt`. |
| Mercado Pago Checkout API (tokenización en navegador con Public Key, cobro en servidor con Access Token, precios server-side, `X-Idempotency-Key`, rollback en rechazo, webhook idempotente por `external_reference`, `PUBLIC_BASE_URL`) | `backend/src/lib/mercadopago.ts`, `backend/src/routes/pagos.ts`, `homepage/checkout.html`, `homepage/js/checkout.js`, `homepage/gracias.html` | **Se porta** como `services/pagos.ts` + `routes/pagos.ts` + checkout en homepage y en el portal (renovación). |
| Modelo `Licencia` (tipo, estado, vigencia, campos `mp_*`) + `database/migrations/002_licencias.sql` | `backend/prisma/schema.prisma:296-317` | Evoluciona a `Plan` + `License` + `Payment` (§5.2). |
| Panel docente como especificación funcional (aulas, sedes, alta masiva, asignaciones, bloqueo, matriz de seguimiento, estadísticas) | `frontend/src/views/TeacherDashboard.vue` (97 KB) | Se descompone en `views/portal/*` por pestaña + `stores/portal.ts`. |
| Planes previos | `plan_desarrollo_plataforma_educativa.md`, `tender-painting-twilight.md`, `planes/simulaciones-matter-three.md` | Pedagogía, riesgos, licenciamiento, reglas de rendimiento en tablets. |

**No se trae:** materias no-programación, `three.js`/simulaciones, Phidias (SIS del colegio alemán), arcade/minijuegos, `axios` (fetch tipado), Pyodide, dump SQL.

## 4. Arquitectura del monorepo

```
codenestschool/
├── package.json                 # workspaces: ["apps/*","packages/*"]; engines node>=24; packageManager npm@11.9.0
├── tsconfig.base.json           # strict, ES2022, isolatedModules, verbatimModuleSyntax
├── docker-compose.yml           # postgres:15-alpine :5433 (codenest/codenest/codenest_db), volumen codenest_pg
├── .env.example  .gitignore  .gitattributes(LFS *.mp3, eol=lf)  .editorconfig  .nvmrc(24)  README.md
├── docs/PLAN.md                 # copia de este plan
├── apps/
│   ├── backend/                 # Fastify 4 + Prisma 5 (FASE 1: package.json, tsconfig, prisma/, scripts/)
│   │   ├── prisma/schema.prisma
│   │   ├── prisma/migrations/   # versionadas (Codexia no las tenía)
│   │   ├── prisma/sql/partitions.sql
│   │   ├── prisma/seed.ts       # tsx; lee packages/content
│   │   ├── scripts/ensure-partitions.ts, sync-audio.ts, rollup-metrics.ts
│   │   └── src/ (FASE 1.5) server.ts, plugins/{prisma,jwt,security}.ts, routes/, services/
│   ├── frontend/                # Vue 3 + Pinia + Vite 5 + Phaser 3 + Blockly 11 + Monaco + Howler (juego en /app, portal en /app/portal)
│   │   └── public/static/audio/ # instruction_world{X}_lvl{Y}.mp3, success_…, hint_…, ui_…, celebration_{n}.mp3, world{X}_intro.mp3, manifest.json
│   └── homepage/                # sitio público estático SEO (HTML/CSS/JS vanilla, servido por Fastify en /): index, beneficios, como-funciona, planes, faq, checkout, gracias, sitemap.xml, robots.txt
├── packages/
│   ├── shared/                  # exports a fuente TS ("./src/index.ts"); tipos, catálogo 30 mundos, GridSimulator, estrellas, pylite, zod
│   └── content/                 # worlds/m01…m30.json (600 actividades) + schema zod + helpers de autoría
└── scripts/                     # generate-voiceover.ts, generate-sfx.ts, validate-content.ts, lib/elevenlabs.ts, voices.config.ts (sin Prisma)
```

Reglas de TS/monorepo (de la revisión): `@codenest/shared` se consume vía `exports` a `.ts` (Vite, vue-tsc, vitest y tsx lo resuelven sin alias); backend compila con `tsc -b` + project references (`composite` en shared) y `module: NodeNext`; en shared **sin `enum` de TS** (objetos `as const`) y sin DOM; backend añade `satisfies Record<GrupoEdad, $Enums.GrupoEdad>` para detectar divergencia con Prisma. `postinstall: prisma generate` en backend. No existe script `db:push` (destruiría el particionado).

Dependencias por paquete:
- **backend:** fastify@4, @fastify/jwt, @fastify/cors, @fastify/helmet, @fastify/static, @fastify/rate-limit, @prisma/client + prisma@5, bcrypt, zod, pino; dev: tsx, typescript, vitest, pino-pretty.
- **frontend:** vue@3, pinia, vue-router@4, phaser@3.80, blockly@11, monaco-editor, howler (en `dependencies`, no dev); dev: vite@5, @vitejs/plugin-vue, vue-tsc, vitest, playwright.
- **shared/content/scripts:** typescript, zod, tsx. Sin SDK ElevenLabs (fetch nativo).

## 5. FASE 1 — Core, DB y pipeline ElevenLabs (Sprints 1–2) — TAREA INMEDIATA

### 5.1 Estructura base (paso 1)
Archivos del árbol anterior. Scripts raíz: `dev`, `build`, `db:up`, `db:migrate`, `db:seed`, `voice:generate`, `voice:sync`, `content:validate`, `test`. `.env.example`: `DATABASE_URL=postgresql://codenest:codenest@localhost:5433/codenest_db`, `SHADOW_DATABASE_URL`, `JWT_SECRET`, `ELEVENLABS_API_KEY`, `PORT=3001`, `TZ=America/Bogota`, `PUBLIC_BASE_URL`, `MP_ACCESS_TOKEN`, `MP_PUBLIC_KEY`, `MP_WEBHOOK_SECRET`, `PRECIO_PERSONAL_COP`, `PRECIO_PADRES_COP`, `PRECIO_ESCUELA_COP=12000000`. `git lfs track "*.mp3"`.

`packages/shared/src/`:
- `types/age-group.ts`, `types/editor.ts`, `types/activity.ts` (formato v3), `types/runtime.ts` (`Accion` con `desde/hasta/celdasRecorridas` para el modo rodar, `WorkerRequest/Response`, `IRenderer`), `types/audio.ts` (mapa `AUDIO_PREFIX` + tipos plantilla `` `instruction_world${number}_lvl${number}` ``).
- `catalog/worlds.ts`: los **30 mundos** (número, slug, nombre, grupo, concepto, bioma, editor, lenguajes, paleta). Única fuente de verdad.
- `runtime/` queda como carpeta con `README` (GridSimulator y pylite se implementan en FASE 1.5).

### 5.2 `schema.prisma` completo (paso 2)
Convención Codexia + `@db.Timestamptz(6)` explícito, `previewFeatures = ["postgresqlExtensions"]` (extensión `citext` para `usuario`/`email`).

**Enums:** `RolUsuario {nino, tutor, docente, admin_escuela, admin}` · `TipoPlan {personal, padres, escuela}` · `EstadoLicencia {pendiente, activa, vencida, cancelada}` · `EstadoPago {pendiente, aprobado, rechazado, reembolsado, cancelado}` · `GrupoEdad {exploradores, creadores, hackers}` · `TipoEditor {comandos, bloques, texto}` · `LenguajeCodigo {comandos, javascript, python}` · `TipoActividad {recorrido, recoleccion, debug, integrador, jefe}` · `TipoAudio {instruccion, exito, pista, ui, mundo_intro, celebracion}` · `EstadoAudio {pendiente, generado, fallido, obsoleto}` · `TipoItemTienda {sombrero, gafas, disfraz, color, accesorio}` · `EstadoConsentimiento {pendiente, otorgado, revocado}`.

| Modelo → tabla | Campos clave |
|---|---|
| `Institution` → `instituciones` | igual a Codexia |
| `User` → `usuarios` | `usuario` citext único (niños sin email), `email?` citext único, `passwordHash?`, `pinHash?` (PIN de imágenes, bcrypt cost 8), `rol`, `grupoEdad?`, `fechaNacimiento?`, `avatarConfig` JSONB `{fuzzColor, sombrero, gafas, disfraz}` (**verdad de lo equipado**), `monedas`, `estrellasTotales`, `rachaDias`, `ultimaActividad`, `institucionId?`, `activo`, `creadoEn`, `actualizadoEn @updatedAt` |
| `GuardianLink` → `tutores_ninos` | `tutorId`, `ninoId`, `parentesco`; `@@unique([tutorId, ninoId])`, `@@index([ninoId])` |
| `ParentalConsent` → `consentimientos` | `ninoId`, `tutorId`, `estado`, `versionPolitica`, `otorgadoEn`, `revocadoEn?`, `ip?` |
| `AccessAudit` → `auditoria_accesos` | `actorId`, `ninoId`, `accion`, `recurso`, `ip?`, `creadoEn`; `@@index([ninoId, creadoEn])` |
| `RefreshToken` → `tokens_refresh` | `usuarioId`, `tokenHash @unique`, `expiraEn`, `revocado`; `@@index([usuarioId, expiraEn])` |
| `Classroom` → `aulas`, `Enrollment` → `inscripciones` (`ninoId`), `Assignment` → `asignaciones` (`mundoId?`/`actividadId?`) | como Codexia |
| `VoiceProfile` → `voces` | `clave @unique` (guia_clara, guia_bella, robot_josh, robot_adam), `elevenVoiceId`, `modelo`, `settings` JSONB, `rolPersonaje` |
| `AudioAsset` → `audios` | `clave @unique`, `tipo`, `texto`, `textoHash`, `vozId`, `idioma`, `rutaArchivo?`, `formato`, `duracionMs?`, `tamanoBytes?`, `estado` (default `pendiente`), `error?`, `generadoEn?`; `@@index([estado])`, `@@index([textoHash])`. **El seed crea las filas en `pendiente`; el voiceover solo rellena.** |
| `World` → `mundos` | `numero` 1–30 único, `slug` único, `nombre`, `grupoEdad`, `concepto`, `descripcion`, `bioma`, `editor`, `lenguajes` (String[]), `colorPrimario/Secundario`, `icono`, `fondoUrl?`, `musicaUrl?`, `audioIntroId?`, `activo` (sin `actividadInicio/Fin`: derivados) |
| `Activity` → `actividades` | `mundoId`, `numeroGlobal` 1–600 único (validado en seed + CHECK SQL), `numeroEnMundo` 1–20, `slug` único, `nombre`, `tipo`, `dificultad`, `config` JSONB v3 (sin textos narrados), `instruccionTexto`, `exitoTexto` (**canónicos**), `audioInstruccionId?`, `audioExitoId?`, `solucionReferencia` JSONB, `version`, `activo`; `@@unique([mundoId, numeroEnMundo])` |
| `Hint` → `pistas` | `actividadId`, `orden`, `texto`, `audioId?`, `costoMonedas`; `@@unique([actividadId, orden])` |
| `ActivitySession` → `sesiones_actividad` | `usuarioId`, `actividadId`, `editorUsado`, `lenguaje`, `programa` JSONB, `intentos`, `tiempoSegundos`, `completada`, `estrellas`, `monedasGanadas`, `iniciadaEn`, `completadaEn?`; `@@index([usuarioId, actividadId, completada])` |
| `CodeSubmission` → `envios_codigo` | `sesionId`, `usuarioId`, `actividadId`, `codigo` (registro), `editor`, `lenguaje`, `accionesEjecutadas` JSONB (**lo que valida el servidor**), `tamanoPrograma`, `resultado` JSONB, `exitoso`, `tiempoEjecucionMs`, `enviadoEn`; índices por `usuarioId`, `actividadId`, `sesionId` |
| `UserActivityProgress` → `progreso_actividad` | `usuarioId`, `actividadId`, `mejorEstrellas`, `completada`, `intentosTotales`, `primeraVez`, `ultimaVez`; `@@unique([usuarioId, actividadId])`, `@@index([usuarioId])` |
| `Achievement` / `UserAchievement` → `logros` / `usuarios_logros` | + `clave @unique` para upsert |
| `StoreItem` → `items_tienda`, `UserInventory` → `inventario_usuario` | `clave @unique`, `tipo`, `grupoEdad?`, `orden`, `imagenUrl`, `costoMonedas`, `requiereMundo?`; inventario solo posesión (sin `equipado`) |
| `Plan` → `planes` | `clave @unique` (personal, padres, escuela), `nombre`, `precioCop` (Escuela 12.000.000; se siembra desde env `PRECIO_*_COP`), `vigenciaDias` (365), `maxNinos` (personal 1, padres N por confirmar, escuela ilimitado/`maxEstudiantes`), `beneficios` JSONB, `activo`, `orden` |
| `License` → `licencias` | `planId`, `titularId` (usuario tutor/personal/admin_escuela), `institucionId?`, `estado`, `codigoAcceso?`, `inicioVigencia`, `finVigencia`, `renovadaDeId?`, `creadoEn`, `actualizadoEn @updatedAt`; `@@index([titularId, estado])`, `@@index([finVigencia])` |
| `Payment` → `pagos` | `licenciaId`, `mpPaymentId? @unique`, `mpPreferenceId?`, `idempotencyKey @unique`, `montoCop`, `moneda`, `estado`, `mpStatus?`, `mpStatusDetail?`, `metodo?` (tarjeta, PSE, efectivo), `emailComprador`, `payloadWebhook` JSONB?, `creadoEn`, `actualizadoEn`; `@@index([licenciaId])` |
| `BillingProfile` → `perfiles_facturacion` | `usuarioId @unique`, `razonSocial?`, `nitCedula`, `direccion?`, `ciudad`, `telefono?` (datos para el comprobante de pago) |
| `TelemetryEvent` → `telemetria` **(particionada)** | `id BigInt`, `usuarioId`, `actividadId?`, `sesionId?`, `evento`, `datos` JSONB, `creadoEn`; `@@id([id, creadoEn])`; **sin `@relation`** (FK + RESTRICT bloquearía la supresión Ley 1581); `@@index([usuarioId, creadoEn])`, `@@index([actividadId, creadoEn])`. Nunca se devuelve el `BigInt` al cliente. |
| `ActivityMetricDaily` → `metricas_actividad_diaria` **(particionada)** | `actividadId`, `fecha @db.Date`, `intentos`, `completadas`, `estrellasPromedio`, `tiempoPromedioSeg`, `erroresComunes` JSONB; `@@id([actividadId, fecha])`; relación `onDelete: Cascade` |
| `UserMetricDaily` → `metricas_usuario_diaria` **(particionada)** | `usuarioId`, `fecha`, `tiempoSeg`, `actividadesCompletadas`, `estrellas`, `monedas`; `@@id([usuarioId, fecha])` |

**Particionado (procedimiento):** `prisma migrate dev --create-only --name init`; editar el SQL: `PARTITION BY RANGE ("creado_en"|"fecha")` en las 3 tablas, **partición `_default`** en cada una, función `crear_particion_mes(tabla, mes)` (`CREATE TABLE IF NOT EXISTS` + `format('%I')`), particiones de 12 meses, vista `v_progreso_aula` (port de `database/schema.sql:227`), CHECK de `numero_global`, extensión `citext`. Contenido fuente en `prisma/sql/partitions.sql`. `ensure-partitions.ts` (idempotente, 3 meses por delante) corre al arrancar el backend. No usar `@unique` adicionales en tablas particionadas.

### 5.3 `scripts/generate-voiceover.ts` (paso 3)
- `scripts/lib/elevenlabs.ts`: `tts()` → `POST /v1/text-to-speech/{voiceId}?output_format=mp3_44100_64`, modelo `eleven_multilingual_v2`; reintenta solo 429 (`Retry-After`)/5xx/red con backoff+jitter (máx 5); **aborta** en 401/422 quota/400; `getSubscription()` para comprobar caracteres disponibles antes de empezar. Clave solo de `process.env.ELEVENLABS_API_KEY` (cargada con `process.loadEnvFile`); no requerida en `--dry-run`; nunca se imprime.
- `scripts/voices.config.ts`: grupo/rol → `VoiceProfile` (Exploradores/Creadores: guía cálida; Hackers: robot para sistema + guía para narrativa).
- `scripts/generate-voiceover.ts`:
  - CLI: `--worlds 1-10`, `--types instruction,success,hint,ui,intro,celebration`, `--dry-run`, `--limit N`, `--force`, `--concurrency 2` (semáforo propio).
  - Fuente: **solo** `packages/content/worlds/*.json` + `catalog/worlds.ts` + `scripts/ui-phrases.ts`. No toca la BD.
  - Claves/archivos: `instruction_world{X}_lvl{Y}`, `success_world{X}_lvl{Y}` (solo si el texto es específico; si no, pool `celebration_{n}`), `hint_world{X}_lvl{Y}_{n}`, `world{X}_intro`, `ui_{clave}`. Salida `apps/frontend/public/static/audio/`.
  - Idempotencia: hash `sha256(texto+voiceId+modelo+settings+formato)`; caché content-addressed `scripts/.cache/{hash}.mp3` (textos repetidos se pagan una vez); regenera si falta el archivo; escritura atómica `.tmp`→rename; `manifest.json` actualizado tras cada clip.
  - Normaliza texto (sin markdown, "M1"→"mundo uno") y **falla si detecta `{placeholder}`**.
  - Resumen: generados/omitidos/fallidos/caracteres. Consola ASCII (cp1252 en Windows).
- `apps/backend/scripts/sync-audio.ts`: lee `manifest.json` y actualiza `audios` (`estado`, `rutaArchivo`, `duracionMs`, `tamanoBytes`).
- `scripts/generate-sfx.ts`: port de `generate-sfx.mjs` (pops, boings, estrellas, choque cómico, loops por bioma).

Presupuesto: ~600 instrucciones + ~1.200 pistas + 30 intros + ~60 UI/celebración ≈ **1.900 clips**, ~300 k caracteres. Primero M1–M2 para validar voz.

### 5.4 Contenido mínimo
`packages/content/schema.ts` (zod v3) y `packages/content/worlds/m01-planeta-fuzzes.json` con 3 actividades de ejemplo. `apps/backend/prisma/seed.ts` siembra 30 mundos (del catálogo), voces, actividades disponibles y sus `audios` en `pendiente`.

### 5.5 Cierre de FASE 1
Presentar árbol, `schema.prisma`, migración editada, script y **esperar aprobación** antes de `apps/backend/src`. Tras aprobación: `git init`, LFS, primer commit con `docs/PLAN.md`, `git remote add origin …codenestschool.git`, `git push -u origin main`.

## 6. FASES 1.5–5 (hoja de ruta, sprints de 2 semanas)

### FASE 1.5 — Backend Fastify + simulador compartido (Sprint 2)
- `apps/backend/src`: `server.ts`, `plugins/prisma.ts` (**un solo cliente**), `plugins/jwt.ts` (claims `rol`, `ninos[]`; `JWT_SECRET` obligatorio), `plugins/security.ts` (helmet, cors, rate-limit en login/PIN), `routes/{auth,guardian,curriculum,sessions,submissions,progress,store,teacher,audio,telemetry}.ts`, `services/{achievements,stars,rewards}.ts`; zod `safeParse`→400; vitest desde el día 1.
- **El servidor no ejecuta código del usuario:** recalcula estrellas re-simulando `accionesEjecutadas` con `GridSimulator` y midiendo `tamanoPrograma` (fichas/bloques/líneas).
- `packages/shared/src/runtime/GridSimulator.ts` (modos `paso` y `rodar`, tiles de color, agujeros, rodadores, sensores) + `stars.ts` + primer esqueleto de `pylite/` (tokenizador INDENT/DEDENT). Prerrequisito de contenido, validación y servidor.

### FASE 2 — Frontend base, design system infantil, audio (Sprints 3–4)
- Tokens (`styles/tokens.css`): Fredoka + Nunito; paleta saturada (`--azul-neon #1FA2FF`, `--verde-cesped #5AD35A`, `--magenta #FF3CAC`, `--amarillo #FFD93D`, `--naranja #FF8A3D`, `--morado #7B61FF`); fondos por grupo (espacio/fantasía/naturaleza); radios 24 px; sombras biseladas "juguete"; objetivos táctiles ≥ 72 px; `prefers-reduced-motion`.
- Componentes: `BotonJuguete`, `FichaComando`, `BarraPrograma` (dropzones grandes; Pointer Events propios en `composables/useDragFicha.ts`, sin HTML5 DnD), `PanelEstrellas`, `MapaMundo`, `TiendaFuzz`, `BotonEscucharDeNuevo` (megáfono), `FuzzAvatar` (SVG), `LoginImagenes` (PIN de imágenes), `MascotaGuia`, `CelebrationModal`.
- `stores/audio.ts` (Howler): canales `voz` (único), `sfx`, `musica` (loop por bioma, fade); `narrar(key, texto)` → MP3 de `static/audio`; en `loaderror` se anota el hueco en `clipsQueFaltan` y se avisa por consola, sin sintetizar (§2); desbloqueo tras primer gesto; mute persistido; precarga por mundo desde `manifest.json`. Cada actividad reproduce su instrucción al montar.
- **Vertical slice al final del sprint 3:** M1-L1 jugable (fichas → simulador → canvas Phaser mínimo → estrellas persistidas), antes de completar todo el design system.
- Carga diferida por ruta: un explorador de M1 no descarga Blockly ni Monaco.

### FASE 3 — Motor Phaser isométrico 2.5D y sandbox (Sprints 5–6)
- `game/IsoGridScene` (proyección 2:1, tile 64×32, depth por `y`), `PhaserRenderer implements IRenderer`, sprites Fuzz (idle, rodar, chocar, celebrar), 10 tilesets base × variantes de paleta = 30 biomas. Codexia no tiene assets: pipeline propio SVG→atlas (script) + Kenney CC0 como placeholder.
- Mecánicas: `rodar` (M1–10), tiles de color (M2), agujeros/charcos (M3), viento (M6), rodadores (M8), hielo (M17). Partículas de estrellas, "bump" cómico, confeti.
- `workers/runner.worker.ts`: port de `codeRunner.worker.ts` sobre `GridSimulator`; la barra de comandos compila fichas→JS (`fuzz.derecha(); repetir(3, () => fuzz.saltar());`) para que **las tres modalidades usen el mismo pipeline**. Tests de inyección (`fetch`, `importScripts`, bucle infinito).

### FASE 4 — Blockly 11 y Monaco (Sprints 7–8)
- Blockly (M11–20): `blockly/core` + `blocks` + `javascript` + `msg/es`; bloques `repetir`, `si/sino`, `mientras`, `variable`, `funcion`, `lista`; toolbox desde `bloquesDisponibles`; vista paralela del código (Monaco read-only); renderer `zelos`; JSON del workspace en `ActivitySession.programa`.
- Monaco (M21–30): JS con `fuzz.d.ts` (IntelliSense), `MonacoEnvironment.getWorker`, marcadores de error por línea, tema alto contraste. Python vía `pylite` (for/range, while, if/elif/else, def, listas, and/or/not) → JS → mismo sandbox; `Activity.lenguajes` decide qué ofrece cada actividad.

### FASE 5 — Contenido y telemetría (Sprint 9, con pista paralela desde el Sprint 3)
- Autoría: 600 actividades en `packages/content/worlds/m01…m30.json` con generadores procedurales por concepto + ajuste manual (~150 h de autoría; empieza en el sprint 3 en paralelo). `validate-content.ts` corre cada `solucionReferencia` (JS y, si aplica, Python) por `GridSimulator` y exige 3 estrellas; en CI.
- `seed.ts` upsert de 30 mundos + 600 actividades + pistas + audios pendientes + tienda + logros; voiceover por lotes; `sync-audio`.
- Telemetría: `POST /api/telemetry/events` (lote, zod, responde `{recibidos}`), eventos `actividad_iniciada`, `ejecucion`, `error_sandbox`, `pista_usada`, `completada`, `audio_repetido`; `rollup-metrics.ts` diario (día en `America/Bogota`); panel docente con tiempo/intentos/errores por actividad.

### FASE 6 — Homepage SEO, portal del cliente y Mercado Pago (Sprints 10–11; el esquema de planes/licencias/pagos ya nace en FASE 1)

**6.1 Homepage pública (`apps/homepage`, estática, servida por Fastify en `/`; el juego en `/app`)**
- Páginas: `index` (hero con Fuzz animado, beneficios por grupo de edad, demo jugable portada de `homepage/js/demo.js`, cifras, testimonios, FAQ, CTA), `beneficios`, `como-funciona` (metodología, 30 mundos, voz, seguridad de datos), `planes` (Personal / Padres / Escuela con comparativa), `faq`, `contacto`, `checkout?plan=…`, `gracias`, `privacidad` y `terminos` (Ley 1581).
- SEO: `<title>`/`meta description` por página, canonical, Open Graph + Twitter Card con `og:image` real, JSON-LD `EducationalOrganization`, `Product`+`Offer` por plan (precio COP), `FAQPage`, `BreadcrumbList`; `sitemap.xml` y `robots.txt` generados en build; HTML semántico (`h1` único, `alt` en imágenes), `lang="es-CO"`, fuentes con `preconnect`, imágenes WebP con `loading="lazy"`, CSS crítico inline; objetivo Lighthouse ≥ 90 en SEO/Accesibilidad/Performance; `hreflang` preparado para en/de.
- Estilo: paleta infantil de CodeNest (no la navy/neón de Codexia), tipografía Fredoka/Nunito, componentes reveal/counters de `homepage/js/main.js`.

**6.2 Planes (`Plan` + seed desde env)**

| Plan | Titular | Incluye | Precio |
|---|---|---|---|
| Personal | 1 adulto/joven autodidacta o 1 niño con tutor | 1 perfil de niño, 30 mundos, audio, tienda | por confirmar (`PRECIO_PERSONAL_COP`) |
| Padres | tutor | hasta N perfiles de niños (N por confirmar), reportes por niño, consentimiento | por confirmar (`PRECIO_PADRES_COP`) |
| Escuela | `admin_escuela` | institución, sedes, docentes, aulas, alta masiva de estudiantes, panel docente, códigos de acceso | **$12.000.000 COP/año** (`PRECIO_ESCUELA_COP`) |

Vigencia anual (`vigenciaDias 365`); precios siempre decididos en servidor (patrón de `pagos.ts:12-21`). Opcional: prueba gratuita de 7 días sin tarjeta (decisión pendiente; Codexia usaba prueba de 24 h pagada).

**6.3 Mercado Pago (`services/pagos.ts`, `routes/pagos.ts`)**
- Checkout API transparente: tokenización en navegador con `MP_PUBLIC_KEY` (SDK JS de Mercado Pago cargado en `checkout.html` y en el portal), cobro en servidor con `MP_ACCESS_TOKEN`, `X-Idempotency-Key` `lic-{id}-{uuid}`, transacción Prisma (cuenta + institución/aula + licencia `pendiente`) → cobro → activación o rollback (`limpiarCompra`), soporte de pagos asíncronos (PSE/efectivo quedan `pendiente` hasta webhook).
- Endpoints: `GET /api/pagos/config` (public key + precios), `POST /api/pagos/checkout` (alta nueva), `POST /api/pagos/renovar` (titular autenticado; crea `License.renovadaDeId`), `POST /api/pagos/webhook` (idempotente por `external_reference`, valida firma `x-signature`), `GET /api/pagos/:id` (estado). Rate-limit en checkout/webhook. `PUBLIC_BASE_URL` para `notification_url`.
- Correos transaccionales (comprobante, códigos de acceso, aviso de vencimiento a 30/7/1 días) quedan como **pendiente de decidir proveedor** (no está en el stack).

**6.4 Portal del cliente (`apps/frontend/src/views/portal/*`, rutas `/app/portal/*`, roles `tutor | admin_escuela | docente`)**
- Común: resumen de suscripción (plan, vigencia, cupos usados), **renovar/cambiar plan** con checkout embebido, historial de pagos y comprobantes, perfil de facturación, datos de cuenta y contraseña, consentimiento Ley 1581 (otorgar/revocar), exportación/supresión de datos del niño, centro de ayuda.
- Padres/Personal: gestión de niños (crear perfil, PIN de imágenes, grupo de edad, avatar), **reportes de progreso por niño** (mundos, estrellas, tiempo semanal, conceptos dominados, actividades donde se atasca), control de tiempo de juego, notificaciones de logros.
- Escuela (`admin_escuela`): sedes, docentes (invitación), aulas y códigos de acceso, alta masiva de estudiantes (CSV/JSON), cupos vs `maxEstudiantes`, bloqueo de estudiantes/aulas, asignaciones por aula, **matriz de seguimiento** y estadísticas (port funcional de `TeacherDashboard.vue`, descompuesto en pestañas + `stores/portal.ts`), auditoría de accesos.
- Docente: vista reducida (sus aulas, asignaciones, seguimiento).
- Implementación: layout `PortalLayout.vue` distinto al del juego (adultos: denso, tablas, gráficos SVG/CSS propios como Codexia), guards por rol, todas las consultas agregadas en `services/reportes.ts` sobre `progreso_actividad` y `metricas_*` (no sobre telemetría cruda).

Hito jugable: fin de FASE 3 con M1 completo (20 actividades, voz, fuzz, estrellas, tienda). Hito comercial: fin de FASE 6 con compra de plan Escuela en sandbox de Mercado Pago y portal operativo.

## 7. Mapa de 30 mundos (`packages/shared/src/catalog/worlds.ts`)

| Grupo | Editor | Mundos (concepto) |
|---|---|---|
| Exploradores 4–6 | comandos | M1 Planeta de los Fuzzes (secuencias) · M2 Bosque Arcoíris (condicionales de color) · M3 Pradera de los Saltos (repetir Nx) · M4 Cueva de los Ecos (patrones) · M5 Oasis Dulce (orden de recolección) · M6 Castillo de Nubes (si/sino) · M7 Bahía Pirata (subrutina "Super Salto") · M8 Montaña Neón (bucles finitos vs infinitos) · M9 Valle Dinosaurios (debug visual) · M10 Estación Espacial (integrador) |
| Creadores 7–9 | bloques | M11 Reino de Cristal (repeat) · M12 Cuevas Mecánicas (variables) · M13 Ciudad Engranajes (funciones) · M14 Templo Elementos (if/else) · M15 Laberinto Isométrico (AND/OR) · M16 Fábrica Baterías (parámetros) · M17 Bioma Congelado (while/until) · M18 Archipiélago Volcánico (listas) · M19 Misión Reconocimiento (debug 2+) · M20 Fortaleza del Titán (integrador) |
| Hackers 10–12+ | texto (JS; Python pylite donde aplique) | M21 Ciudad Ciberisométrica (sintaxis) · M22 Servidor Olvidado (arrays) · M23 Laboratorio Antivirus (for) · M24 Red Submarina (objetos) · M25 Reactor Nuclear (async/eventos, solo JS) · M26 Desierto Algoritmos (búsqueda/orden) · M27 Satélite Hackeado (try/catch, solo JS) · M28 Centro de Drones (pathfinding) · M29 Arena Cibersegura (refactor/eficiencia) · M30 Núcleo de la IA (proyecto final) |

Actividad N: mundo = ⌈N/20⌉, número en mundo = ((N−1) mod 20)+1.

## 8. Formato de actividad v3 (`Activity.config`, zod en `packages/content/schema.ts`)

Extiende el v2 de Codexia (`frontend/src/game/types.ts:43-70`). Los textos narrados viven en columnas (`instruccionTexto`, `exitoTexto`, `pistas.texto`); `config` solo lleva claves de audio.
```jsonc
{
  "version": 3, "grupo": "exploradores", "editor": "comandos", "lenguajes": ["comandos"], "modoMovimiento": "rodar",
  "grid": { "cols": 8, "rows": 6, "tiles": [[{"t":"camino","color":"rojo"}, {"t":"agujero"}, …]] },
  "spawn": { "x": 0, "y": 2, "dir": "derecha" },
  "items": [{ "id": "estrella1", "tipo": "estrella", "x": 5, "y": 2 }],
  "actores": [{ "tipo": "rodador", "ruta": [[3,1],[3,4]], "periodo": 2 }],
  "comandosPermitidos": ["derecha","arriba","abajo","izquierda","repetir","siColor"],
  "bloquesDisponibles": [], "codigoInicial": { "javascript": "" },
  "programaPrefijado": [ … ],
  "objetivos": [{ "id": "salida", "tipo": "alcanzar_celda", "x": 7, "y": 2, "obligatorio": true }],
  "criteriosEstrella": { "1": {"objetivos":["salida"]}, "2": {…}, "3": {"objetivos":["salida","estrella1"], "maxFichas": 4} },
  "audio": { "instruccion": "instruction_world1_lvl1", "exito": "celebration_pool", "pistas": ["hint_world1_lvl1_1"] },
  "demoAnimada": "demo_m1_l1",
  "recompensa": { "monedas": 10 }, "topeEjecucion": 5000
}
```
`solucionReferencia` (columna): `{ "comandos": [...] }` o `{ "javascript": "...", "python": "..." }`.

## 9. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Claves expuestas en BeSmart (ElevenLabs, PG) | Rotar clave ElevenLabs; `.env` gitignored; check CI `grep -rn "sk_"`; `JWT_SECRET` obligatorio. |
| Prisma sin particiones nativas / `db push` destructivo | Migración editada + `_default` + `ensure-partitions`; sin script `db:push`; `migrate diff` en CI. |
| Coste ElevenLabs | Hash + caché content-addressed + pool de celebraciones; comprobar cuota antes. Sin fallback: el coste real medido de los mundos 1–10 fue de 46.524 caracteres para 697 clips, sobre un plan Pro de 1.500.000/mes. |
| Autoría de 600 actividades | Pista paralela desde sprint 3; generadores procedurales; `validate-content` en CI. |
| DnD táctil 4–6 años sin librería | Pointer Events propios, fichas ≥ 72 px, snap, playtesting en M1. |
| Python sin Pyodide | `pylite` subconjunto; actividades declaran `lenguajes`; M25/M27 solo JS. |
| PIN de imágenes débil | `pinHash` + contexto (aula/tutor) + rate-limit. |
| Propiedad intelectual Kodable | Solo inspiración; personajes, nombres, arte y audio originales; Kenney CC0 placeholder. |
| Datos de menores (Ley 1581) | Tabla de consentimientos versionada, auditoría de accesos, telemetría sin FK para permitir supresión, sin trackers. |
| Peso de MP3 en repo | Git LFS (cuota 1 GB gratis; vigilar). |
| Pagos: montos manipulados, webhooks duplicados, pagos asíncronos | Precio solo en servidor; idempotencia por `external_reference` y `idempotencyKey`; estado `pendiente` hasta confirmación; firma `x-signature`; sandbox de MP en tests. |
| Precios/cupos de Personal y Padres sin definir | Configurables por env y seed; confirmar antes de publicar `planes.html`. |
| SEO en SPA | El sitio público es HTML estático (no Vue); el juego/portal viven en `/app` con `noindex`. |

## 10. Verificación (FASE 1, ejecutable)

1. `npm install` y `npm ls --workspaces --depth 0` sin `missing`/`invalid`.
2. `npx -w apps/backend prisma validate` y `prisma format --check`.
3. `docker compose up -d` → `prisma migrate dev --name init` → `psql … -c '\d+ telemetria'` muestra `Partition key: RANGE (creado_en)`; `pg_inherits` ≥ 13 particiones por tabla (12 meses + default); ídem métricas.
4. `prisma migrate diff --from-migrations … --to-schema-datamodel …` → "No difference detected"; `migrate status` limpio.
5. Insert 14 meses en el futuro cae en `telemetria_default`; `ensure-partitions.ts` corre dos veces sin error.
6. `tsc -b` sin errores; `node --experimental-strip-types packages/shared/src/index.ts` arranca (shared sin runtime TS).
7. `npm run db:seed` → 30 `mundos`, `audios` en `pendiente` > 0, `numero_global` consistente con la fórmula de §7.
8. `tsx scripts/generate-voiceover.ts --worlds 1 --dry-run` sin API key lista claves y caracteres; con clave inválida `--limit 1` → 401 claro sin archivos; con clave real `--limit 1` crea `instruction_world1_lvl1.mp3` y entrada en manifest; segunda corrida `generados 0, omitidos 1`; `sync-audio` deja la fila en `generado`.
9. `validate-content.ts --schema-only` valida `m01-*.json`.
10. `git check-ignore .env` → `.env`; `git lfs ls-files` lista los mp3; `grep -rn "sk_" --exclude-dir=node_modules .` vacío.

Verificación de fases posteriores: FASE 1.5 vitest auth (tutor→niño→PIN→JWT con `ninos[]`) y recálculo de estrellas; FASE 2 M1-L1 jugable y, al renombrar un MP3, `validate-content` lo detecta y la app anota el hueco sin quedarse a medias; FASE 3 tests de inyección al sandbox; FASE 4 M11 con vista paralela y M21 con IntelliSense/errores por línea + pylite en vitest; FASE 5 `validate-content` en 600 actividades, Playwright un mundo por grupo, panel docente con métricas; FASE 6 compra de cada plan con tarjetas de prueba de Mercado Pago (aprobada, rechazada, pendiente), webhook duplicado sin doble activación, renovación desde el portal, Lighthouse ≥ 90 en homepage, `sitemap.xml` válido, Playwright del flujo padre: registro → pago → crear niño → PIN → jugar → ver reporte.

## 11. Entrega del plan
Este documento se guarda en `C:\Users\eortiz\Desktop\codenestschool\docs\PLAN.md` y se incluye en el primer commit de FASE 1 para seguimiento posterior.
