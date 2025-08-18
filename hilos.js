import { Ciclo } from "./instrucciones.js";

export default class Hilo {
  constructor(id, cache, memoriaCompartida, bloque, estadoGlobal) {
    this.id = id;
    this.constantesParaMemoria = {};
    this.memoriaLocal = cache;
    this.memoriaCompartida = memoriaCompartida;
    this.bloque = bloque;
    this.proximaInstruccion = bloque.shift();
    this.preparado = true;
    this.contexto = this;
    this.memoriaLocal.agregarVariable("OP", []);
    this.estadoGlobal = estadoGlobal; // Nueva referencia al estado global
  }

  conId(id) {
    return this.id === id;
  }

  setEstadoGlobal(estadoGlobal) {
    this.estadoGlobal = estadoGlobal;
  }

  ejecutarSiguienteInstruccion() {
    this.ejecutarInstruccionActual();
    if (this.bloque.length == 0) {
      this.preparado = false;
      this.estadoGlobal.decidirQuienSigue(this);
    } else {
      if (this.proximaInstruccion.estaResuelto()) {
        this.proximaInstruccion = this.bloque.shift();
      }
      this.estadoGlobal.decidirQuienSigue(this);
    }
  }

  ejecutarInstruccionActual() {
    console.log("ejecutado", this.proximaInstruccion, this);
    this.proximaInstruccion.resolver(this);
  }

  estaPreparado() {
    return this.preparado;
  }

  resolverLectura(valor) {
    let valorLectura;
    if (this.memoriaCompartida.hayVariable(valor)) {
      valorLectura = this.memoriaCompartida.verValor(valor);
      this.estadoGlobal.informar(
        new Estado(
          this.id,
          "Lectura",
          `local.${valor} : ${valorLectura}`,
          this.proximaInstruccion?.toString() || ""
        )
      );
      this.memoriaLocal.agregarVariable(valor, valorLectura);
      // Si es una variable global, se guarda en memoria local
    } else {
      valorLectura = this.memoriaLocal.verValor(valor);
      this.estadoGlobal.informar(
        new Estado(
          this.id,
          "Lectura",
          `local.${valor} : ${valorLectura}`,
          this.proximaInstruccion?.toString() || ""
        )
      );
      this.memoriaLocal.agregarVariable(valor, valorLectura);
    }
  }

  resolverSegunValorFijo(valor) {
    if (valor === "}") {
      return;
    }
    if (this.memoriaLocal.hayVariable(valor)) {
      return this.memoriaLocal.verValor(valor);
    }
    eval(valor);
  }

  resolverConImprimir(valor) {
    this.estadoGlobal.informar(new Estado(this.id, "Imprimir", valor));
  }

  resolverConSuma(valor, valor1) {
    let primerValor = valor.resolverPuro(this);
    let segundoValor = valor1.resolverPuro(this);
    this.estadoGlobal.informar(
      new Estado(
        this.id,
        "OP arit",
        `local.OP : ${
          primerValor + segundoValor
        } (${primerValor} + ${segundoValor})`
      )
    );
    this.memoriaLocal.verValor("OP").push(primerValor + segundoValor);
  }

  resolverDeclaracionVariableLocal(valor, fmemoria) {
    fmemoria(valor, this.memoriaLocal);
  }

  resolverEscritura(nombre, valor) {
    const valorAEscribir = valor.resolverPuro(this);

    if (!this.memoriaCompartida.hayVariable(nombre)) {
      this.memoriaLocal.agregarVariable(nombre, valorAEscribir);
    } else {
      this.estadoGlobal.informar(
        new Estado(this.id, "Escritura", `global.${nombre} : ${valorAEscribir}`)
      );
      this.memoriaCompartida.agregarVariable(nombre, valorAEscribir);
    }
  }

  resolverConIgualdad(vIzquierdo, vDerecho) {
    const valorIzquierdo = vIzquierdo.resolverPuro(this);
    const valorDerecho = vDerecho.resolverPuro(this);
    this.estadoGlobal.informar(
      new Estado(
        this.id,
        "OP bool",
        `local.OP : ${
          valorIzquierdo == valorDerecho
        } (${valorIzquierdo} == ${valorDerecho})`
      )
    );
    this.memoriaLocal.verValor("OP").push(valorIzquierdo == valorDerecho);
  }

  resolverConMayor(vIzquierdo, vDerecho) {
    const valorIzquierdo = vIzquierdo.resolverPuro(this);
    const valorDerecho = vDerecho.resolverPuro(this);
    this.estadoGlobal.informar(
      new Estado(
        this.id,
        "OP bool",
        `local.OP : ${
          valorIzquierdo > valorDerecho
        } (${valorIzquierdo} > ${valorDerecho})`
      )
    );
    this.memoriaLocal.verValor("OP").push(valorIzquierdo > valorDerecho);
  }

