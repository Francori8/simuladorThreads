// Tour guiado genérico y reutilizable — sin dependencias externas.
// Uso:
//   import { iniciarTour } from "./tour.js";
//   iniciarTour([
//     { selector: "#miBoton", titulo: "Título", texto: "Explicación...", posicion: "bottom" },
//     ...
//   ], { storageKey: "tour-visto", forzar: false });

const CLASE_RAIZ = "tour-overlay";

export function iniciarTour(pasos, opciones = {}) {
  const { storageKey = "tour-visto", forzar = false } = opciones;

  if (!pasos || pasos.length === 0) return;
  if (!forzar && storageKey && localStorage.getItem(storageKey)) return;

  let indice = 0;
  const raiz = document.createElement("div");
  raiz.className = CLASE_RAIZ;
  raiz.innerHTML = `
    <div class="${CLASE_RAIZ}-hueco"></div>
    <div class="${CLASE_RAIZ}-tooltip" role="dialog" aria-live="polite">
      <div class="${CLASE_RAIZ}-titulo"></div>
      <div class="${CLASE_RAIZ}-texto"></div>
      <div class="${CLASE_RAIZ}-pie">
        <span class="${CLASE_RAIZ}-contador"></span>
        <div class="${CLASE_RAIZ}-botones">
          <button type="button" class="${CLASE_RAIZ}-saltar">Saltar</button>
          <button type="button" class="${CLASE_RAIZ}-anterior">Anterior</button>
          <button type="button" class="${CLASE_RAIZ}-siguiente">Siguiente</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(raiz);

  const hueco = raiz.querySelector(`.${CLASE_RAIZ}-hueco`);
  const tooltip = raiz.querySelector(`.${CLASE_RAIZ}-tooltip`);
  const elTitulo = raiz.querySelector(`.${CLASE_RAIZ}-titulo`);
  const elTexto = raiz.querySelector(`.${CLASE_RAIZ}-texto`);
  const elContador = raiz.querySelector(`.${CLASE_RAIZ}-contador`);
  const btnAnterior = raiz.querySelector(`.${CLASE_RAIZ}-anterior`);
  const btnSiguiente = raiz.querySelector(`.${CLASE_RAIZ}-siguiente`);
  const btnSaltar = raiz.querySelector(`.${CLASE_RAIZ}-saltar`);

  function terminar() {
    if (storageKey) localStorage.setItem(storageKey, "1");
    raiz.remove();
    window.removeEventListener("resize", posicionar);
    document.removeEventListener("keydown", alTecla);
  }

  function alTecla(e) {
    if (e.key === "Escape") terminar();
    if (e.key === "ArrowRight") avanzar();
    if (e.key === "ArrowLeft") retroceder();
  }

  function avanzar() {
    if (indice >= pasos.length - 1) { terminar(); return; }
    indice++;
    mostrarPaso();
  }

  function retroceder() {
    if (indice <= 0) return;
    indice--;
    mostrarPaso();
  }

  function posicionar() {
    const paso = pasos[indice];
    const el = document.querySelector(paso.selector);
    if (!el) { avanzar(); return; }

    el.scrollIntoView({ block: "center", behavior: "instant" in window ? "instant" : "auto" });
    const r = el.getBoundingClientRect();
    const margen = 6;

    hueco.style.top = `${r.top - margen}px`;
    hueco.style.left = `${r.left - margen}px`;
    hueco.style.width = `${r.width + margen * 2}px`;
    hueco.style.height = `${r.height + margen * 2}px`;

    const posicion = paso.posicion || "bottom";
    tooltip.className = `${CLASE_RAIZ}-tooltip ${CLASE_RAIZ}-tooltip--${posicion}`;

    // Posicionamiento simple relativo al hueco; se ajusta luego de medir el tooltip.
    tooltip.style.visibility = "hidden";
    tooltip.style.top = "0px";
    tooltip.style.left = "0px";
    requestAnimationFrame(() => {
      const t = tooltip.getBoundingClientRect();
      let top, left;
      switch (posicion) {
        case "top":
          top = r.top - margen - t.height - 12;
          left = r.left + r.width / 2 - t.width / 2;
          break;
        case "left":
          top = r.top + r.height / 2 - t.height / 2;
          left = r.left - margen - t.width - 12;
          break;
        case "right":
          top = r.top + r.height / 2 - t.height / 2;
          left = r.right + margen + 12;
          break;
        default: // bottom
          top = r.bottom + margen + 12;
          left = r.left + r.width / 2 - t.width / 2;
      }
      left = Math.max(8, Math.min(left, window.innerWidth - t.width - 8));
      top = Math.max(8, Math.min(top, window.innerHeight - t.height - 8));
      tooltip.style.top = `${top}px`;
      tooltip.style.left = `${left}px`;
      tooltip.style.visibility = "visible";
    });
  }

  function mostrarPaso() {
    const paso = pasos[indice];
    elTitulo.textContent = paso.titulo || "";
    elTexto.textContent = paso.texto || "";
    elContador.textContent = `${indice + 1} / ${pasos.length}`;
    btnAnterior.disabled = indice === 0;
    btnSiguiente.textContent = indice === pasos.length - 1 ? "Finalizar" : "Siguiente";
    posicionar();
  }

  btnSiguiente.addEventListener("click", avanzar);
  btnAnterior.addEventListener("click", retroceder);
  btnSaltar.addEventListener("click", terminar);
  window.addEventListener("resize", posicionar);
  document.addEventListener("keydown", alTecla);

  mostrarPaso();
}

export function reiniciarTour(storageKey = "tour-visto") {
  localStorage.removeItem(storageKey);
}
