import { Ciclo, CicloRepeat, CicloForEach, While, EntradaMonitor } from "./instrucciones.js";
import Memoria from "./memoria.js";
import { Semaphore } from "./semaforo.js";
import { ErrorSimulador } from "./errores.js";
import { Instancia } from "./clase.js";
import { InstanciaMonitor } from "./monitor.js";

function esSemaforo(valor) {
  return valor instanceof Semaphore || Array.isArray(valor) && valor[0] instanceof Semaphore;
}

export default class Hilo {
  constructor(id, cache, memoriaCompartida, bloque, funciones = {}, nombre = null, clases = {}, monitores = {}) {
    this.id = id;
    this.nombre = nombre ?? `Thread-${id}`;
    this.memoriaLocal = cache;
    this.memoriaCompartida = memoriaCompartida;
    this.bloque = bloque;
    this.proximaInstruccion = bloque.shift();
    this.preparado = true;
    this.bloqueado = false;
    this._pasosSleep = 0;
    this.estadoGlobal = null;
    this._contexto = [];
    this._callStack = []; // frames de funciones: { bloque, proximaInstruccion, memoriaLocal, llamada }
    this.funciones = funciones; // tabla nombre -> { params, instrucciones }
    this.clases    = clases;   // tabla nombre -> Clase (instancias frescas por hilo)
    this.monitores = monitores; // tabla nombre -> Monitor (instancias frescas por hilo)
  }

  // Crea un hilo hijo que hereda el contexto del proceso padre:
  // - memoriaLocal del padre como memoriaCompartida del hijo (herencia de contexto)
  // - memoriaCompartida global sigue siendo la misma
  // - funciones, clases y monitores se comparten por referencia
  _crearHijoConContexto(id, nombre, instrucciones) {
    const hijo = new Hilo(
      id,
      new Memoria(), // memoria local fresca para el hijo
      this.memoriaCompartida,
      instrucciones,
      this.funciones,
      nombre ?? null,
      this.clases,
      this.monitores,
    );
    // El hijo recibe un snapshot de la memoria local del padre en el momento de ser lanzado.
    // Así cada hijo tiene sus propios valores aunque el padre sobreescriba variables después.
    // Los valores de referencia (canales, instancias) se comparten por referencia — correcto.
    hijo._memoriaContextoPadre = this.memoriaLocal.clonar();
    return hijo;
  }

  setEstadoGlobal(estadoGlobal) {
    this.estadoGlobal = estadoGlobal;
  }

  entrarAtomic() { this._atomicDepth = (this._atomicDepth ?? 0) + 1; }
  salirAtomic()  { if (this._atomicDepth > 0) this._atomicDepth--; }
  estaEnAtomic() { return (this._atomicDepth ?? 0) > 0; }

  estaPreparado()   { return this.preparado; }
  estaBloqueado()   { return this.bloqueado; }
  estaDurmiendo()   { return this._pasosSleep > 0; }

  dormir(n) {
    this.preparado = false;
    this.bloqueado = false;
    this._pasosSleep = n;
  }

  tickSleep() {
    if (this._pasosSleep <= 0) return;
    this._pasosSleep--;
    if (this._pasosSleep === 0) {
      this.preparado = true;
      this.informar("Despertado", "sleep terminado");
    }
  }

  bloquear(instruccionAcquire) {
    this.preparado = false;
    this.bloqueado = true;
    this._acquirePendiente = instruccionAcquire;
    this.informar("Bloqueado", `esperando semáforo`);
  }

  despertar() {
    this.preparado = true;
    this.bloqueado = false;
    this.informar("Despertado", `semáforo liberado`);
    if (this._acquirePendiente) {
      this._acquirePendiente.resolverComoDesbloqueado();
      this._acquirePendiente = null;
    }
  }

  ejecutarSiguienteInstruccion() {
    if (!this.proximaInstruccion.estaResuelto()) {
      this.proximaInstruccion.resolver(this);
    }
    if (this.proximaInstruccion.estaResuelto()) {
      if (this.bloque.length === 0) {
        // Bloque vacío: si hay un frame pendiente es una función sin return explícito
        if (this._callStack.length > 0) {
          this.retornarFuncion(null);
        } else {
          this.preparado = false;
          this.estadoGlobal.terminarHilosHijos(this);
        }
      } else {
        this.proximaInstruccion = this.bloque.shift();
      }
    }
    this.estadoGlobal.decidirQuienSigue();
  }

  // --- Versión generador para modo paso a paso ---

