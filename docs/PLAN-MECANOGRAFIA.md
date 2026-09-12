# Mecanografía de Codexia — plan de trabajo

> Herramienta nueva para los grandes (5.º, 6.º y 7.º): aprender a escribir con el
> teclado de verdad, con los dedos donde van, en un entorno gamificado y jugable
> tanto en un portátil como en una tableta.

Fecha: 2026-09-12.

---

## 1. Lo que se entrega

| Lo pedido | Cómo se resuelve |
|---|---|
| Herramienta para 5.º, 6.º y 7.º | Tres zonas: **Playa de las Teclas** (5.º), **Laguna de las Palabras** (6.º) y **Cima de los Párrafos** (7.º), 24 lecciones |
| Teclado en pantalla (móvil) | Teclado propio dibujado por nosotros, con los dedos por colores; se toca y escribe |
| Teclado físico (escritorio) | Entrada real del teclado, con el mismo diagrama como guía |
| Todo gamificado | Estrellas por lección, récords de PPM, insignias, y tres minijuegos de práctica |
| Gráficos excelentes | Tres fondos generados con IA en S3, y personajes dibujados con primitivas |

## 2. La decisión que manda sobre todo: el teclado es ESPAÑOL

Un tutor de mecanografía copiado del inglés no sirve aquí. El teclado
**español (Latinoamérica)** tiene `ñ`, la tecla muerta de tilde (`´`), la `ü`, los
signos `¿` y `¡`, y la posición de los símbolos cambiada. Un niño que aprende en
un teclado inglés y luego escribe "mañana" no encuentra la letra.

Eso obliga a dos cosas:

- **Teclas muertas de verdad.** `´` + `a` = `á`, y se enseña así, porque así
  funciona el teclado que tiene delante. La lógica está implementada en el motor,
  no simulada con atajos.
- **Lecciones propias.** La `ñ` no es "una letra más": está en el meñique derecho
  y se practica aparte, igual que los acentos, que son de 6.º.

## 3. Cómo se escribe en cada dispositivo

Es la parte con más trampa del proyecto, así que va explícita:

| | Escritorio | Tableta y móvil |
|---|---|---|
| Entrada | Teclado físico, capturada en un `<input>` invisible | Nuestro teclado en pantalla, a toques |
| Por qué así | El `input` recibe el carácter YA compuesto: es la única forma de que `´`+`e` llegue como `é`. Con `keydown` llega `Dead` y se pierde el acento | Si se enfocara un `input`, saltaría el teclado del sistema, taparía media pantalla y no enseñaría dónde va cada dedo |
| El diagrama | Se ve igual, como guía: resalta la tecla siguiente y el dedo que toca | Es el propio teclado |

El teclado en pantalla implementa la tecla muerta: tocar `´` deja el acento
pendiente y la siguiente vocal sale acentuada. Aprender eso **es** aprender a
escribir en español.

## 4. Arquitectura

### Contenido (`packages/content/src/mecanografia.ts`)
- `TECLADO_ES`: filas, teclas, dedo y mano de cada una, y el carácter con y sin
  mayúscula. Única fuente de verdad para el diagrama y para la ayuda del dedo.
- `LECCIONES`: 24, en tres zonas. Cada una con sus teclas nuevas, su texto y los
  mínimos de precisión y PPM para una, dos y tres estrellas.
- Frases para narrar.

### Compartido (`packages/shared/src/mecanografia/`)
- `medidas.ts`: PPM, precisión y estrellas. **Puras**, para que el servidor
  recalcule exactamente lo mismo que vio el niño en pantalla.
- `zod`: el esquema del resultado de una lección, con topes de plausibilidad.

### Backend
- `TypingProgress` (por usuario y lección) y `TypingProfile` (resumen y **errores
  por tecla**, que es lo que el docente necesita: "le cuesta la ñ").
- `mecanografia.service.ts`, `mecanografia.routes.ts`, insignias, y una pestaña
  más en el panel del docente.

### Frontend
- `components/TecladoEnPantalla.vue` — el teclado, con dedos por colores.
- `composables/useMecanografia.ts` — el motor: texto, posición, errores, PPM.
- `views/MecanografiaView.vue` — el mapa de las tres islas.
- `views/LeccionTecladoView.vue` — la lección.
- `views/PracticaTecladoView.vue` — los minijuegos.

## 5. Los minijuegos (práctica libre)

Tres modos sobre un mismo motor —llegan palabras, tú las escribes— con tres
escenas distintas, porque lo que cambia la sensación del juego es la escena:

- **Ola**: escribe antes de que la ola te alcance. Velocidad.
- **Pesca**: escribe la palabra del pez para pescarlo. Palabras completas.
- **Carrera**: cada palabra te adelanta. Resistencia.

