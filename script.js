import ejemplos from "./ejemplo.js";

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
  $("#btn-copiar-traza").addEventListener("click", () => {
    navigator.clipboard.writeText(ultimaTrazaTexto);
  });

  const btnToggle = $("#btn-toggle-ejemplos");
  const panelEjemplos = $("#panel-ejemplos");
  btnToggle.addEventListener("click", () => {
    const abierto = !panelEjemplos.hidden;
    panelEjemplos.hidden = abierto;
    btnToggle.setAttribute("aria-expanded", String(!abierto));
  });
}

function modificarTexto(e) {
  const idBtn = e.target.dataset.btnid;
  for (const cat of ejemplos) {
    const ej = cat.ejemplos.find(ex => ex.id == idBtn);
    if (ej) {
      $("#codigo").value = ej.texto;
      return;
    }
  }
}

let workerActual = null;
let ultimaTrazaTexto = "";

function ejecutarCodigo() {
  if (workerActual) {
    workerActual.terminate();
    workerActual = null;
  }

  ocultarError();
  const consolaEl = $("#consola");
  consolaEl.innerHTML = "";
  $("#traza").innerHTML = "";
  $("#variables").innerText = "";
  $("#btn-copiar-traza").hidden = true;
  $("#cancelar").hidden = false;
  $("#ejecutar").disabled = true;

  const worker = new Worker("./simulador.worker.js", { type: "module" });
  workerActual = worker;

  worker.onmessage = ({ data }) => {
    workerActual = null;
    $("#cancelar").hidden = true;
    $("#ejecutar").disabled = false;

    data.consolaLines?.forEach(msg => {
      consolaEl.innerHTML += `<p>${msg}</p>`;
    });

    if (!data.ok) {
      mostrarErrorDesdeWorker(data.error);
      $("#traza").innerHTML = (data.traza ?? []).join("");
      return;
    }

    ultimaTrazaTexto = data.trazaTexto;
    $("#variables").innerText = (data.variables ?? []).join(" ");
    $("#traza").innerHTML = (data.traza ?? []).join("");
    $("#btn-copiar-traza").hidden = false;

    if (data.finalizacion === "limite") {
      mostrarAviso("Se alcanzó el límite de ciclos — el programa puede no haber terminado. Aumentá el límite en configuración si es necesario.");
    }
  };

  worker.onerror = (e) => {
    workerActual = null;
    $("#cancelar").hidden = true;
    $("#ejecutar").disabled = false;
    mostrarError(new Error(`Error del worker: ${e.message}`));
  };

  worker.postMessage({
    codigo:             $("#codigo").value,
    limiteRepeticiones: limiteDeRepeticionesActual(),
    probabilidad:       averiguarProbabilidad(),
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