  *ejecutarSiguienteInstruccionGen() {
    if (!this.proximaInstruccion.estaResuelto()) {
      this.proximaInstruccion.resolver(this);
    }
    if (this.proximaInstruccion.estaResuelto()) {
      if (this.bloque.length === 0) {
        if (this._callStack.length > 0) {
          this.retornarFuncion(null);
        } else {
          this.preparado = false;
          this.estadoGlobal.terminarHilosHijos(this);
        }
      } else {
        this.proximaInstruccion = this.bloque.shift();
      }
    }
    yield* this.estadoGlobal.decidirQuienSigueGen();
  }

  // --- Interfaz para las instrucciones ---

  // Devuelve la memoriaInstancia activa si estamos dentro de un método, o null.
  _memoriaInstanciaActiva() {
    for (let i = this._callStack.length - 1; i >= 0; i--) {
      if (this._callStack[i].memoriaInstancia) return this._callStack[i].memoriaInstancia;
    }
    return null;
  }

  // Devuelve la Instancia activa (para resolver `this`), o null si no hay.
  getInstanciaActiva() {
    for (let i = this._callStack.length - 1; i >= 0; i--) {
      if (this._callStack[i].instanciaActiva) return this._callStack[i].instanciaActiva;
    }
    return null;
  }

  // Devuelve la InstanciaMonitor activa del frame actual (para wait/notify).
  getMonitorActivo() {
    for (let i = this._callStack.length - 1; i >= 0; i--) {
      if (this._callStack[i].instanciaMonitor) return this._callStack[i].instanciaMonitor;
    }
    return null;
  }

  // Bloquea el thread esperando el lock del monitor
  bloquearEnMonitor(instruccionEntrada) {
    this.preparado = false;
    this.bloqueado = true;
    this._pendiente = instruccionEntrada;
    this.informar("MonitorEspera", `esperando lock`);
  }

  // Bloquea el thread esperando en receive() de un canal
  bloquearEnCanal(instruccionReceive) {
    this.preparado = false;
    this.bloqueado = true;
    this._pendiente = instruccionReceive;
    this.informar("CanalEspera", `bloqueado esperando receive`);
  }

  // Despierta desde receive(), pasando el valor recibido
  despertarDelCanal(instruccionReceive, valor) {
    this.preparado = true;
    this.bloqueado = false;
    instruccionReceive.resolverComoDesbloqueado(valor);
    this._pendiente = null;
    this.informar("CanalReceive", `recibido: ${valor}`);
  }

  // Bloquea el thread en una variable de condición
  bloquearEnCondicion(instruccionWait) {
    this.preparado = false;
    this.bloqueado = true;
    this._pendiente = instruccionWait;
    this.informar("CondEspera", `bloqueado en condición`);
  }

  // Despierta el thread (desde monitor o condición)
  despertarEnMonitor(instruccion) {
    this.preparado = true;
    this.bloqueado = false;
    instruccion.resolverComoDesbloqueado();
    this._pendiente = null;
  }

  leer(nombre) {
    let valor;
    let scope;
    // Orden: local → instancia activa → contexto padre (si es hilo hijo) → global
    if (this.memoriaLocal.hayVariable(nombre)) {
      valor = this.memoriaLocal.verValor(nombre);
      scope = "local";
    } else {
      const instMem = this._memoriaInstanciaActiva();
      if (instMem && instMem.hayVariable(nombre)) {
        valor = instMem.verValor(nombre);
        if (!esSemaforo(valor)) {
          this.informar("Lectura", `instancia.${nombre} : ${valor}`);
        }
        return valor;
      } else if (this._memoriaContextoPadre && this._memoriaContextoPadre.hayVariable(nombre)) {
        valor = this._memoriaContextoPadre.verValor(nombre);
        scope = "proceso";
      } else if (this.memoriaCompartida.hayVariable(nombre)) {
        valor = this.memoriaCompartida.verValor(nombre);
        scope = "global";
      } else {
        throw ErrorSimulador.runtime(
          `Variable "${nombre}" no está declarada`,
          this.id,
          this.proximaInstruccion?.toString()
        );
      }
    }
    if (!esSemaforo(valor)) {
      this.informar("Lectura", `${scope}.${nombre} : ${valor}`);
    }
    return valor;
  }

