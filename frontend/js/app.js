
import { api } from "./api.js";

/* TALLER VÁZQUEZ - APLICACIÓN PRINCIPAL */

const bookingForm = document.querySelector("#booking-form");
const bookingStatus = document.querySelector("#booking-status");
const chatForm = document.querySelector("#chat-form");
const chatStatus = document.querySelector("#chat-status");
const messages = document.querySelector("#messages");

let conversationId = null;
let bookingBusy = false;
let chatBusy = false;
let availabilityRequest = 0;

const phoneInput = bookingForm?.elements.namedItem("phone");
const dateInput = bookingForm?.elements.namedItem("date");
const timeSelect = bookingForm?.elements.namedItem("time");

/* FECHA LOCAL DE ESPAÑA */

function todayInSpain() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts.map(part => [part.type, part.value])
  );

  return `${values.year}-${values.month}-${values.day}`;
}

/* MENSAJES */

function showStatus(element, message, type = "info") {
  if (!element) return;
  element.textContent = message;
  element.dataset.state = type;
}

function addMessage(message, sender = "assistant") {
  if (!messages) return;

  const article = document.createElement("article");
  article.className = `chat-message chat-message--${sender}`;

  const heading = document.createElement("strong");
  heading.textContent = sender === "user" ? "Tú" : "Taller IA";

  const paragraph = document.createElement("p");
  paragraph.textContent = message;

  article.append(heading, paragraph);
  messages.appendChild(article);
  messages.scrollTop = messages.scrollHeight;
}

/* TELÉFONO: MÁXIMO 9 CIFRAS */

if (phoneInput) {
  phoneInput.addEventListener("input", () => {
    phoneInput.value = phoneInput.value
      .replace(/\D/g, "")
      .slice(0, 9);
  });

  phoneInput.addEventListener("paste", event => {
    event.preventDefault();

    const pasted = event.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 9);

    phoneInput.value = pasted;
  });
}

/* CARGAR CONFIGURACIÓN */

async function loadBusiness() {
  if (dateInput) dateInput.min = todayInSpain();

  try {
    const { data } = await api("/api/config");

    const name = document.querySelector("#business-name");
    const hours = document.querySelector("#opening-hours");

    if (name && data?.nombre) name.textContent = data.nombre;
    if (hours && data?.horario) hours.textContent = data.horario;

  } catch (error) {
    console.warn("Configuración:", error.message);
  }
}

/* DISPONIBILIDAD */

function getSlots(data) {
  if (Array.isArray(data)) return data;

  const possibleKeys = [
    "horas",
    "slots",
    "available",
    "hours",
    "times",
    "disponibilidad",
    "disponibilitat"
  ];

  for (const key of possibleKeys) {
    if (Array.isArray(data?.[key])) return data[key];
  }

  return [];
}

function getSlotDetails(slot) {
  if (typeof slot === "string") {
    return { time: slot, available: true };
  }

  if (!slot || typeof slot !== "object") return null;

  return {
    time: slot.hora || slot.time || slot.value,
    available: slot.disponible ?? slot.available ?? slot.libre ?? true
  };
}

function resetTimeSelect(message) {
  if (!timeSelect) return;
  timeSelect.replaceChildren(new Option(message, ""));
  timeSelect.disabled = true;
}

async function loadAvailability() {
  if (!dateInput || !timeSelect) return;

  const date = dateInput.value;
  const request = ++availabilityRequest;

  resetTimeSelect("Consultando horarios...");

  if (!date) {
    resetTimeSelect("Selecciona primero una fecha");
    return;
  }

  if (date < todayInSpain()) {
    resetTimeSelect("Fecha no válida");
    showStatus(
      bookingStatus,
      "No puedes reservar en una fecha pasada.",
      "error"
    );
    return;
  }

  try {
    const { data } = await api(
      `/api/disponibilitat?fecha=${encodeURIComponent(date)}`
    );

    if (request !== availabilityRequest || dateInput.value !== date) return;

    const slots = getSlots(data)
      .map(getSlotDetails)
      .filter(slot => slot && slot.time && slot.available);

    timeSelect.replaceChildren(
      new Option(
        slots.length ? "Selecciona una hora" : "No hay horarios disponibles",
        ""
      )
    );

    for (const slot of slots) {
      timeSelect.add(new Option(slot.time, slot.time));
    }

    timeSelect.disabled = slots.length === 0;

    showStatus(
      bookingStatus,
      slots.length
        ? "Elige una de las horas disponibles."
        : "No hay horas libres para esta fecha.",
      slots.length ? "info" : "error"
    );

  } catch (error) {
    if (request !== availabilityRequest) return;

    resetTimeSelect("Error al cargar horarios");

    showStatus(
      bookingStatus,
      `No se pudo consultar la disponibilidad: ${error.message}`,
      "error"
    );
  }
}

