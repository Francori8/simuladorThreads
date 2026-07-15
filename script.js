import ejemplos from "./ejemplo.js";
import { iniciarModoStepByStep, cerrarModoStepByStep } from "./pasoapaso.js";
import { iniciarTour } from "./tour.js";
import { generarLinkCompartir, leerCodigoDesdeUrl } from "./compartir.js";

const PASOS_TOUR = [
  {
    selector: "#panel-ejemplos",
    titulo: "Ejemplos",
    texto: "Elegí un ejemplo predefinido para cargarlo en el editor y entender rápido qué hace el simulador.",
    posicion: "right",
  },
  {
    selector: "#codigo",
    titulo: "Editor de código",
    texto: "Acá escribís el programa concurrente: threads, semáforos, monitores y canales.",
    posicion: "bottom",
  },
  {
    selector: "#ejecutar",
    titulo: "Ejecutar",
    texto: "Corre el programa de una sola vez con un scheduling aleatorio y muestra el resultado.",
    posicion: "top",
  },
  {
    selector: "#btn-pasoapaso",
    titulo: "Paso a paso",
    texto: "Ejecutá el mismo programa instrucción por instrucción para ver cómo se intercalan los threads.",
    posicion: "top",
  },
  {
    selector: "#btn-comparar",
    titulo: "Comparar ejecuciones",
    texto: "Corré el mismo código dos veces con schedulings distintos para ver el no-determinismo en acción.",
    posicion: "top",
  },
  {
    selector: "#btn-compartir",
    titulo: "Compartir",
    texto: "Copia un link que abre el simulador con este mismo código ya cargado, ideal para mandarle un ejemplo a alguien.",
    posicion: "top",
  },
  {
    selector: "#porcentaje",
    titulo: "Probabilidad de cambio de thread",
    texto: "Controla qué tan seguido el scheduler cambia de thread: más interleaving o más ejecución secuencial.",
    posicion: "bottom",
  },
];

const PASOS_TOUR_PASOAPASO = [
  {
    selector: "#pap-threads",
    titulo: "Threads",
    texto: "Cada tarjeta es un thread. El color del borde indica su estado: preparado, bloqueado, durmiendo o terminado.",
    posicion: "right",
  },
  {
    selector: "#pap-derecha",
    titulo: "Traza",
    texto: "Acá vas viendo, paso por paso, qué instrucción ejecuta cada thread.",
    posicion: "left",
  },
  {
    selector: "#pap-auto",
    titulo: "Auto",
    texto: "Ejecuta automáticamente un paso tras otro. Con 'Manual' en cambio elegís vos qué thread avanza en cada paso.",
    posicion: "top",
  },
  {
    selector: "#pap-siguiente",
    titulo: "Siguiente",
    texto: "Avanza un solo paso a la vez, para seguir la ejecución con detalle.",
    posicion: "top",
  },
];

const PASOS_TOUR_COMPARAR = [
  {
    selector: "#cmp-col-a",
    titulo: "Dos ejecuciones, mismo código",
    texto: "Cada columna corre el mismo programa con un scheduling probabilístico distinto, para mostrar cómo el resultado puede cambiar entre corridas.",
    posicion: "right",
  },
  {
    selector: "#cmp-col-a .cmp-reejecutar",
    titulo: "Reejecutar",
    texto: "Volvé a correr solo esta columna con un nuevo scheduling, sin tocar la otra.",
    posicion: "bottom",
  },
];

const $ = (arg) => document.querySelector(arg);

const limiteDeRepeticionesActual = () => $("input[name='limite']:checked").value;
const averiguarProbabilidad = () => $("#porcentaje").value * (100 / $("#porcentaje").max / 100);

$("textarea").addEventListener("keydown", agregarTab);

function agregarTab(e) {
  if (e.keyCode !== 9) return;
  const textArea = e.target;
  const inicio = textArea.selectionStart;
  const final = textArea.selectionEnd;
  textArea.value = textArea.value.substring(0, inicio) + "\t" + textArea.value.substring(final);
  textArea.selectionStart = inicio + 1;
  textArea.selectionEnd = inicio + 1;
  e.preventDefault();
}

