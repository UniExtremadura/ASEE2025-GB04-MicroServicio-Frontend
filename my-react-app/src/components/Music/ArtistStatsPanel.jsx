import React, { useState, useEffect, useCallback, useMemo } from "react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell 
} from 'recharts';

import { 
  fetchArtistSongs,   
  fetchArtistAlbums,  
  fetchAllSongStats, 
  fetchAllAlbumStats,
  fileURL
} from "../../services/api";

import '../../styles/StatsDashboard.css';

// --- CONSTANTES ---
const ROYALTY_RATE = 0; 

// --- FUNCIONES AUXILIARES ---
const formatMoney = (amount) => {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount);
};

const getDefaultStartDate = () => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().split('T')[0];
};

const getTodayDate = () => new Date().toISOString().split('T')[0];

// --- COMPONENTE PRINCIPAL ---
const ArtistStatsPanel = ({ artistEmail }) => {
  // --- DEBUG: Verificar si llega el prop ---
  console.log("🎨 Dashboard montado. Email recibido:", artistEmail);

  // Estados de Datos
  const [mergedSongData, setMergedSongData] = useState([]);
  const [mergedAlbumData, setMergedAlbumData] = useState([]);
  const [expandedAlbums, setExpandedAlbums] = useState(new Set());
  
  // Estados de Filtro de Fecha
  const [startDate, setStartDate] = useState(getDefaultStartDate());
  const [endDate, setEndDate] = useState(getTodayDate());
  const [isAllTime, setIsAllTime] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const toggleAlbum = (albumId) => {
    setExpandedAlbums(prev => {
      const newSet = new Set(prev);
      newSet.has(albumId) ? newSet.delete(albumId) : newSet.add(albumId);
      return newSet;
    });
  };

  const fetchStats = useCallback(async () => {
    // Si no hay email, no hacemos nada (mostramos loading o error después)
    if (!artistEmail) {
        console.warn("⚠️ No hay artistEmail, esperando...");
        setLoading(false);
        return;
    }

    setLoading(true);
    setError(null);
    try {
      console.log(`🚀 Iniciando carga de datos para: ${artistEmail}`);
      const sendStart = isAllTime ? null : startDate;
      const sendEnd = isAllTime ? null : endDate;
      // 1. EJECUTAR TODAS LAS LLAMADAS EN PARALELO
    const [
            contentSongs, 
            contentAlbums, 
            statsSongs, 
            statsAlbums
        ] = await Promise.all([
            fetchArtistSongs(artistEmail),  // 👈 Nombre corregido
        fetchArtistAlbums(artistEmail), // 👈 Nombre corregido
        fetchAllSongStats(sendStart, sendEnd), 
        fetchAllAlbumStats(sendStart, sendEnd) 
]);

      console.log("✅ Datos recibidos:", { contentSongs, statsSongs });

      // 2. FUSIONAR DATOS DE CANCIONES
      // Usamos la lista de canciones del artista (contentSongs) como base
      const songsArray = Array.isArray(contentSongs) ? contentSongs : [];
      
      console.log("--- 🔍 DEBUG CRUCE DE DATOS ---");
      console.log(`1. Canciones del Content (8080): ${songsArray.length}`);
      if (songsArray.length > 0) {
          console.log("   Ejemplo ID Content:", songsArray[0].id, "Tipo:", typeof songsArray[0].id);
      }
      
      console.log(`2. Estadísticas de Mongo (8081): ${statsSongs.length}`);
      if (statsSongs.length > 0) {
          console.log("   Ejemplo ID Mongo:", statsSongs[0].idCancion, "Tipo:", typeof statsSongs[0].idCancion);
          // Chequeamos si los IDs coinciden
          const match = statsSongs.find(s => String(s.idCancion) === String(songsArray[0]?.id));
          console.log("   ¿Prueba de cruce con el primero?:", match ? "✅ COINCIDE" : "❌ NO COINCIDE");
      }
      console.log("-----------------------------------");
      // 👆👆👆 FIN DEL BLOQUE A PEGAR 👆👆👆
      const songsWithStats = songsArray.map(song => {
          // --- AQUI ES DONDE VA LA LÓGICA DE BÚSQUEDA SEGURA ---
          const stat = statsSongs.find(s => {
             // Convertimos todo a String para asegurar
             const songId = String(song.id);
             
             // Comprobamos las 3 posibilidades de nombre que puede dar Mongo
             if (s.idCancion && String(s.idCancion) === songId) return true;
             if (s.id && String(s.id) === songId) return true;
             if (s._id && String(s._id) === songId) return true;
             
             return false;
          });
          // ------------------------------------------------------
          
          const totalPlays = stat ? (stat.reproduccionesTotales || stat.reproducciones || 0) : 0; // Aseguramos nombres
          const avgRating = stat ? (stat.valoracionMedia || 0) : 0;
          
          const filteredPlays = totalPlays; // Muestra el total real sin recorta

          return {
              ...song, 
              reproducciones: filteredPlays,
              valoracion: avgRating,
              ingresosGenerados: filteredPlays * ROYALTY_RATE 
          };
      });

      // 3. FUSIONAR DATOS DE ÁLBUMES
      const albumsArray = Array.isArray(contentAlbums) ? contentAlbums : [];

      const albumsWithStats = albumsArray.map(album => {
          const stat = statsAlbums.find(a => a.idAlbum === album.id || a.id === album.id);
          
          let totalPlays = stat ? (stat.reproduccionesTotales || 0) : 0;
          let avgRating = stat ? (stat.valoracionMedia || 0) : 0;

          // Calculamos ingresos sumando las canciones procesadas anteriormente
          const albumSongs = songsWithStats.filter(s => s.idAlbum === album.id);
          const albumRevenue = albumSongs.reduce((acc, s) => acc + s.ingresosGenerados, 0);
          
          const filteredPlays = totalPlays;

          return {
              ...album,
              reproducciones: filteredPlays,
              valoracion: avgRating,
              ingresosGenerados: albumRevenue
          };
      });

      setMergedSongData(songsWithStats);
      setMergedAlbumData(albumsWithStats);

    } catch (err) {
      console.error("❌ Error cargando dashboard:", err);
      setError("Error al conectar con los servicios. Revisa que ambos backends (8080 y 8081) estén corriendo.");
    } finally {
      setLoading(false);
    }
  }, [artistEmail, startDate, endDate, isAllTime]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // --- CÁLCULOS DE VISUALIZACIÓN (Memoizados) ---
  const totalRevenue = useMemo(() => mergedSongData.reduce((acc, curr) => acc + curr.ingresosGenerados, 0), [mergedSongData]);
  const totalPlays = useMemo(() => mergedSongData.reduce((acc, curr) => acc + curr.reproducciones, 0), [mergedSongData]);
  const singles = mergedSongData.filter(song => !song.idAlbum);

  const chartData = useMemo(() => {
      return [...mergedSongData]
        .sort((a, b) => b.reproducciones - a.reproducciones)
        .slice(0, 10) // Top 10 canciones
        .map(song => ({
            name: song.nomCancion.length > 15 ? song.nomCancion.substring(0, 15) + '...' : song.nomCancion,
            reproducciones: song.reproducciones,
            fullTitle: song.nomCancion
        }));
  }, [mergedSongData]);

  // --- RENDERIZADO ---

  // Caso: No se pasó email
  if (!artistEmail) return <div className="error">No se ha seleccionado ningún artista.</div>;

  if (loading) return <div className="loading">Cargando estadísticas...</div>;
  
  if (error) return <div className="error" style={{color:'red', padding:'20px', border:'1px solid red'}}>{error}</div>;
  
  if (mergedSongData.length === 0 && mergedAlbumData.length === 0) {
      return <div className="no-content">Este artista no tiene canciones ni álbumes registrados.</div>;
  }

  return (
    <div className="artist-dashboard">
      <h2>Panel de Control: {artistEmail}</h2>

      {/* === FILTRO DE FECHAS === */}
      <div className="filters-container">
        {/* 👇 NUEVO CHECKBOX: "Ver todo" */}
        <div className="date-input-group" style={{display: 'flex', alignItems: 'center', marginRight: '20px'}}>
            <input 
                type="checkbox" 
                id="allTimeCheck"
                checked={isAllTime}
                onChange={(e) => setIsAllTime(e.target.checked)}
                style={{width: '20px', height: '20px', cursor: 'pointer'}}
            />
            <label htmlFor="allTimeCheck" style={{marginLeft: '8px', cursor: 'pointer', fontWeight: 'bold'}}>
                Ver histórico completo
            </label>
        </div>

        {/* INPUTS DE FECHA (Ahora tienen la propiedad disabled={isAllTime}) */}
        <div className="date-input-group">
            <label style={{opacity: isAllTime ? 0.5 : 1}}>Fecha Inicio:</label>
            <input 
                type="date" 
                value={startDate} 
                onChange={(e) => setStartDate(e.target.value)} 
                disabled={isAllTime} // 👈 Se bloquea si activas el histórico
                style={{opacity: isAllTime ? 0.5 : 1, cursor: isAllTime ? 'not-allowed' : 'text'}}
            />
        </div>
        <div className="date-input-group">
            <label style={{opacity: isAllTime ? 0.5 : 1}}>Fecha Fin:</label>
            <input 
                type="date" 
                value={endDate} 
                onChange={(e) => setEndDate(e.target.value)} 
                disabled={isAllTime} // 👈 Se bloquea si activas el histórico
                style={{opacity: isAllTime ? 0.5 : 1, cursor: isAllTime ? 'not-allowed' : 'text'}}
            />
        </div>
        
        {!isAllTime && (
            <div style={{marginLeft: 'auto', color: '#888', fontSize: '0.9em', alignSelf: 'center'}}>
                Periodo: <strong>{new Date(startDate).toLocaleDateString()}</strong> - <strong>{new Date(endDate).toLocaleDateString()}</strong>
            </div>
        )}
      </div>
      
      {/* === GRÁFICO DE BARRAS === */}
      <div className="chart-section">
          <h3>Tendencia de Reproducciones (Top Canciones)</h3>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
                <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" vertical={false} />
                    <XAxis 
                        dataKey="name" 
                        stroke="#666" 
                        fontSize={12} 
                        tickLine={false}
                        axisLine={false}
                    />
                    <YAxis 
                        stroke="#666" 
                        fontSize={12} 
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value}
                    />
                    <Tooltip 
                        cursor={{fill: 'var(--chart-cursor)'}} 
                        contentStyle={{ 
                            backgroundColor: '#fff', 
                            border: '1px solid #ccc', 
                            color: '#333',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                        }}
                        formatter={(value) => [value.toLocaleString(), "Reproducciones"]}
                    />
                    <Bar dataKey="reproducciones" radius={[4, 4, 0, 0]}>
                        {chartData.map((entry, index) => (
                            <Cell 
                                key={`cell-${index}`} 
                                fill={index < 3 ? '#4CAF50' : '#82ca9d'} 
                            />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
          </div>
      </div>

      {/* === RESUMEN FINANCIERO === */}
      <div className="financial-summary">
        <div className="summary-card">
            <div className="summary-title">Ingresos Estimados</div>
            <div className="summary-value" style={{color: '#1db954'}}>
                {formatMoney(totalRevenue)}
            </div>
        </div>
        <div className="summary-card">
            <div className="summary-title">Reproducciones Totales</div>
            <div className="summary-value">{totalPlays.toLocaleString()}</div>
        </div>
        <div className="summary-card">
            <div className="summary-title">Catálogo Activo</div>
            <div className="summary-value">{mergedSongData.length} Canciones</div>
        </div>
      </div>

      {/* === ÁLBUMES === */}
      {mergedAlbumData.length > 0 && (
        <>
            <h3>Detalle por Álbum</h3>
            <div className="albums-list-container">
                {mergedAlbumData.map((album) => {
                    const albumSongs = mergedSongData.filter(song => song.idAlbum === album.id);
                    const isExpanded = expandedAlbums.has(album.id);
                    // Sumamos ingresos de las canciones hijas para mostrar en la cabecera
                    const displayRevenue = albumSongs.reduce((acc, s) => acc + s.ingresosGenerados, 0);

                    return (
                    <div key={album.id} className="album-group">
                        <div className="album-header" onClick={() => toggleAlbum(album.id)}>
                            <span className={`chevron ${isExpanded ? 'expanded' : ''}`}>▶</span>
                            <div className="row-title-block album-header-title">
                                <span>{album.titulo}</span>
                                <span style={{fontSize: '0.8em', color: '#888', fontWeight: 'normal'}}>
                                    ID: {album.id} • Precio: {album.precio}€
                                </span>
                            </div>
                            <div className="row-stats-container">
                                <span className="stat-plays">💿 {album.reproducciones.toLocaleString()}</span>
                                <div className="stat-revenue">
                                    {formatMoney(displayRevenue)}
                                </div>
                            </div>
                        </div>
                        {isExpanded && (
                            <div className="album-songs-dropdown">
                                {albumSongs.length > 0 ? (
                                    albumSongs.map((song, index) => (
                                        <SongRow key={song.id} song={song} index={index} isInsideAlbum={true} />
                                    ))
                                ) : (
                                    <div className="no-content-row">No hay canciones asociadas a este álbum.</div>
                                )}
                            </div>
                        )}
                    </div>
                    );
                })}
            </div>
        </>
      )}

      {/* === SENCILLOS === */}
      {singles.length > 0 && (
          <div className="singles-section">
            <h3>Detalle por Sencillos</h3>
            <div className="songs-list-container">
                {singles.map((song, index) => (
                    <SongRow key={song.id} song={song} index={index} isInsideAlbum={false} />
                ))}
            </div>
          </div>
      )}
    </div>
  );
};

// --- SUBCOMPONENTE: FILA DE CANCIÓN ---
const SongRow = ({ song, index, isInsideAlbum }) => (
    <div className={`list-row song-row ${isInsideAlbum ? 'album-song-row' : ''}`}>
        <span className="row-index">{index + 1}</span>
        <div className="row-info-container">
            <img 
                src={fileURL(song.imgPortada)} 
                alt={song.nomCancion} 
                className="row-thumbnail"
                onError={(e) => {e.target.src = 'https://via.placeholder.com/40/333333/888888?text=🎵'}}
            />
            <div className="row-title-block">
                <span className="row-title">{song.nomCancion}</span>
                <span style={{fontSize: '0.75em', color: '#666'}}>Venta: {song.precio}€</span>
            </div>
        </div>
        <div className="row-stats-container">
            <span className="stat-plays">{song.reproducciones.toLocaleString()} rep.</span>
            <div className="stat-revenue">
                {formatMoney(song.ingresosGenerados)}
                <span className="label">est.</span>
            </div>
            {song.valoracion > 0 && (
                <span className="stat-rating">⭐ {song.valoracion.toFixed(1)}</span>
            )}
        </div>
    </div>
);

export default ArtistStatsPanel;