  resolverMayorOIgualdad(vIzquierdo, vDerecho) {
    const valorIzquierdo = vIzquierdo.resolverPuro(this);
    const valorDerecho = vDerecho.resolverPuro(this);
    this.estadoGlobal.informar(
      new Estado(
        this.id,
        "OP bool",
        `local.OP : ${
          valorIzquierdo >= valorDerecho
        } (${valorIzquierdo} >= ${valorDerecho})`
      )
    );
    this.memoriaLocal.verValor("OP").push(valorIzquierdo >= valorDerecho);
  }

  resolverMenor(vIzquierdo, vDerecho) {
    const valorIzquierdo = vIzquierdo.resolverPuro(this);
    const valorDerecho = vDerecho.resolverPuro(this);
    this.estadoGlobal.informar(
      new Estado(
        this.id,
        "OP bool",
        `local.OP : ${
          valorIzquierdo < valorDerecho
        } (${valorIzquierdo} < ${valorDerecho})`
      )
    );
    this.memoriaLocal.verValor("OP").push(valorIzquierdo < valorDerecho);
  }

  resolverMenorOIgual(vIzquierdo, vDerecho) {
    const valorIzquierdo = vIzquierdo.resolverPuro(this);
    const valorDerecho = vDerecho.resolverPuro(this);
    this.estadoGlobal.informar(
      new Estado(
        this.id,
        "OP bool",
        `local.OP : ${
          valorIzquierdo <= valorDerecho
        } (${valorIzquierdo} <= ${valorDerecho})`
      )
    );
    this.memoriaLocal.verValor("OP").push(valorIzquierdo <= valorDerecho);
  }

  resolverYLogico(vIzquierdo, vDerecho) {
    const valorIzquierdo = vIzquierdo.resolverPuro(this);
    const valorDerecho = vDerecho.resolverPuro(this);
    this.estadoGlobal.informar(
      new Estado(
        this.id,
        "OP bool",
        `local.OP : ${
          valorIzquierdo && valorDerecho
        } (${valorIzquierdo} && ${valorDerecho})`
      )
    );
    this.memoriaLocal.verValor("OP").push(valorIzquierdo && valorDerecho);
  }

  resolverOLogico(vIzquierdo, vDerecho) {
    const valorIzquierdo = vIzquierdo.resolverPuro(this);
    const valorDerecho = vDerecho.resolverPuro(this);
    this.estadoGlobal.informar(
      new Estado(
        this.id,
        "OP bool",
        `local.OP : ${
          valorIzquierdo || valorDerecho
        } (${valorIzquierdo} || ${valorDerecho})`
      )
    );
    this.memoriaLocal.verValor("OP").push(valorIzquierdo || valorDerecho);
  }

  resolverCondicional(condicion) {
    if (condicion.resolverPuro(this)) {
      this.borrarProximoCasoFalsoSiExiste();
    } else {
      this.irHastaElElseSiExiste();
    }
  }

  resolverWhile(condicion, maximo) {
    if (condicion.resolverPuro(this)) {
      this.bloque.unshift(
        new Ciclo(condicion, this.instruccionesHastaElFinalDeBloque(), maximo)
      );
    } else {
      this.borrarHastaFinDeBloqueDesde(0);
    }
  }

  resolverMaximoCiclos() {
    this.estadoGlobal.informarEstadoFinalizacionPorMaximoCiclos();
  }

  resolverSeguirCiclo(condicion, ciclo) {
    const valorCondicion = condicion.resolverPuro(this);
    console.log("valor condicion", valorCondicion);

    if (valorCondicion) {
      ciclo.reiniciar();
    } else {
      ciclo.terminado();
    }
  }

  resolverFinDeBloque() {
    console.log("final bloque");
  }

  valorLocalDe(nombre) {
    if (nombre === "OP") {
      const valor = this.memoriaLocal.verValor("OP").shift();

      return valor;
    }
    if (this.memoriaLocal.hayVariable(nombre)) {
      return this.memoriaLocal.verValor(nombre);
    }
    if (this.memoriaCompartida.hayVariable(nombre)) {
      return this.memoriaCompartida.verValor(nombre);
    }

    return this.memoriaLocal.verValor(nombre);
  }

  valorFijoSegun(valor) {
    if (this.memoriaLocal.hayVariable(valor)) {
      return this.memoriaLocal.verValor(valor);
    }

    return eval(valor);
  }

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
      if (this.bloque[i].esInstruccionConBloque()) {
        cantBloques++;
      }
      if (this.bloque[i].esElse() || this.bloque[i].esFinDeBloque()) {
        cantBloques--;
      }

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
    this.instruccion = instruccion; // NUEVO: instrucción completa
  }

  threadId() {
    return this.thread;
  }
  estiloDeOperacion() {
    return this.operacion;
  }

  desarrollo() {
    return this.texto;
  }

  getInstruccion() {
    return this.instruccion; // NUEVO: método para obtener la instrucción
  }
}