function cargar() {
  crearBotones($("#contenedorBotones"), ejemplos, modificarTexto);
  $("#ejecutar").addEventListener("click", ejecutarCodigo);
  $("#cancelar").addEventListener("click", cancelarEjecucion);
  $("#btn-pasoapaso").addEventListener("click", () => {
    iniciarModoStepByStep(
      $("#codigo").value,
      limiteDeRepeticionesActual(),
      averiguarProbabilidad()
    );
    tourAlAparecer("#pap-threads .pap-thread-card", PASOS_TOUR_PASOAPASO, "tour-pasoapaso-visto");
  });
  $("#btn-copiar-traza").addEventListener("click", () => {
    navigator.clipboard.writeText(ultimaTrazaTexto);
  });
  $("#btn-comparar").addEventListener("click", () => {
    iniciarComparacion();
    tourAlAparecer("#cmp-col-a .cmp-variables:not(:empty)", PASOS_TOUR_COMPARAR, "tour-comparar-visto");
  });
  $("#cmp-volver").addEventListener("click", cerrarComparacion);
  $("#cmp-col-a .cmp-reejecutar").addEventListener("click", () => ejecutarEnColumna("#cmp-col-a"));
  $("#cmp-col-b .cmp-reejecutar").addEventListener("click", () => ejecutarEnColumna("#cmp-col-b"));

  const btnToggle = $("#btn-toggle-ejemplos");
  const panelEjemplos = $("#panel-ejemplos");
  btnToggle.addEventListener("click", () => {
    const abierto = !panelEjemplos.hidden;
    panelEjemplos.hidden = abierto;
    btnToggle.setAttribute("aria-expanded", String(!abierto));
  });

  $("#btn-tour").addEventListener("click", () => {
    iniciarTour(PASOS_TOUR, { storageKey: "tour-simulador-visto", forzar: true });
  });

  const btnCompartir = $("#btn-compartir");
  const textoOriginalBtnCompartir = btnCompartir.textContent;
  btnCompartir.addEventListener("click", async () => {
    const link = await generarLinkCompartir($("#codigo").value);
    await navigator.clipboard.writeText(link);
    btnCompartir.textContent = "¡Copiado!";
    setTimeout(() => { btnCompartir.textContent = textoOriginalBtnCompartir; }, 1500);
  });

  $("#codigo").addEventListener("input", guardarCodigoEnLocalStorageConDebounce);

  cargarCodigoInicial();
}

const CLAVE_CODIGO_GUARDADO = "simulador-codigo-guardado";
let idDebounceGuardado = null;

function guardarCodigoEnLocalStorageConDebounce() {
  clearTimeout(idDebounceGuardado);
  idDebounceGuardado = setTimeout(() => {
    localStorage.setItem(CLAVE_CODIGO_GUARDADO, $("#codigo").value);
  }, 500);
}

// Espera a que `selector` aparezca en el DOM (el panel se llena async vía Worker)
// y recién ahí lanza el tour correspondiente. Se rinde tras 5s por si nunca aparece.
function tourAlAparecer(selector, pasos, storageKey) {
  if (localStorage.getItem(storageKey)) return;
  if (document.querySelector(selector)) {
    iniciarTour(pasos, { storageKey });
    return;
  }
  const observer = new MutationObserver(() => {
    if (!document.querySelector(selector)) return;
    observer.disconnect();
    iniciarTour(pasos, { storageKey });
  });
  observer.observe(document.body, { childList: true, subtree: true });
  setTimeout(() => observer.disconnect(), 5000);
}

async function cargarCodigoInicial() {
  const codigoCompartido = await leerCodigoDesdeUrl();
  if (codigoCompartido !== null) {
    $("#codigo").value = codigoCompartido;
    return; // si vino por link compartido, no interrumpir con el tour
  }

  const codigoGuardado = localStorage.getItem(CLAVE_CODIGO_GUARDADO);
  if (codigoGuardado !== null) {
    $("#codigo").value = codigoGuardado;
  }

  iniciarTour(PASOS_TOUR, { storageKey: "tour-simulador-visto" });
}

function modificarTexto(e) {
  const idBtn = e.target.dataset.btnid;
  for (const cat of ejemplos) {
    const ej = cat.ejemplos.find(ex => ex.id == idBtn);
    if (ej) {
      $("#codigo").value = ej.texto;
      localStorage.setItem(CLAVE_CODIGO_GUARDADO, ej.texto);
      return;
    }
  }
}

let workerActual = null;
let ultimaTrazaTexto = "";

