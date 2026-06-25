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
    const estadosAntes = estadoGlobal.estados.length;
    const result = generador.next();

    const estadosNuevos = estadoGlobal.estados.length - estadosAntes;
    const huboInstruccion = estadosNuevos > 0;
    if (huboInstruccion) threadIdElegido = null; // consumido solo si se ejecutó algo real

    // Emitir un mensaje por cada estado nuevo (puede haber varios si hubo atomic)
    for (let i = estadosAntes; i < estadoGlobal.estados.length; i++) {
      numeroPaso++;
      const estado = estadoGlobal.estados[i];
      const esUltimo = i === estadoGlobal.estados.length - 1;
      self.postMessage({
        tipo:        "paso",
        numeroPaso,
        paso:        serializarEstado(estado),
        // Solo mandar snapshot actualizado en el último para no saturar
        threads:     esUltimo ? snapshotThreads() : null,
        variables:   esUltimo ? mem.mostrarMemoria() : null,
        consolaLines: esUltimo ? [...consolaVirtual.lines] : null,
      });
    }

    if (result.done) {
      threadIdElegido = null;
      modoActual = "terminado";
      self.postMessage({
        tipo:        "fin",
        finalizacion: estadoGlobal.finalizacion ?? "exitosa",
        trazaTexto:  trazaTexto(),
      });
      return;
    }

    if (modoActual === "manual") {
      if (!huboInstruccion || estadoGlobal.estaEnAtomic()) {
        // Yield sin instrucción real, o hay un thread en atomic que no puede interrumpirse
        siguiente();
      } else {
        emitirEsperando();
      }
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
  // Si no hay threads preparados para elegir (ej: todos durmiendo), avanzar automático
  if (preparados.length === 0) {
    siguiente();
    return;
  }
  self.postMessage({ tipo: "esperando", threads: preparados });
}

function activarAuto(idx) {
  modoActual = "auto";
  if (estadoGlobal) estadoGlobal.setModoManual(false);
  velocidad = VELOCIDADES[idx] ?? 300;
  scheduleProximo();
}

function pausar() {
  modoActual = "pausado";
  if (estadoGlobal) estadoGlobal.setModoManual(false);
  clearTimeout(timeoutId);
}

function activarModoManual() {
  clearTimeout(timeoutId);
  modoActual = "manual";
  if (estadoGlobal) estadoGlobal.setModoManual(true);
  emitirEsperando();
}

function setVelocidad(idx) {
  velocidad = VELOCIDADES[idx] ?? 300;
  // Si estamos en auto, resetear el timeout para aplicar la nueva velocidad de inmediato
  if (modoActual === "auto") {
    clearTimeout(timeoutId);
    scheduleProximo();
  }
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
