// js/FormularioAlbum.js
// -------------------------------------------------------------
// Gestiona el formulario de subida de álbumes.
//
// - Carga dinámicamente la lista de canciones existentes.
// - Carga los géneros desde el microservicio de contenidos.
// - Permite seleccionar canciones y géneros.
// - Muestra una previsualización de la portada del álbum.
// - Envía todo al endpoint /api/albumes usando el JWT guardado en localStorage.
// - Inicializa estadísticas del álbum en el microservicio de estadísticas.
//

// Backend principal (álbumes, canciones, géneros)
const API_BASE = "http://127.0.0.1:8080";

// Backend de estadísticas
const API_STATS = "http://127.0.0.1:8081";


document.addEventListener("DOMContentLoaded", () => {
  // --- Referencias al DOM ---
  const form = document.getElementById("uploadAlbumForm");
  const imgPortadaInput = document.getElementById("imgPortada");
  const previewImg = document.getElementById("previewAlbumImg");

  const cancionesContainer = document.getElementById("canciones-list-container");
  const songsInvalid = document.getElementById("songsInvalid");

  const genreGrid = document.getElementById("genreGrid");
  const genreInvalid = document.getElementById("genreInvalid");

  if (!form) {
    console.error('El formulario con ID "uploadAlbumForm" no se encontró.');
    return;
  }

  // -------------------------------------------------------------
  // 0) Obtener el ID del artista desde el token
  // -------------------------------------------------------------
  function getArtistaIdFromToken() {
    const token = localStorage.getItem("authToken");
    if (!token) return null;

    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      return payload.sub || payload.id || payload.artistaId;
    } catch (e) {
      console.error("Error al decodificar el token:", e);
      return null;
    }
  }

  // -------------------------------------------------------------
  // 1) Cargar canciones existentes
  // -------------------------------------------------------------
  function cargarCanciones() {
    const artistaId = getArtistaIdFromToken();
    if (!artistaId) {
      cancionesContainer.innerHTML =
        '<div class="alert alert-danger">No se pudo obtener el ID del artista. Inicia sesión.</div>';
      return;
    }

    const urlCanciones = `${API_BASE}/api/artistas/${artistaId}/canciones`;

    cancionesContainer.innerHTML =
      '<div class="text-muted p-3">Cargando canciones...</div>';

    fetch(urlCanciones)
      .then((r) => {
        if (!r.ok) throw new Error(`Error al cargar canciones: ${r.status}`);
        return r.json();
      })
      .then((canciones) => {
        cancionesContainer.innerHTML = "";

        if (!canciones.length) {
          cancionesContainer.innerHTML =
            '<div class="text-muted p-3">No hay canciones disponibles.</div>';
          return;
        }

        canciones.forEach((cancion) => {
          const songItem = document.createElement("div");
          songItem.className = "song-item";
          songItem.dataset.id = cancion.id;

          const raw = cancion.imgSencillo || cancion.portada || cancion.imgPortada || cancion.coverPath || "";
          let coverUrl = "https://via.placeholder.com/50";

          if (raw) {
            if (raw.startsWith("http")) coverUrl = raw;
            else if (raw.startsWith("/")) coverUrl = `${API_BASE}${raw}`;
            else coverUrl = `${API_BASE}/${raw}`;
          }

          const precio =
            typeof cancion.precio === "number"
              ? cancion.precio.toFixed(2)
              : cancion.precio || "0.00";

          songItem.innerHTML = `
            <img src="${coverUrl}" class="song-item-cover">
            <div class="song-item-info">
              <strong>${cancion.nomCancion || "(sin título)"}</strong>
              <small class="text-muted">ID: ${cancion.id} - ${precio} €</small>
            </div>
          `;

          songItem.addEventListener("click", () => {
            songItem.classList.toggle("selected");
          });

          cancionesContainer.appendChild(songItem);
        });
      })
      .catch((err) => {
        console.error(err);
        cancionesContainer.innerHTML =
          '<div class="alert alert-danger">Error al cargar las canciones.</div>';
      });
  }

  cargarCanciones();

  // -------------------------------------------------------------
  // 2) Cargar géneros
  // -------------------------------------------------------------
  const urlGeneros = `${API_BASE}/api/generos`;

  async function cargarGeneros() {
    try {
      const res = await fetch(urlGeneros);
      if (!res.ok) throw new Error("Error al cargar géneros");
      const generos = await res.json();

      genreGrid.innerHTML = "";

      generos.forEach((g) => {
        const id = `genre-${g.toLowerCase().replace(/\s+/g, "-")}`;

        const input = document.createElement("input");
        input.type = "checkbox";
        input.className = "btn-check";
        input.id = id;
        input.value = g;

        const label = document.createElement("label");
        label.className = "btn btn-outline-primary btn-sm m-1";
        label.htmlFor = id;
        label.textContent = g;

        genreGrid.appendChild(input);
        genreGrid.appendChild(label);
      });
    } catch (e) {
      console.error(e);
      genreGrid.innerHTML = '<span class="text-muted">(géneros no disponibles)</span>';
    }
  }

  cargarGeneros();

  // -------------------------------------------------------------
  // 3) Previsualización portada
  // -------------------------------------------------------------
  if (imgPortadaInput && previewImg) {
    imgPortadaInput.addEventListener("change", () => {
      const file = imgPortadaInput.files?.[0];
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

  // -------------------------------------------------------------
  // 4) Envío del formulario
  // -------------------------------------------------------------
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    event.stopPropagation();

    form.classList.add("was-validated");
    if (!form.checkValidity()) return;

    // Validar géneros
    const selectedGenres = Array.from(
      genreGrid.querySelectorAll('input[type="checkbox"]:checked')
    ).map((el) => el.value);

    if (!selectedGenres.length) {
      genreInvalid.style.display = "block";
      return;
    }
    genreInvalid.style.display = "none";

    // Validar canciones
    const selectedSongs = document.querySelectorAll(".song-item.selected");
    if (!selectedSongs.length) {
      songsInvalid.style.display = "block";
      return;
    }
    songsInvalid.style.display = "none";

    // Construcción del FormData
    const formData = new FormData();
    formData.append("titulo", form.querySelector("#nomAlbum").value);
    formData.append("date", form.querySelector("#date").value);
    formData.append("precio", form.querySelector("#precio").value);

    if (imgPortadaInput.files.length > 0) {
      formData.append("portada", imgPortadaInput.files[0]);
    }

    selectedGenres.forEach((g) => formData.append("genres", g));
    selectedSongs.forEach((s) => formData.append("canciones_ids", s.dataset.id));

    const token = localStorage.getItem("authToken");

    fetch(`${API_BASE}/api/albumes`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    })
      .then((res) => {
        if (!res.ok)
          return res.json().catch(() => null).then((b) => {
            throw new Error(b?.detail || `Error HTTP ${res.status}`);
          });
        return res.json();
      })
      .then((data) => {
        console.log("Álbum subido:", data);

        // -------------------------------------------------------------
        // 🔥 INICIALIZAR ESTADÍSTICAS DEL ÁLBUM (AÑADIDO DEL 2º ARCHIVO)
        // -------------------------------------------------------------
        if (data?.id) {
          fetch(`${API_STATS}/estadisticas/album`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ idAlbum: data.id }),
          })
            .then((r) =>
              r.ok
                ? console.log("Estadísticas creadas correctamente.")
                : console.warn("Error estadísticas:", r.status)
            )
            .catch((e) =>
              console.error("Error conectando con estadísticas:", e)
            );
        }

        alert("✅ ¡Álbum subido correctamente!");

        form.reset();
        form.classList.remove("was-validated");
        previewImg.style.display = "none";

        document
          .querySelectorAll(".song-item.selected")
          .forEach((x) => x.classList.remove("selected"));

        // Redirección original del primer archivo
        window.location.href = "/musica";
      })
      .catch((e) => {
        console.error(e);
        alert("❌ Error al subir el álbum: " + e.message);
      });
  });
});