// Lanza un Worker que corre `codigo` y renderiza el resultado en los elementos dados.
// Reusado por el modo "Ejecutar" normal y por cada columna del modo "Comparar" —
// la única diferencia entre ambos es qué contenedores DOM se actualizan y algunos
// callbacks opcionales (aviso de límite de ciclos, botón de copiar traza, etc.)
function ejecutarYRenderizar({
  codigo,
  limiteRepeticiones,
  probabilidad,
  elVariables,
  elConsola,
  elTraza,
  onError,
  onFinOk,
  onFinalizar, // se llama siempre al terminar (éxito o error), antes que onError/onFinOk
}) {
  const worker = new Worker("./simulador.worker.js", { type: "module" });

  worker.onmessage = ({ data }) => {
    onFinalizar?.();

    data.consolaLines?.forEach(msg => {
      elConsola.innerHTML += `<p>${escaparHtml(msg)}</p>`;
    });

    if (!data.ok) {
      elTraza.innerHTML = (data.traza ?? []).join("");
      onError(data.error);
      return;
    }

    renderVariables(elVariables, data.variables ?? [], data.historialVariables ?? {});
    elTraza.innerHTML = (data.traza ?? []).join("");
    onFinOk(data);
  };

  worker.onerror = (e) => {
    onFinalizar?.();
    onError({ esSimulador: false, message: `Error del worker: ${e.message}` });
  };

  worker.postMessage({ codigo, limiteRepeticiones, probabilidad });
  return worker;
}

function ejecutarCodigo() {
  if (workerActual) {
    workerActual.terminate();
    workerActual = null;
  }

  ocultarError();
  const consolaEl = $("#consola");
  consolaEl.innerHTML = "";
  $("#traza").innerHTML = "";
  $("#variables").innerHTML = "";
  $("#btn-copiar-traza").hidden = true;
  $("#cancelar").hidden = false;
  $("#ejecutar").disabled = true;

  workerActual = ejecutarYRenderizar({
    codigo:             $("#codigo").value,
    limiteRepeticiones: limiteDeRepeticionesActual(),
    probabilidad:       averiguarProbabilidad(),
    elVariables:        $("#variables"),
    elConsola:          consolaEl,
    elTraza:            $("#traza"),
    onFinalizar: () => {
      workerActual = null;
      $("#cancelar").hidden = true;
      $("#ejecutar").disabled = false;
    },
    onError: (err) => mostrarErrorDesdeWorker(err),
    onFinOk: (data) => {
      ultimaTrazaTexto = data.trazaTexto;
      $("#btn-copiar-traza").hidden = false;
      if (data.finalizacion === "limite") {
        mostrarAviso("Se alcanzó el límite de ciclos — el programa puede no haber terminado. Aumentá el límite en configuración si es necesario.");
      }
    },
  });
}

function escaparHtml(texto) {
  const div = document.createElement("div");
  div.textContent = texto;
  return div.innerHTML;
}

function renderVariables(contenedor, variables, historial) {
  contenedor.innerHTML = "";

  variables.forEach(linea => {
    const idx = linea.indexOf(":");
    const nombre = idx === -1 ? linea : linea.substring(0, idx).trim();
    const valorFinal = idx === -1 ? "" : linea.substring(idx + 1).trim();
    const cambios = historial[nombre];

    const fila = document.createElement("div");
    fila.className = "variable-fila";

    if (!cambios || cambios.length < 2) {
      fila.innerHTML = `<span class="variable-nombre">${escaparHtml(linea)}</span>`;
      contenedor.appendChild(fila);
      return;
    }

    const toggle = document.createElement("button");
    toggle.className = "variable-toggle";
    toggle.type = "button";
    toggle.title = "Ver historial de cambios de esta variable";
    toggle.innerHTML = `<span class="variable-toggle-icono">▸</span> <span class="variable-nombre">${escaparHtml(nombre)}:</span> ${escaparHtml(valorFinal)}`;

    const detalle = document.createElement("div");
    detalle.className = "variable-historial";
    detalle.hidden = true;
    detalle.innerHTML = cambios
      .map(c => `<span class="variable-paso">${escaparHtml(c.valor)} <span class="variable-thread">(${escaparHtml(c.threadLabel)})</span></span>`)
      .join(`<span class="variable-flecha"> → </span>`);

    toggle.addEventListener("click", () => {
      detalle.hidden = !detalle.hidden;
      toggle.classList.toggle("variable-toggle-abierto", !detalle.hidden);
    });

    fila.appendChild(toggle);
    fila.appendChild(detalle);
    contenedor.appendChild(fila);
  });
}

