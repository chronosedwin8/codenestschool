# Colegios, grupos y seguimiento por actividad

Lo que falta para que un colegio entero se maneje solo, sin que nadie toque la base
de datos a mano.

## 1. Colegios y planes (panel de administración)

- Pestaña **Colegios**: crear y editar instituciones (nombre, NIT, ciudad, país,
  cupo de estudiantes), ver cuántos docentes, grupos y estudiantes tiene cada una,
  y qué licencia la cubre.
- **Plan al docente**: desde Equipo se le asigna un plan. Crea una `licencia` con
  él como titular, vigencia desde hoy según `vigencia_dias` del plan, y aparece en
  su portal igual que una comprada. Se puede cancelar y se puede renovar.
- **Permiso de Phidias por docente** (`usuarios.phidias_habilitado`): un
  interruptor en la lista de Equipo. El token de Phidias abre el expediente de
  1.175 menores; que lo use todo el que entre no es aceptable. `admin` siempre
  puede.

## 2. Grupos y altas (zona del docente)

Cuatro formas de llenar un grupo, cada una para un momento distinto del curso:

1. **Del colegio, secciones enteras** — el primer día (solo si está habilitado).
2. **Del colegio, por código** — el que llega tarde o el grupo de refuerzo que
   junta niños de seis cursos. Se teclea el código y se va añadiendo a una
   bandeja; el documento se busca en el servidor y **nunca vuelve al navegador**.
3. **Pegar una lista** — cuando no hay sistema académico.
4. **Uno a uno** — el que llega en octubre.

### El fallo de la ventana que se cerraba

`ImportarPhidias.vue` guardaba solo los **ids** de los elegidos y reemplazaba el
listado entero al abrir otra sección. Al cambiar de curso, el panel abierto
desaparecía (el `v-if` colgaba del nivel de la sección abierta) y los ya marcados
dejaban de verse: parecía que se hubieran perdido. Se cambia por una **bandeja
persistente** (`Map<id, estudiante>`) que sobrevive a cambiar de sección, se ve
siempre, y de la que se puede sacar a alguien uno a uno.

## 3. Asignar actividades y seguirlas

- `asignaciones` ya apuntaba a un aula. Se añade `asignaciones_estudiantes`
  (`AssignmentTarget`): sin filas, la tarea es del grupo entero; con filas, es de
  esos estudiantes. No se parte el modelo en dos.
- Se puede asignar un **mundo** (20 actividades) o una **actividad** concreta.
- Pestaña **Seguimiento**: matriz estudiantes × asignaciones. Cada celda es el
  porcentaje de la asignación que ese estudiante lleva terminado
  (`completadas / actividades de la asignación`), con las estrellas y los intentos
  al pasar el ratón. Una celda gris clara significa "empezó y no terminó nada":
  es distinto de no haber entrado, y es la señal que de verdad sirve.
- Arriba: estudiantes, terminaron todo, en progreso, iniciando y promedio del
  grupo. Filtros por asignación y por mundo.

## 4. Verificación

- Pruebas de servidor: permiso de Phidias (403 sin él), importar por códigos,
  asignación a estudiantes concretos, matriz con un grupo real.
- Navegador de verdad (Chrome por CDP): crear colegio, asignar plan, habilitar
  Phidias, armar un grupo mixto con dos secciones y dos códigos sin perder la
  selección, asignar a dos estudiantes y leer la matriz.
- Despliegue con la lista de [[codenest-despliegue]]: migración nueva, así que
  `migrate deploy` sobre base vacía y `migrate diff --exit-code` antes de empujar.
