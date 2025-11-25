const API_BASE_URL = 'http://127.0.0.1:8001';
const COMPRAS_API_URL = 'http://127.0.0.1:8080/api';
const STATS_BASE_URL = "http://localhost:8081";

export const fetchArtistSongs = async (artistEmail) => {
  try {
    const response = await fetch(`${COMPRAS_API_URL}/artistas/${encodeURIComponent(artistEmail)}/canciones`);
    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }
    return response.json();
  } catch (error) {
    console.error('Error fetching artist songs:', error);
    throw error;
  }
};

export const fetchArtistAlbums = async (artistEmail) => {
  try {
    const response = await fetch(`${COMPRAS_API_URL}/artistas/${encodeURIComponent(artistEmail)}/albumes`);
    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }
    return response.json();
  } catch (error) {
    console.error('Error fetching artist albums:', error);
    throw error;
  }
};


export const fetchData = async (endpoint) => {
  try {
    const response = await fetch(`${API_BASE_URL}/${endpoint}`);
    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }
    return response.json();
  } catch (error) {
    console.error('Error fetching data:', error);
    throw error;
  }
};

export const postData = async (endpoint, data) => {
  try {
    const response = await fetch(`${API_BASE_URL}/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }
    return response.json();
  } catch (error) {
    console.error('Error posting data:', error);
    throw error;
  }
};

export const getArtistEmailFromToken = () => {
  const token = localStorage.getItem("authToken");
  if (!token) return null;

  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.sub || payload.email; // Ajusta según tu JWT
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

export const fetchUserByEmail = async (email) => {
  const response = await fetch(`${API_BASE_URL}/usuarios/${encodeURIComponent(email)}`);
  if (!response.ok) {
    throw new Error(`Error ${response.status}: ${response.statusText}`);
  }
  return response.json();
};

export const fetchArtistByEmail = async (email) => {
  const response = await fetch(`${API_BASE_URL}/artistas/${encodeURIComponent(email)}`);
  if (!response.ok) {
    throw new Error(`Error ${response.status}: ${response.statusText}`);
  }
  return response.json();
};

export const fetchArtistsByEmails = async (emails) => {
  if (!Array.isArray(emails) || emails.length === 0) return {};

  const uniqueEmails = Array.from(
    new Set(
      emails.filter(
        (email) => typeof email === "string" && email.trim().length > 0,
      ),
    ),
  );

  const result = {};

  await Promise.all(
    uniqueEmails.map(async (email) => {
      const artist = await fetchArtistByEmail(email);
      if (artist) {
        result[email] = artist;
      }
    }),
  );

  return result;
};

export const fetchUserPurchases = async (email) => {
  try {
    const response = await fetch(`${COMPRAS_API_URL}/compras?user_ref=${encodeURIComponent(email)}`);
    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }
    return response.json();
  } catch (error) {
    console.error('Error fetching purchases:', error);
    throw error;
  }
};

export const fetchSongById = async (songId) => {
  try {
    const response = await fetch(`${COMPRAS_API_URL}/canciones/${songId}`);
    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }
    return response.json();
  } catch (error) {
    console.error('Error fetching song:', error);
    throw error;
  }
};

export const fetchUserAlbumPurchases = async (email) => {
  try {
    const response = await fetch(`${COMPRAS_API_URL}/compras/albumes?user_ref=${encodeURIComponent(email)}`);
    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }
    return response.json();
  } catch (error) {
    console.error('Error fetching album purchases:', error);
    throw error;
  }
};

export const fetchAlbumById = async (albumId) => {
  try {
    const response = await fetch(`${COMPRAS_API_URL}/albumes/${albumId}`);
    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }
    return response.json();
  } catch (error) {
    console.error('Error fetching album details:', error);
    throw error;
  }
};

export const purchaseSong = async ({ songId, pricePaid, userEmail }) => {
  const token = localStorage.getItem("authToken");
  if (!token) {
    throw new Error("Authentication token not found.");
  }

  try {
    const response = await fetch(`${COMPRAS_API_URL}/compras/cancion`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        id_cancion: songId,
        precio_pagado: pricePaid,
        user_ref: userEmail,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(errorData.detail || `Error ${response.status}`);
    }

    return response.json();
  } catch (error) {
    console.error('Error purchasing song:', error);
    throw error;
  }
};

export const registerSongPlay = async (songId) => {
  try {
    const response = await fetch(`${COMPRAS_API_URL}/canciones/${songId}/reproducir`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }
    return response.json();
  } catch (error) {
    console.error('Error registering song play:', error);
    throw error;
  }
};

// --- NUEVAS FUNCIONES PARA ELIMINAR ---

export const deleteUser = async (email) => {
  const response = await fetch(`${API_BASE_URL}/usuarios/${encodeURIComponent(email)}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error(`Error ${response.status}: ${response.statusText}`);
  }
  return response.json();
};

export const deleteArtist = async (email) => {
  const response = await fetch(`${API_BASE_URL}/artistas/${encodeURIComponent(email)}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error(`Error ${response.status}: ${response.statusText}`);
  }
  return response.json();
};

// ==========================================
// 📊 MICROSERVICIO DE ESTADÍSTICAS (8081)
// ==========================================
export const fetchAllSongStats = async (startDate, endDate) => {
  try {
    // URL Correcta: /estadisticas/canciones
    let url = `${STATS_BASE_URL}/estadisticas/canciones`;
    if (startDate && endDate) {
        url += `?fechaInicio=${startDate}&fechaFin=${endDate}`;
    }
    const response = await fetch(url);
    if (!response.ok) throw new Error("Error fetching song stats");
    return await response.json();
  } catch (error) {
    console.error("❌ Error en fetchAllSongStats:", error);
    return []; 
  }
};

// Obtener todas las estadísticas de álbumes
export const fetchAllAlbumStats = async (startDate, endDate) => {
  try {
    // URL Correcta: /estadisticas/albumes
    let url = `${STATS_BASE_URL}/estadisticas/albumes`;
    if (startDate && endDate) {
        url += `?fechaInicio=${startDate}&fechaFin=${endDate}`;
    }
    const response = await fetch(url);
    if (!response.ok) throw new Error("Error fetching album stats");
    return await response.json();
  } catch (error) {
    console.error("❌ Error en fetchAllAlbumStats:", error);
    return [];
  }
};

// Obtener estadísticas de una canción específica
export const fetchSongStatById = async (songId) => {
  try {
    const url = `${STATS_BASE_URL}/estadisticas/canciones/${songId}`;
    const response = await fetch(url);
    if (!response.ok) {
      // Si devuelve 404 es normal si la canción no tiene stats aún
      if (response.status === 404) return null;
      const body = await response.text();
      console.error(`❌ [STATS API] Error ${response.status} fetchSongStatById. Body:`, body);
      throw new Error(`Error ${response.status} fetchSongStatById`);
    }
    return await response.json();
  } catch (error) {
    console.error("💥 [STATS API] Error fetchSongStatById:", error);
    return null;
  }
};

// Obtener estadísticas de un álbum específico
export const fetchAlbumStatById = async (albumId) => {
  try {
    const url = `${STATS_BASE_URL}/estadisticas/albumes/${albumId}`;
    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 404) return null;
      const body = await response.text().catch(() => "");
      console.error(`❌ [STATS API] Error ${response.status} fetchAlbumStatById. Body:`, body);
      throw new Error(`Error ${response.status} fetchAlbumStatById`);
    }
    return await response.json();
  } catch (error) {
    console.error("💥 [STATS API] Error fetchAlbumStatById:", error);
    return null;
  }
};

// Obtener reproducciones de canciones por IDs
export const fetchSongsPlaysByIds = async (songIds = [], startDate, endDate) => {
  try {
    // URL Correcta: /estadisticas/canciones/reproducciones
    const url = `${STATS_BASE_URL}/estadisticas/canciones/reproducciones`;
    
    // Construir el body con los IDs y fechas (si existen)
    const body = {
      ids: songIds,
      fechaInicio: startDate || null,
      fechaFin: endDate || null
    };
    
    console.log(`📊 Fetching songs plays by IDs from: ${url}`, body);
    
    const response = await fetch(url, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(body)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ HTTP error! status: ${response.status}`, errorText);
      return {}; // Devolvemos objeto vacío para no romper map
    }
    
    const data = await response.json();
    console.log(`📊 Songs plays by IDs received:`, data);
    
    // IMPORTANTE: El backend ahora devuelve { "idCancion": plays, "idCancion2": plays... }
    // o { "reproducciones_totales": X } si no lo cambiaste.
    // Asumiendo que cambiaste el backend para devolver Map<String, Long> por ID:
    return data;
    
  } catch (error) {
    console.error("❌ Error en fetchSongsPlaysByIds:", error);
    return {};
  }
};