function cancelarEjecucion() {
  if (workerActual) {
    workerActual.terminate();
    workerActual = null;
  }
  $("#cancelar").hidden = true;
  $("#ejecutar").disabled = false;
  mostrarAviso("Ejecución cancelada.");
}

const workersComparar = { "#cmp-col-a": null, "#cmp-col-b": null };
let codigoComparar = null; // fijo mientras el panel está abierto — el editor queda oculto/no editable

function iniciarComparacion() {
  if (workerActual) {
    workerActual.terminate();
    workerActual = null;
  }
  ocultarError();

  $("main").hidden = true;
  $("#panel-comparar").hidden = false;

  codigoComparar = $("#codigo").value;

  ejecutarEnColumna("#cmp-col-a");
  ejecutarEnColumna("#cmp-col-b");
}

function ejecutarEnColumna(selectorColumna) {
  const columna  = $(selectorColumna);
  const variablesEl = columna.querySelector(".cmp-variables");
  const consolaEl   = columna.querySelector(".cmp-consola");
  const trazaEl     = columna.querySelector(".cmp-traza");
  const btnReejecutar = columna.querySelector(".cmp-reejecutar");

  if (workersComparar[selectorColumna]) {
    workersComparar[selectorColumna].terminate();
  }

  variablesEl.textContent = "Ejecutando…";
  consolaEl.innerHTML = "";
  trazaEl.innerHTML = "";
  btnReejecutar.disabled = true;

  workersComparar[selectorColumna] = ejecutarYRenderizar({
    codigo:             codigoComparar,
    limiteRepeticiones: limiteDeRepeticionesActual(),
    probabilidad:       averiguarProbabilidad(),
    elVariables:        variablesEl,
    elConsola:          consolaEl,
    elTraza:            trazaEl,
    onFinalizar: () => {
      workersComparar[selectorColumna] = null;
      btnReejecutar.disabled = false;
    },
    onError: (err) => {
      variablesEl.innerHTML = "";
      const errPanel = document.createElement("div");
      errPanel.className = "panel-error--error";
      errPanel.textContent = err.esSimulador ? err.formateado : `Error inesperado: ${err.message}`;
      variablesEl.appendChild(errPanel);
    },
    onFinOk: () => {},
  });
}

function cerrarComparacion() {
  Object.keys(workersComparar).forEach(key => {
    workersComparar[key]?.terminate();
    workersComparar[key] = null;
  });
  codigoComparar = null;
  $("#panel-comparar").hidden = true;
  $("main").hidden = false;
}

function mostrarError(e) {
  const panel = $("#panel-error");
  panel.className = "panel-error--error";
  panel.textContent = `Error inesperado: ${e.message}`;
  console.error(e);
  panel.hidden = false;
}

function mostrarErrorDesdeWorker(err) {
  const panel = $("#panel-error");
  panel.className = "panel-error--error";
  panel.textContent = err.esSimulador ? err.formateado : `Error inesperado: ${err.message}`;
  panel.hidden = false;
}

function mostrarAviso(mensaje) {
  const panel = $("#panel-error");
  panel.className = "panel-error--aviso";
  panel.textContent = mensaje;
  panel.hidden = false;
}

function ocultarError() {
  $("#panel-error").hidden = true;
  $("#panel-error").className = "";
}

function crearBotones(contenedor, categorias, funcionOnClick) {
  categorias.forEach(({ categoria, ejemplos }, idx) => {
    const grupo = document.createElement("div");
    grupo.className = "ejemplo-grupo";

    const slug = categoria.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-");

    const label = document.createElement("button");
    label.className = "ejemplo-categoria";
    label.textContent = categoria;
    label.setAttribute("aria-expanded", idx === 0 ? "true" : "false");
    grupo.appendChild(label);

    const botones = document.createElement("div");
    botones.className = "ejemplo-botones";
    if (idx !== 0) botones.hidden = true;

    ejemplos.forEach(({ id, titulo, razon }) => {
      const btn = document.createElement("button");
      btn.className = `ejemplo-btn ejemplo-btn--${slug}`;
      btn.dataset.btnid = id;
      btn.title = razon;
      btn.textContent = titulo;
      btn.addEventListener("click", funcionOnClick);
      botones.appendChild(btn);
    });

    label.addEventListener("click", () => {
      const abierto = label.getAttribute("aria-expanded") === "true";
      label.setAttribute("aria-expanded", abierto ? "false" : "true");
      botones.hidden = abierto;
    });

    grupo.appendChild(botones);
    contenedor.appendChild(grupo);
  });
}

window.addEventListener("load", cargar);
