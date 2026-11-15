
import { api } from "../js/api.js";

/* TALLER VÁZQUEZ - GESTIÓN */

const table = document.querySelector("#bookings-table");
const adminStatus = document.querySelector("#admin-status");

const totalElement = document.querySelector("#total-bookings");
const pendingElement = document.querySelector("#pending-bookings");
const confirmedElement = document.querySelector("#confirmed-bookings");

const searchInput = document.querySelector("#search-bookings");
const filterInput = document.querySelector("#filter-status");
const refreshButton = document.querySelector("#refresh-bookings");

let reservations = [];
let loading = false;

function showStatus(message, type = "info") {
  adminStatus.textContent = message;
  adminStatus.dataset.state = type;
}

function getReservations(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.reservas)) return data.reservas;
  if (Array.isArray(data?.reserves)) return data.reserves;
  if (Array.isArray(data?.bookings)) return data.bookings;
  return [];
}

function getValue(item, ...keys) {
  for (const key of keys) {
    if (item?.[key] !== undefined && item[key] !== null) {
      return item[key];
    }
  }
  return "";
}

function getState(item) {
  return String(
    getValue(item, "status", "estado", "estat") || "pendiente"
  ).toLowerCase();
}

function formatDate(date) {
  if (!date) return "-";

  const value = new Date(`${date}T12:00:00`);

  if (Number.isNaN(value.getTime())) return String(date);

  return new Intl.DateTimeFormat("es-ES").format(value);
}

function createCell(value) {
  const cell = document.createElement("td");
  cell.textContent = String(value || "-");
  return cell;
}

function createButton(label, className, callback) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `btn ${className}`;
  button.textContent = label;
  button.addEventListener("click", callback);
  return button;
}

function updateStatistics() {
  totalElement.textContent = reservations.length;

  pendingElement.textContent = reservations.filter(item =>
    ["pendiente", "pending"].includes(getState(item))
  ).length;

  confirmedElement.textContent = reservations.filter(item =>
    ["confirmada", "confirmed"].includes(getState(item))
  ).length;
}

function renderReservations() {
  const search = searchInput.value.trim().toLowerCase();
  const selectedStatus = filterInput.value;

  const filtered = reservations.filter(item => {
    const searchable = [
      getValue(item, "name", "nombre", "cliente"),
      getValue(item, "phone", "telefono", "teléfono"),
      getValue(item, "plate", "matricula", "matrícula"),
      getValue(item, "brand", "marca"),
      getValue(item, "model", "modelo"),
      getValue(item, "service", "servicio")
    ].join(" ").toLowerCase();

    const matchesSearch = searchable.includes(search);
    const state = getState(item);
    const matchesState = !selectedStatus ||
      state === selectedStatus ||
      (selectedStatus === "pendiente" && state === "pending") ||
      (selectedStatus === "confirmada" && state === "confirmed") ||
      (selectedStatus === "cancelada" && state === "cancelled");

    return matchesSearch && matchesState;
  });

  table.replaceChildren();

  if (!filtered.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 8;
    cell.className = "empty-message";
    cell.textContent = "No se han encontrado reservas.";
    row.appendChild(cell);
    table.appendChild(row);
    return;
  }

  for (const item of filtered) {
    const row = document.createElement("tr");

    const id = getValue(item, "id", "_id", "reserva_id");
    const name = getValue(item, "name", "nombre", "cliente");
    const phone = getValue(item, "phone", "telefono", "teléfono");

    const vehicle = [
      getValue(item, "brand", "marca"),
      getValue(item, "model", "modelo"),
      getValue(item, "plate", "matricula", "matrícula")
    ].filter(Boolean).join(" ");

    const service = getValue(item, "service", "servicio");
    const date = getValue(item, "date", "fecha");
    const time = getValue(item, "time", "hora");
    const state = getState(item);

    row.append(
      createCell(name),
      createCell(phone),
      createCell(vehicle),
      createCell(service),
      createCell(formatDate(date)),
      createCell(time),
      createCell(state)
    );

    const actionsCell = document.createElement("td");
    const actions = document.createElement("div");
    actions.className = "admin-actions";

    if (id === "") {
      actions.textContent = "Sin identificador";
    } else {
      if (!["confirmada", "confirmed"].includes(state)) {
        actions.appendChild(createButton(
          "Confirmar",
          "",
          () => changeReservation(id, "confirmada")
        ));
      }

      if (!["cancelada", "cancelled"].includes(state)) {
        actions.appendChild(createButton(
          "Cancelar",
          "btn-secondary",
          () => changeReservation(id, "cancelada")
        ));
      }

      actions.appendChild(createButton(
        "Eliminar",
        "btn-danger",
        () => deleteReservation(id)
      ));
    }

    actionsCell.appendChild(actions);
    row.appendChild(actionsCell);
    table.appendChild(row);
  }
}

/* CARGAR RESERVAS */

async function loadReservations() {
  if (loading) return;

  loading = true;
  refreshButton.disabled = true;

  showStatus("Cargando reservas...");

  try {
    const { data } = await api("/api/reserves");

    reservations = getReservations(data);

    updateStatistics();
    renderReservations();

    showStatus("Reservas cargadas correctamente.", "success");

  } catch (error) {
    showStatus(
      `Error al cargar las reservas: ${error.message}`,
      "error"
    );

    table.replaceChildren();

    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 8;
    cell.textContent = "No se pueden mostrar las reservas.";

    row.appendChild(cell);
    table.appendChild(row);

  } finally {
    loading = false;
    refreshButton.disabled = false;
  }
}

/* MODIFICAR RESERVA */

async function changeReservation(id, newStatus) {
  if (!window.confirm(`¿Quieres cambiar el estado a ${newStatus}?`)) {
    return;
  }

  try {
    await api(`/api/reserves/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ status: newStatus })
    });

    showStatus("Reserva modificada correctamente.", "success");
    await loadReservations();

  } catch (error) {
    showStatus(`No se pudo modificar: ${error.message}`, "error");
  }
}

/* ELIMINAR RESERVA */

async function deleteReservation(id) {
  if (!window.confirm("¿Seguro que quieres eliminar esta reserva?")) {
    return;
  }

  try {
    await api(`/api/reserves/${encodeURIComponent(id)}`, {
      method: "DELETE"
    });

    showStatus("Reserva eliminada correctamente.", "success");
    await loadReservations();

  } catch (error) {
    showStatus(`No se pudo eliminar: ${error.message}`, "error");
  }
}

/* EVENTOS */

searchInput.addEventListener("input", renderReservations);
filterInput.addEventListener("change", renderReservations);
refreshButton.addEventListener("click", loadReservations);

loadReservations();
