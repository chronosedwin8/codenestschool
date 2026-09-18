-- Corrige tildes y enes de los textos de los planes ya guardados.
--
-- Solo cambia un texto si sigue siendo EXACTAMENTE el sembrado original: si
-- el administrador ya edito una tarjeta, su version no coincide y se respeta.
-- "al ano" en una tarjeta de precios no es una errata menor.

UPDATE "planes" SET "descripcion" = 'Para un niño o niña que aprende en casa, con acompañamiento de su tutor.'
WHERE "clave" = 'personal' AND "descripcion" = 'Para un nino o nina que aprende en casa, con acompanamiento de su tutor.';

UPDATE "planes" SET "beneficios" = '["1 perfil de niño con avatar personalizable", "Los 30 mundos y las 600 actividades", "Instrucciones narradas con voz humana", "Tienda de accesorios para el Fuzz", "Reporte de progreso para el tutor", "Vigencia de 1 año"]'::jsonb
WHERE "clave" = 'personal' AND "beneficios" = '["1 perfil de nino con avatar personalizable", "Los 30 mundos y las 600 actividades", "Instrucciones narradas con voz humana", "Tienda de accesorios para el Fuzz", "Reporte de progreso para el tutor", "Vigencia de 1 ano"]'::jsonb;

UPDATE "planes" SET "beneficios" = '["Hasta 4 perfiles de niños", "Todo lo del plan Personal para cada hijo", "Reportes comparativos por hijo", "Control de tiempo de juego", "Notificaciones de logros", "Vigencia de 1 año"]'::jsonb
WHERE "clave" = 'padres' AND "beneficios" = '["Hasta 4 perfiles de ninos", "Todo lo del plan Personal para cada hijo", "Reportes comparativos por hijo", "Control de tiempo de juego", "Notificaciones de logros", "Vigencia de 1 ano"]'::jsonb;

UPDATE "planes" SET "descripcion" = 'Para colegios: sedes, docentes, aulas y seguimiento pedagógico completo.'
WHERE "clave" = 'escuela' AND "descripcion" = 'Para colegios: sedes, docentes, aulas y seguimiento pedagogico completo.';

UPDATE "planes" SET "beneficios" = '["Estudiantes ilimitados", "Múltiples sedes y aulas con código de acceso", "Docentes ilimitados con panel propio", "Alta masiva de estudiantes", "Asignación de mundos y actividades por aula", "Matriz de seguimiento y estadísticas por grupo", "Auditoría de accesos y cumplimiento Ley 1581", "Capacitación inicial y soporte prioritario", "Vigencia de 1 año"]'::jsonb
WHERE "clave" = 'escuela' AND "beneficios" = '["Estudiantes ilimitados", "Multiples sedes y aulas con codigo de acceso", "Docentes ilimitados con panel propio", "Alta masiva de estudiantes", "Asignacion de mundos y actividades por aula", "Matriz de seguimiento y estadisticas por grupo", "Auditoria de accesos y cumplimiento Ley 1581", "Capacitacion inicial y soporte prioritario", "Vigencia de 1 ano"]'::jsonb;