// Alias para mantener compatibilidad
export const fetchSongPlaysSumByIds = fetchSongsPlaysByIds;

// Crear estadística inicial de canción
export const createSongStat = async (songData) => {
  try {
    const response = await fetch(`${STATS_BASE_URL}/estadisticas/cancion`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(songData)
    });
    
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error("❌ Error en createSongStat:", error);
    return null;
  }
};

// Alias
export const createSongStats = createSongStat;

// Crear estadística inicial de álbum
export const createAlbumStat = async (albumData) => {
  try {
    const response = await fetch(`${STATS_BASE_URL}/estadisticas/album`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(albumData)
    });
    
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error("❌ Error en createAlbumStat:", error);
    return null;
  }
};

// Alias
export const createAlbumStats = createAlbumStat;

// Registrar reproducción de canción
export const postSongReproduction = async (idCancion, emailUser) => {
  try {
    const url = `${STATS_BASE_URL}/reproducciones`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idCancion: idCancion,
        emailUser: emailUser || "anonimo"
      })
    });
    return await response.json();
  } catch (error) {
    console.error("💥 [API] Error FATAL de conexión (¿El 8081 está apagado?):", error);
  }
};

// ==========================================
// FUNCIONES PARA REGISTRAR COMPRAS
// ==========================================

