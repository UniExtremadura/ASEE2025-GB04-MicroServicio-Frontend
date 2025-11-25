import React, { useState, useEffect, useCallback, useMemo } from "react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell 
} from 'recharts';

import { 
  fetchArtistSongs,   
  fetchArtistAlbums,  
  fetchAllSongStats, 
  fetchAllAlbumStats,
  fetchSongPlaysSumByIds,
  fetchSongStatById,
  fetchAlbumStatById,
  forceUpdateAlbumPlays,
  fileURL
} from "../../services/api";
import '../../styles/StatsDashboard.css';

// --- UTILIDADES ---
const formatMoney = (amount) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(Number(amount) || 0);

// Devuelve la fecha de hoy (YYYY-MM-DD)
const getTodayDate = () => new Date().toISOString().split('T')[0];

// Devuelve la fecha de hace 30 días (YYYY-MM-DD)
const getDefaultStartDate = () => {
  const date = new Date();
  date.setDate(date.getDate() - 30);
  return date.toISOString().split('T')[0];
};

// Normaliza el rango de fechas para llamadas al backend
const normalizeDateRange = (start, end, allTime) => {
  if (allTime) return { start: null, end: null, isAllTime: true };
  if (!start || !end) return { start: null, end: null, isAllTime: true };

  const s = String(start).slice(0, 10);
  const e = String(end).slice(0, 10);

  if (s > e) return { start: e, end: s, isAllTime: false };
  return { start: s, end: e, isAllTime: false };
};



