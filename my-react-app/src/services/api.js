const API_BASE_URL = 'http://127.0.0.1:8001';
const COMPRAS_API_URL = 'http://127.0.0.1:8080/api';
const STATS_BASE_URL = "http://localhost:8081/estadisticas";

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
    let url = `${STATS_BASE_URL}/canciones`;
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

export const fetchAllAlbumStats = async (startDate, endDate) => {
  try {
    let url = `${STATS_BASE_URL}/albumes`;
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

export const fileURL = (relativePath) => {
  if (!relativePath) return null;
  
  // Si ya es una URL completa, devolverla
  if (relativePath.startsWith("http")) {
    return relativePath;
  }

  // TRUCO: Usamos la constante que ya tienes, pero le borramos "/api"
  // http://127.0.0.1:8080/api  --->  http://127.0.0.1:8080
  const rootUrl = COMPRAS_API_URL.replace('/api', '');

  // Aseguramos que el path empiece con barra /
  const cleanPath = relativePath.startsWith("/") ? relativePath : `/${relativePath}`;
  
  return `${rootUrl}${cleanPath}`;
};
export const postSongReproduction = async (idCancion, emailUser) => {
  // 1. LOG DE CONTROL: Si ves esto en la consola, la función arrancó
  console.log("🔥 [API] Ejecutando postSongReproduction. ID:", idCancion);

  try {
    // 2. URL "HARDCODED" (Escrita directa para evitar errores de variables)
    const url = "http://localhost:8081/reproducciones";
    
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idCancion: idCancion,
        emailUser: emailUser || "anonimo"
      })
    });

    // 3. LOG DE RESPUESTA
    if (response.ok) {
        console.log("✅ [API] Guardado en 8081 correctamente");
    } else {
        console.error(`❌ [API] Error del servidor 8081: ${response.status}`);
    }

    return await response.json();

  } catch (error) {
    // 4. LOG DE ERROR DE RED
    console.error("💥 [API] Error FATAL de conexión (¿El 8081 está apagado?):", error);
  }
};