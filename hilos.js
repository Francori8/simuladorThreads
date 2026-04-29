import { Ciclo } from "./instrucciones.js";

export default class Hilo {
  constructor(id, cache, memoriaCompartida, bloque) {
    this.id = id;
    this.memoriaLocal = cache;
    this.memoriaCompartida = memoriaCompartida;
    this.bloque = bloque;
    this.proximaInstruccion = bloque.shift();
    this.preparado = true;
    this.estadoGlobal = null;
  }

  setEstadoGlobal(estadoGlobal) {
    this.estadoGlobal = estadoGlobal;
  }

  estaPreparado() { return this.preparado; }

  ejecutarSiguienteInstruccion() {
    this.proximaInstruccion.resolver(this);
    if (this.bloque.length === 0) {
      this.preparado = false;
    } else if (this.proximaInstruccion.estaResuelto()) {
      this.proximaInstruccion = this.bloque.shift();
    }
    this.estadoGlobal.decidirQuienSigue(this);
  }

  // --- Interfaz para las instrucciones ---

  leer(nombre) {
    let valor;
    if (this.memoriaCompartida.hayVariable(nombre)) {
      valor = this.memoriaCompartida.verValor(nombre);
      this.memoriaLocal.agregarVariable(nombre, valor);
    } else {
      valor = this.memoriaLocal.verValor(nombre);
    }
    this.informar("Lectura", `local.${nombre} : ${valor}`);
    return valor;
  }

  escribir(nombre, valor) {
    if (this.memoriaCompartida.hayVariable(nombre)) {
      this.informar("Escritura", `global.${nombre} : ${valor}`);
      this.memoriaCompartida.agregarVariable(nombre, valor);
    } else {
      this.memoriaLocal.agregarVariable(nombre, valor);
    }
  }

  informar(tipo, detalle) {
    this.estadoGlobal.informar(
      new Estado(this.id, tipo, detalle, this.proximaInstruccion?.toString() || "")
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
      this.bloque.unshift(
        new Ciclo(condicion, this.instruccionesHastaElFinalDeBloque(), maximo)
      );
    } else {
      this.borrarHastaFinDeBloqueDesde(0);
    }
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

  // --- Manipulación interna de la cola ---

  borrarProximoCasoFalsoSiExiste() {
    const indice = this.indiceDelBloqueQueCierraActual(0);
    if (this.bloque[indice].esElse()) {
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

class Estado {
  constructor(idThread, operacion, texto, instruccion) {
    this.thread = idThread;
    this.operacion = operacion;
    this.texto = texto;
    this.instruccion = instruccion;
  }

  threadId() { return this.thread; }
  estiloDeOperacion() { return this.operacion; }
  desarrollo() { return this.texto; }
  getInstruccion() { return this.instruccion; }
}
