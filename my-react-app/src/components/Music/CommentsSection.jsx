import React, { useEffect, useState } from "react";
import {
  fetchSongComments,
  postSongComment,
  fetchAlbumComments,
  postAlbumComment,
  getStoredUserEmail,
} from "../../services/musicApi";
import "../../styles/CommentsSection.css";

const CommentsSection = ({ targetType, targetId }) => {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const userEmail = getStoredUserEmail();
  const isLoggedIn = !!userEmail;

  useEffect(() => {
    if (!targetId) return;

    const loadComments = async () => {
      setLoading(true);
      try {
        let data = [];
        if (targetType === "song") {
          data = await fetchSongComments(targetId);
        } else if (targetType === "album") {
          data = await fetchAlbumComments(targetId);
        }
        setComments(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Error cargando comentarios", err);
        setComments([]);
      } finally {
        setLoading(false);
      }
    };

    loadComments();
  }, [targetType, targetId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setSubmitting(true);
    setError("");

    try {
      let createdComment;
      if (targetType === "song") {
        createdComment = await postSongComment(targetId, newComment);
      } else {
        createdComment = await postAlbumComment(targetId, newComment);
      }

      setComments([createdComment, ...comments]);
      setNewComment("");
    } catch (err) {
      console.error(err);
      setError("No se pudo enviar el comentario. Inténtalo de nuevo.");
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (isoString) => {
    if (!isoString) return "";
    return new Date(isoString).toLocaleString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (!targetId) return null;

  return (
    <div className="comments-section">
      <h3 className="comments-header">Comentarios ({comments.length})</h3>

      {/* 1. FORMULARIO PRIMERO (Arriba) */}
      {isLoggedIn ? (
        <form onSubmit={handleSubmit} className="comment-form">
          <textarea
            className="comment-input"
            placeholder="Escribe tu opinión aquí..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            maxLength={500}
            required
          />
          {error && (
            <p
              className="text-danger"
              style={{ fontSize: "0.9rem", color: "red" }}
            >
              {error}
            </p>
          )}
          <button
            type="submit"
            className="btn-comment"
            disabled={submitting || !newComment.trim()}
          >
            {submitting ? "Publicando..." : "Comentar"}
          </button>
        </form>
      ) : (
        <div className="login-prompt">
          <p>Inicia sesión para dejar un comentario.</p>
        </div>
      )}

      {/* 2. LISTA DE COMENTARIOS DESPUÉS (Abajo) */}
      <div className="comments-list">
        {loading && <p>Cargando comentarios...</p>}

        {!loading && comments.length === 0 && (
          <p style={{ color: "#666", fontStyle: "italic", padding: "10px" }}>
            No hay comentarios aún. ¡Sé el primero en opinar!
          </p>
        )}

        {comments.map((c) => (
          <div key={c.id} className="comment-item">
            <div className="comment-meta">
              <span className="comment-user">
                {c.user_ref ? c.user_ref.split("@")[0] : "Usuario"}
              </span>
              <span>{formatDate(c.created_at)}</span>
            </div>
            {/* El color de este texto ahora es oscuro gracias al CSS nuevo */}
            <div className="comment-content">{c.content}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CommentsSection;
