import React, { useEffect, useState } from "react";
import { jsPDF } from "jspdf";

// API 
import {
  fetchAlbumById,
  fetchAlbumTracks,
  fetchArtistsByEmails,
  registerSongPlay,
  purchaseAlbum,
  getStoredUserEmail,
   fetchSongById, 
    purchaseSong,   
} from "../../services/musicApi"; 

import {
  postSongReproduction,
  postSongPurchase,
  fetchSongRatingAvg,
  fetchUserRating,
  postRating,
  updateRating,
} from "../../services/api";

// CSS
import "../../styles/valoraciones.css";

// PLAYLIST
import AddToPlaylistModal from "./AddToPlaylistModal";

// SHARE
import ShareModal from "../ShareModal";

import { fileURL } from "../../utils/helpers";

// ------------------ HELPERS ------------------
const formatPrice = (value) => {
  if (value === null || value === undefined) return "No disponible";
  const num = Number(value);
  if (Number.isNaN(num)) return "No disponible";
  if (num === 0) return "Gratis";
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
  }).format(num);
};

const getArtistLabel = (song) => {
  if (Array.isArray(song.artistas) && song.artistas.length > 0) {
    const first = song.artistas[0];
    if (typeof first === "string") return song.artistas.join(", ");
    if (first.nickname) return song.artistas.map((a) => a.nickname).join(", ");
    if (first.email) return song.artistas.map((a) => a.email).join(", ");
  }
  if (Array.isArray(song.artistas_emails) && song.artistas_emails.length > 0) {
    return song.artistas_emails.join(", ");
  }
  if (song.artistNickname) return song.artistNickname;
  if (song.artistEmail) return song.artistEmail;
  return "Artista desconocido";
};