## 6. Fases

1. Contenido: teclado español y las 26 lecciones.
2. Medidas compartidas (PPM, precisión, estrellas) con pruebas.
3. Backend: modelos, servicio, rutas, insignias, docente, pruebas.
4. El teclado en pantalla y el motor de escritura.
5. Las vistas: mapa, lección, práctica, perfil.
6. Gráficos (IA → S3) y sonidos de tecla (ElevenLabs).
7. Verificación en navegador: **escritorio con teclas reales y móvil con toques**.

## 7. Riesgos

| Riesgo | Qué se hace |
|---|---|
| Los acentos se pierden con `keydown` | Se lee del `input` compuesto; hay prueba del caso `´`+`e` |
| El teclado del sistema tapa la pantalla en móvil | No se enfoca ningún campo: se escribe con nuestro teclado |
| Un niño "gana" con 200 PPM manipulando el navegador | El servidor recalcula y descarta lo implausible |
| Enseñar malos hábitos | Precisión antes que velocidad: sin 90 % no hay tercera estrella, por rápido que vaya |

## 8. Lo que solo se vio en un navegador de verdad

Las 330 pruebas pasaban antes de encontrar estos tres. Van anotados porque los
tres son del mismo tipo: **fallos que solo existen cuando hay una pantalla**.

| Fallo | Cómo se veía | Causa |
|---|---|---|
| El teclado no se podía usar en un teléfono | De la cuarta tecla en adelante los toques no hacían nada | Las teclas eran cuadradas (`aspect-ratio: 1/1`) con alto mínimo, y eso ataba el ancho: doce teclas de 44 px son 583 px en una pantalla de 412. `elementFromPoint` devolvía nada porque la tecla estaba fuera. Ahora manda el **alto** y el ancho lo reparte el flex |
| `´` + `a` contaba error | Solo en móvil: cada palabra con tilde de la Laguna se contaba mal | La tecla muerta se *armaba* y nunca se *aplicaba*. En un portátil no se notaba porque el sistema operativo compone la vocal antes de que la aplicación la vea; con el teclado de la pantalla no hay nada que lo tape |
| "12000 ppm" tras la primera tecla | Un instante, y luego 50 | Un carácter en 10 ms. Aritméticamente cierto y pedagógicamente inútil. Se muestra un guion hasta la primera palabra (`velocidadEnVivo`) |

| Dos lecciones de la Cima eran **imposibles** en tableta | El niño llegaba a la `@` y no podía seguir | `cima-02` (correos y fechas) y `cima-05` (código) piden `@ - _ > { }`, y esas teclas no estaban dibujadas. En un portátil da igual, porque el niño usa su teclado físico; tocando el de la pantalla, no había forma de avanzar. Se añadieron como están en el teclado latinoamericano de verdad: `-`/`_` tras el punto, `<`/`>` a la izquierda de la z, `[`/`{` y `]`/`}` tras la ñ, y la arroba en la Q con **Alt Gr** (en el teclado de España sería Alt Gr + 2; el colegio es colombiano) |

Ese último se buscaba solo: hay una prueba que recorre **las 26 lecciones y las 70
palabras de los minijuegos** y exige que cada carácter tenga tecla en el teclado
dibujado y que `comoEscribir()` sepa decir con qué dedo y con qué modificador se
escribe. Una lección que pida algo que no se puede tocar no llega a producción.

Y una lección sobre el propio arnés, que llevó a acusar a la aplicación de algo
que no hacía: en CDP, `Input.dispatchKeyEvent` con `type: 'keyDown'` **y** `text`
ya inserta el carácter. Mandar además un evento `char` lo inserta dos veces. Eso
se veía como "8 % de precisión" en una lección escrita correctamente. Antes de
creer que el código está mal, hay que comprobar que la medida está bien.

El arnés (`teclado.mjs`) comprueba, contra un servidor en **modo producción**:
la isla con sus 3 zonas y 26 lecciones; una lección con tildes escrita con teclas
reales hasta ⭐⭐⭐ y 100 % de precisión; los tres minijuegos con su fondo de S3;
y, con un teléfono emulado (412 px, `pointer: coarse`), doce teclas escritas
**tocando** el teclado de la pantalla, acento incluido.

### Lo que no es ideal y se sabe

En un teléfono de 412 px el teclado entra completo (384 px, sin desbordar), pero
una fila española tiene 14 teclas, así que cada una queda en unos 22 px de ancho
por 45 de alto. Nada es inalcanzable —está comprobado tocando— pero un dedo de
diez años acertará más en una tableta o con el teléfono en horizontal. No se
esconden teclas para ensancharlas: esto enseña dónde está cada tecla de un
teclado de verdad, y un teclado al que le faltan teclas enseña mal.