export const postSongPurchase = async (songId, pricePaid) => {
  const token = localStorage.getItem("authToken");
  if (!token) return;

  try {
    await fetch(`${STATS_BASE_URL}/estadisticas/compras/cancion`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        idCancion: songId,
        precio: Number(pricePaid) 
      }),
    });
  } catch (error) {
    console.error("Error stats compras:", error);
  }
};

export const postAlbumPurchase = async (albumId, pricePaid) => {
  const token = localStorage.getItem("authToken");
  if (!token) return;

  try {
    await fetch(`${STATS_BASE_URL}/estadisticas/compras/album`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        idAlbum: albumId,
        precio: Number(pricePaid) 
      }),
    });
  } catch (error) {
    console.error("Error stats compras álbum:", error);
  }
};

// ==========================================
// FUNCIONES ADICIONALES
// ==========================================

// Forzar actualización de reproducciones de álbum
export const forceUpdateAlbumPlays = async (albumId) => {
  try {
    const url = `${STATS_BASE_URL}/estadisticas/albumes/${albumId}/actualizar-reproducciones`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    return null;
  }
};

// Eliminar estadísticas de canción
export const deleteSongStats = async (songId) => {
  try {
    const url = `${STATS_BASE_URL}/estadisticas/canciones/${songId}`;
    const response = await fetch(url, { method: "DELETE" });
    return response.ok;
  } catch (error) {
    console.error("💥 Error deleteSongStats:", error);
    return false;
  }
};

// Función para construir URLs de archivos
export const fileURL = (relativePath) => {
  if (!relativePath) return null;
  if (relativePath.startsWith("http")) return relativePath;

  const rootUrl = COMPRAS_API_URL.replace('/api', '');
  const cleanPath = relativePath.startsWith("/") ? relativePath : `/${relativePath}`;
  
  return `${rootUrl}${cleanPath}`;
};