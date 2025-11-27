import React, { useEffect, useState } from "react";
// API PRINCIPAL
import { jsPDF } from "jspdf";
import {
  fetchAlbumById,
  fetchAlbumTracks,
  fetchArtistsByEmails,
  registerSongPlay,
  purchaseAlbum,
  getStoredUserEmail,
  getPurchasedAlbums, // De tu rama
} from "../../services/musicApi";

// IMPORTAMOS LAS FUNCIONES DE VALORACIÓN (De develop)
import {
  postAlbumPurchase,
  postSongReproduction,
  fetchAlbumRatingAvg,
  fetchUserRating,
  postRating,
  updateRating,
} from "../../services/api";

import CommentsSection from "./CommentsSection"; // De tu rama
import AddToPlaylistModal from "./AddToPlaylistModal";
import ShareModal from "../ShareModal"; // De develop
import { fileURL, formatDate } from "../../utils/helpers";
import "../../styles/MusicGlobal.css";
import "../../styles/valoraciones.css"; // Estilos de las estrellas

// ------------------ SUB-COMPONENTES AUXILIARES (ESTRELLAS) ------------------
const StarRating = ({ value }) => {
  const rating = Math.max(0, Math.min(5, Number(value) || 0));
  const percentage = (rating / 5) * 100;
  return (
    <div
      className="star-rating-container"
      title={`Valoración: ${rating.toFixed(1)}`}
    >
      <div className="star-layer-bg">★★★★★</div>
      <div className="star-layer-fg" style={{ width: `${percentage}%` }}>
        ★★★★★
      </div>
    </div>
  );
};

const InteractiveRating = ({ currentRating, onRate }) => {
  const [hoverValue, setHoverValue] = useState(0);
  return (
    <div className="interactive-stars" onMouseLeave={() => setHoverValue(0)}>
      {[1, 2, 3, 4, 5].map((star) => {
        const isActive = star <= (hoverValue || currentRating);
        return (
          <button
            key={star}
            type="button"
            className={`star-btn ${isActive ? "star-filled" : "star-empty"}`}
            onClick={() => onRate(star)}
            onMouseEnter={() => setHoverValue(star)}
          >
            ★
          </button>
        );
      })}
    </div>
  );
};

