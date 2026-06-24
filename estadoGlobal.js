import { ErrorSimulador } from "./errores.js";

export default class EstadoGlobal {
  constructor(threads) {
    this.probabilidad = 0;
    this.estados = [];
    this.threads = threads;
  }

  informar(estado) {
    this.estados.push(estado);
  }
  mostrarTraza() {
    return this.estados.map(
      (value) => `<div class="elementoTraza">
                    <h3 class="thread">${value.threadLabel()} </h3>
                    <div class="contenedorTraza">
                        <p class="texto">${value.getInstruccion() ?? ""}</p>
                        <p class="operacion">${value.estiloDeOperacion()}</p>
                        <p class="accion">${value.desarrollo()}</p>
                    </div>
            </div>`
    );
  }

  informarEstadoFinalizacionPorMaximoCiclos() {
    this.finalizacion = "limite";
  }

  informarEstadoFinalizacionExitosa() {
    this.finalizacion = "exitosa";
  }

  setProbabilidad(probabilidad) {
    this.probabilidad = probabilidad;
  }

  setModoManual(val) {
    this.modoManual = val;
  }

  decidirQuienSigue() {
    // Si hay un thread en atomic, no sortear — ese thread tiene prioridad
    const enAtomic = this.threads.find(th => th.estaPreparado() && th.estaEnAtomic());
    if (!enAtomic) this.sortearSuerte();
    const preparados = enAtomic ? [enAtomic] : this.threadPreparados();
    if (preparados.length > 0) {
      preparados[0].ejecutarSiguienteInstruccion(this);
    } else {
      // Tick de sleep hasta que alguno despierte o no quede nadie durmiendo
      while (this.threadPreparados().length === 0 && this.threadsDurmiendo().length > 0) {
        this.threadsDurmiendo().forEach(th => th.tickSleep());
      }
      if (this.threadPreparados().length > 0) {
        this.decidirQuienSigue();
      } else if (this.threadsBloqueados().length > 0) {
        this.informarDeadlock();
      } else {
        this.informarEstadoFinalizacionExitosa();
      }
    }
  }

  informarDeadlock() {
    const bloqueados = this.threads
      .filter(th => th.estaBloqueado())
      .map(th => `TH ${th.getId()} : ${th.nombre}`)
      .join(", ");
    throw ErrorSimulador.runtime(`Deadlock: todos los threads están bloqueados y ninguno puede avanzar.\nThreads bloqueados: ${bloqueados}`);
  }

  sortearSuerte() {
    this.threads.sort(() => Math.random() - this.probabilidad);
  }

  resolver() {
    this.threads.forEach(th => th.setEstadoGlobal(this));
    this.decidirQuienSigue();
  }

  // --- Versión generador para modo paso a paso ---

  *resolverGen() {
    this.threads.forEach(th => th.setEstadoGlobal(this));
    yield* this.decidirQuienSigueGen();
  }

  estaEnAtomic() {
    return this.threads.some(th => th.estaPreparado() && th.estaEnAtomic());
  }

  *decidirQuienSigueGen() {
    if (!this.estaEnAtomic()) yield; // pausa acá — el worker inyecta threadIdForzado antes del next()

    const enAtomic = this.threads.find(th => th.estaPreparado() && th.estaEnAtomic());
    let elegido = null;
    if (enAtomic) {
      elegido = enAtomic;
    } else if (this.threadIdForzado !== undefined && this.threadIdForzado !== null) {
      elegido = this.threads.find(th => th.id === this.threadIdForzado && th.estaPreparado()) ?? null;
      this.threadIdForzado = null;
    }
    if (!elegido && !this.modoManual) this.sortearSuerte();
    const preparados = elegido ? [elegido] : this.threadPreparados();
    if (preparados.length > 0) {
      yield* preparados[0].ejecutarSiguienteInstruccionGen();
    } else {
      while (this.threadPreparados().length === 0 && this.threadsDurmiendo().length > 0) {
        this.threadsDurmiendo().forEach(th => th.tickSleep());
      }
      if (this.threadPreparados().length > 0) {
        yield* this.decidirQuienSigueGen();
      } else if (this.threadsBloqueados().length > 0) {
        this.informarDeadlock();
      } else {
        this.informarEstadoFinalizacionExitosa();
      }
    }
  }

  threadPreparados() {
    return this.threads.filter(th => th.estaPreparado());
  }

  threadsDurmiendo() {
    return this.threads.filter(th => th.estaDurmiendo());
  }

  threadsBloqueados() {
    return this.threads.filter(th => th.estaBloqueado());
  }

  // Crea un hilo hijo heredando el contexto del proceso padre.
  // El hijo ve las variables locales del padre (incluyendo canales) como propias.
  lanzarHiloHijo(padre, nombre, instrucciones) {
    const id = this.threads.length;
    const hijo = padre._crearHijoConContexto(id, nombre, instrucciones);
    hijo.padre = padre;
    this.threads.push(hijo);
    hijo.setEstadoGlobal(this);
  }

  terminarHilosHijos(padre) {
    this.threads.forEach(th => {
      if (th.padre === padre && th.estaPreparado()) {
        th.preparado = false;
        th.bloqueado = false;
        th.informar("Terminado", `padre ${padre.nombre} terminó`);
        this.terminarHilosHijos(th);
      }
    });
  }
}