/* VALIDAR TELÉFONO */

function validPhone(phone) {
  return /^[0-9]{9}$/.test(phone);
}

/* CREAR RESERVA */

async function submitReservation(event) {
  event.preventDefault();

  if (bookingBusy || !bookingForm) return;
  if (!bookingForm.reportValidity()) return;

  const form = new FormData(bookingForm);

  const reservation = {
    name: String(form.get("name") || "").trim(),
    phone: String(form.get("phone") || "").trim(),
    service: String(form.get("service") || "").trim(),
    brand: String(form.get("brand") || "").trim(),
    model: String(form.get("model") || "").trim(),
    plate: String(form.get("plate") || "").trim().toUpperCase(),
    date: String(form.get("date") || ""),
    time: String(form.get("time") || ""),
    description: String(form.get("description") || "").trim(),
    observations: String(form.get("observations") || "").trim()
  };

  if (!validPhone(reservation.phone)) {
    showStatus(
      bookingStatus,
      "El teléfono debe tener exactamente 9 cifras.",
      "error"
    );
    phoneInput?.focus();
    return;
  }

  if (reservation.date < todayInSpain()) {
    showStatus(bookingStatus, "La fecha no puede estar en el pasado.", "error");
    return;
  }

  if (!reservation.time) {
    showStatus(bookingStatus, "Selecciona una hora disponible.", "error");
    return;
  }

  bookingBusy = true;

  const button = bookingForm.querySelector('[type="submit"]');
  const originalText = button?.textContent;

  if (button) {
    button.disabled = true;
    button.textContent = "ENVIANDO...";
  }

  showStatus(bookingStatus, "Comprobando y guardando la reserva...");

  try {
    const { data } = await api("/api/reserves", {
      method: "POST",
      body: JSON.stringify(reservation)
    });

    showStatus(
      bookingStatus,
      data?.message || "¡Tu solicitud de reserva se ha enviado correctamente!",
      "success"
    );

    bookingForm.reset();
    dateInput.min = todayInSpain();
    resetTimeSelect("Selecciona primero una fecha");

  } catch (error) {
    if (error.status === 409) {
      showStatus(
        bookingStatus,
        "Ese horario ya no está disponible. Selecciona otro.",
        "error"
      );
      await loadAvailability();
    } else {
      showStatus(bookingStatus, error.message, "error");
    }

  } finally {
    bookingBusy = false;

    if (button) {
      button.disabled = false;
      button.textContent = originalText || "SOLICITAR CITA";
    }
  }
}

/* CHAT IA */

async function sendMessage(event) {
  event.preventDefault();

  if (chatBusy || !chatForm) return;

  const input = chatForm.elements.namedItem("message");
  const message = input.value.trim();

  if (!message) return;

  chatBusy = true;
  input.disabled = true;

  const button = chatForm.querySelector('[type="submit"]');
  if (button) button.disabled = true;

  addMessage(message, "user");
  input.value = "";

  showStatus(chatStatus, "El asistente está preparando una respuesta...");

  try {
    const { data } = await api("/api/chat", {
      method: "POST",
      body: JSON.stringify({
        message,
        conversationId
      })
    });

    conversationId =
      data?.conversationId ||
      data?.conversation_id ||
      conversationId;

    const answer =
      data?.reply ||
      data?.response ||
      data?.answer ||
      data?.message;

    if (typeof answer !== "string" || !answer.trim()) {
      throw new Error("El servidor no ha devuelto una respuesta válida.");
    }

    addMessage(answer, "assistant");
    showStatus(chatStatus, "Respuesta recibida.", "success");

  } catch (error) {
    showStatus(
      chatStatus,
      `No se pudo conectar con Taller IA: ${error.message}`,
      "error"
    );

  } finally {
    chatBusy = false;
    input.disabled = false;
    if (button) button.disabled = false;
    input.focus();
  }
}

/* INICIALIZAR */

if (dateInput) {
  dateInput.addEventListener("change", loadAvailability);
}

if (bookingForm) {
  bookingForm.addEventListener("submit", submitReservation);
}

if (chatForm) {
  chatForm.addEventListener("submit", sendMessage);

  addMessage(
    "¡Hola! Soy el asistente de Taller Vázquez. Cuéntame qué le ocurre a tu coche y te ayudaré a solicitar una cita.",
    "assistant"
  );
}

loadBusiness();