// ------------------ SUB-COMPONENTES ESTRELLAS ------------------
const StarRating = ({ value }) => {
  const rating = Math.max(0, Math.min(5, Number(value) || 0));
  const percentage = (rating / 5) * 100;

  return (
    <div className="star-rating-container" title={`Valoración: ${rating.toFixed(1)}`}>
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
const PublicSongDetail = ({ songId, onBack }) => {
  const [song, setSong] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [plays, setPlays] = useState(0);
  const [album, setAlbum] = useState(null);
  const [artistName, setArtistName] = useState("");

  // Compra
  const [showPurchase, setShowPurchase] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [purchaseError, setPurchaseError] = useState("");
  const [purchaseOk, setPurchaseOk] = useState("");

  // Playlist + Share
  const [showAddToPlaylist, setShowAddToPlaylist] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  // Rating
  const [avgRating, setAvgRating] = useState(0);
  const [myRating, setMyRating] = useState(0);
  const [hasRated, setHasRated] = useState(false);
  const [ratingMessage, setRatingMessage] = useState("");

  // ------------------ CARGA DE DATOS ------------------
  useEffect(() => {
    const loadAllData = async () => {
      if (!songId) return;

      try {
        setLoading(true);
        setErr("");

        const data = await fetchSongById(songId);
        setSong(data);
        setPlays(data.numVisualizaciones || 0);
        setPayAmount(data.precio ?? "");

        // Media valoración
        try {
          const media = await fetchSongRatingAvg(songId);
          setAvgRating(Number(media) || 0);
        } catch {}

        // Rating usuario
        const email = getStoredUserEmail();
        if (email) {
          try {
            const myVote = await fetchUserRating(email, songId);
            if (myVote) {
              setMyRating(myVote.valoracion);
              setHasRated(true);
            } else {
              setMyRating(0);
              setHasRated(false);
            }
          } catch {}
        }

        // Álbum
        if (data.idAlbum != null) {
          try {
            const albumData = await fetchAlbumById(data.idAlbum);
            setAlbum(albumData);
          } catch {}
        }

        // Artistas
        if (Array.isArray(data.artistas_emails) && data.artistas_emails.length) {
          try {
            const emails = data.artistas_emails;
            const artists = await fetchArtistsByEmails(emails);
            const first = artists[emails[0]];
            setArtistName(
              first?.display_name ||
              first?.nombre_artistico ||
              first?.email ||
              emails[0].split("@")[0]
            );
          } catch {}
        }
      } catch (e) {
        setErr("No se pudo cargar la canción.");
      } finally {
        setLoading(false);
      }
    };

    loadAllData();
  }, [songId]);

  // ------------------ REPRODUCCIÓN ------------------
  const handlePlayClick = async () => {
    if (!song) return;
    setPlays((p) => p + 1);

    const email = getStoredUserEmail();
    postSongReproduction(song.id, email).catch(() => {});

    try {
      const updated = await registerSongPlay(song.id);
      if (updated?.numVisualizaciones != null) {
        setSong(updated);
        setPlays(updated.numVisualizaciones);
      }
    } catch {}
  };

  // ------------------ RATING ------------------
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
        await updateRating(email, song.id, stars);
        setRatingMessage("Valoración actualizada");
      } else {
        await postRating(email, song.id, stars);
        setHasRated(true);
        setRatingMessage("¡Valoración guardada!");
      }

      const media = await fetchSongRatingAvg(song.id);
      setAvgRating(Number(media));

      setTimeout(() => setRatingMessage(""), 2000);
    } catch (err) {
      if (hasRated && err.response?.status === 404) {
        try {
          await postRating(email, song.id, stars);
          setHasRated(true);
          const media = await fetchSongRatingAvg(song.id);
          setAvgRating(Number(media));
          setRatingMessage("¡Valoración guardada!");
          return;
        } catch {}
      }

      setRatingMessage("Error al guardar.");
    }
  };

  // ------------------ COMPRA ------------------
  const openPurchaseModal = () => {
    setPurchaseError("");
    setPurchaseOk("");
    if (!localStorage.getItem("authToken")) {
      setPurchaseError("Necesitas iniciar sesión para comprar.");
    }
    setShowPurchase(true);
  };

  const closePurchaseModal = () => {
    if (!purchaseLoading) {
      setShowPurchase(false);
      setPurchaseError("");
      setPurchaseOk("");
    }
  };

  // ------------------ PDF (versión avanzada tuya) ------------------
  const generateReceiptPDF = (songData, pricePaid, userEmail, artistLabel) => {
    const doc = new jsPDF();

    doc.setTextColor(40);
    doc.setFontSize(22);
    doc.text("Resound Música", 20, 20);

    doc.setFontSize(16);
    doc.text("Recibo de Compra Digital", 20, 30);

    doc.setLineWidth(0.5);
    doc.line(20, 35, 190, 35);

    doc.setFontSize(12);
    doc.text(`Fecha: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, 20, 50);
    doc.text(`ID Transacción: ${Math.random().toString(36).substr(2, 9).toUpperCase()}`, 20, 60);
    doc.text(`Comprador: ${userEmail}`, 20, 70);

    doc.setFillColor(240, 240, 240);
    doc.rect(20, 85, 170, 10, "F");

    doc.setFont("helvetica", "bold");
    doc.text("Concepto", 25, 91);
    doc.text("Artista", 100, 91);
    doc.text("Precio", 160, 91);

    doc.setFont("helvetica", "normal");
    const songName = songData.nomCancion || songData.titulo || "Canción";

    let finalPrice = pricePaid;
    if (finalPrice === null || finalPrice === "") {
      finalPrice = songData.precio || 0;
    }
    const priceString = formatPrice(finalPrice);

    doc.text(songName, 25, 105);
    doc.text(artistLabel, 100, 105);
    doc.text(priceString, 160, 105);

    doc.line(20, 115, 190, 115);
    doc.setFont("helvetica", "bold");
    doc.text(`TOTAL PAGADO: ${priceString}`, 130, 125);

    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    doc.text("Gracias por apoyar la música independiente.", 20, 150);
    doc.text("Este es un comprobante digital generado automáticamente.", 20, 155);

    doc.save(`Recibo_Resound_${songName.replace(/\s+/g, "_")}.pdf`);
  };

  const handleConfirmPurchase = async () => {
    if (!song) return;

    const token = localStorage.getItem("authToken");
    if (!token) {
      setPurchaseError("Debes iniciar sesión.");
      return;
    }

    const email = getStoredUserEmail();
    if (!email) {
      setPurchaseError("No se pudo leer el email.");
      return;
    }

    const amount =
      payAmount === "" || payAmount === null ? null : Number.parseFloat(payAmount);

    if (payAmount !== "" && (Number.isNaN(amount) || amount < 0)) {
      setPurchaseError("Importe inválido.");
      return;
    }

    setPurchaseLoading(true);
    setPurchaseError("");
    setPurchaseOk("");

    try {
      await purchaseSong({
        songId: song.id,
        pricePaid: amount,
        userEmail: email,
      });

      try {
        const precioFinal = amount ?? song.precio ?? 0;
        await postSongPurchase(song.id, precioFinal);
      } catch {}

      setPurchaseOk("Compra realizada con éxito.");
      generateReceiptPDF(song, amount, email, artistName || getArtistLabel(song));

    } catch (error) {
      setPurchaseError(
        error?.response?.data?.detail ||
        error?.message ||
        "Error al completar la compra."
      );
    } finally {
      setPurchaseLoading(false);
    }
  };

  // ------------------ RENDER ------------------
  if (loading) return <div>Cargando canción…</div>;
  if (err || !song) return <div>{err || "Canción no encontrada"}</div>;

  const coverPath =
    song.imgPortada || song.imgSencillo || song.portada || song.coverPath || null;
  const coverSrc = coverPath
    ? fileURL(coverPath)
    : "https://via.placeholder.com/500x500?text=Sin+portada";

  const albumTitle = album?.titulo || song.albumTitulo || "Sencillo";
  const artistLabel = artistName || getArtistLabel(song);

  let publishedLabel = null;
  if (song.date) {
    const d = new Date(song.date);
    publishedLabel =
      "Publicado el " +
      (isNaN(d.getTime()) ? String(song.date) : d.toLocaleDateString("es-ES"));
  }

  return (
    <div className="public-song-detail">
      {onBack && (
        <button className="btn-link back-button" onClick={onBack}>
          ← Volver al catálogo
        </button>
      )}

      <div className="public-song-layout">
        {/* IZQUIERDA */}
        <div className="public-song-cover">
          <img src={coverSrc} alt={song.nomCancion || song.titulo} />

          <div className="star-rating-wrapper">
            <StarRating value={avgRating} />
            <div className="rating-text">
              Media: {avgRating.toFixed(1)} / 5
            </div>
          </div>

          <div className="user-rating-section">
            <div className="user-rating-title">
              {hasRated ? "Tu valoración" : "Valora esta canción"}
            </div>

            <InteractiveRating
              currentRating={myRating}
              onRate={handleUserRate}
            />

            <div className="rating-msg">{ratingMessage}</div>
          </div>
        </div>

        {/* DERECHA */}
        <div className="public-song-info">
          <h2 className="song-title">{song.nomCancion || song.titulo}</h2>
          <div className="song-artist">por {artistLabel}</div>
          <div className="song-album">del álbum {albumTitle}</div>
          {publishedLabel && <div className="song-date">{publishedLabel}</div>}

          <div className="song-stats">
            <button className="btn-play" onClick={handlePlayClick}>
              ▶ Reproducir
            </button>
            <span>Reproducciones: {plays}</span>
          </div>

          <div className="song-purchase">
            <button className="btn-primary" onClick={openPurchaseModal}>
              Comprar {formatPrice(song.precio)}
            </button>
            <p className="purchase-note">
              Recibirás futuras descargas asociadas a tu cuenta.
            </p>
          </div>

          <div style={{ display: "flex", gap: "10px", marginTop: "12px" }}>
            <button
              className="btn-secondary"
              onClick={() => setShowAddToPlaylist(true)}
            >
              ➕ Añadir a playlist
            </button>

            <button
              className="btn-secondary"
              style={{
                backgroundColor: "#e0f2fe",
                borderColor: "#bae6fd",
                color: "#0284c7",
              }}
              onClick={() => setShowShareModal(true)}
            >
              📢 Compartir
            </button>
          </div>
        </div>
      </div>

      {/* MODAL COMPRA */}
      {showPurchase && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <h3>Confirmar compra</h3>
            <p className="modal-subtitle">
              {song.nomCancion} · {artistLabel}
            </p>

            <label className="modal-label">Importe (€)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="modal-input"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              placeholder={`Precio actual: ${formatPrice(song.precio)}`}
            />

            {purchaseError && <div className="modal-error">{purchaseError}</div>}
            {purchaseOk && <div className="modal-success">{purchaseOk}</div>}

            <div className="modal-actions">
              <button
                className="btn-secondary"
                onClick={closePurchaseModal}
                disabled={purchaseLoading}
              >
                Cerrar
              </button>
              <button
                className="btn-primary"
                onClick={handleConfirmPurchase}
                disabled={purchaseLoading}
              >
                {purchaseLoading ? "Procesando…" : "Comprar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PLAYLIST */}
      {showAddToPlaylist && (
        <AddToPlaylistModal
          song={song}
          onClose={() => setShowAddToPlaylist(false)}
        />
      )}

      {/* MODAL COMPARTIR */}
      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        title={`Escucha "${song.nomCancion}" de ${artistLabel} en Resound Música`}
        url={window.location.href}
      />
    </div>
  );
};

export default PublicSongDetail;
