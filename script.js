import Memoria from "./memoria.js";
import EstadoGlobal from "./estadoGlobal.js";
import ejemplos from "./ejemplo.js";
import { parsear } from "./parser.js";

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
}

function modificarTexto(e) {
  const idBtn = e.target.dataset.btnid;
  $("#codigo").value = ejemplos.find((ej) => ej.id == idBtn).texto;
}

function ejecutarCodigo() {
  const mem = new Memoria();
  const consola = $("#consola");
  consola.innerText = "";

  const threads = parsear(
    $("#codigo").value,
    mem,
    consola,
    limiteDeRepeticionesActual()
  );

  const estado = new EstadoGlobal(threads, mem);
  estado.setProbabilidad(averiguarProbabilidad());
  estado.resolver();

  $("#variables").innerText = mem.mostrarMemoria().join(" ");
  $("#traza").innerHTML = estado.mostrarTraza().join("");
}

function crearBotones(contenedor, elementos, funcionOnClick) {
  elementos.forEach((val) => {
    contenedor.innerHTML += `<button data-btnid=${val.id} title="${val.razon}" class="ejemplo-btn"> ${val.id}</button>`;
  });
  contenedor.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", funcionOnClick);
  });
}

window.addEventListener("load", cargar);
