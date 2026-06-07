import Memoria from "./memoria.js";

/**
 * Cola FIFO de threads bloqueados en una variable de condición.
 * wait()      → encola el thread y suelta el lock del monitor
 * notify()    → desencola el primero y lo pone a competir por el lock
 * notifyAll() → desencola todos y los pone a competir por el lock
 */
export class VariableCondicion {
  constructor(nombre) {
    this.nombre = nombre;
    this.cola   = []; // FIFO de { hilo, instruccionWait }
  }

  hayEsperando() {
    return this.cola.length > 0;
  }

  // El thread se encola y queda bloqueado
  encolar(hilo, instruccionWait) {
    this.cola.push({ hilo, instruccionWait });
    hilo.bloquearEnCondicion(instruccionWait);
  }

  // Desencola el primero y lo pone a competir por el lock del monitor
  notificarUno(instanciaMonitor) {
    if (this.cola.length === 0) return;
    const { hilo, instruccionWait } = this.cola.shift();
    instanciaMonitor.competirPorLock(hilo, instruccionWait);
  }

  // Desencola todos y los pone a competir por el lock
  notificarTodos(instanciaMonitor) {
    while (this.cola.length > 0) {
      const { hilo, instruccionWait } = this.cola.shift();
      instanciaMonitor.competirPorLock(hilo, instruccionWait);
    }
  }
}

/**
 * Definición de un monitor — análogo a Clase pero con lock implícito.
 *
 * nombre            → nombre del monitor
 * atributosDefault  → { nombre: valorInicial }
 * metodos           → { nombre: { params, instrucciones } }
 * constructorDef    → { params, instrucciones } | null
 * condiciones       → [string] nombres de variables de condición declaradas
 */
export class Monitor {
  constructor(nombre, atributosDefault, metodos, constructorDef, condiciones) {
    this.nombre           = nombre;
    this.atributosDefault = atributosDefault;
    this.metodos          = metodos;
    this.constructorDef   = constructorDef;
    this.condiciones      = condiciones; // nombres declarados explícitamente
  }

  tieneMetodo(nombre) {
    return nombre in this.metodos;
  }

  getMetodo(nombre) {
    return this.metodos[nombre];
  }

  /**
   * Crea una nueva InstanciaMonitor con:
   * - su propia memoria de atributos
   * - su propio lock (libre al inicio)
   * - sus propias variables de condición
   */
  instanciar() {
    const mem = new Memoria();
    for (const [nombre, valor] of Object.entries(this.atributosDefault)) {
      mem.agregarVariable(nombre, valor);
    }

    // Crear variables de condición: las declaradas + siempre la implícita "_default"
    const vars = { _default: new VariableCondicion("_default") };
    for (const nombre of this.condiciones) {
      vars[nombre] = new VariableCondicion(nombre);
    }

    return new InstanciaMonitor(this.nombre, mem, vars);
  }

  toString() { return `Monitor(${this.nombre})`; }
}

/**
 * Objeto concreto de un monitor.
 *
 * nombreMonitor     → para lookup de métodos en hilo.monitores
 * memoriaInstancia  → atributos propios
 * variablesCondicion→ { nombre: VariableCondicion }
 * lock              → null si libre, hilo actual si tomado
 * colaLock          → threads esperando para entrar (pelea aleatoria)
 */
export class InstanciaMonitor {
  constructor(nombreMonitor, memoriaInstancia, variablesCondicion) {
    this.nombreMonitor      = nombreMonitor;
    this.memoriaInstancia   = memoriaInstancia;
    this.variablesCondicion = variablesCondicion;
    this.lock               = null;  // hilo que tiene el lock, o null
    this.profundidad        = 0;     // contador de re-entrada
    this.colaLock           = [];    // { hilo, instruccion } esperando el lock
  }

  // Intenta tomar el lock. Si está libre lo toma y devuelve true.
  // Si el mismo hilo ya lo tiene (re-entrada), incrementa profundidad y devuelve true.
  // Si está ocupado por otro, encola el thread y devuelve false.
  intentarTomarLock(hilo, instruccionEntrada) {
    if (this.lock === null) {
      this.lock = hilo;
      this.profundidad = 1;
      hilo.informar("MonitorEntra", `${this.nombreMonitor} — lock tomado`);
      return true;
    }
    if (this.lock === hilo) {
      // Re-entrada: el mismo hilo ya tiene el lock
      this.profundidad++;
      hilo.informar("MonitorEntra", `${this.nombreMonitor} — re-entrada (prof. ${this.profundidad})`);
      return true;
    }
    // Lock ocupado por otro: bloquear el thread
    this.colaLock.push({ hilo, instruccion: instruccionEntrada });
    hilo.bloquearEnMonitor(instruccionEntrada);
    return false;
  }

  // Libera un nivel de re-entrada. Solo suelta el lock cuando profundidad llega a 0.
  liberarLock(hilo) {
    if (this.lock !== hilo) return; // seguridad
    this.profundidad--;
    if (this.profundidad > 0) {
      // Todavía hay niveles de re-entrada activos — no soltar el lock
      hilo.informar("MonitorSale", `${this.nombreMonitor} — salida re-entrada (prof. ${this.profundidad})`);
      return;
    }
    hilo.informar("MonitorSale", `${this.nombreMonitor} — lock liberado`);
    this.lock = null;
    if (this.colaLock.length > 0) {
      this.colaLock.sort(() => Math.random() - 0.5);
      const { hilo: siguiente, instruccion } = this.colaLock.shift();
      this.lock = siguiente;
      this.profundidad = 1;
      siguiente.despertarEnMonitor(instruccion);
      siguiente.informar("MonitorEntra", `${this.nombreMonitor} — lock tomado`);
    }
  }

  // Un thread que estaba en wait() vuelve a competir por el lock.
  competirPorLock(hilo, instruccionWait) {
    if (this.lock === null) {
      // Lock libre: tomar directamente
      this.lock = hilo;
      this.profundidad = 1;
      hilo.despertarEnMonitor(instruccionWait);
      hilo.informar("MonitorEntra", `${this.nombreMonitor} — lock retomado tras notify`);
    } else {
      // Lock ocupado: encolar junto a los otros que esperan
      this.colaLock.push({ hilo, instruccion: instruccionWait });
    }
  }

  getCondicion(nombre) {
    const vc = this.variablesCondicion[nombre];
    if (!vc) throw new Error(`Variable de condición "${nombre}" no existe en ${this.nombreMonitor}`);
    return vc;
  }

  getCondicionDefault() {
    return this.variablesCondicion["_default"];
  }

  toString() { return `[${this.nombreMonitor}]`; }
}
