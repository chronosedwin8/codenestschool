# Constructor de Juegos de Codexia — plan de trabajo

> Sección nueva de CodeNest School: el estudiante deja de resolver actividades y
> pasa a **crear** su propio juego arcade, guardarlo, publicarlo si quiere, y
> recibir por ello un diploma y una insignia.

Fecha: 2026-09-12. Estado inicial: 30 mundos y 600 actividades en producción, con
tienda, panel del estudiante, zona docente y SSO del colegio ya funcionando.

---

## 1. Qué se entrega, punto por punto

| Lo pedido | Cómo se resuelve |
|---|---|
| Constructor tipo arcade | `ConstructorView` + motor `ArcadeRuntime` sobre Phaser (ya está en el paquete) |
| Escenarios prediseñados | 10 fondos generados con Magnific (Freepik), guardados en S3 |
| Construir sus obstáculos | Tipos, tamaño, velocidad, frecuencia, daño y puntos; hasta 6 clases por juego |
| Elegir personajes | Catálogo de personajes dibujados como SVG propio, igual que el Fuzz |
| Programar los eventos | Reglas `cuando … entonces …` con fichas, la misma metáfora de los mundos 1-10 |
| Teclado (flechas) o ratón | `control: 'teclado' \| 'raton'`, una sola decisión que cambia el motor |
| Guardar | Borrador en la base, autoguardado y guardado explícito |
| Publicar, y que decida el alumno | `estado: borrador \| publicado`, reversible por él |
| Zona de juegos publicados | `/app/juegos`, con partidas y me-gusta; el docente ve además los borradores de sus aulas |
| Diploma al publicar | Diploma verificable con código `CDX-XXXX-XXXX`, página pública e imprimible |
| Insignia en el perfil | Logro `constructor-de-juegos` visible en "Lo que llevas hecho" |

## 2. Dos decisiones de diseño que conviene explicar

**Los títulos no se escriben: se sortean.** El nombre del juego sale de tres
listas de palabras (`Veloz Cohete Rosa`, `Isla Brillante Feliz`) y el niño puede
volver a tirar los dados hasta que le guste. Kodable hace lo mismo
(*"Cool Mega Mash"*, *"Starry Galactic Trove"*) y no es casualidad: en el momento
en que un menor escribe texto libre que otros menores van a leer, hace falta
moderación humana, y sin ella la zona de juegos publicados es un problema, no una
función. Con esto, **nada de lo que se publica es texto libre**.

**Los fondos se generan con IA; los personajes y los obstáculos se dibujan en
código.** Un fondo es una imagen a pantalla completa y la IA la hace muy bien. Un
sprite necesita **transparencia**, y los modelos de imagen no la entregan: saldría
un personaje con un rectángulo de fondo pegado. El proyecto ya dibuja al Fuzz con
SVG por esta misma razón, así que los personajes y obstáculos siguen ese camino:
se ven bien, pesan nada y se retiñen de cualquier color.

## 3. Arquitectura

### Compartido (`packages/shared/src/juegos/`)
- `definicion.ts` — tipos y **esquema zod** del JSON del juego (v1) y sus límites.
  Lo usan el navegador y el servidor: el servidor nunca se fía de lo que llega.
- `nombres.ts` — el sorteo de títulos.

### Contenido (`packages/content/src/`)
- `juegos-catalogo.ts` — escenarios (URL en S3), personajes, obstáculos y
  recompensas, con sus formas y colores.
- `juegos-frases.ts` — las locuciones del constructor y del diploma.

### Backend (`apps/backend/src/`)
- `lib/s3.ts` — cliente S3 con firma SigV4 escrito a mano (puerto del de
  BookStudio). Sin `@aws-sdk`: son 40 MB de dependencias para cuatro operaciones,
  en una imagen que ya se compila justa de memoria.
- `services/almacen.service.ts` — subidas al bucket, con las rutas del §5.
- `services/proyectos.service.ts` — crear, guardar, publicar, despublicar, listar.
- `services/logros.service.ts` — conceder una insignia (idempotente).
- `services/diplomas.service.ts` — emitir y verificar diplomas.
- `routes/proyectos.routes.ts` — `/api/proyectos/*` (del alumno).
- `routes/juegos.routes.ts` — `/api/juegos` (publicados), `/api/juegos/:id/partida`, `/api/juegos/:id/megusta`, `/api/juegos/diploma/:codigo`.
- `routes/docente.routes.ts` — se le añade `/proyectos` (todo lo de sus aulas).

