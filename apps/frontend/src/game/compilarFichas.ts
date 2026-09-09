/**
 * Traduce un programa de fichas a JavaScript.
 *
 * Es la pieza que permite que las tres formas de programar acaben en el mismo
 * sitio. Las fichas de los prelectores, los bloques de Blockly y el texto de
 * Monaco generan todos el mismo JavaScript, que pasa por el mismo sandbox y se
 * verifica con el mismo simulador. Sin esto habría tres motores distintos y tres
 * conjuntos de errores por descubrir.
 *
 * También sirve para algo pedagógico: el niño de seis años que arrastra flechas
 * está escribiendo código real sin saberlo, y el día que abra el editor de texto
 * verá que dice lo mismo que sus fichas.
 */
import type { PasoPrograma } from './tipos.js';

/** Traducción de cada ficha a su llamada de la API del Fuzz. */
const LLAMADA: Record<string, string> = {
  derecha: 'fuzz.derecha()',
  izquierda: 'fuzz.izquierda()',
  arriba: 'fuzz.arriba()',
  abajo: 'fuzz.abajo()',
  saltar: 'fuzz.saltar()',
  recoger: 'fuzz.recoger()',
};

export interface ResultadoCompilacion {
  readonly codigo: string;
  /** Número de fichas del programa; es la medida que exige la tercera estrella. */
  readonly tamano: number;
  /** Estructuras usadas, para los criterios de eficiencia de los mundos 29 y 20. */
  readonly estructuras: readonly string[];
}

/**
 * Genera el JavaScript de un programa de fichas.
 * `sangria` existe para que el código anidado dentro de un bucle se lea bien
 * cuando se muestre al niño junto a las fichas.
 */
function generar(
  pasos: readonly PasoPrograma[],
  estructuras: Set<string>,
  sangria = '',
): string[] {
  const lineas: string[] = [];

  for (const paso of pasos) {
    switch (paso.comando) {
      case 'repetir': {
        estructuras.add('repetir');
        const veces = paso.veces ?? 2;
        // Un bucle sin cuerpo no hace nada, pero tampoco debe romper la
        // traducción: se genera vacío y el niño ve que le falta algo dentro.
        const cuerpo = generar(paso.hijos ?? [], estructuras, `${sangria}  `);
        lineas.push(`${sangria}repetir(${veces}, () => {`);
        lineas.push(...(cuerpo.length > 0 ? cuerpo : [`${sangria}  // aqui van las fichas`]));
        lineas.push(`${sangria}});`);
        break;
      }

      case 'siColor': {
        estructuras.add('siColor');
        const color = paso.color ?? 'rojo';
        const cuerpo = generar(paso.hijos ?? [], estructuras, `${sangria}  `);
        lineas.push(`${sangria}if (fuzz.colorCasilla() === '${color}') {`);
        lineas.push(...(cuerpo.length > 0 ? cuerpo : [`${sangria}  // aqui van las fichas`]));
        lineas.push(`${sangria}}`);
        break;
      }

      case 'siSino': {
        estructuras.add('siSino');
        const siCuerpo = generar(paso.hijos ?? [], estructuras, `${sangria}  `);
        const sinoCuerpo = generar(paso.sino ?? [], estructuras, `${sangria}  `);
        lineas.push(`${sangria}if (fuzz.puedeAvanzar()) {`);
        lineas.push(...(siCuerpo.length > 0 ? siCuerpo : [`${sangria}  // aqui van las fichas`]));
        lineas.push(`${sangria}} else {`);
        lineas.push(...(sinoCuerpo.length > 0 ? sinoCuerpo : [`${sangria}  // aqui van las fichas`]));
        lineas.push(`${sangria}}`);
        break;
      }

      case 'funcion': {
        estructuras.add('funcion');
        // El "super salto" del mundo 7: un grupo de fichas con nombre.
        const cuerpo = generar(paso.hijos ?? [], estructuras, `${sangria}  `);
        lineas.push(`${sangria}superSalto();`);
        lineas.push(`${sangria}// superSalto agrupa: ${cuerpo.length} paso(s)`);
        break;
      }

      default: {
        const llamada = LLAMADA[paso.comando];
        if (llamada) lineas.push(`${sangria}${llamada};`);
        break;
      }
    }
  }

  return lineas;
}

/** Cuenta las fichas de un programa, incluidas las anidadas. */
function contarFichas(pasos: readonly PasoPrograma[]): number {
  return pasos.reduce(
    (total, paso) => total + 1 + contarFichas(paso.hijos ?? []) + contarFichas(paso.sino ?? []),
    0,
  );
}

export function compilarFichas(pasos: readonly PasoPrograma[]): ResultadoCompilacion {
  const estructuras = new Set<string>();
  const lineas = generar(pasos, estructuras);

  // Las funciones declaradas por el niño se definen antes del programa.
  const definiciones: string[] = [];
  const superSalto = pasos.find((p) => p.comando === 'funcion');
  if (superSalto) {
    const cuerpo = generar(superSalto.hijos ?? [], estructuras, '  ');
    definiciones.push('function superSalto() {');
    definiciones.push(...(cuerpo.length > 0 ? cuerpo : ['  // aqui van las fichas']));
    definiciones.push('}');
    definiciones.push('');
  }

  return {
    codigo: [...definiciones, ...lineas].join('\n'),
    tamano: contarFichas(pasos),
    estructuras: [...estructuras],
  };
}
