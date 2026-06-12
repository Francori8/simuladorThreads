import Simulador from "./simulador.js";
import ejemplos from "./ejemplo.js";
import { ErrorSimulador } from "./errores.js";

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
  $("#btn-copiar-traza").addEventListener("click", () => {
    navigator.clipboard.writeText(simulador.trazaTexto());
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

const simulador = new Simulador();

function ejecutarCodigo() {
  ocultarError();
  const consola = $("#consola");
  consola.innerText = "";
  $("#traza").innerHTML = "";
  $("#variables").innerText = "";
  $("#btn-copiar-traza").hidden = true;

  try {
    simulador.iniciar(
      $("#codigo").value,
      consola,
      limiteDeRepeticionesActual(),
      averiguarProbabilidad()
    );
  } catch (e) {
    mostrarError(e);
    $("#traza").innerHTML = simulador.traza().join("");
    return;
  }

  $("#variables").innerText = simulador.variables().join(" ");
  $("#traza").innerHTML = simulador.traza().join("");
  $("#btn-copiar-traza").hidden = false;

  if (simulador.finalizacion() === "limite") {
    mostrarAviso("Se alcanzó el límite de ciclos — el programa puede no haber terminado. Aumentá el límite en configuración si es necesario.");
  }
}

function mostrarError(e) {
  const panel = $("#panel-error");
  panel.className = "panel-error--error";
  if (e instanceof ErrorSimulador) {
    panel.textContent = e.formatear();
  } else {
    panel.textContent = `Error inesperado: ${e.message}`;
    console.error(e);
  }
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