### Modelo de datos
```prisma
GameProject   proyectos_juego     autorId, titulo, definicion JSONB, estado,
                                  portadaUrl, partidas, meGusta, publicadoEn
GameLike      juegos_megusta      @@unique([proyectoId, usuarioId])
Diploma       diplomas            codigo @unique, alumnoId, proyectoId, emitidoEn
```
Más `Achievement` y `UserAchievement`, que ya existen y no los usaba nadie.

### Frontend (`apps/frontend/src/`)
- `game/ArcadeRuntime.ts` — escena Phaser que interpreta la definición: fondo,
  jugador, generadores de obstáculos, colisiones, marcador, victoria y derrota.
- `views/ProyectosView.vue` — mis juegos.
- `views/ConstructorView.vue` — el constructor, en pestañas grandes.
- `views/JuegosView.vue` — los publicados.
- `views/JugarJuegoView.vue` — jugar uno.
- `views/DiplomaView.vue` — el diploma, imprimible.
- `stores/proyectos.ts`.

## 4. La definición del juego (v1)

```jsonc
{
  "version": 1,
  "escenario": "espacio",            // clave del catálogo
  "control": "teclado",              // teclado | raton
  "jugador": { "personaje": "cohete", "color": "#1FA2FF", "velocidad": "normal", "vidas": 3, "dispara": true },
  "obstaculos": [
    { "id": "o1", "forma": "asteroide", "color": "#94A3B8", "tamano": "mediano",
      "velocidad": "normal", "frecuencia": "media", "efecto": "quitaVida", "puntos": 0 }
  ],
  "premios": [
    { "id": "p1", "forma": "estrella", "color": "#FFD93D", "frecuencia": "baja", "puntos": 10 }
  ],
  "reglas": [
    { "cuando": "tocaPremio", "entonces": "sumarPuntos", "valor": 10 },
    { "cuando": "tocaObstaculo", "entonces": "quitarVida" },
    { "cuando": "puntosLleganA", "valor": 100, "entonces": "ganar" }
  ],
  "meta": { "tipo": "puntos", "valor": 100 },
  "musica": "espacio"
}
```
Límites duros (validados en el servidor): 6 obstáculos, 4 premios, 20 reglas,
título de 40 caracteres y solo claves del catálogo. Un juego no puede referirse a
una imagen que no sea nuestra.

## 5. El bucket

`codexialabstorage`, región `us-east-1`, con esta estructura:

```
catalogo/escenarios/{clave}.jpg      fondos 16:9 generados con Magnific
catalogo/musica/{clave}.mp3          música por escenario (ElevenLabs)
proyectos/{id}/portada.png           captura del juego al publicar
diplomas/{codigo}.png                copia del diploma emitido
```

Lo del catálogo es público y con caché larga (es el mismo archivo para todos). Lo
de `proyectos/` y `diplomas/` también es público de lectura, pero su nombre lleva
un identificador que no se puede adivinar.

## 6. Fases y orden de ejecución

1. **Cimientos**: bucket, cliente S3, definición compartida con zod y pruebas.
2. **Backend**: migraciones, servicios, rutas, insignia, diploma, pruebas.
3. **Assets**: escenarios con Magnific → S3; locuciones y música con ElevenLabs.
4. **Motor**: `ArcadeRuntime` en Phaser, con los dos controles.
5. **Constructor**: la interfaz, pestaña a pestaña.
6. **Publicar**: zona de juegos, diploma, insignia en el perfil, vista del docente.
7. **Verificación**: pruebas automáticas, y en el navegador y en modo producción:
   construir un juego, jugarlo, publicarlo, recibir el diploma, verlo en la zona
   pública y comprobar que el docente lo ve.

## 7. Riesgos

| Riesgo | Qué se hace |
|---|---|
| Contenido inapropiado en una zona de menores | Cero texto libre: títulos sorteados y solo assets del catálogo |
| Un juego imposible de ganar o de perder | El constructor avisa si no hay meta alcanzable, y "Probar" es obligatorio antes de publicar |
| Definición manipulada desde el navegador | zod en el servidor, con límites duros y claves del catálogo |
| Créditos de Magnific | Solo 10 fondos, generados una vez desde un script y servidos desde S3; el alumno nunca genera imágenes |
| Peso del paquete en una tableta | El constructor y el motor se cargan de forma diferida, como Blockly y Monaco |
| Coste de S3 | Catálogo con `cache-control` de un año; las portadas son PNG de 640×360 |