  escribir(nombre, valor) {
    // Orden: local → instancia activa → contexto padre (si es hilo hijo) → global → crea en local
    if (this.memoriaLocal.hayVariable(nombre)) {
      this.memoriaLocal.agregarVariable(nombre, valor);
      this.informar("Escritura", `local.${nombre} : ${valor}`);
    } else {
      const instMem = this._memoriaInstanciaActiva();
      if (instMem && instMem.hayVariable(nombre)) {
        this.informar("Escritura", `instancia.${nombre} : ${valor}`);
        instMem.agregarVariable(nombre, valor);
      } else if (this._memoriaContextoPadre && this._memoriaContextoPadre.hayVariable(nombre)) {
        this._memoriaContextoPadre.agregarVariable(nombre, valor);
        this.informar("Escritura", `proceso.${nombre} : ${valor}`);
      } else if (this.memoriaCompartida.hayVariable(nombre)) {
        this.informar("Escritura", `global.${nombre} : ${valor}`);
        this.memoriaCompartida.agregarVariable(nombre, valor);
      } else {
        this.memoriaLocal.agregarVariable(nombre, valor);
      }
    }
  }

  pushContexto(instruccion) { this._contexto.push(instruccion); }
  popContexto() { this._contexto.pop(); }

  informar(tipo, detalle) {
    const ctx = this._contexto.length > 0 ? this._contexto.at(-1) : this.proximaInstruccion;
    this.estadoGlobal.informar(
      new Estado(this.id, this.nombre, tipo, detalle, ctx?.toString() || "")
    );
  }

  evaluar(string) {
    if (this.memoriaLocal.hayVariable(string)) return this.memoriaLocal.verValor(string);
    return eval(string);
  }

  declararLocal(string, fmemoria) {
    fmemoria(string, this.memoriaLocal);
  }

  // --- Control de flujo ---

  resolverCondicional(valor) {
    if (valor) {
      this.borrarProximoCasoFalsoSiExiste();
    } else {
      this.irHastaElElseSiExiste();
    }
  }

  resolverWhile(condicion, valor, maximo) {
    if (valor) {
      const cuerpo = this.prepararCuerpo(this.instruccionesHastaElFinalDeBloque(), maximo);
      this.bloque.unshift(new Ciclo(condicion, cuerpo, maximo));
    } else {
      this.borrarHastaFinDeBloqueDesde(0);
    }
  }

  resolverRepeat(n, maximo) {
    if (n > 0) {
      const cuerpo = this.prepararCuerpo(this.instruccionesHastaElFinalDeBloque(), maximo);
      const ciclo = new CicloRepeat(cuerpo, maximo);
      ciclo.iniciar(n);
      this.bloque.unshift(ciclo);
    } else {
      this.borrarHastaFinDeBloqueDesde(0);
    }
  }

  resolverFor(condicion, incremento, valor, maximo) {
    if (valor) {
      const cuerpo = this.instruccionesHastaElFinalDeBloque();
      cuerpo.splice(cuerpo.length - 1, 0, incremento);
      const cuerpoPreparado = this.prepararCuerpo(cuerpo, maximo);
      this.bloque.unshift(new Ciclo(condicion, cuerpoPreparado, maximo));
    } else {
      this.borrarHastaFinDeBloqueDesde(0);
    }
  }

  resolverForEach(nombreVar, lista, maximo) {
    if (lista.length > 0) {
      const cuerpo = this.prepararCuerpo(this.instruccionesHastaElFinalDeBloque(), maximo);
      const ciclo = new CicloForEach(nombreVar, lista, cuerpo, maximo);
      this.bloque.unshift(ciclo);
    } else {
      this.borrarHastaFinDeBloqueDesde(0);
    }
  }

  // Convierte While anidados en Ciclo antes de armar el ListaCircular,
  // ya que dentro de un Ciclo no se puede usar hilo.bloque para buscar el cuerpo.
  prepararCuerpo(bloque, maximo) {
    const resultado = [];
    let i = 0;
    while (i < bloque.length) {
      const instr = bloque[i];
      if (instr instanceof While) {
        let depth = 1, j = i + 1;
        while (depth > 0 && j < bloque.length) {
          if (bloque[j].esInstruccionConBloque()) depth++;
          if (bloque[j].esElse() || bloque[j].esFinDeBloque()) depth--;
          j++;
        }
        const cuerpoInterno = this.prepararCuerpo(bloque.slice(i + 1, j), maximo);
        resultado.push(new Ciclo(instr.condicion, cuerpoInterno, maximo));
        i = j;
      } else {
        resultado.push(instr);
        i++;
      }
    }
    return resultado;
  }

  getId() { return this.id; }

