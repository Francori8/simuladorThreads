const $ = (id) => document.getElementById(id);

let worker          = null;
let numeroPasoActual = 0;
let variablesAntes  = {};
let ultimaTrazaTexto = "";
let threadActivoId  = null;
let ultimaConfig    = null; // { codigo, limiteRepeticiones, probabilidad }

export function iniciarModoStepByStep(codigo, limiteRepeticiones, probabilidad) {
  ultimaConfig = { codigo, limiteRepeticiones, probabilidad };
  if (worker) {
    worker.terminate();
    worker = null;
  }

  numeroPasoActual = 0;
  variablesAntes   = {};
  ultimaTrazaTexto = "";
  threadActivoId   = null;

  // Mostrar panel paso a paso, ocultar panel traza normal y botones de ejecutar
  $("panel-traza").hidden      = true;
  $("panel-pasoapaso").hidden  = false;
  $("ejecutar").hidden         = true;
  $("cancelar").hidden         = true;
  $("btn-pasoapaso").hidden    = true;

  // Reset UI
  $("pap-threads").innerHTML  = "";
  $("pap-variables").innerHTML = "";
  $("pap-consola").innerHTML  = "";
  $("pap-traza").innerHTML    = "";
  $("pap-contador").textContent = "Paso 0";
  setControles("iniciando");

  worker = new Worker("./pasoapaso.worker.js", { type: "module" });

  worker.onmessage = ({ data }) => {
    switch (data.tipo) {
      case "inicio":     onInicio(data);     break;
      case "paso":       onPaso(data);       break;
      case "fin":        onFin(data);        break;
      case "error":      onError(data);      break;
      case "esperando":  onEsperando(data);  break;
    }
  };

  worker.onerror = (e) => {
    mostrarMensajeFinal(`Error del worker: ${e.message}`, "error");
    setControles("terminado");
  };

  worker.postMessage({ cmd: "iniciar", codigo, limiteRepeticiones, probabilidad });

  // Listeners de controles
  $("pap-auto").onclick      = () => activarAuto();
  $("pap-manual").onclick    = () => activarManual();
  $("pap-pausa").onclick     = () => pausar();
  $("pap-siguiente").onclick = () => darSiguiente();
  $("pap-reiniciar").onclick = () => reiniciar();
  $("pap-cancelar").onclick  = () => cancelar();
  $("pap-velocidad").oninput = () => {
    worker?.postMessage({ cmd: "velocidad", idx: Number($("pap-velocidad").value) });
  };
}

export function cerrarModoStepByStep() {
  if (worker) { worker.terminate(); worker = null; }
  $("panel-pasoapaso").hidden = true;
  $("panel-traza").hidden     = false;
  $("ejecutar").hidden        = false;
  $("btn-pasoapaso").hidden   = false;
}

// --- Handlers de mensajes del Worker ---

function onInicio({ threads, variables }) {
  renderThreads(threads, null);
  renderVariables(variables);
  setControles("pausado");
}

function onPaso({ numeroPaso, paso, threads, variables, consolaLines }) {
  numeroPasoActual = numeroPaso;
  $("pap-contador").textContent = `Paso ${numeroPaso}`;

  const threadIdActivo = paso?.threadId ?? null;
  threadActivoId = threadIdActivo;

  // Deshabilitar clicks mientras se procesa el paso
  $("pap-threads").querySelectorAll(".pap-thread-card").forEach(card => {
    card.classList.remove("pap-thread-elegible");
    card.style.cursor = "";
    card.onclick = null;
  });

  // threads/variables/consolaLines pueden ser null en pasos intermedios de atomic
  if (threads)      renderThreads(threads, threadIdActivo);
  if (variables)    renderVariables(variables);
  if (consolaLines) renderConsola(consolaLines);

  if (paso) {
    agregarPasoTraza(paso);
  }
}

function onFin({ finalizacion, trazaTexto }) {
  ultimaTrazaTexto = trazaTexto;
  setControles("terminado");
  const msg = finalizacion === "limite"
    ? "Se alcanzó el límite de ciclos."
    : "Ejecución finalizada.";
  mostrarMensajeFinal(msg, finalizacion === "limite" ? "aviso" : "ok");
}

