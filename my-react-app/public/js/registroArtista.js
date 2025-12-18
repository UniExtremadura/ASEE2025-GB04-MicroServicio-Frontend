// Registro de artista + previsualización de imagen + validación y envío con FormData
document.addEventListener('DOMContentLoaded', function () {
  const form = document.getElementById('artistForm');
  const pwd = document.getElementById('password');
  const pwd2 = document.getElementById('password2');
  const imgInput = document.getElementById('img_perfil');
  const preview = document.getElementById('previewImg');
  const USERS_API = window._env_?.USUARIOS_URL || 'http://127.0.0.1:8001';
  // 🖼️ Previsualizar imagen seleccionada
  imgInput?.addEventListener('change', (ev) => {
    const file = ev.target.files && ev.target.files[0];
    if (!file || !file.type.startsWith('image/')) {
      preview.style.display = 'none';
      preview.src = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      preview.src = reader.result;
      preview.style.display = 'block';
    };
    reader.readAsDataURL(file);
  });

  // 🧾 Manejar envío del formulario
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    let valid = form.checkValidity();

    // Comprobar que las contraseñas coincidan
    if (pwd.value !== pwd2.value) {
      valid = false;
      pwd2.setCustomValidity('no-coincide');
      pwd2.classList.add('is-invalid');
    } else {
      pwd2.setCustomValidity('');
      pwd2.classList.remove('is-invalid');
    }

    if (!valid) {
      e.stopPropagation();
      form.classList.add('was-validated');
      return;
    }

    // ✅ Construir el FormData (para multipart/form-data)
    const formData = new FormData();
    formData.append("nombre_artistico", document.getElementById('nombre_artistico').value);
    formData.append("email", document.getElementById('email').value);
    formData.append("password", pwd.value);

    // Añadir imagen si existe
    if (imgInput.files && imgInput.files[0]) {
      formData.append("img_perfil", imgInput.files[0]);
    }

    // ✅ Enviar al backend (sin headers manuales)
    try {
      const response = await fetch(`${USERS_API}/artistas/register`, {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        alert("🎉 Artista registrado correctamente");
        console.log("✅ Respuesta del servidor:", result);
        window.location.href = 'login.html';
      } else {
        const error = await response.json();
        alert("⚠️ Error: " + (error.detail || error.message || "No se pudo registrar el artista."));
        console.error("❌ Error de API:", error);
      }
    } catch (err) {
      console.error("❌ Error de conexión:", err);
      alert("❌ Error de conexión con el servidor.");
    }
  });

  // 🔁 Validación en tiempo real de contraseñas
  pwd2.addEventListener('input', () => {
    if (pwd.value === pwd2.value) {
      pwd2.setCustomValidity('');
      pwd2.classList.remove('is-invalid');
    }
  });
});
