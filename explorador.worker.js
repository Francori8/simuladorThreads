import Explorador from "./explorador.js";

self.onmessage = ({ data }) => {
  const { codigo, limiteRepeticiones, maxCaminos, maxProfundidad } = data;

  try {
    const explorador = new Explorador(codigo, limiteRepeticiones);
    const resultado = explorador.explorar({
      maxCaminos,
      maxProfundidad,
      onProgreso: (caminosExplorados, max) => {
        self.postMessage({ ok: true, tipo: "progreso", caminosExplorados, maxCaminos: max });
      },
    });

    self.postMessage({
      ok: true,
      tipo: "final",
      caminosExplorados: resultado.caminosExplorados,
      truncado: resultado.truncado,
      deadlocks: resultado.deadlocks.map(d => ({ secuencia: d.secuencia, mensaje: d.mensaje })),
      // Map no es clonable por postMessage — convertir a array de pares.
      valoresPorVariable: Object.fromEntries(
        Object.entries(resultado.valoresPorVariable).map(([nombre, mapa]) => [nombre, [...mapa.entries()]])
      ),
    });
  } catch (e) {
    self.postMessage({
      ok: false,
      tipo: "final",
      error: {
        message: e.message,
        esSimulador: e?.esSimulador ?? false,
        formateado: e?.formatear?.() ?? e.message,
      },
    });
  }
};
