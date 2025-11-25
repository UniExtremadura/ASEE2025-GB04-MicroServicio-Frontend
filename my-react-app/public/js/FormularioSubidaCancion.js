// FormularioSubidaCancion.js
// -------------------------------------------------------------

// Backend de CONTENIDOS (Puerto 8080)
const API_BASE = "http://127.0.0.1:8080";

// Backend de ESTADÍSTICAS (Puerto 8081)
const STATS_BASE_URL = "http://localhost:8081";

// -------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("uploadSongForm");

  // Campos del DOM
  const campoTitulo = document.getElementById("nomCancion");
  const campoAudio = document.getElementById("archivoMp3");
  const campoPortada = document.getElementById("imgPortada");
  const genreGrid = document.getElementById("genreGrid");
  const genreInvalid = document.getElementById("genreInvalid");
  const campoFecha = document.getElementById("date");
  const campoPrecio = document.getElementById("precio");
  const previewImg = document.getElementById("previewImg");

  // --------------------------------------------
  // A. Cargar géneros al iniciar
  // --------------------------------------------
  loadGenres();

  async function loadGenres() {
    try {
      const res = await fetch(`${API_BASE}/api/generos`);
      if (!res.ok) throw new Error("No se pudieron obtener los géneros");

      const genres = await res.json();
      genreGrid.innerHTML = "";

      (genres || []).forEach((g) => {
        const id = `genre-${g.toLowerCase().replace(/\s+/g, "-")}`;

        const input = document.createElement("input");
        input.type = "checkbox";
        input.className = "btn-check";
        input.id = id;
        input.value = g;
        input.autocomplete = "off";

        const label = document.createElement("label");
        label.className = "btn btn-outline-primary btn-sm m-1";
        label.htmlFor = id;
        label.textContent = g;

        genreGrid.appendChild(input);
        genreGrid.appendChild(label);
      });
    } catch (e) {
      console.error(e);
      genreGrid.innerHTML =
        '<span class="text-muted">(géneros no disponibles)</span>';
    }
  }

  // --------------------------------------------
  // B. Previsualización de portada
  // --------------------------------------------
  if (campoPortada && previewImg) {
    campoPortada.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          previewImg.src = ev.target.result;
          previewImg.style.display = "block";
        };
        reader.readAsDataURL(file);
      } else {
        previewImg.src = "";
        previewImg.style.display = "none";
      }
    });
  }

  // --------------------------------------------
  // C. Validación de extensión de audio
  // --------------------------------------------
  function audioExtensionValida(file) {
    if (!file) return false;
    const nombre = file.name.toLowerCase();
    return (
      nombre.endsWith(".mp3") ||
      nombre.endsWith(".wav") ||
      nombre.endsWith(".flac") ||
      nombre.endsWith(".ogg")
    );
  }

  // --------------------------------------------
  // D. Submit del formulario
  // --------------------------------------------
  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!form.checkValidity()) {
      form.classList.add("was-validated");
      return;
    }

    const TOKEN = localStorage.getItem("authToken");
    if (!TOKEN) {
      alert("No hay token de sesión. Inicia sesión para poder subir canciones.");
      return;
    }

    // Géneros seleccionados
    const selectedGenres = Array.from(
      genreGrid.querySelectorAll('input[type="checkbox"]:checked')
    ).map((el) => el.value);

    if (selectedGenres.length === 0) {
      genreInvalid.style.display = "block";
      return;
    } else {
      genreInvalid.style.display = "none";
    }

    // Validación del audio
    const audioFile = campoAudio.files[0];
    if (!audioFile) {
      alert("Debes seleccionar un archivo de audio.");
      return;
    }
    if (!audioExtensionValida(audioFile)) {
      alert("Formato de audio no válido. Usa MP3, WAV, FLAC u OGG.");
      return;
    }

    // Construcción de FormData
    const fd = new FormData();
    fd.append("nomCancion", campoTitulo.value.trim());
    fd.append("precio", String(campoPrecio.value || 0));
    selectedGenres.forEach((g) => fd.append("genres", g));

    const dateVal = campoFecha.value.trim();
    if (dateVal) fd.append("date", dateVal);

    fd.append("audio", audioFile);

    const portadaFile = campoPortada.files[0];
    if (portadaFile) fd.append("portada", portadaFile);

    try {
      // =====================================================
      // PASO 1 — SUBIR CANCIÓN A CONTENIDOS (8080)
      // =====================================================
      const res = await fetch(`${API_BASE}/api/canciones`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${TOKEN}`,
        },
        body: fd,
      });

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        const newSongId = data?.id;

        // =====================================================
        // PASO 2 — REGISTRO EN ESTADÍSTICAS (8081)
        // =====================================================
        if (newSongId) {
          try {
            await fetch(`${STATS_BASE_URL}/estadisticas/cancion`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${TOKEN}`,
              },
              body: JSON.stringify({ idCancion: newSongId }),
            });

            console.log(
              `📊 Estadísticas inicializadas para canción ID: ${newSongId}`
            );
          } catch (statsError) {
            console.error("⚠️ Error conectando con estadísticas:", statsError);
          }
        }

        // ---------------------------------------
        // Éxito total
        // ---------------------------------------
        alert(
          `✅ Canción subida correctamente.${
            newSongId ? "\nID: " + newSongId : ""
          }`
        );

        form.reset();
        previewImg.style.display = "none";
        form.classList.remove("was-validated");

        // Redirección a la lista de música
        window.location.href = "/musica";
        return;
      }

      // ---------------------------------------
      // Error del servidor
      // ---------------------------------------
      let msg = `Error ${res.status}`;
      try {
        const err = await res.json();
        if (err?.detail) {
          msg += `: ${JSON.stringify(err.detail)}`;
        }
      } catch {}

      alert("❌ " + msg);
    } catch (e) {
      console.error(e);
      alert("❌ No se pudo contactar con el servidor.");
    }
  });
});