  leerIndexado(nombre, indice) {
    let arr;
    if (this.memoriaCompartida.hayVariable(nombre)) {
      arr = this.memoriaCompartida.verValor(nombre);
      if (!esSemaforo(arr)) {
        this.memoriaLocal.agregarVariable(nombre, [...arr]);
      }
    } else if (this.memoriaLocal.hayVariable(nombre)) {
      arr = this.memoriaLocal.verValor(nombre);
    } else {
      throw ErrorSimulador.runtime(
        `Variable "${nombre}" no está declarada`,
        this.id,
        this.proximaInstruccion?.toString()
      );
    }
    if (!Array.isArray(arr) && !(arr instanceof Semaphore)) {
      throw ErrorSimulador.runtime(
        `"${nombre}" no es una lista (es ${typeof arr})`,
        this.id,
        this.proximaInstruccion?.toString()
      );
    }
    if (Array.isArray(arr) && (indice < 0 || indice >= arr.length)) {
      throw ErrorSimulador.runtime(
        `Índice ${indice} fuera de rango en "${nombre}" (tamaño ${arr.length})`,
        this.id,
        this.proximaInstruccion?.toString()
      );
    }
    const valor = arr[indice];
    if (!esSemaforo(valor)) {
      this.informar("Lectura[]", `${nombre}[${indice}] : ${valor}`);
    }
    return valor;
  }

  escribirIndexado(nombre, indice, valor) {
    if (this.memoriaCompartida.hayVariable(nombre)) {
      const arr = [...this.memoriaCompartida.verValor(nombre)];
      arr[indice] = valor;
      this.informar("Escritura[]", `global.${nombre}[${indice}] : ${valor}`);
      this.memoriaCompartida.agregarVariable(nombre, arr);
    } else {
      const arr = [...this.memoriaLocal.verValor(nombre)];
      arr[indice] = valor;
      this.memoriaLocal.agregarVariable(nombre, arr);
    }
  }

  escribirLocal(nombre, valor) {
    this.informar("Iteracion", `local.${nombre} : ${valor}`);
    this.memoriaLocal.agregarVariable(nombre, valor);
  }

  resolverSeguirCiclo(valor, ciclo) {
    if (valor) {
      ciclo.reiniciar();
    } else {
      ciclo.terminado();
    }
  }

  resolverMaximoCiclos() {
    this.estadoGlobal.informarEstadoFinalizacionPorMaximoCiclos();
  }

  // --- Call stack de funciones ---

  llamarFuncion(nombre, params, instruccionesTemplate, valores, instruccionLlamada, esAtomica = false) {
    this._callStack.push({
      bloque:              this.bloque,
      proximaInstruccion:  this.proximaInstruccion,
      memoriaLocal:        this.memoriaLocal,
      memoriaInstancia:    null,
      llamada:             instruccionLlamada,
      atomic:              esAtomica,
    });

    const nuevoFrame = new Memoria();
    params.forEach((p, i) => nuevoFrame.agregarVariable(p, valores[i] ?? null));

    // Reiniciar instrucciones antes de ejecutar — el mismo hilo puede llamar
    // la función varias veces y las instrucciones quedan resuelto=true de la vez anterior
    instruccionesTemplate.forEach(i => i.reiniciarParaLlamada ? i.reiniciarParaLlamada() : i.reiniciar());
    const cuerpo = [...instruccionesTemplate];

    if (cuerpo.length === 0) {
      instruccionLlamada.resolve(null);
      return;
    }

    this.bloque             = cuerpo;
    this.proximaInstruccion = this.bloque.shift();
    this.memoriaLocal       = nuevoFrame;
  }

  llamarMetodo(nombre, params, instruccionesTemplate, valores, instancia, instruccionLlamada) {
    this._callStack.push({
      bloque:              this.bloque,
      proximaInstruccion:  this.proximaInstruccion,
      memoriaLocal:        this.memoriaLocal,
      memoriaInstancia:    instancia.memoriaInstancia,
      instanciaActiva:     instancia, // para resolver `this`
      llamada:             instruccionLlamada,
    });

    const nuevoFrame = new Memoria();
    params.forEach((p, i) => nuevoFrame.agregarVariable(p, valores[i] ?? null));

    // Reiniciar instrucciones antes de ejecutar
    instruccionesTemplate.forEach(i => i.reiniciarParaLlamada ? i.reiniciarParaLlamada() : i.reiniciar());
    const cuerpo = [...instruccionesTemplate];

    if (cuerpo.length === 0) {
      instruccionLlamada.resolve(null);
      return;
    }

    this.bloque             = cuerpo;
    this.proximaInstruccion = this.bloque.shift();
    this.memoriaLocal       = nuevoFrame;
  }

