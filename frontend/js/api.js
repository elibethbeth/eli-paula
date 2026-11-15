
/* TALLER VÁZQUEZ - API */

export async function api(path, options = {}) {
  if (!path.startsWith("/api/")) {
    throw new Error("La dirección de la API no es válida.");
  }

  const headers = new Headers(options.headers || {});
  headers.set("Accept", "application/json");

  if (options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  let response;

  try {
    response = await fetch(path, {
      ...options,
      headers,
      credentials: "same-origin",
      cache: "no-store"
    });
  } catch {
    throw new Error(
      "No se puede conectar con el servidor. Comprueba la conexión."
    );
  }

  let data = null;

  if (response.status !== 204) {
    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      data = await response.json();
    } else {
      const message = await response.text();
      data = message ? { error: message } : null;
    }
  }

  if (!response.ok) {
    const error = new Error(
      data?.error ||
      data?.message ||
      `Error del servidor: ${response.status}`
    );

    error.status = response.status;
    error.data = data;
    throw error;
  }

  return { data, status: response.status };
}
