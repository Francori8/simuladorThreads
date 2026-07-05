import Memoria, { formatearAtributos } from "./memoria.js";

/**
 * Representa la definición de una clase.
 * Es compartida entre todas las instancias del mismo tipo — no hay una copia por instancia.
 *
 * nombre           → nombre de la clase (ej: "Contador")
 * atributosDefault → map nombre → valor inicial declarado en el cuerpo de la clase
 * metodos          → tabla nombre → { params: string[], instrucciones: Instruccion[] }
 * constructorDef   → { params: string[], instrucciones: Instruccion[] } o null
 */
export class Clase {
  constructor(nombre, atributosDefault, metodos, constructorDef) {
    this.nombre           = nombre;
    this.atributosDefault = atributosDefault; // { nombre: valorInicial }
    this.metodos          = metodos;          // { nombre: { params, instrucciones } }
    this.constructorDef   = constructorDef;   // { params, instrucciones } | null
  }

  tieneMetodo(nombre) {
    return nombre in this.metodos;
  }

  getMetodo(nombre) {
    return this.metodos[nombre];
  }

  /**
   * Crea una nueva Instancia de esta clase.
   * Cada instancia recibe su propia Memoria con los atributos copiados desde los defaults.
   */
  instanciar() {
    const mem = new Memoria();
    for (const [nombre, valor] of Object.entries(this.atributosDefault)) {
      // Si el atributo default es una Instancia, clonarla para que cada
      // objeto externo tenga su propia instancia interna independiente
      mem.agregarVariable(nombre, valor instanceof Instancia ? valor.clonar() : valor);
    }
    return new Instancia(this.nombre, mem);
  }

  toString() {
    return `Clase(${this.nombre})`;
  }
}

/**
 * Representa un objeto concreto (una instancia de una Clase).
 *
 * nombreClase      → nombre de la clase, para lookup en la tabla de clases del hilo
 * memoriaInstancia → Memoria propia con los atributos de este objeto
 *
 * El lookup de métodos se hace en runtime a través del hilo (hilo.clases[nombreClase]),
 * así cada hilo usa sus propias instancias frescas de instrucciones y no hay estado compartido.
 */
export class Instancia {
  constructor(nombreClase, memoriaInstancia) {
    this.nombreClase      = nombreClase;
    this.memoriaInstancia = memoriaInstancia;
  }

  // Crea una copia profunda de esta instancia — mismos atributos, memoria propia.
  // Se usa cuando una instancia es atributo default de una clase: cada objeto
  // externo necesita su propia copia de la instancia interna.
  clonar() {
    const mem = new Memoria();
    for (const variable of this.memoriaInstancia.contenido) {
      const valor = variable.verValor();
      mem.agregarVariable(variable.nombre, valor instanceof Instancia ? valor.clonar() : valor);
    }
    return new Instancia(this.nombreClase, mem);
  }

  toString(profundidad = 0) {
    if (profundidad >= 3) return `[${this.nombreClase}]`;
    const atributos = formatearAtributos(this.memoriaInstancia, profundidad, (valor, p) =>
      valor instanceof Instancia ? valor.toString(p + 1) : valor
    );
    return `${this.nombreClase}(${atributos})`;
  }
}