// --- COMPONENTE PRINCIPAL ---
const ArtistStatsDashboard = ({ artistEmail }) => {
  const [mergedSongData, setMergedSongData]   = useState([]);
  const [mergedAlbumData, setMergedAlbumData] = useState([]);
  const [expandedAlbums, setExpandedAlbums]   = useState(new Set());

  const [startDate, setStartDate] = useState(getDefaultStartDate());
  const [endDate, setEndDate]     = useState(getTodayDate());
  const [isAllTime, setIsAllTime] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const toggleAlbum = (albumId) => {
    setExpandedAlbums(prev => {
      const s = new Set(prev);
      s.has(albumId) ? s.delete(albumId) : s.add(albumId);
      return s;
    });
  };

  const fetchStats = useCallback(async () => {
    if (!artistEmail) { setLoading(false); return; }
    setLoading(true); setError(null);

    try {
      // 1) Catálogo (contenido) -> nombres/portadas/títulos
      const [contentSongs, contentAlbums] = await Promise.all([
        fetchArtistSongs(artistEmail),
        fetchArtistAlbums(artistEmail),
      ]);
      const songsArray  = Array.isArray(contentSongs)  ? contentSongs  : [];
      const albumsArray = Array.isArray(contentAlbums) ? contentAlbums : [];
      
const { start, end, isAllTime: rangeAllTime } =
  normalizeDateRange(startDate, endDate, isAllTime);

        // Canciones: reproducciones con rango (POST /estadisticas/canciones/reproducciones)
        const songIds = songsArray.map(s => String(s.id));
        const playsMap = await fetchSongPlaysSumByIds(songIds, start, end, rangeAllTime);


      const statsById = {};
      await Promise.all(
        songIds.map(async (id) => {
          const stat = await fetchSongStatById(id);
          if (stat) {
            statsById[id] = {
              ingresos: Number(stat?.ingresos ?? 0),
              valoracion: Number(stat?.valoracionMedia ?? stat?.valoracion ?? 0),
              reproduccionesFallback: Number(stat?.reproduccionesTotales ?? stat?.reproducciones ?? 0),
            };
          }
        })
      );

      const songsWithStats = songsArray.map(song => {
        const id = String(song.id);
        const plays      = playsMap[id] ?? statsById[id]?.reproduccionesFallback ?? 0;
        const ingresos   = statsById[id]?.ingresos ?? 0;
        const valoracion = statsById[id]?.valoracion ?? 0;
        return {
          ...song,
          reproducciones: Number(plays) || 0,
          ingresosGenerados: Number(ingresos) || 0,
          valoracion: Number(valoracion) || 0,
        };
      });

      // 3) Álbumes: listado general (si tu backend lo rellena) + detalle por ID + fallback por suma de canciones
      
        const statsAlbumsList = await fetchAllAlbumStats(
             rangeAllTime ? null : start,
             rangeAllTime ? null : end
        );


      const albumsWithStats = await Promise.all(
        albumsArray.map(async (album) => {
          const albumId    = String(album.id);
          const albumSongs = songsWithStats.filter(s => String(s.idAlbum) === albumId);

          // Fallback sumando canciones (ya filtradas por fecha)
          const fallbackPlays   = albumSongs.reduce((acc, s) => acc + (Number(s.reproducciones) || 0), 0);
          const fallbackRevenue = albumSongs.reduce((acc, s) => acc + (Number(s.ingresosGenerados) || 0), 0);
          const fallbackRating  = (() => {
            const vals = albumSongs.map(s => Number(s.valoracion || 0)).filter(v => v > 0);
            return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
          })();

          const fromList = (Array.isArray(statsAlbumsList) ? statsAlbumsList : []).find(a =>
            String(a?.idAlbum ?? a?.id ?? a?._id ?? "") === albumId
          );
          const fromDetail = await fetchAlbumStatById(albumId);

          const reproducciones = Number(
            (fromDetail?.reproduccionesTotales ?? fromDetail?.reproducciones ??
             fromList?.reproduccionesTotales  ?? fromList?.reproducciones  ??
             fallbackPlays) || 0
          );

          const ingresosGenerados = Number(
            (fromDetail?.ingresos ?? fromList?.ingresos ?? fallbackRevenue) || 0
          );

          const valoracion = Number(
            (fromDetail?.valoracionMedia ?? fromDetail?.valoracion ??
             fromList?.valoracionMedia  ?? fromList?.valoracion  ??
             fallbackRating) || 0
          );

          return {
            ...album,
            reproducciones,
            ingresosGenerados,
            valoracion,
            _albumSongsCount: albumSongs.length,
          };
        })
      );

      setMergedSongData(songsWithStats);
      setMergedAlbumData(albumsWithStats);
    } catch (err) {
      console.error("Error cargando dashboard:", err);
      setError("Error conectando a servicios. Revisa que contenidos (8080) y estadísticas (8081) estén corriendo.");
    } finally {
      setLoading(false);
    }
  }, [artistEmail, startDate, endDate, isAllTime]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  // --- Resumen ---
  const totalRevenue = useMemo(() => {
    const songsRevenue  = mergedSongData.reduce((acc, s) => acc + (Number(s.ingresosGenerados) || 0), 0);
    const albumsRevenue = mergedAlbumData.reduce((acc, a) => acc + (Number(a.ingresosGenerados) || 0), 0);
    return songsRevenue + albumsRevenue;
  }, [mergedSongData, mergedAlbumData]);

  const totalPlays = useMemo(() => {
    // Para evitar doble contaje, sumamos sólo canciones (filtradas por fecha)
    return mergedSongData.reduce((acc, s) => acc + (Number(s.reproducciones) || 0), 0);
  }, [mergedSongData]);

  const singles = mergedSongData.filter(song => !song.idAlbum);

  const chartData = useMemo(() => {
    const sortedSongs = [...mergedSongData]
      .sort((a, b) => (b.reproducciones || 0) - (a.reproducciones || 0))
      .slice(0, 10);
    return sortedSongs.map(song => ({
      name: song.nomCancion.length > 15 ? song.nomCancion.substring(0, 15) + '...' : song.nomCancion,
      reproducciones: song.reproducciones || 0,
      fullTitle: song.nomCancion
    }));
  }, [mergedSongData]);
  const topEarners = useMemo(() => {
    // Hacemos una copia [...mergedSongData] para no alterar el array original
    return [...mergedSongData]
      .sort((a, b) => (b.ingresosGenerados || 0) - (a.ingresosGenerados || 0))
      .slice(0, 5); // Nos quedamos con el Top 5
  }, [mergedSongData]);
  // --- Render ---
  if (!artistEmail) return <div className="error">No artist selected.</div>;
  if (loading)      return <div className="loading">Cargando estadísticas...</div>;
  if (error)        return <div className="error" style={{color:'red', padding:'20px', border:'1px solid red'}}>{error}</div>;
  if (mergedSongData.length === 0 && mergedAlbumData.length === 0)
    return <div className="no-content">Este artista no tiene canciones ni álbumes registrados.</div>;

  return (
    <div className="artist-dashboard">
      <h2>Panel de Control: {artistEmail}</h2>

      {/* === FILTROS === */}
      <div className="filters-container">
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
        <div className="date-input-group">
          <label style={{opacity: isAllTime ? 0.5 : 1}}>Fecha Inicio:</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            disabled={isAllTime}
            style={{opacity: isAllTime ? 0.5 : 1, cursor: isAllTime ? 'not-allowed' : 'text'}}
          />
        </div>
        <div className="date-input-group">
          <label style={{opacity: isAllTime ? 0.5 : 1}}>Fecha Fin:</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            disabled={isAllTime}
            style={{opacity: isAllTime ? 0.5 : 1, cursor: isAllTime ? 'not-allowed' : 'text'}}
          />
        </div>
      </div>

      {/* === GRÁFICO === */}
      {chartData.length > 0 && (
        <div className="chart-section">
          <h3>Tendencia de Reproducciones (Top Canciones)</h3>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" vertical={false} />
                <XAxis dataKey="name" stroke="#666" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#666" fontSize={12} tickLine={false} axisLine={false}
                  tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value}
                />
                <Tooltip
                  cursor={{fill: 'rgba(0,0,0,0.1)'}}
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc', color: '#333' }}
                  formatter={(value) => [value.toLocaleString(), "Reproducciones"]}
                  labelFormatter={(label, payload) => payload?.[0]?.payload?.fullTitle ?? label}
                />
                <Bar dataKey="reproducciones" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index < 3 ? '#4CAF50' : '#82ca9d'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* === RESUMEN === */}
      <div className="financial-summary">
        <div className="summary-card">
          <div className="summary-title">Ingresos Totales (Ventas)</div>
          <div className="summary-value" style={{color: '#1db954'}}>
            {formatMoney(totalRevenue)}
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-title">Reproducciones Totales</div>
          <div className="summary-value">{Number(totalPlays).toLocaleString() }</div>
        </div>
        <div className="summary-card">
          <div className="summary-title">Catálogo Activo</div>
          <div className="summary-value">{mergedSongData.length} Canciones</div>
        </div>
      </div>

      {topEarners.length > 0 && (
        <div className="chart-section" style={{ marginBottom: '40px' }}>
            <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                🏆 Top Canciones más Rentables
                <span style={{ fontSize: '0.6em', fontWeight: 'normal', color: '#888' }}>(Ventas)</span>
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {topEarners.map((song, index) => (
                    <div key={song.id} style={{
                        display: 'flex', 
                        alignItems: 'center', 
                        padding: '15px', 
                        backgroundColor: '#f9f9f9', 
                        borderRadius: '8px',
                        borderLeft: index === 0 ? '5px solid #ffd700' : '5px solid #e0e0e0' // Oro para el #1
                    }}>
                        {/* Posición */}
                        <div style={{ 
                            fontSize: '1.5em', 
                            fontWeight: 'bold', 
                            color: index === 0 ? '#d4af37' : '#aaa', 
                            width: '40px' 
                        }}>
                            #{index + 1}
                        </div>

                        {/* Portada */}
                        <img 
                            src={fileURL(song.imgPortada)} 
                            alt={song.nomCancion}
                            style={{ width: '50px', height: '50px', borderRadius: '6px', objectFit: 'cover', marginRight: '15px' }}
                            onError={(e) => { e.target.src = 'https://via.placeholder.com/50?text=🎵' }}
                        />

                        {/* Título y Datos */}
                        <div style={{ flexGrow: 1 }}>
                            <div style={{ fontWeight: 'bold', fontSize: '1.1em' }}>{song.nomCancion}</div>
                            <div style={{ fontSize: '0.85em', color: '#666' }}>
                                {Number(song.reproducciones).toLocaleString()} reproducciones
                            </div>
                        </div>

                        {/* Dinero Ganado */}
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '1.2em', fontWeight: '800', color: '#2e7d32' }}>
                                {formatMoney(song.ingresosGenerados)}
                            </div>
                            <div style={{ fontSize: '0.75em', color: '#2e7d32', backgroundColor: '#e8f5e9', padding: '2px 6px', borderRadius: '4px', display: 'inline-block' }}>
                                Generado
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
      )}
      
      {/* === ÁLBUMES === */}
      {mergedAlbumData.length > 0 && (
        <>
          <h3>Detalle por Álbum</h3>
          <div className="albums-list-container">
            {mergedAlbumData.map((album) => {
              const albumSongs = mergedSongData.filter(song => String(song.idAlbum) === String(album.id));
              const isExpanded = expandedAlbums.has(album.id);
              const displayRevenue = Number(album.ingresosGenerados || 0);

              return (
                <div key={album.id} className="album-group">
                  <div className="album-header" onClick={() => toggleAlbum(album.id)}>
                    <span className={`chevron ${isExpanded ? 'expanded' : ''}`}>▶</span>
                    <div className="row-title-block album-header-title">
                      <span>{album.titulo}</span>
                      <span style={{fontSize: '0.8em', color: '#888', fontWeight: 'normal'}}>
                        ID: {album.id} • Precio: {album.precio}€
                        {album._albumSongsCount > 0 && ` • ${album._albumSongsCount} pistas`}
                      </span>
                      
                    </div>
                    
                    <div className="row-stats-container">
                      <span className="stat-plays">💿 {Number(album.reproducciones || 0).toLocaleString()}</span>
                      <div className="stat-revenue">
                        {formatMoney(displayRevenue)}
                      </div>
                      <button
                        title="Forzar actualización de reproducciones del álbum"
                        onClick={async (e) => {
                          e.stopPropagation();
                          await forceUpdateAlbumPlays(album.id);
                          await new Promise(r => setTimeout(r, 250));
                          await fetchStats();
                        }}
                        style={{
                          marginLeft: 8, padding: '4px 8px', borderRadius: 6,
                          border: '1px solid #ddd', background: '#fff', cursor: 'pointer'
                        }}
                      >
                        ⟳
                      </button>
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

// --- FILA DE CANCIÓN ---
const SongRow = ({ song, index, isInsideAlbum }) => (
  <div className={`list-row song-row ${isInsideAlbum ? 'album-song-row' : ''}`}>
    <span className="row-index">{index + 1}</span>
    <div className="row-info-container">
      <img
        src={fileURL(song.imgPortada)}
        alt={song.nomCancion}
        className="row-thumbnail"
        onError={(e) => { e.target.src = 'https://via.placeholder.com/40/333333/888888?text=🎵' }}
      />
      <div className="row-title-block">
        <span className="row-title">{song.nomCancion}</span>
        <span style={{fontSize: '0.75em', color: '#666'}}>Precio: {song.precio}€</span>
      </div>
    </div>
    <div className="row-stats-container">
      <span className="stat-plays">{Number(song.reproducciones || 0).toLocaleString()} rep.</span>
      <div className="stat-revenue">
        {formatMoney(song.ingresosGenerados || 0)}
        <span className="label">ventas</span>
      </div>
      {Number(song.valoracion || 0) > 0 && (
        <span className="stat-rating">⭐ {Number(song.valoracion).toFixed(1)}</span>
      )}
    </div>
  </div>
);

export default ArtistStatsDashboard;
