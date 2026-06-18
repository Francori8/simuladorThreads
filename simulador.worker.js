import Simulador from "./simulador.js";

const sim = new Simulador();

self.onmessage = function ({ data }) {
  const { codigo, limiteRepeticiones, probabilidad } = data;

  const consolaVirtual = {
    lines: [],
    log(msg) { this.lines.push(msg); },
  };

  try {
    sim.iniciar(codigo, consolaVirtual, limiteRepeticiones, probabilidad);
    self.postMessage({
      ok:           true,
      consolaLines: consolaVirtual.lines,
      traza:        sim.traza(),
      variables:    sim.variables(),
      finalizacion: sim.finalizacion(),
      trazaTexto:   sim.trazaTexto(),
    });
  } catch (e) {
    self.postMessage({
      ok:           false,
      consolaLines: consolaVirtual.lines,
      error: {
        message:     e.message,
        esSimulador: e?.esSimulador ?? false,
        formateado:  e?.formatear?.() ?? e.message,
      },
      traza:     sim.traza(),
      variables: sim.variables(),
    });
  }
};
