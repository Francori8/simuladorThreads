const $ = (id) => document.getElementById(id);

let worker = null;

// Escapa HTML — mismo criterio que el resto de la UI (ver script.js).
function escaparHtml(texto) {
  const div = document.createElement("div");
  div.textContent = texto;
  return div.innerHTML;
}

export function iniciarVerificacion(codigo, limiteRepeticiones) {
  if (worker) {
    worker.terminate();
    worker = null;
  }

  const panel = $("panel-verificar");
  panel.hidden = false;
  panel.className = "panel-error--aviso";
  panel.textContent = "Explorando entrelazados posibles…";
  $("btn-verificar").disabled = true;
  $("btn-verificar-cancelar").hidden = false;

  worker = new Worker("./explorador.worker.js", { type: "module" });

  worker.onmessage = ({ data }) => {
    if (data.tipo === "progreso") {
      panel.className = "panel-error--aviso";
      panel.textContent = `Explorando… ${data.caminosExplorados.toLocaleString("es")} / ${data.maxCaminos.toLocaleString("es")} caminos`;
      return;
    }

    $("btn-verificar").disabled = false;
    $("btn-verificar-cancelar").hidden = true;
    worker = null;
    if (data.ok) {
      renderResultado(panel, data);
    } else {
      panel.className = "panel-error--error";
      panel.textContent = data.error?.formateado ?? data.error?.message ?? "Error desconocido al verificar.";
    }
  };

  worker.onerror = (e) => {
    $("btn-verificar").disabled = false;
    $("btn-verificar-cancelar").hidden = true;
    worker = null;
    panel.className = "panel-error--error";
    panel.textContent = `Error del worker: ${e.message}`;
  };

  worker.postMessage({
    codigo,
    limiteRepeticiones,
    maxCaminos: 100000,
    maxProfundidad: 500,
  });
}

export function cancelarVerificacion() {
  if (worker) {
    worker.terminate();
    worker = null;
  }
  $("btn-verificar").disabled = false;
  $("btn-verificar-cancelar").hidden = true;
  $("panel-verificar").hidden = true;
}

function renderResultado(panel, data) {
  const { caminosExplorados, truncado, deadlocks, valoresPorVariable } = data;
  const huboDeadlock = deadlocks.length > 0;
  const huboVariacion = Object.values(valoresPorVariable).some(vals => vals.length > 1);

  const lineas = [];
  lineas.push(
    `${caminosExplorados.toLocaleString("es")} camino${caminosExplorados === 1 ? "" : "s"} explorado${caminosExplorados === 1 ? "" : "s"}` +
    (truncado ? " (exploración parcial — se alcanzó el límite, no es una garantía exhaustiva)" : " (exploración completa)")
  );

  if (huboDeadlock) {
    lineas.push(`❌ Deadlock encontrado en ${deadlocks.length} de ${caminosExplorados} camino${caminosExplorados === 1 ? "" : "s"}.`);
  } else {
    lineas.push("✅ Sin deadlock en los caminos explorados.");
  }

  const nombresVars = Object.keys(valoresPorVariable).sort();
  if (nombresVars.length > 0) {
    lineas.push("");
    lineas.push("Valores finales por variable global:");
    for (const nombre of nombresVars) {
      const entradas = valoresPorVariable[nombre];
      const total = entradas.reduce((acc, [, cant]) => acc + cant, 0);
      const detalle = entradas
        .map(([valor, cant]) => `${valor} (${Math.round((cant / total) * 100)}%)`)
        .join(", ");
      const marca = entradas.length > 1 ? "⚠️ " : "";
      lineas.push(`  ${marca}${nombre}: ${detalle}`);
    }
    if (huboVariacion) {
      lineas.push("");
      lineas.push("(% = proporción de entrelazados posibles, no la probabilidad real del scheduler — que está sesgado a cambiar de thread con menos frecuencia)");
    }
  }

  panel.className = huboDeadlock ? "panel-error--error" : (huboVariacion ? "panel-error--aviso" : "panel-error--ok");
  panel.innerHTML = lineas.map(escaparHtml).join("\n");
}
