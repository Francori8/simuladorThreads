import Memoria from "./memoria.js";
import EstadoGlobal from "./estadoGlobal.js";
import { parsear } from "./parser.js";

export default class Simulador {
  constructor() {
    this.estado = null;
    this.mem    = null;
  }

  iniciar(codigo, consola, limiteRepeticiones, probabilidad) {
    this.mem    = new Memoria();
    this.estado = null;

    const threads = parsear(codigo, this.mem, consola, limiteRepeticiones);

    this.estado = new EstadoGlobal(threads);
    this.estado.setProbabilidad(probabilidad);
    this.estado.resolver();
  }

  traza() {
    return this.estado?.mostrarTraza() ?? [];
  }

  variables() {
    return this.mem?.mostrarMemoria() ?? [];
  }

  historialVariablesGlobales() {
    return this.estado?.historialVariablesGlobales() ?? {};
  }

  finalizacion() {
    return this.estado?.finalizacion ?? null;
  }

  trazaTexto() {
    return (this.estado?.estados ?? [])
      .map(e => `${e.threadLabel()} | ${e.estiloDeOperacion()} | ${e.desarrollo()}`)
      .join("\n");
  }
}