function onEsperando({ threads }) {
  // Marcar las tarjetas de threads preparados como elegibles
  const contenedor = $("pap-threads");
  contenedor.querySelectorAll(".pap-thread-card").forEach(card => {
    const id = Number(card.dataset.threadId);
    const esElegible = threads.some(th => th.id === id);
    card.classList.toggle("pap-thread-elegible", esElegible);
    if (esElegible) {
      card.style.cursor = "pointer";
      card.onclick = () => elegirThread(id);
    } else {
      card.style.cursor = "";
      card.onclick = null;
    }
  });
}

function elegirThread(id) {
  // Quitar estado elegible de todas las tarjetas
  $("pap-threads").querySelectorAll(".pap-thread-card").forEach(card => {
    card.classList.remove("pap-thread-elegible");
    card.style.cursor = "";
    card.onclick = null;
  });
  worker?.postMessage({ cmd: "elegir", threadId: id });
}

function onError({ error }) {
  setControles("terminado");
  mostrarMensajeFinal(
    error.esSimulador ? error.formateado : `Error: ${error.message}`,
    "error"
  );
}

// --- Controles ---

function activarAuto() {
  worker?.postMessage({ cmd: "auto", velocidadIdx: Number($("pap-velocidad").value) });
  setControles("auto");
}

function activarManual() {
  worker?.postMessage({ cmd: "manual" }); // activa modo manual y emite "esperando"
  setControles("manual");
}

function pausar() {
  worker?.postMessage({ cmd: "pausa" });
  setControles("pausado");
}

function darSiguiente() {
  if (!worker) return;
  setControles("pausado"); // asegura que esté en modo manual
  worker.postMessage({ cmd: "siguiente" });
}

function reiniciar() {
  if (worker) { worker.terminate(); worker = null; }
  if (ultimaConfig) {
    const { codigo, limiteRepeticiones, probabilidad } = ultimaConfig;
    // Resetear UI sin salir del modo
    numeroPasoActual = 0;
    variablesAntes   = {};
    ultimaTrazaTexto = "";
    threadActivoId   = null;
    $("pap-threads").innerHTML   = "";
    $("pap-variables").innerHTML = "";
    $("pap-consola").innerHTML   = "";
    $("pap-traza").innerHTML     = "";
    $("pap-contador").textContent = "Paso 0";
    setControles("iniciando");

    worker = new Worker("./pasoapaso.worker.js", { type: "module" });
    worker.onmessage = ({ data }) => {
      switch (data.tipo) {
        case "inicio":    onInicio(data);    break;
        case "paso":      onPaso(data);      break;
        case "fin":       onFin(data);       break;
        case "error":     onError(data);     break;
        case "esperando": onEsperando(data); break;
      }
    };
    worker.onerror = (e) => {
      mostrarMensajeFinal(`Error del worker: ${e.message}`, "error");
      setControles("terminado");
    };
    worker.postMessage({ cmd: "iniciar", codigo, limiteRepeticiones, probabilidad });
  }
}

function cancelar() {
  if (worker) { worker.terminate(); worker = null; }
  cerrarModoStepByStep();
}

// --- Render ---

function renderThreads(threads, threadActivoId) {
  const contenedor = $("pap-threads");

  threads.forEach(th => {
    let card = contenedor.querySelector(`[data-thread-id="${th.id}"]`);
    if (!card) {
      card = document.createElement("div");
      card.className = "pap-thread-card";
      card.dataset.threadId = th.id;
      card.innerHTML = `
        <div class="pap-thread-header">
          <span class="pap-thread-label">TH ${th.id}</span>
          <span class="pap-thread-nombre">${th.nombre}</span>
          <span class="pap-thread-estado"></span>
        </div>
        <div class="pap-thread-proxima"></div>
      `;
      contenedor.appendChild(card);
    }

    const estadoAnterior = card.dataset.estado;
    card.dataset.estado = th.estado;
    card.querySelector(".pap-thread-estado").textContent = th.estado;
    card.querySelector(".pap-thread-proxima").textContent = th.proximaInstruccion ?? "";

    // Highlight del thread activo
    card.classList.toggle("pap-thread-activo", th.id === threadActivoId);

    // Flash si cambió de estado
    if (estadoAnterior && estadoAnterior !== th.estado) {
      card.classList.remove("pap-flash");
      void card.offsetWidth; // reflow para reiniciar animación
      card.classList.add("pap-flash");
    }
  });
}