// ------------------ COMPONENTE PRINCIPAL ------------------
const PublicAlbumDetail = ({ albumId, onBack, onOpenSong }) => {
  const [album, setAlbum] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [plays, setPlays] = useState(0);

  // Estado para Compras
  const [showPurchase, setShowPurchase] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [purchaseError, setPurchaseError] = useState("");
  const [purchaseOk, setPurchaseOk] = useState("");
  const [purchaseLoading, setPurchaseLoading] = useState(false);

  // Verificación (De tu rama)
  const [isAlbumPurchased, setIsAlbumPurchased] = useState(false);

  // Estado del modal de compartir (De develop)
  const [showShareModal, setShowShareModal] = useState(false);

  // --- NUEVOS ESTADOS PARA VALORACIÓN (De develop) ---
  const [avgRating, setAvgRating] = useState(0);
  const [myRating, setMyRating] = useState(0);
  const [hasRated, setHasRated] = useState(false);
  const [ratingMessage, setRatingMessage] = useState("");

  // 1) Cargar álbum + canciones + nombres de artista + VALORACIONES
  useEffect(() => {
    if (albumId == null) return;

    const loadAlbum = async () => {
      try {
        setLoading(true);
        setError("");
        setIsAlbumPurchased(false);
        // Reset valoraciones
        setMyRating(0);
        setHasRated(false);

        // A. Cargar Datos Básicos
        const [albumData, tracksData] = await Promise.all([
          fetchAlbumById(albumId),
          fetchAlbumTracks(albumId),
        ]);

        // Verificación de compra de álbum (Tu lógica)
        const userEmail = getStoredUserEmail();
        const token = localStorage.getItem("authToken");
        if (token && userEmail) {
          try {
            const purchasedIds = await getPurchasedAlbums(userEmail);
            if (purchasedIds.includes(Number(albumId))) {
              setIsAlbumPurchased(true);
            }
          } catch (e) {
            console.warn("Error verificando compras", e);
          }
        }

        // B. Procesar Artistas
        let albumWithArtists = albumData;
        try {
          const emails = Array.isArray(albumData.artistas_emails)
            ? albumData.artistas_emails
            : [];
          if (emails.length > 0) {
            const artistsByEmail = await fetchArtistsByEmails(emails);
            const artistas = emails.map((email) => {
              const artist = artistsByEmail[email];
              if (artist)
                return (
                  artist.display_name ||
                  artist.nombre_artistico ||
                  artist.email ||
                  email
                );
              return typeof email === "string"
                ? email.split("@")[0]
                : "Artista";
            });
            albumWithArtists = {
              ...albumData,
              artistas,
              artistas_display: artistas.join(", "),
            };
          }
        } catch (innerErr) {
          console.warn("Error resolviendo artistas:", innerErr);
        }

        setAlbum(albumWithArtists);
        setTracks(tracksData || []);
        setPayAmount(albumData?.precio ?? "");

        // C. Cargar Media de Valoración (Álbum)
        try {
          const media = await fetchAlbumRatingAvg(albumId);
          setAvgRating(Number(media) || 0);
        } catch (e) {
          console.warn("No se pudo cargar la media del álbum", e);
        }

        // D. Cargar Valoración del Usuario (Álbum)
        const email = getStoredUserEmail();
        if (email) {
          try {
            // Pasamos songId=null, albumId=albumId
            const existingVote = await fetchUserRating(email, null, albumId);
            if (existingVote) {
              setMyRating(existingVote.valoracion);
              setHasRated(true);
            }
          } catch (e) {
            /* Error silencioso si no ha votado */
          }
        }
      } catch (err) {
        console.error("Error cargando álbum:", err);
        setError("No se han podido cargar los datos del álbum.");
      } finally {
        setLoading(false);
      }
    };

    loadAlbum();
  }, [albumId]);

  // 2) Track actual y sincronizar reproducciones
  const canciones = tracks;
  const currentTrack =
    canciones.length > 0
      ? canciones[Math.min(currentTrackIndex, canciones.length - 1)]
      : null;

  useEffect(() => {
    if (!currentTrack) return;
    setPlays(currentTrack.numVisualizaciones || 0);
  }, [currentTrack]);

  // 3) Registrar reproducción + estadísticas
  const handlePlayClick = async (song) => {
    if (!song || !song.id) return;
    setPlays((p) => p + 1);

    // Estadística histórica (Develop)
    const email = getStoredUserEmail();
    postSongReproduction(song.id, email).catch((err) =>
      console.warn("Aviso: No se pudo guardar estadística histórica", err),
    );

    // Registro real de reproducción
    try {
      const updated = await registerSongPlay(song.id);
      if (updated && typeof updated.numVisualizaciones === "number") {
        setPlays(updated.numVisualizaciones);

        setTracks((prev) =>
          prev.map((t) =>
            t.id === song.id
              ? { ...t, numVisualizaciones: updated.numVisualizaciones }
              : t,
          ),
        );
      }
    } catch (err) {
      console.error(err);
    }
  };

  // ---------------------------
  // MANEJO DE LA VALORACIÓN (LÓGICA ÁLBUM)
  // ---------------------------
  const handleUserRate = async (stars) => {
    const email = getStoredUserEmail();
    if (!email) {
      alert("Debes iniciar sesión para valorar.");
      return;
    }

    setMyRating(stars);
    setRatingMessage("Guardando...");

    try {
      if (hasRated) {
        // Actualizar (PUT) - idSong=null, idAlbum=album.id
        await updateRating(email, null, album.id, stars);
        setRatingMessage("Valoración actualizada");
      } else {
        // Crear (POST)
        await postRating(email, null, album.id, stars);
        setHasRated(true);
        setRatingMessage("¡Valoración guardada!");
      }

      // Recargar media
      const nuevaMedia = await fetchAlbumRatingAvg(album.id);
      setAvgRating(Number(nuevaMedia) || 0);
      setTimeout(() => setRatingMessage(""), 2000);
    } catch (error) {
      // Auto-reparación 404 (Si falla PUT, intenta POST)
      if (hasRated && error.response && error.response.status === 404) {
        console.warn("Sincronización corregida: Cambiando a POST.");
        try {
          await postRating(email, null, album.id, stars);
          setHasRated(true);
          setRatingMessage("¡Valoración guardada!");

          const nuevaMedia = await fetchAlbumRatingAvg(album.id);
          setAvgRating(Number(nuevaMedia) || 0);
          setTimeout(() => setRatingMessage(""), 2000);
        } catch (postError) {
          setRatingMessage("Error al guardar.");
        }
      } else {
        setRatingMessage("Error al conectar.");
      }
    }
  };

  // ---------------------------
  // MANEJO DE LA COMPRA
  // ---------------------------
  const openPurchaseModal = () => {
    setPurchaseError("");
    setPurchaseOk("");
    const token = localStorage.getItem("authToken");
    if (!token) setPurchaseError("Necesitas iniciar sesión para comprar.");
    setShowPurchase(true);
  };

  const closePurchaseModal = () => {
    if (purchaseLoading) return;
    setShowPurchase(false);
    setPurchaseError("");
    setPurchaseOk("");
  };

  const handleConfirmPurchase = async () => {
    if (!album) return;
    const token = localStorage.getItem("authToken");
    if (!token) {
      setPurchaseError("Inicia sesión para completar la compra.");
      return;
    }
    const email = getStoredUserEmail();
    const amount =
      payAmount === "" || payAmount === null
        ? null
        : Number.parseFloat(payAmount);
    if (payAmount !== "" && (Number.isNaN(amount) || amount < 0)) {
      setPurchaseError("Introduce un importe válido.");
      return;
    }

    setPurchaseLoading(true);
    setPurchaseError("");

    try {
      await purchaseAlbum({
        albumId: album.id,
        pricePaid: amount,
        userEmail: email,
      });

      // Registrar estadística de compra (Develop)
      try {
        const precioFinal =
          amount !== null ? amount : Number(album.precio ?? 0);
        await postAlbumPurchase(album.id, precioFinal);
      } catch (statsErr) {
        console.warn("Fallo estadística compra:", statsErr);
      }

      setPurchaseOk("Álbum comprado correctamente.");
      setIsAlbumPurchased(true); // Actualizar estado local
    } catch (err) {
      const msg =
        err?.response?.data?.detail || err?.message || "Error compra.";
      setPurchaseError(msg);
    } finally {
      setPurchaseLoading(false);
    }
  };

  // Guardas
  if (albumId == null) return null;
  if (loading) return <div className="loading">Cargando álbum…</div>;
  if (error) return <div className="no-content">{error}</div>;
  if (!album) return <div className="no-content">Álbum no encontrado.</div>;

  const cover =
    fileURL(album.imgPortada || album.portada) || "/placeholder-album.png";
  const artistNames = album.artistas_display || "Varios artistas";
  const price = Number(album.precio ?? 0);

  // Variable auxiliar para mostrar géneros si existieran en el objeto album (opcional)
  const genresText = album.generos ? album.generos.join(", ") : "";

  return (
    <section className="album-page">
      <button type="button" className="btn-back" onClick={onBack}>
        ← Volver al catálogo
      </button>

      <div className="album-layout">
        <div className="album-main">
          <div className="album-player-card">
            <h2 className="album-title">{album.titulo}</h2>
            <p className="album-artist">{artistNames}</p>

            {album.date && (
              <p className="album-meta">Lanzado el {formatDate(album.date)}</p>
            )}
            {genresText && <p className="album-meta">Géneros: {genresText}</p>}

            {currentTrack && (
              <div className="album-player">
                <button
                  type="button"
                  className="btn-play big"
                  onClick={() => handlePlayClick(currentTrack)}
                >
                  ▶
                </button>
                <span>Reproducciones: {plays}</span>
                <div className="album-player-info">
                  <div className="player-track-title">
                    {currentTrack.nomCancion || currentTrack.titulo}
                  </div>
                </div>
              </div>
            )}

            <div className="album-purchase">
              {isAlbumPurchased ? (
                <button
                  type="button"
                  className="btn-success"
                  disabled
                  style={{
                    cursor: "default",
                    backgroundColor: "#28a745",
                    color: "white",
                    border: "none",
                    width: "100%",
                  }}
                >
                  ✅ Álbum Comprado
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={openPurchaseModal}
                >
                  Comprar álbum digital completo{" "}
                  {price > 0 ? `${price.toFixed(2)} € o más` : "(elige precio)"}
                </button>
              )}

              {/* BOTÓN DE COMPARTIR (De develop) */}
              <button
                type="button"
                className="btn-secondary"
                style={{
                  marginTop: "10px",
                  width: "100%",
                  backgroundColor: "#e0f2fe",
                  borderColor: "#bae6fd",
                  color: "#0284c7",
                }}
                onClick={() => setShowShareModal(true)}
              >
                📢 Compartir Álbum
              </button>

              <p className="purchase-note">
                {isAlbumPurchased
                  ? "Ya posees este álbum y todas sus canciones."
                  : "Incluye todas las canciones del álbum en tu biblioteca digital."}
              </p>
            </div>
          </div>

          {/* TRACKLIST */}
          <div className="album-tracklist">
            <h3>Lista de canciones</h3>
            {canciones.length === 0 ? (
              <p>Vacío</p>
            ) : (
              <ol>
                {canciones.map((song, index) => (
                  <li
                    key={song.id}
                    className={`track-item ${index === currentTrackIndex ? "active" : ""}`}
                    onClick={() => {
                      setCurrentTrackIndex(index);
                      if (onOpenSong) onOpenSong(song.id);
                    }}
                  >
                    <div
                      style={{ display: "flex", alignItems: "center", flex: 1 }}
                    >
                      <button
                        type="button"
                        className="track-play-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCurrentTrackIndex(index);
                          handlePlayClick(song);
                        }}
                      >
                        ▶
                      </button>
                      <span className="track-number">{index + 1}.</span>
                      <span className="track-title">
                        {song.nomCancion || song.titulo}
                      </span>
                    </div>

                    {typeof song.precio === "number" && (
                      <span className="track-price">
                        {song.precio.toFixed(2)} €
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>

        {/* PORTADA + VALORACIONES */}
        <div className="album-cover-side">
          <img src={cover} alt={album.titulo} />

          {/* ======================================= */}
          {/* SECCIÓN DE VALORACIÓN (De develop) */}
          {/* ======================================= */}

          {/* 1. Media Visual */}
          <div className="star-rating-wrapper" style={{ marginTop: "15px" }}>
            <StarRating value={avgRating} />
            <div className="rating-text">
              Media: {avgRating.toFixed(1)} <span>/ 5</span>
            </div>
          </div>

          {/* 2. Valoración Interactiva */}
          <div className="user-rating-section">
            <div className="user-rating-title">
              {hasRated ? "Tu valoración" : "Valora este álbum"}
            </div>

            <InteractiveRating
              currentRating={myRating}
              onRate={handleUserRate}
            />

            <div className="rating-msg">{ratingMessage}</div>
          </div>
          {/* ======================================= */}
        </div>
      </div>

      {/* 2. IMPORTANTE: Añadir la sección de comentarios (De tu rama) */}
      {album && (
        <div style={{ marginTop: "40px" }}>
          <CommentsSection targetType="album" targetId={album.id} />
        </div>
      )}

      {/* MODAL COMPRA */}
      {showPurchase && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <h3>Comprar álbum completo</h3>
            <input
              type="number"
              min={price}
              step="0.01"
              className="modal-input"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
            />
            <p className="modal-hint">
              Precio mínimo:{" "}
              {price > 0 ? `${price.toFixed(2)} €` : "puedes elegir 0€ o más"}.
              Si dejas el campo vacío se usará el precio base.
            </p>

            {purchaseError && (
              <div className="modal-error">{purchaseError}</div>
            )}
            {purchaseOk && <div className="modal-success">{purchaseOk}</div>}
            <div className="modal-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={closePurchaseModal}
                disabled={purchaseLoading}
              >
                Cancelar
              </button>
              {!purchaseOk && (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleConfirmPurchase}
                  disabled={purchaseLoading}
                >
                  {purchaseLoading ? "Procesando…" : "Pagar y comprar"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL COMPARTIR (De develop) */}
      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        title={`Descubre el álbum "${album.titulo}" de ${artistNames} en Resound Música`}
        url={window.location.href}
      />
    </section>
  );
};

export default PublicAlbumDetail;
