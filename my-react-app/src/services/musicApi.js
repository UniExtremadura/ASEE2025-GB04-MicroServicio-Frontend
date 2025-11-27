import axios from "axios";

const CONTENTS_BASE_URL = "http://127.0.0.1:8080/api";
const USERS_BASE_URL = "http://127.0.0.1:8001"; // msUsuarios

const api = axios.create({
  baseURL: CONTENTS_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("authToken");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const getArtistEmailFromToken = () => {
  const token = localStorage.getItem("authToken");
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.sub || payload.email;
  } catch (error) {
    console.error("Error decoding token:", error);
    return null;
  }
};

export const getStoredUserEmail = () => {
  try {
    const userData = localStorage.getItem("userData");
    if (userData) {
      const parsed = JSON.parse(userData);
      if (parsed?.email) return parsed.email;
      if (parsed?.user_data?.email) return parsed.user_data.email;
    }
  } catch (err) {
    console.warn("No se pudo parsear userData de localStorage", err);
  }
  const fromToken = getArtistEmailFromToken();
  if (fromToken) return fromToken;
  return null;
};

// ... (MANTENER CÓDIGO EXISTENTE: fetchArtistAlbums, fetchArtistSongs, updateAlbum, updateSong, deleteAlbum, deleteSong, fetchPublicSongs, fetchSongById, fetchPublicAlbums, fetchAlbumById, fetchAlbumTracks, registerSongPlay) ...

export const fetchArtistAlbums = async (artistEmail) => {
  try {
    const response = await api.get(`/artistas/${artistEmail}/albumes`);
    return response.data;
  } catch (error) {
    console.error("Error fetching albums:", error);
    throw error;
  }
};

export const fetchArtistSongs = async (artistEmail) => {
  try {
    const response = await api.get(`/artistas/${artistEmail}/canciones`);
    return response.data;
  } catch (error) {
    console.error("Error fetching songs:", error);
    throw error;
  }
};

const toISODate = (d) => (d ? String(d).slice(0, 10) : null);

export const updateAlbum = async (albumId, data, coverFile) => {
  const form = new FormData();
  if (data.titulo !== undefined) form.append("titulo", data.titulo);
  if (data.precio !== undefined) form.append("precio", data.precio);
  if (data.date) form.append("date", toISODate(data.date));
  if (Array.isArray(data.genre)) {
    data.genre.forEach((g) => form.append("genre", g));
  }
  if (Array.isArray(data.canciones_ids)) {
    data.canciones_ids.forEach((id) => form.append("canciones_ids", id));
  }
  if (Array.isArray(data.artista_emails)) {
    data.artista_emails.forEach((email) =>
      form.append("artista_emails", email),
    );
  }
  if (coverFile) {
    form.append("portada", coverFile);
  }
  const response = await api.put(`/albumes/${albumId}`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
};

export const updateSong = async (songId, data, coverFile) => {
  const form = new FormData();
  form.append("nomCancion", data.nomCancion || data.titulo);
  if (data.precio !== undefined) form.append("precio", data.precio);
  if (data.date) form.append("date", toISODate(data.date));
  if (data.idAlbum !== undefined && data.idAlbum !== null) {
    form.append("idAlbum", data.idAlbum);
  }
  if (Array.isArray(data.genres)) {
    data.genres.forEach((g) => form.append("generos", g));
  }
  if (Array.isArray(data.artista_emails)) {
    data.artista_emails.forEach((email) =>
      form.append("artista_emails", email),
    );
  }
  if (coverFile) {
    form.append("portada", coverFile);
  }
  const response = await api.put(`/canciones/${songId}`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
};

export const deleteAlbum = async (albumId) => {
  const response = await api.delete(`/albumes/${albumId}`);
  return response.data;
};

export const deleteSong = async (songId) => {
  const response = await api.delete(`/canciones/${songId}`);
  return response.data;
};

export const fetchPublicSongs = async () => {
  const response = await api.get("/canciones");
  return response.data;
};

export const fetchSongById = async (songId) => {
  const response = await api.get(`/canciones/${songId}`);
  return response.data;
};

export const fetchPublicAlbums = async () => {
  const response = await api.get("/albumes");
  return response.data;
};

export const fetchAlbumById = async (albumId) => {
  const response = await api.get(`/albumes/${albumId}`);
  return response.data;
};

export const fetchAlbumTracks = async (albumId) => {
  const response = await api.get(`/albumes/${albumId}/canciones`);
  return response.data;
};

export const registerSongPlay = async (songId) => {
  const response = await api.post(`/canciones/${songId}/play`);
  return response.data;
};

export const purchaseSong = async ({ songId, pricePaid, userEmail }) => {
  const user_ref = userEmail || getStoredUserEmail();
  if (!user_ref) {
    const err = new Error("No se pudo determinar el email del usuario.");
    err.code = "missing_user_email";
    throw err;
  }
  const response = await api.post("/compras", {
    song_id: songId,
    user_ref,
    price_paid: pricePaid,
  });
  return response.data;
};

export const purchaseAlbum = async ({ albumId, pricePaid, userEmail }) => {
  const user_ref = userEmail || getStoredUserEmail();
  if (!user_ref) {
    const err = new Error("No se pudo determinar el email del usuario.");
    err.code = "missing_user_email";
    throw err;
  }
  const response = await api.post(`/albumes/${albumId}/compras`, {
    user_ref,
    price_paid: pricePaid,
  });
  return response.data;
};

// =====================================
// NUEVAS FUNCIONES DE VERIFICACIÓN
// =====================================

/** Verifica si la canción ya fue comprada */
export const checkSongPurchase = async (userRef, songId) => {
  try {
    const response = await api.get(`/compras/check`, {
      params: { user_ref: userRef, song_id: songId },
    });
    return response.data.purchased; // true/false
  } catch (error) {
    console.error("Error verificando compra de canción:", error);
    return false;
  }
};

/** Obtiene lista de IDs de álbumes comprados para verificar localmente */
export const getPurchasedAlbums = async (userRef) => {
  try {
    const response = await api.get(`/compras/albumes`, {
      params: { user_ref: userRef },
    });
    // response.data es un array de ints [1, 2, 5...]
    return response.data;
  } catch (error) {
    console.error("Error obteniendo álbumes comprados:", error);
    return [];
  }
};

// ... (MANTENER CÓDIGO EXISTENTE DE USUARIOS Y PLAYLISTS) ...

const usersApi = axios.create({
  baseURL: USERS_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

export const fetchArtistByEmail = async (email) => {
  if (!email) return null;
  try {
    const response = await usersApi.get(
      `/artistas/${encodeURIComponent(email)}`,
    );
    return response.data;
  } catch (error) {
    console.error("Error fetching artist by email:", email, error);
    return null;
  }
};

export const fetchArtistsByEmails = async (emails) => {
  if (!Array.isArray(emails) || emails.length === 0) return {};
  const uniqueEmails = Array.from(
    new Set(emails.filter((e) => typeof e === "string" && e.trim().length > 0)),
  );
  const result = {};
  await Promise.all(
    uniqueEmails.map(async (email) => {
      const artist = await fetchArtistByEmail(email);
      if (artist) result[email] = artist;
    }),
  );
  return result;
};

export const fetchPlaylists = async () => {
  const response = await api.get("/playlists");
  return response.data;
};

export const fetchPlaylistById = async (id) => {
  const response = await api.get(`/playlists/${id}`);
  return response.data;
};

export const createPlaylist = async ({ name, description, songIds = [] }) => {
  const response = await api.post("/playlists", {
    name,
    description,
    song_ids: songIds,
  });
  return response.data;
};

export const updatePlaylist = async (id, { name, description }) => {
  const payload = {};
  if (name !== undefined) payload.name = name;
  if (description !== undefined) payload.description = description;
  const response = await api.patch(`/playlists/${id}`, payload);
  return response.data;
};

export const deletePlaylist = async (id) => {
  await api.delete(`/playlists/${id}`);
};

export const addSongToPlaylist = async (playlistId, songId) => {
  const response = await api.post(`/playlists/${playlistId}/songs`, {
    song_id: songId,
  });
  return response.data;
};

export const removeSongFromPlaylist = async (playlistId, songId) => {
  const response = await api.delete(`/playlists/${playlistId}/songs/${songId}`);
  return response.data;
};

// Obtener comentarios de una canción
export const fetchSongComments = async (songId) => {
  const response = await api.get(`/canciones/${songId}/comentarios`);
  return response.data;
};

// Publicar comentario en una canción
export const postSongComment = async (songId, content) => {
  const response = await api.post(`/canciones/${songId}/comentarios`, {
    content,
  });
  return response.data;
};

// Obtener comentarios de un álbum
export const fetchAlbumComments = async (albumId) => {
  const response = await api.get(`/albumes/${albumId}/comentarios`);
  return response.data;
};

// Publicar comentario en un álbum
export const postAlbumComment = async (albumId, content) => {
  const response = await api.post(`/albumes/${albumId}/comentarios`, {
    content,
  });
  return response.data;
};
