export default class EstadoGlobal {
  constructor(threads) {
    this.probabilidad = 0;
    this.estados = [];
    this.threads = threads;
  }

  informar(estado) {
    this.estados.push(estado);
  }
  mostrarEstadoDeFinalizacion() {
    return this.finalizacion.estado();
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
    console.log("Maximo ciclos alcanzado");
  }

  informarEstadoFinalizacionExitosa() {
    console.log("Finalizacion Exitosa");
  }

  setProbabilidad(probabilidad) {
    this.probabilidad = probabilidad;
  }

  decidirQuienSigue(thread) {
    this.sortearSuerte();
    const preparados = this.threadPreparados();
    if (preparados.length === 0) {
      const bloqueados = this.threads.filter(th => th.estaBloqueado());
      if (bloqueados.length > 0) {
        this.informarDeadlock();
      } else {
        this.informarEstadoFinalizacionExitosa();
      }
    } else {
      preparados[0].ejecutarSiguienteInstruccion(this);
    }
  }

  informarDeadlock() {
    console.warn("DEADLOCK: todos los threads están bloqueados esperando un semáforo.");
  }

  sortearSuerte() {
    this.threads.sort(() => Math.random() - this.probabilidad);
  }

  resolver() {
    this.sortearSuerte();
    this.threads.forEach((thread) => thread.setEstadoGlobal(this));

    const preparados = this.threadPreparados();
    if (preparados.length === 0) return;
    preparados[0].ejecutarSiguienteInstruccion(this);
  }

  threadPreparados() {
    return this.threads.filter((th) => th.estaPreparado());
  }
}
