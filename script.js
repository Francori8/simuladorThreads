import Memoria from "./memoria.js";
import EstadoGlobal from "./estadoGlobal.js";
import ejemplos from "./ejemplo.js";
import { parsear } from "./parser.js";
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

  const btnConfig  = $("#btn-config");
  const panelConfig = $("#panel-config");
  btnConfig.addEventListener("click", () => {
    const abierto = !panelConfig.hidden;
    panelConfig.hidden = abierto;
    btnConfig.setAttribute("aria-expanded", String(!abierto));
  });

  // Cerrar al hacer click fuera del panel
  document.addEventListener("click", (e) => {
    if (!panelConfig.hidden && !panelConfig.contains(e.target) && e.target !== btnConfig) {
      panelConfig.hidden = true;
      btnConfig.setAttribute("aria-expanded", "false");
    }
  });
}

function modificarTexto(e) {
  const idBtn = e.target.dataset.btnid;
  for (const cat of ejemplos) {
    const ej = cat.ejemplos.find(ex => ex.id == idBtn);
    if (ej) {
      $("#codigo").value = ej.texto;
      $("#panel-config").hidden = true;
      $("#btn-config").setAttribute("aria-expanded", "false");
      return;
    }
  }
}

function ejecutarCodigo() {
  ocultarError();
  const mem = new Memoria();
  const consola = $("#consola");
  consola.innerText = "";
  $("#traza").innerHTML = "";
  $("#variables").innerText = "";

  let threads;
  try {
    threads = parsear(
      $("#codigo").value,
      mem,
      consola,
      limiteDeRepeticionesActual()
    );
  } catch (e) {
    mostrarError(e);
    return;
  }

  const estado = new EstadoGlobal(threads, mem);
  estado.setProbabilidad(averiguarProbabilidad());

  try {
    estado.resolver();
  } catch (e) {
    mostrarError(e);
    // Mostrar la traza parcial que se generó antes del error
    $("#traza").innerHTML = estado.mostrarTraza().join("");
    return;
  }

  $("#variables").innerText = mem.mostrarMemoria().join(" ");
  $("#traza").innerHTML = estado.mostrarTraza().join("");
}

function mostrarError(e) {
  const panel = $("#panel-error");
  if (e instanceof ErrorSimulador) {
    panel.textContent = e.formatear();
  } else {
    // Error inesperado de JS — igual mostrarlo
    panel.textContent = `Error inesperado: ${e.message}`;
    console.error(e);
  }
  panel.hidden = false;
}

function ocultarError() {
  $("#panel-error").hidden = true;
}

function crearBotones(contenedor, categorias, funcionOnClick) {
  categorias.forEach(({ categoria, ejemplos }) => {
    const grupo = document.createElement("div");
    grupo.className = "ejemplo-grupo";

    const label = document.createElement("span");
    label.className = "ejemplo-categoria";
    label.textContent = categoria;
    grupo.appendChild(label);

    const botones = document.createElement("div");
    botones.className = "ejemplo-botones";
    ejemplos.forEach(({ id, titulo, razon }) => {
      const btn = document.createElement("button");
      const slug = categoria.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-");
      btn.className = `ejemplo-btn ejemplo-btn--${slug}`;
      btn.dataset.btnid = id;
      btn.title = razon;
      btn.textContent = titulo;
      btn.addEventListener("click", funcionOnClick);
      botones.appendChild(btn);
    });
    grupo.appendChild(botones);
    contenedor.appendChild(grupo);
  });
}

window.addEventListener("load", cargar);
