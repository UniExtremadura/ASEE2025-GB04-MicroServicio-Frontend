document.addEventListener('DOMContentLoaded', function () {
  const form = document.getElementById('loginForm');
  const togglePassword = document.getElementById('togglePassword');
  const passwordInput = document.getElementById('password');
  const eyeIcon = togglePassword.querySelector('.eye-icon');

  const USERS_API = window._env_?.USUARIOS_URL || 'http://127.0.0.1:8001';

  // 👁️ Alternar visibilidad de contraseña
  togglePassword.addEventListener('click', () => {
    const type = passwordInput.type === 'password' ? 'text' : 'password';
    passwordInput.type = type;
    
    // Cambiar ícono (opcional: puedes usar dos SVG diferentes)
    eyeIcon.style.opacity = type === 'text' ? '0.6' : '1';
  });

  // 🔐 Manejar envío del formulario
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!form.checkValidity()) {
      e.stopPropagation();
      form.classList.add('was-validated');
      return;
    }

    const email = document.getElementById('email').value;
    const password = passwordInput.value;

    try {
      // Endpoint actualizado de autenticación
      const response = await fetch(`${USERS_API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Login exitoso:', result);
        
        // Guardar token JWT y datos del usuario
        localStorage.setItem('authToken', result.access_token);
        localStorage.setItem('tokenType', result.token_type);
        localStorage.setItem('userType', result.user_type);
        localStorage.setItem('userData', JSON.stringify(result.user_data));
        
        // Mensaje de bienvenida personalizado
        const displayName = result.user_data.display_name || result.user_data.email;
        alert(`🎉 Bienvenido/a, ${displayName}!`);

        // Redirigir según tipo de usuario
        if (result.user_type === 'artist') {
          window.location.href = '/musica';
        } else if (result.user_data.is_admin) {
          window.location.href = 'admin-dashboard.html';
        } else {
          window.location.href = '/musica';
        }
      } else {
        const error = await response.json();
        alert('⚠️ ' + (error.detail || 'Credenciales incorrectas'));
        console.error('❌ Error de login:', error);
      }
    } catch (err) {
      console.error('❌ Error de conexión:', err);
      alert('❌ No se pudo conectar con el servidor. Verifica que el backend esté activo.');
    }
  });
});