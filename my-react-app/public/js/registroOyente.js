document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('signupForm');
    const pwd = document.getElementById('password');
    const pwd2 = document.getElementById('password2');
    const edad = document.getElementById('edad');
    const imgInput = document.getElementById('img_perfil');
    const preview = document.getElementById('previewImg');

    // URL del microservicio
    const BASE_URL = window._env_?.USUARIOS_URL || 'http://127.0.0.1:8001';
    const USER_API = `${BASE_URL}/usuarios/registro`;

    // Previsualización de imagen
    imgInput?.addEventListener('change', (ev) => {
        const file = ev.target.files && ev.target.files[0];
        if (!file) {
            preview.style.display = 'none';
            preview.src = '';
            return;
        }
        if (!file.type.startsWith('image/')) {
            alert('Por favor, selecciona un archivo de imagen válido');
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

    // Validación de contraseñas en tiempo real
    pwd2.addEventListener('input', () => {
        if (pwd.value === pwd2.value) {
            pwd2.setCustomValidity('');
            pwd2.classList.remove('is-invalid');
        } else {
            pwd2.setCustomValidity('Las contraseñas no coinciden');
            pwd2.classList.add('is-invalid');
        }
    });

    // Manejo del envío del formulario
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Validación del formulario
        if (!form.checkValidity()) {
            e.stopPropagation();
            form.classList.add('was-validated');
            return;
        }

        // Validación adicional de contraseñas
        if (pwd.value !== pwd2.value) {
            pwd2.setCustomValidity('Las contraseñas no coinciden');
            form.classList.add('was-validated');
            return;
        }

        const submitBtn = document.getElementById('submitBtn');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Registrando...';

        try {
            // Crear FormData con todos los campos (incluimos full_name)
            const formData = new FormData();
            formData.append('usuario', form.usuario.value);
            formData.append('nombre_completo', form.nombre_completo.value);
            formData.append('full_name', form.nombre_completo.value); 
            formData.append('email', form.email.value);
            formData.append('password', form.password.value);
            formData.append('edad', form.edad.value);

            // Añadir imagen si existe
            if (imgInput.files && imgInput.files[0]) {
                formData.append('img_perfil', imgInput.files[0]);
            }

            const response = await fetch(USER_API, {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.detail || data.message || 'Error en el registro');
            }

            alert('¡Registro exitoso!');
            window.location.href = 'login.html';
        } catch (error) {
            console.error('Error:', error);
            alert(error.message || 'Error al registrar usuario');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Crear cuenta';
        }
    });
});