function renderVariables(variables) {
  const contenedor = $("pap-variables");
  const nuevas = {};
  variables.forEach(v => {
    // variables viene como array de strings tipo "n: 3"
    const idx = v.indexOf(":");
    if (idx !== -1) {
      nuevas[v.substring(0, idx).trim()] = v.substring(idx + 1).trim();
    }
  });

  Object.entries(nuevas).forEach(([nombre, valor]) => {
    let chip = contenedor.querySelector(`[data-var="${nombre}"]`);
    if (!chip) {
      chip = document.createElement("span");
      chip.className = "pap-var";
      chip.dataset.var = nombre;
      contenedor.appendChild(chip);
    }
    const cambio = variablesAntes[nombre] !== undefined && variablesAntes[nombre] !== valor;
    chip.textContent = `${nombre}: ${valor}`;
    if (cambio) {
      chip.classList.remove("pap-var-changed");
      void chip.offsetWidth;
      chip.classList.add("pap-var-changed");
    }
  });

  variablesAntes = nuevas;
}

function renderConsola(lines) {
  const contenedor = $("pap-consola");
  const actual = contenedor.querySelectorAll("p").length;
  for (let i = actual; i < lines.length; i++) {
    const p = document.createElement("p");
    p.textContent = lines[i];
    contenedor.appendChild(p);
  }
}

function agregarPasoTraza(paso) {
  const traza = $("pap-traza");
  const div = document.createElement("div");
  div.className = "elementoTraza pap-paso-nuevo";
  div.innerHTML = `
    <h3 class="thread">${paso.threadLabel}</h3>
    <div class="contenedorTraza">
      <p class="texto">${paso.instruccion ?? ""}</p>
      <p class="operacion">${paso.operacion}</p>
      <p class="accion">${paso.desarrollo}</p>
    </div>
  `;
  traza.appendChild(div);
  // Quitar clase de animación al siguiente frame
  requestAnimationFrame(() => div.classList.remove("pap-paso-nuevo"));
  // Auto-scroll
  traza.scrollTop = traza.scrollHeight;
}

function mostrarMensajeFinal(mensaje, tipo) {
  const span = document.createElement("span");
  span.className = `pap-mensaje-final pap-mensaje-${tipo}`;
  span.textContent = mensaje;
  $("pap-controles").appendChild(span);
}

// --- Estado de los controles según modo ---

function setControles(modo) {
  const btnAuto     = $("pap-auto");
  const btnManual   = $("pap-manual");
  const btnPausa    = $("pap-pausa");
  const btnSig      = $("pap-siguiente");
  const btnRei      = $("pap-reiniciar");
  const sliderVel   = $("pap-velocidad");

  // Limpiar mensajes anteriores
  $("pap-controles").querySelectorAll(".pap-mensaje-final").forEach(el => el.remove());

  switch (modo) {
    case "iniciando":
      btnAuto.disabled   = true;
      btnManual.disabled = true;
      btnPausa.disabled  = true;
      btnSig.disabled    = true;
      btnRei.disabled    = true;
      sliderVel.disabled = true;
      break;
    case "pausado":
      btnAuto.disabled   = false;
      btnManual.disabled = false;
      btnPausa.disabled  = true;
      btnSig.disabled    = false;
      btnRei.disabled    = false;
      sliderVel.disabled = true;
      break;
    case "auto":
      btnAuto.disabled   = true;
      btnManual.disabled = false;
      btnPausa.disabled  = false;
      btnSig.disabled    = true;
      btnRei.disabled    = false;
      sliderVel.disabled = false;
      break;
    case "manual":
      btnAuto.disabled   = false;
      btnManual.disabled = true;
      btnPausa.disabled  = true;
      btnSig.disabled    = true; // en manual se elige desde las tarjetas
      btnRei.disabled    = false;
      sliderVel.disabled = true;
      break;
    case "terminado":
      btnAuto.disabled   = true;
      btnManual.disabled = true;
      btnPausa.disabled  = true;
      btnSig.disabled    = true;
      btnRei.disabled    = false;
      sliderVel.disabled = true;
      break;
  }
}
