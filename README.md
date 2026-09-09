# CodeNest School

Plataforma de programación para niños de 4 a 12+ años: 30 mundos, 600 actividades y tres formas de programar según la edad. Inspirada en Kodable (interfaz sin texto para prelectores) y CodeCombat (progresión hacia código real).

## Grupos de edad

| Grupo | Edad | Mundos | Cómo programa | Interfaz |
|---|---|---|---|---|
| Exploradores | 4–6 | 1–10 | Fichas de flechas con arrastrar y soltar | 100 % gráfica, sin texto, con voz |
| Creadores | 7–9 | 11–20 | Bloques (Blockly 11) | Bloques con el código generado a la vista |
| Hackers | 10–12+ | 21–30 | Texto (Monaco Editor) | JavaScript, y Python en los mundos donde aplica |

Cada mundo tiene 20 actividades. La actividad número N pertenece al mundo ⌈N/20⌉.

## Arquitectura

```
codenestschool/
├── apps/
│   ├── backend/     Fastify 4 + Prisma 5 + PostgreSQL 15
│   ├── frontend/    Vue 3 + Pinia + Vite 5 + Phaser 3 + Blockly + Monaco + Howler
│   └── homepage/    Sitio público estático, optimizado para buscadores
├── packages/
│   ├── shared/      Tipos, catálogo de los 30 mundos, simulador y esquemas zod
│   └── content/     Reparto de voces, textos de interfaz y los JSON de mundos
└── scripts/         Generación de voz con ElevenLabs y validación de contenido
```

## Requisitos

- Node.js 24 o superior
- Docker (para PostgreSQL 15)
- Git LFS (los MP3 de voz se versionan con LFS)

## Puesta en marcha

```bash
npm install
cp .env.example .env          # completa JWT_SECRET y las claves que uses
npm run db:up                 # PostgreSQL 15 en el puerto 5433
npm run db:migrate            # aplica la migración inicial
npm run db:seed               # 30 mundos, 3 planes, voces y audios pendientes
npm run content:validate      # valida el contenido curricular
```

La base de datos de desarrollo corre en el puerto 5433 para no interferir con una instalación local de PostgreSQL.

## Generación de voz

Las instrucciones se narran siempre. Los MP3 se generan una sola vez con ElevenLabs y se sirven como archivos estáticos; si un clip falta, el navegador recurre a la Web Speech API.

```bash
npm run voice:generate -- --dry-run          # qué se generaría y cuántos caracteres cuesta
npm run voice:generate -- --worlds 1         # genera un mundo
npm run voice:sync                           # refleja el resultado en la tabla de audios
```

El generador es idempotente: identifica cada clip por el hash de su texto, voz y ajustes, así que solo regenera lo que cambió. Los textos repetidos se cobran una sola vez.

## Planes

| Plan | Para quién | Perfiles de niño | Precio anual |
|---|---|---|---|
| Personal | Un niño en casa | 1 | Configurable |
| Padres | Familias | Hasta 4 | Configurable |
| Escuela | Colegios | Sin límite | $12.000.000 COP |

Los precios los fija siempre el servidor a partir de variables de entorno. El pago se procesa con Mercado Pago.

## Comandos útiles

| Comando | Qué hace |
|---|---|
| `npm run build` | Compila todos los paquetes |
| `npm run db:studio` | Explorador visual de la base de datos |
| `npm run db:partitions` | Crea las particiones mensuales que falten |
| `npm run voice:sfx` | Genera los efectos de sonido del juego |

## Notas de desarrollo

Nunca ejecutes `prisma db push` en este proyecto. Las tablas de telemetría y métricas están particionadas por rango y ese comando las recrearía sin la partición. Usa siempre migraciones, y si regeneras la inicial, vuelve a aplicar `apps/backend/scripts/patch-partition-migration.mjs`.

## Cumplimiento

Los datos de menores se tratan conforme a la Ley 1581 de 2012 y el Decreto 1377 de 2013: los niños no tienen correo electrónico, entran con un usuario y un PIN de imágenes bajo la responsabilidad de un adulto, el consentimiento del tutor queda registrado con la versión de la política aceptada, y todo acceso de un adulto a los datos de un menor queda auditado.
