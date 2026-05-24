import { Ciclo, CicloRepeat, CicloForEach, While } from "./instrucciones.js";

export default class Hilo {
  constructor(id, cache, memoriaCompartida, bloque, nombre = null) {
    this.id = id;
    this.nombre = nombre ?? `Thread-${id}`;
    this.memoriaLocal = cache;
    this.memoriaCompartida = memoriaCompartida;
    this.bloque = bloque;
    this.proximaInstruccion = bloque.shift();
    this.preparado = true;
    this.estadoGlobal = null;
    this._contexto = [];
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

  pushContexto(instruccion) { this._contexto.push(instruccion); }
  popContexto() { this._contexto.pop(); }

  informar(tipo, detalle) {
    const ctx = this._contexto.length > 0 ? this._contexto.at(-1) : this.proximaInstruccion;
    this.estadoGlobal.informar(
      new Estado(this.id, tipo, detalle, ctx?.toString() || "")
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
      this.memoriaLocal.agregarVariable(nombre, [...arr]);
    } else {
      arr = this.memoriaLocal.verValor(nombre);
    }
    const valor = arr[indice];
    this.informar("Lectura[]", `${nombre}[${indice}] : ${valor}`);
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
