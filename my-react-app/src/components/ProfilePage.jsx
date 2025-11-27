import React, { useRef, useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  fetchUserPurchases, 
  fetchSongById, 
  fetchUserAlbumPurchases, 
  fetchAlbumById,
  fetchUserByEmail,
  fetchArtistByEmail,
  fetchArtistsByEmails,
  deleteUser,   
  deleteArtist,
  fetchUserPlayStats,    
  fileURL
} from '../services/api';
import ShareModal from './ShareModal'; 
import '../styles/ProfilePage.css';

const API_BASE_URL = 'http://127.0.0.1:8001';
const FILES_BASE_URL = 'http://127.0.0.1:8080';

export default function ProfilePage() {
  const { email } = useParams();
  const navigate = useNavigate();
  
  const [user, setUser] = useState(null);
  const [userType, setUserType] = useState(null); 
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  
  const [purchasedSongs, setPurchasedSongs] = useState([]);
  const [purchasedAlbums, setPurchasedAlbums] = useState([]);
  const [activeTab, setActiveTab] = useState('songs');
  const [purchasesLoading, setPurchasesLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  
  const [topSongs, setTopSongs] = useState([]); 
  const [statsLoading, setStatsLoading] = useState(false);

  const [editForm, setEditForm] = useState({
    display_name: '',
    password: '',
    avatar: null
  });
  const [previewAvatar, setPreviewAvatar] = useState(null);
  const avatarInputRef = useRef(null);

  // 1. Cargar datos del Perfil
  useEffect(() => {
    const loadProfileData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const userData = await fetchUserByEmail(email);
        setUser(userData);
        setUserType('user'); 
      } catch (userErr) {
        console.log("No es usuario, probando como artista...");
        try {
          const artistData = await fetchArtistByEmail(email);
          if (artistData) {
            setUser(artistData);
            setUserType('artist'); 
          } else {
            setError(new Error("Perfil no encontrado"));
          }
        } catch (artistErr) {
          console.error("Tampoco es artista:", artistErr);
          setError(artistErr);
        }
      } finally {
        setLoading(false);
      }
    };

    if (email) {
      loadProfileData();
    }
  }, [email]);

  // 2. Verificar propiedad
  useEffect(() => {
    const checkOwnership = async () => {
      const token = localStorage.getItem('authToken');
      if (!token || !email) {
        setIsOwner(false);
        return;
      }
      try {
        const response = await fetch(`${API_BASE_URL}/auth/me`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          const currentUserEmail = data.user_data?.email || data.email;
          setIsOwner(currentUserEmail === email);
        } else {
          setIsOwner(false);
        }
      } catch (err) {
        console.error(err);
        setIsOwner(false);
      }
    };
    checkOwnership();
  }, [email]);

  // 3. Cargar Compras
  useEffect(() => {
    if (email) {
      setPurchasesLoading(true);
      const loadAllPurchases = async () => {
        try {
          const songPurchaseIds = await fetchUserPurchases(email);
          const songsPromises = songPurchaseIds.map(p => fetchSongById(p.idCancion || p));
          const songs = await Promise.all(songsPromises);
          setPurchasedSongs(songs);

          const albumPurchasesData = await fetchUserAlbumPurchases(email);
          const albumsPromises = albumPurchasesData.map(p => fetchAlbumById(p.idAlbum || p));
          const albums = await Promise.all(albumsPromises);
          setPurchasedAlbums(albums);

        } catch (err) {
          setPurchasedSongs([]);
          setPurchasedAlbums([]);
        } finally {
          setPurchasesLoading(false);
        }
      };
      loadAllPurchases();
    }
  }, [email]);

  useEffect(() => {
    if (email && activeTab === 'stats') {
      const loadStats = async () => {
        setStatsLoading(true);
        try {
          // A. Obtener Stats y Ordenar
          const statsMap = await fetchUserPlayStats(email);
          const sortedStats = statsMap ? Object.entries(statsMap)
            .map(([songId, count]) => ({ id: songId, plays: count }))
            .sort((a, b) => b.plays - a.plays) : [];

          // B. Obtener detalles Canción + Título Álbum
          const songsWithDetails = await Promise.all(
            sortedStats.map(async (item) => {
              try {
                const song = await fetchSongById(item.id);
                
                // Aseguramos el nombre del álbum
                let albumTitle = "Sencillo";
                if (song.idAlbum) {
                    try {
                        const albumData = await fetchAlbumById(song.idAlbum);
                        if(albumData && albumData.titulo) albumTitle = albumData.titulo;
                    } catch (e) { /* ignore */ }
                }

                // Devolvemos todo mezclado
                return { 
                    ...song, 
                    plays: item.plays, 
                    albumName: albumTitle,
                    // Preparamos un nombre de visualización seguro por si acaso
                    safeTitle: song.nomCancion || song.titulo || "Canción sin nombre"
                };
              } catch (e) { return null; }
            })
          );
          
          const validSongs = songsWithDetails.filter(s => s);

          // C. Resolver Nombres de Artistas
          const allEmails = validSongs.reduce((acc, song) => {
             if (Array.isArray(song.artistas_emails)) return [...acc, ...song.artistas_emails];
             // Soporte por si viene como string suelto
             if (typeof song.artistas_emails === 'string') return [...acc, song.artistas_emails]; 
             return acc;
          }, []);
          
          // Fetch masivo de artistas
          const artistsMap = await fetchArtistsByEmails(allEmails);

          // D. Construir objeto final para la vista
          const finalSongs = validSongs.map(song => {
             const emailArtista = Array.isArray(song.artistas_emails) ? song.artistas_emails[0] : null;
             const datosArtista = artistsMap[emailArtista];
             
             const artistName = datosArtista?.display_name 
                || datosArtista?.nombre_artistico 
                || emailArtista 
                || "Artista Desconocido";

             return { ...song, artistName };
          });
          
          setTopSongs(finalSongs);

        } catch (err) {
          console.error("Error stats:", err);
        } finally {
          setStatsLoading(false);
        }
      };
      loadStats();
    }
  }, [email, activeTab]);


  // Handlers Edición
  const handleOpenEdit = () => {
    if (user) {
      setEditForm({
        display_name: user.display_name || user.nombre_artistico || '',
        password: '',
        avatar: null
      });
    }
    setPreviewAvatar(null);
    setShowEditModal(true);
  };
  const handleCloseEdit = () => setShowEditModal(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEditForm(prev => ({ ...prev, [name]: value }));
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setEditForm(prev => ({ ...prev, avatar: file }));
      setPreviewAvatar(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('display_name', editForm.display_name);
    if (editForm.password) formData.append('password', editForm.password);
    if (editForm.avatar) formData.append('avatar', editForm.avatar);

    const endpoint = userType === 'artist' ? 'artistas' : 'usuarios'; 

    try {
      const response = await fetch(`${API_BASE_URL}/${endpoint}/${encodeURIComponent(email)}`, {
        method: 'PUT',
        body: formData
      });
      if (!response.ok) throw new Error('Error update');
      alert('Perfil actualizado');
      handleCloseEdit();
      window.location.reload();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const handleDeleteProfile = async () => {
    try {
      if (userType === 'artist') {
        await deleteArtist(email);
      } else {
        await deleteUser(email);
      }
      localStorage.removeItem("authToken");
      localStorage.removeItem("tokenType");
      localStorage.removeItem("userType");
      localStorage.removeItem("userData");
      alert("Tu cuenta ha sido eliminada correctamente.");
      window.location.href = "/";
    } catch (err) {
      alert("Error al eliminar el perfil: " + err.message);
    }
  };

  if (loading) return <div className="loading">Cargando...</div>;
  if (error) return <div className="error">Perfil no encontrado</div>;
  if (!user) return <div className="error">Usuario no encontrado</div>;

  const username = user.display_name || user.nombre_artistico || 'Usuario';
  const backendAvatarUrl = user.avatar_url ? `${API_BASE_URL}${user.avatar_url}` : null;

  return (
    <div className="profile-page">
      
      <div className="profile-header-container">
        <button className="back-btn" onClick={() => navigate(-1)}>
          <span>←</span> Volver
        </button>
        
        <div className="profile-banner"></div>
        
        <div className="profile-header-content">
          <div className="avatar-box">
            {backendAvatarUrl ? (
              <img src={backendAvatarUrl} alt="avatar" />
            ) : (
              <div className="avatar-placeholder">{username.charAt(0).toUpperCase()}</div>
            )}
          </div>

          <div className="profile-info">
            <h1>{username}</h1>
            
            <div style={{ display: 'flex', gap: '15px', color: '#6b7280', fontSize: '0.9rem', marginBottom: '5px' }}>
              <span>🎵 {purchasedSongs.length} Canciones</span>
              <span>💿 {purchasedAlbums.length} Álbumes</span>
            </div>

            <div className="profile-actions">
              {isOwner && (
                <>
                  <button className="btn-edit" onClick={handleOpenEdit}>Editar Perfil</button>
                  <button 
                    className="btn-share" 
                    style={{ color: '#ef4444', borderColor: '#ef4444', background: '#fff' }}
                    onClick={() => setShowDeleteModal(true)}
                  >
                    Eliminar Perfil
                  </button>
                </>
              )}
              <button className="btn-share" onClick={() => setShowShareModal(true)}>
                Compartir Perfil
              </button>
            </div>
          </div>
        </div>

        <div className="profile-tabs-container">
          <div className="profile-tabs">
            <button 
              className={`tab-btn ${activeTab === 'songs' ? 'active' : ''}`}
              onClick={() => setActiveTab('songs')}
            >
              Canciones ({purchasedSongs.length})
            </button>
            <button 
              className={`tab-btn ${activeTab === 'albums' ? 'active' : ''}`}
              onClick={() => setActiveTab('albums')}
            >
              Álbumes ({purchasedAlbums.length})
            </button>
            <button 
              className={`tab-btn ${activeTab === 'stats' ? 'active' : ''}`}
              onClick={() => setActiveTab('stats')}
            >
              📊 Mis Estadísticas
            </button>
          </div>
        </div>
      </div>

      <main className="purchases-grid">
        {purchasesLoading ? (
          <div className="loading">Cargando colección...</div>
        ) : (
          <>
            {activeTab === 'songs' && (
              purchasedSongs.length > 0 ? (
                purchasedSongs.map(song => (
                  // --- AQUI ESTA EL CAMBIO: onClick para navegar ---
                  <div 
                    key={song.id} 
                    className="purchase-card"
                    onClick={() => navigate(`/musica?songId=${song.id}`)}
                  >
                    <div className="card-image">
                      <img 
                        src={`${FILES_BASE_URL}${song.imgPortada || song.portada}?t=${Date.now()}`}
                        alt={song.nomCancion}
                        onError={(e) => e.target.src = 'https://via.placeholder.com/200'}
                      />
                      <div className="play-overlay">
                        <div className="play-icon">▶</div>
                      </div>
                    </div>
                    <div className="card-details">
                      <h3>{song.nomCancion}</h3>
                      <p>{song.artistas_emails?.[0] || 'Artista desconocido'}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty-msg">No tienes canciones compradas.</div>
              )
            )}

            {activeTab === 'albums' && (
              purchasedAlbums.length > 0 ? (
                purchasedAlbums.map(album => (
                  // --- AQUI ESTA EL CAMBIO: onClick para navegar ---
                  <div 
                    key={album.id} 
                    className="purchase-card"
                    onClick={() => navigate(`/musica?albumId=${album.id}`)}
                  >
                    <div className="card-image">
                      <img 
                        src={`${FILES_BASE_URL}${album.imgPortada || album.portada}?t=${Date.now()}`}
                        alt={album.titulo}
                        onError={(e) => e.target.src = 'https://via.placeholder.com/200'}
                      />
                      <div className="play-overlay">
                        <div className="play-icon">▶</div>
                      </div>
                    </div>
                    <div className="card-details">
                      <h3>{album.titulo}</h3>
                      <p>{album.artistas_emails?.[0] || 'Varios Artistas'}</p>
                      <span className="badge-album">Álbum</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty-msg">No tienes álbumes comprados.</div>
              )
            )}
            
           {activeTab === 'stats' && (
              <div className="stats-container" style={{ width: '100%', paddingBottom: '50px' }}>
                
                {statsLoading ? ( 
                  <div className="loading" style={{padding: '60px', textAlign: 'center', color: '#666'}}>
                    Cargando tu ranking musical...
                  </div>
                ) : topSongs.length > 0 ? (
                  <div className="top-songs-list" style={{ marginTop: '20px' }}>
                    <h3 style={{ marginBottom: '25px', color: '#111827', fontSize: '1.5rem', paddingLeft: '10px', whiteSpace: 'nowrap' }}>
                      📊 Tu Top Más Escuchado
                    </h3>
                    
                    {/* ENCABEZADO CON GRID RESPONSIVO */}
                    <div style={{ 
                      display: 'grid', 
                      gridTemplateColumns: 'minmax(40px, 60px) minmax(60px, 80px) minmax(200px, 1fr) minmax(150px, 0.8fr) minmax(140px, 200px)', 
                      gap: '20px',
                      padding: '0 20px 15px 20px',
                      borderBottom: '1px solid #e5e7eb',
                      color: '#9ca3af',
                      fontSize: '0.8rem',
                      fontWeight: 'bold',
                      textTransform: 'uppercase',
                      letterSpacing: '1px',
                      alignItems: 'center'
                    }}>
                      <div style={{ textAlign: 'center' }}>#</div>
                      <div></div>
                      <div>Título</div>
                      <div>Álbum</div>
                      <div style={{ textAlign: 'right' }}>Reproducciones</div>
                    </div>

                    {/* FILAS DE DATOS */}
                    {(() => {
                      const maxPlays = Math.max(...topSongs.map(s => s.plays)) || 1;

                      return topSongs.map((song, index) => {
                        const percentage = (song.plays / maxPlays) * 100;
                        
                        let rankColor = '#6b7280'; 
                        let rankWeight = '500';
                        let rankSize = '1rem';
                        let rowBg = 'transparent';
                        
                        if (index === 0) { 
                            rankColor = '#d97706';
                            rankWeight = '900'; 
                            rankSize = '1.4rem';
                            rowBg = '#fffbeb';
                        } 
                        else if (index === 1) { 
                            rankColor = '#94a3b8'; 
                            rankWeight = '800'; 
                            rankSize = '1.2rem'; 
                        }
                        else if (index === 2) { 
                            rankColor = '#b45309'; 
                            rankWeight = '700'; 
                            rankSize = '1.1rem'; 
                        }

                        return (
                          <div 
                            key={song.id || index} 
                            onClick={() => navigate(`/musica?songId=${song.id}`)}
                            style={{
                              display: 'grid',
                              gridTemplateColumns: 'minmax(40px, 60px) minmax(60px, 80px) minmax(200px, 1fr) minmax(150px, 0.8fr) minmax(140px, 200px)',
                              gap: '20px',
                              alignItems: 'center',
                              padding: '15px 20px',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              backgroundColor: rowBg,
                              borderBottom: '1px solid #f3f4f6',
                              transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = rowBg}
                          >
                            
                            {/* COL 1: RANKING */}
                            <div style={{ 
                              textAlign: 'center', 
                              color: rankColor, 
                              fontWeight: rankWeight, 
                              fontSize: rankSize
                            }}>
                              {index + 1}
                            </div>

                            {/* COL 2: FOTO */}
                            <img 
                              src={fileURL(song.imgPortada || song.portada) || 'https://via.placeholder.com/60'} 
                              alt={song.safeTitle}
                              style={{ 
                                width: '60px', height: '60px', 
                                borderRadius: '6px', objectFit: 'cover',
                                boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
                                backgroundColor: '#eee'
                              }}
                            />

                            {/* COL 3: TÍTULO Y ARTISTA */}
                            <div style={{ 
                              display: 'flex', 
                              flexDirection: 'column', 
                              justifyContent: 'center', 
                              minWidth: 0 
                            }}>
                              <div style={{ 
                                fontWeight: '700', 
                                color: '#111827', 
                                fontSize: '1.05rem',
                                whiteSpace: 'nowrap', 
                                overflow: 'hidden', 
                                textOverflow: 'ellipsis',
                                marginBottom: '4px'
                              }}>
                                {song.safeTitle}
                              </div>
                              <div style={{ 
                                fontSize: '0.9rem', 
                                color: '#6b7280',
                                whiteSpace: 'nowrap', 
                                overflow: 'hidden', 
                                textOverflow: 'ellipsis'
                              }}>
                                {song.artistName}
                              </div>
                            </div>

                            {/* COL 4: ÁLBUM */}
                            <div style={{ 
                              color: '#4b5563', 
                              fontSize: '0.95rem',
                              whiteSpace: 'nowrap', 
                              overflow: 'hidden', 
                              textOverflow: 'ellipsis'
                            }}>
                              {song.albumName}
                            </div>

                            {/* COL 5: REPRODUCCIONES Y BARRA */}
                            <div style={{ 
                              display: 'flex', 
                              flexDirection: 'column', 
                              alignItems: 'flex-end' 
                            }}>
                              <span style={{ 
                                fontWeight: '800', 
                                color: '#1f2937', 
                                fontSize: '1.1rem' 
                              }}>
                                {song.plays}
                              </span>
                              
                              <div style={{ 
                                width: '100%', 
                                maxWidth: '160px',
                                height: '6px', 
                                background: '#e5e7eb', 
                                marginTop: '6px', 
                                borderRadius: '3px', 
                                overflow: 'hidden' 
                              }}>
                                <div style={{ 
                                  width: `${percentage}%`, 
                                  height: '100%', 
                                  background: index === 0 ? '#f59e0b' : '#3b82f6',
                                  borderRadius: '3px',
                                  transition: 'width 0.5s ease'
                                }}></div>
                              </div>
                            </div>

                          </div>
                        );
                      });
                    })()}
                  </div>
                ) : (
                  <div className="empty-msg" style={{ textAlign: 'center', padding: '80px 20px', color: '#9ca3af' }}>
                    <div style={{ fontSize: '4rem', marginBottom: '10px', opacity: 0.5 }}>📊</div>
                    <p style={{fontSize:'1.2rem', fontWeight: '500'}}>Aún no hay datos de reproducción.</p>
                    <p style={{fontSize:'0.95rem'}}>¡Empieza a escuchar música para generar tu ranking personal!</p>
                  </div>
                )}
              </div>
            )}
          </> 
        )}
      </main>

      {/* MODALES (Edición, Borrado, Compartir) - Código idéntico al anterior... */}
      {showEditModal && (
        <div className="modal-overlay" onClick={handleCloseEdit}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Editar Perfil</h2>
              <button className="close-btn" onClick={handleCloseEdit}>&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="edit-form">
              <div className="form-group">
                <label>Imagen de perfil</label>
                <div className="avatar-upload">
                  {(previewAvatar || backendAvatarUrl) && (
                    <img src={previewAvatar || backendAvatarUrl} alt="preview" className="avatar-preview"/>
                  )}
                  <button type="button" className="btn btn-outline" onClick={() => avatarInputRef.current?.click()}>Cambiar imagen</button>
                  <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleAvatarChange} hidden />
                </div>
              </div>
              <div className="form-group">
                <label>Nombre de usuario</label>
                <input type="text" name="display_name" value={editForm.display_name} onChange={handleInputChange} required />
              </div>
              <div className="form-group">
                <label>Nueva contraseña (opcional)</label>
                <input type="password" name="password" value={editForm.password} onChange={handleInputChange} placeholder="Dejar en blanco para mantener la actual" />
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-outline" onClick={handleCloseEdit}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{color: '#ef4444'}}>Eliminar Cuenta</h2>
              <button className="close-btn" onClick={() => setShowDeleteModal(false)}>&times;</button>
            </div>
            <div style={{ padding: '24px' }}>
              <p style={{ marginBottom: '20px', color: '#374151' }}>
                ¿Estás seguro de que deseas eliminar tu cuenta permanentemente? 
                <br/><br/>
                <strong>Esta acción no se puede deshacer</strong> y perderás acceso a tus compras y contenido.
              </p>
              <div className="form-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowDeleteModal(false)}>Cancelar</button>
                <button type="button" className="btn btn-primary" style={{ backgroundColor: '#ef4444' }} onClick={handleDeleteProfile}>Sí, eliminar cuenta</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ShareModal 
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        title={`Echa un vistazo al perfil de ${username} en Resound Música`}
        url={window.location.href} 
      />
    </div>
  );
}