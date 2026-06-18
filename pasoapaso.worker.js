import Simulador from "./simulador.js";
import { parsear } from "./parser.js";
import Memoria from "./memoria.js";
import EstadoGlobal from "./estadoGlobal.js";

// delays en ms para cada nivel del slider (0 = lento, 6 = rápido)
const VELOCIDADES = [1000, 600, 300, 150, 75, 30, 5];

let generador    = null;
let estadoGlobal = null;
let mem          = null;
let consolaVirtual = null;
let modoActual   = "pausado"; // "auto" | "manual" | "pausado" | "terminado"
let velocidad    = 300;
let timeoutId    = null;
let numeroPaso   = 0;
let threadIdElegido = null; // para modo manual: el thread que eligió el usuario

self.onmessage = ({ data }) => {
  switch (data.cmd) {
    case "iniciar":   iniciar(data);   break;
    case "siguiente": siguiente();     break;
    case "elegir":
      threadIdElegido = data.threadId;
      siguiente();
      break;
    case "auto":      activarAuto(data.velocidadIdx ?? 3); break;
    case "pausa":     pausar();        break;
    case "manual":    activarModoManual(); break;
    case "velocidad": setVelocidad(data.idx); break;
    case "cancelar":  cancelar();      break;
  }
};

function iniciar({ codigo, limiteRepeticiones, probabilidad }) {
  consolaVirtual = { lines: [], log(msg) { this.lines.push(msg); } };
  mem = new Memoria();

  try {
    const threads = parsear(codigo, mem, consolaVirtual, limiteRepeticiones);
    estadoGlobal = new EstadoGlobal(threads);
    estadoGlobal.setProbabilidad(probabilidad);
    generador = estadoGlobal.resolverGen();
    numeroPaso = 0;
    modoActual = "pausado";

    // Emitir snapshot inicial (antes de ejecutar nada)
    self.postMessage({
      tipo:     "inicio",
      threads:  snapshotThreads(),
      variables: mem.mostrarMemoria(),
    });
  } catch (e) {
    self.postMessage({ tipo: "error", error: serializarError(e) });
  }
}

function siguiente() {
  if (!generador || modoActual === "terminado") return;
  try {
    if (threadIdElegido !== null) estadoGlobal.threadIdForzado = threadIdElegido;
    const result = generador.next();
    threadIdElegido = null; // consumido
    numeroPaso++;

    const ultimoEstado = estadoGlobal.estados.at(-1);
    self.postMessage({
      tipo:        "paso",
      numeroPaso,
      paso:        ultimoEstado ? serializarEstado(ultimoEstado) : null,
      threads:     snapshotThreads(),
      variables:   mem.mostrarMemoria(),
      consolaLines: [...consolaVirtual.lines],
    });

    if (result.done) {
      modoActual = "terminado";
      self.postMessage({
        tipo:        "fin",
        finalizacion: estadoGlobal.finalizacion ?? "exitosa",
        trazaTexto:  trazaTexto(),
      });
      return;
    }

    // En modo manual, emitir los threads preparados para que el usuario elija
    if (modoActual === "manual") {
      emitirEsperando();
    }
  } catch (e) {
    modoActual = "terminado";
    const ultimoEstado = estadoGlobal?.estados?.at(-1);
    self.postMessage({
      tipo:        "paso",
      numeroPaso,
      paso:        ultimoEstado ? serializarEstado(ultimoEstado) : null,
      threads:     snapshotThreads(),
      variables:   mem?.mostrarMemoria() ?? [],
      consolaLines: [...(consolaVirtual?.lines ?? [])],
    });
    self.postMessage({ tipo: "error", error: serializarError(e) });
  }
}

function emitirEsperando() {
  const preparados = estadoGlobal.threadPreparados().map(th => ({
    id:                 th.id,
    nombre:             th.nombre,
    proximaInstruccion: th.proximaInstruccion?.toString() ?? null,
  }));
  self.postMessage({ tipo: "esperando", threads: preparados });
}

function activarAuto(idx) {
  modoActual = "auto";
  velocidad = VELOCIDADES[idx] ?? 300;
  scheduleProximo();
}

function pausar() {
  modoActual = "pausado";
  clearTimeout(timeoutId);
}

function activarModoManual() {
  clearTimeout(timeoutId);
  modoActual = "manual";
  emitirEsperando();
}

function setVelocidad(idx) {
  velocidad = VELOCIDADES[idx] ?? 300;
}

function cancelar() {
  clearTimeout(timeoutId);
  generador    = null;
  estadoGlobal = null;
  mem          = null;
  modoActual   = "terminado";
}

function scheduleProximo() {
  if (modoActual !== "auto" || !generador) return;
  timeoutId = setTimeout(() => {
    siguiente();
    if (modoActual === "auto") scheduleProximo();
  }, velocidad);
}

// --- Helpers ---

function snapshotThreads() {
  if (!estadoGlobal) return [];
  return estadoGlobal.threads.map(th => ({
    id:     th.id,
    nombre: th.nombre,
    estado: estadoThread(th),
    proximaInstruccion: th.proximaInstruccion?.toString() ?? null,
  }));
}

function estadoThread(th) {
  if (th.estaPreparado())  return "preparado";
  if (th.estaBloqueado())  return "bloqueado";
  if (th.estaDurmiendo())  return "durmiendo";
  return "terminado";
}

function serializarEstado(e) {
  return {
    threadLabel: e.threadLabel(),
    operacion:   e.estiloDeOperacion(),
    desarrollo:  e.desarrollo(),
    instruccion: e.getInstruccion(),
    threadId:    e.threadId(),
  };
}

function serializarError(e) {
  return {
    message:     e.message,
    esSimulador: e?.esSimulador ?? false,
    formateado:  e?.formatear?.() ?? e.message,
  };
}

function trazaTexto() {
  return (estadoGlobal?.estados ?? [])
    .map(e => `${e.threadLabel()} | ${e.estiloDeOperacion()} | ${e.desarrollo()}`)
    .join("\n");
}
