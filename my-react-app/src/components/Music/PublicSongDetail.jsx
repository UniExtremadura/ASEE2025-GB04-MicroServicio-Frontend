import React, { useEffect, useState } from "react";
import { jsPDF } from "jspdf";

// API PRINCIPAL + ESTADÍSTICAS
import {
  fetchSongById,
  fetchAlbumById,
  fetchArtistsByEmails,
  registerSongPlay,
  purchaseSong,
  getStoredUserEmail,
  postSongReproduction,
  postSongPurchase,
} from "../../services/api";

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

// ------------------ COMPONENTE ------------------
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

  // Playlist
  const [showAddToPlaylist, setShowAddToPlaylist] = useState(false);

  // Share
  const [showShareModal, setShowShareModal] = useState(false);

  // ------------------ CARGA SONG ------------------
  useEffect(() => {
    const loadSong = async () => {
      try {
        setLoading(true);
        setErr("");

        const data = await fetchSongById(songId);
        setSong(data);
        setPlays(data.numVisualizaciones || 0);
        setPayAmount(data.precio ?? "");

        // Cargar álbum si existe
        if (data.idAlbum != null) {
          try {
            const albumData = await fetchAlbumById(data.idAlbum);
            setAlbum(albumData);
          } catch (error) {
            console.warn("No se pudo cargar el álbum:", error);
          }
        }

        // Cargar nombres de artistas
        if (Array.isArray(data.artistas_emails) && data.artistas_emails.length) {
          try {
            const emails = data.artistas_emails;
            const artistsByEmail = await fetchArtistsByEmails(emails);
            const first = emails[0];
            const artist = artistsByEmail[first];

            setArtistName(
              artist?.display_name ||
                artist?.nombre_artistico ||
                artist?.email ||
                first?.split("@")[0] ||
                "Artista"
            );
          } catch (error) {
            console.warn("No se pudo resolver display_name:", error);
          }
        }
      } catch (error) {
        console.error("Error cargando canción:", error);
        setErr("No se pudo cargar la canción.");
      } finally {
        setLoading(false);
      }
    };

    if (songId) loadSong();
  }, [songId]);

  // ------------------ PLAY SONG ------------------
  const handlePlayClick = async () => {
    if (!song || !song.id) return;

    // Optimistic UI
    setPlays((p) => p + 1);

    // 1. Estadística 8081
    const email = getStoredUserEmail();
    postSongReproduction(song.id, email).catch((err) =>
      console.warn("Falló estadística (8081):", err)
    );

    // 2. Registro real 8080
    try {
      const updated = await registerSongPlay(song.id);
      if (updated?.numVisualizaciones != null) {
        setSong(updated);
        setPlays(updated.numVisualizaciones);
      }
    } catch (err) {
      console.error("Error registrando reproducción en 8080:", err);
    }
  };

  // ------------------ PURCHASE ------------------
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

  const generateReceiptPDF = (songData, pricePaid, userEmail, artistLabel) => {
    const doc = new jsPDF();
    doc.setFontSize(22);
    doc.text("Resound Música", 20, 20);
    doc.setFontSize(16);
    doc.text("Recibo de Compra Digital", 20, 30);
    doc.line(20, 35, 190, 35);

    doc.setFontSize(12);
    doc.text(`Fecha: ${new Date().toLocaleString()}`, 20, 50);
    doc.text(`Comprador: ${userEmail}`, 20, 60);

    const songName = songData.nomCancion || songData.titulo || "Canción";
    const finalPrice = pricePaid ?? songData.precio ?? 0;

    doc.text(`Canción: ${songName}`, 20, 80);
    doc.text(`Artista: ${artistLabel}`, 20, 90);
    doc.text(`Precio pagado: ${formatPrice(finalPrice)}`, 20, 100);

    doc.save(`Recibo_${songName.replace(/\s+/g, "_")}.pdf`);
  };

  const handleConfirmPurchase = async () => {
    if (!song) return;

    const token = localStorage.getItem("authToken");
    if (!token) {
      setPurchaseError("Inicia sesión para comprar.");
      return;
    }

    const email = getStoredUserEmail();
    if (!email) {
      setPurchaseError("No se pudo leer el email del usuario.");
      return;
    }

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
    setPurchaseOk("");

    try {
      // Compra real 8080
      await purchaseSong({
        songId: song.id,
        pricePaid: amount,
        userEmail: email,
      });

      // Estadística 8081
      try {
        const precioFinal = amount ?? song.precio ?? 0;
        await postSongPurchase(song.id, precioFinal);
      } catch (statsErr) {
        console.warn("Compra OK pero falló estadística:", statsErr);
      }

      setPurchaseOk("Compra realizada con éxito.");

      generateReceiptPDF(
        song,
        amount,
        email,
        artistName || getArtistLabel(song)
      );
    } catch (error) {
      const msg =
        error?.response?.data?.detail ||
        error?.message ||
        "No se pudo completar la compra.";
      setPurchaseError(msg);
    } finally {
      setPurchaseLoading(false);
    }
  };

  // ------------------ RENDER ------------------
  if (loading) return <div>Cargando canción…</div>;
  if (err || !song) return <div>{err || "Canción no encontrada"}</div>;

  const coverPath =
    song.imgPortada ||
    song.imgSencillo ||
    song.portada ||
    song.coverPath ||
    null;
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
          ← Volver
        </button>
      )}

      <div className="public-song-layout">
        <div className="public-song-cover">
          <img src={coverSrc} alt={song.nomCancion || song.titulo} />
        </div>

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

      {/* Modal Compra */}
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

            {purchaseError && (
              <div className="modal-error">{purchaseError}</div>
            )}
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

      {/* Modal Playlist */}
      {showAddToPlaylist && (
        <AddToPlaylistModal
          song={song}
          onClose={() => setShowAddToPlaylist(false)}
        />
      )}

      {/* Modal Compartir */}
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