  // Llama a un método de monitor: antepone EntradaMonitor (toma el lock).
  // El lock se libera en retornarFuncion() al detectar frame.instanciaMonitor.
  llamarMetodoMonitor(nombre, params, instruccionesTemplate, valores, instanciaMonitor, instruccionLlamada) {
    this._callStack.push({
      bloque:              this.bloque,
      proximaInstruccion:  this.proximaInstruccion,
      memoriaLocal:        this.memoriaLocal,
      memoriaInstancia:    instanciaMonitor.memoriaInstancia,
      instanciaActiva:     null,
      instanciaMonitor:    instanciaMonitor,
      llamada:             instruccionLlamada,
    });

    const nuevoFrame = new Memoria();
    params.forEach((p, i) => nuevoFrame.agregarVariable(p, valores[i] ?? null));

    instruccionesTemplate.forEach(i => i.reiniciarParaLlamada ? i.reiniciarParaLlamada() : i.reiniciar());

    // EntradaMonitor toma el lock (o bloquea si está ocupado).
    // El lock se libera siempre en retornarFuncion() al detectar frame.instanciaMonitor.
    const entrada = new EntradaMonitor(new _LiteralInstancia(instanciaMonitor));
    const cuerpo  = [entrada, ...instruccionesTemplate];

    this.bloque             = cuerpo;
    this.proximaInstruccion = this.bloque.shift();
    this.memoriaLocal       = nuevoFrame;
  }

  retornarFuncion(valor) {
    if (this._callStack.length === 0) {
      // return en top-level — ignorar
      this.preparado = false;
      return;
    }
    const frame = this._callStack.pop();
    if (frame.atomic) this.salirAtomic();
    // Si era un frame de monitor, liberar el lock antes de restaurar
    if (frame.instanciaMonitor) {
      frame.instanciaMonitor.liberarLock(this);
    }
    // Restaurar estado del llamador
    this.bloque             = frame.bloque;
    this.proximaInstruccion = frame.proximaInstruccion;
    this.memoriaLocal       = frame.memoriaLocal;
    // Notificar a la LlamadaFuncion que ya terminó
    frame.llamada.resolve(valor);
  }

  // --- Manipulación interna de la cola ---

  borrarProximoCasoFalsoSiExiste() {
    const indice = this.indiceDelBloqueQueCierraActual(0);
    if (this.bloque[indice] && this.bloque[indice].esElse()) {
      this.borrarHastaFinDeBloqueDesde(indice);
    }
  }

  indiceDelBloqueQueCierraActual(indice) {
    let i = indice;
    let cantBloques = 1;
    while (cantBloques > 0) {
      if (this.bloque[i].esInstruccionConBloque()) cantBloques++;
      if (this.bloque[i].esElse() || this.bloque[i].esFinDeBloque()) cantBloques--;
      i++;
    }
    return i;
  }

  instruccionesHastaElFinalDeBloque() {
    return this.bloque.splice(0, this.indiceDelBloqueQueCierraActual(0));
  }

  borrarHastaFinDeBloqueDesde(indice) {
    this.bloque.splice(indice, this.indiceDelBloqueQueCierraActual(indice));
  }

  irHastaElElseSiExiste() {
    this.bloque.splice(0, this.indiceDelBloqueQueCierraActual(0));
  }
}

// Expresión que resuelve directamente a un valor ya conocido (sin pasar por el hilo).
// Usada internamente para pasar la InstanciaMonitor a EntradaMonitor.
class _LiteralInstancia {
  constructor(valor) {
    this.valor    = valor;
    this.resuelto = false;
  }
  estaResuelto()  { return this.resuelto; }
  reiniciar()     { this.resuelto = false; }
  resolver(_hilo) { this.resuelto = true; }
  resolverPuro()  { return this.valor; }
  toString()      { return `${this.valor}`; }
}

class Estado {
  constructor(idThread, nombreThread, operacion, texto, instruccion) {
    this.thread = idThread;
    this.nombre = nombreThread;
    this.operacion = operacion;
    this.texto = texto;
    this.instruccion = instruccion;
  }

  threadId() { return this.thread; }
  threadLabel() { return this.nombre ? `TH ${this.thread} : ${this.nombre}` : `TH : ${this.thread}`; }
  estiloDeOperacion() { return this.operacion; }
  desarrollo() { return this.texto; }
  getInstruccion() { return this.instruccion; }
}
