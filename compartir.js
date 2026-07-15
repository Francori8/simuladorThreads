// Codifica/decodifica texto en el hash de la URL (#code=...) para compartir por link.
// Usa CompressionStream cuando está disponible para links más cortos, con fallback a base64 plano.

const PARAM = "code";

function base64UrlEncode(bytes) {
  let binario = "";
  bytes.forEach(b => (binario += String.fromCharCode(b)));
  return btoa(binario).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(str) {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const binario = atob(base64);
  return Uint8Array.from(binario, c => c.charCodeAt(0));
}

async function comprimir(texto) {
  const bytesTexto = new TextEncoder().encode(texto);
  if (typeof CompressionStream === "undefined") return { bytes: bytesTexto, comprimido: false };

  const cs = new CompressionStream("gzip");
  const writer = cs.writable.getWriter();
  writer.write(bytesTexto);
  writer.close();
  const buffer = await new Response(cs.readable).arrayBuffer();
  return { bytes: new Uint8Array(buffer), comprimido: true };
}

async function descomprimir(bytes) {
  if (typeof DecompressionStream === "undefined") return new TextDecoder().decode(bytes);

  const ds = new DecompressionStream("gzip");
  const writer = ds.writable.getWriter();
  writer.write(bytes);
  writer.close();
  const buffer = await new Response(ds.readable).arrayBuffer();
  return new TextDecoder().decode(buffer);
}

// Genera la URL completa (con hash) que reproduce `texto` al abrirla.
export async function generarLinkCompartir(texto) {
  const { bytes, comprimido } = await comprimir(texto);
  const prefijo = comprimido ? "z" : "r"; // z = gzip, r = raw
  const hash = `${PARAM}=${prefijo}${base64UrlEncode(bytes)}`;
  const url = new URL(window.location.href);
  url.hash = hash;
  return url.toString();
}

// Lee el código embebido en el hash actual de la URL, si existe. Devuelve null si no hay nada.
export async function leerCodigoDesdeUrl() {
  const hash = window.location.hash.replace(/^#/, "");
  const params = new URLSearchParams(hash);
  const valor = params.get(PARAM);
  if (!valor) return null;

  const prefijo = valor[0];
  const bytes = base64UrlDecode(valor.slice(1));

  try {
    if (prefijo === "z") return await descomprimir(bytes);
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}
