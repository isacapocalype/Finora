import { isConfigured } from './supabase.js';
import {
  getSession,
  onAuthStateChange,
  requestPasswordReset,
  signIn,
  signUp,
  updatePassword
} from './services/auth.service.js';
import { icon, refreshIcons } from './icons.js';
import { showToast } from './components/toast.js';
import {
  clearFormErrors,
  setButtonLoading,
  showFieldError
} from './components/states.js';
import { escapeHtml, getErrorMessage } from './utils.js';

const page = document.body.dataset.authPage;
const dashboardUrl = new URL('pages/dashboard.html', window.location.href).href;
const loginUrl = new URL('login.html', window.location.href).href;

init();

function init() {
  refreshIcons();
  bindPasswordToggles();

  if (!isConfigured) {
    showConfigNotice();
    return;
  }

  switch (page) {
    case 'login':
      initLogin();
      redirectIfAuthenticated();
      break;
    case 'register':
      initRegister();
      redirectIfAuthenticated();
      break;
    case 'forgot':
      initForgotPassword();
      break;
    case 'reset':
      initResetPassword();
      break;
    default:
      break;
  }
}

function showConfigNotice() {
  const notice = document.querySelector('[data-config-notice]');

  if (notice) {
    notice.hidden = false;
  }

  document.querySelectorAll('form').forEach((form) => {
    form.querySelectorAll('input, button').forEach((control) => {
      control.disabled = true;
    });
  });
}

function bindPasswordToggles() {
  document.querySelectorAll('[data-password-toggle]').forEach((button) => {
    button.addEventListener('click', () => {
      const input = document.getElementById(button.dataset.passwordToggle);

      if (!input) {
        return;
      }

      const showPassword = input.type === 'password';
      input.type = showPassword ? 'text' : 'password';
      button.setAttribute('aria-pressed', String(showPassword));
      button.setAttribute(
        'aria-label',
        showPassword ? 'Sembunyikan password' : 'Tampilkan password'
      );
      button.innerHTML = icon(showPassword ? 'eye-off' : 'eye');
      refreshIcons();
      input.focus();
    });
  });
}

async function redirectIfAuthenticated() {
  try {
    const session = await getSession();

    if (session) {
      window.location.replace(dashboardUrl);
    }
  } catch (error) {
    console.error('Failed to check auth session:', error);
  }
}

function initLogin() {
  const form = document.getElementById('login-form');

  if (!form) {
    return;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearFormErrors(form);
    hideStatus();

    const emailInput = form.elements.email;
    const passwordInput = form.elements.password;
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const submitButton = form.querySelector('[type="submit"]');

    if (!isValidEmail(email)) {
      showFieldError(emailInput, 'Masukkan alamat email yang valid.');
      return;
    }

    if (!password) {
      showFieldError(passwordInput, 'Password wajib diisi.');
      return;
    }

    setButtonLoading(submitButton, true, 'Memeriksa...');

    try {
      await signIn({ email, password });
      window.location.replace(dashboardUrl);
    } catch (error) {
      console.error('Failed to sign in:', error);
      setButtonLoading(submitButton, false);
      showStatus(mapAuthError(error), 'error');
    }
  });
}

function initRegister() {
  const form = document.getElementById('register-form');

  if (!form) {
    return;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearFormErrors(form);
    hideStatus();

    const fullNameInput = form.elements.fullName;
    const emailInput = form.elements.email;
    const passwordInput = form.elements.password;
    const confirmInput = form.elements.confirmPassword;
    const fullName = fullNameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const confirmPassword = confirmInput.value;
    const submitButton = form.querySelector('[type="submit"]');

    if (fullName.length < 1) {
      showFieldError(fullNameInput, 'Nama lengkap wajib diisi.');
      return;
    }

    if (!isValidEmail(email)) {
      showFieldError(emailInput, 'Masukkan alamat email yang valid.');
      return;
    }

    if (password.length < 8) {
      showFieldError(passwordInput, 'Password minimal 8 karakter.');
      return;
    }

    if (password !== confirmPassword) {
      showFieldError(confirmInput, 'Konfirmasi password tidak sama.');
      return;
    }

    setButtonLoading(submitButton, true, 'Membuat akun...');

    try {
      const result = await signUp({ email, password, fullName });

      if (result.session) {
        window.location.replace(dashboardUrl);
        return;
      }

      const success = document.getElementById('register-success');
      const successEmail = document.querySelector('[data-register-email]');
      const defaultContent = form
        .closest('.auth-form-wrap')
        ?.querySelector('[data-auth-default]');

      if (successEmail) {
        successEmail.textContent = email;
      }

      if (defaultContent) {
        defaultContent.hidden = true;
      }
      if (success) {
        success.hidden = false;
      }
      refreshIcons();
    } catch (error) {
      console.error('Failed to register:', error);
      setButtonLoading(submitButton, false);
      showStatus(mapAuthError(error), 'error');
    }
  });
}

function initForgotPassword() {
  const form = document.getElementById('forgot-form');

  if (!form) {
    return;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearFormErrors(form);
    hideStatus();

    const emailInput = form.elements.email;
    const email = emailInput.value.trim();
    const submitButton = form.querySelector('[type="submit"]');

    if (!isValidEmail(email)) {
      showFieldError(emailInput, 'Masukkan alamat email yang valid.');
      return;
    }

    setButtonLoading(submitButton, true, 'Mengirim...');

    try {
      await requestPasswordReset(email);
      showStatus(
        'Jika email tersebut terdaftar, tautan reset password sudah dikirim. Periksa kotak masuk dan folder spam.',
        'success'
      );
      form.reset();
    } catch (error) {
      console.error('Failed to request password reset:', error);
      showStatus(mapAuthError(error), 'error');
    } finally {
      setButtonLoading(submitButton, false);
    }
  });
}

function initResetPassword() {
  const form = document.getElementById('reset-form');
  const invalidState = document.getElementById('reset-invalid');

  if (!form || !invalidState) {
    return;
  }

  const enableForm = () => {
    form.hidden = false;
    invalidState.hidden = true;
  };

  const disableForm = () => {
    form.hidden = true;
    invalidState.hidden = false;
    refreshIcons();
  };

  getSession()
    .then((session) => {
      if (session) {
        enableForm();
      } else {
        disableForm();
      }
    })
    .catch((error) => {
      console.error('Failed to check recovery session:', error);
      disableForm();
    });

  onAuthStateChange((event, session) => {
    if (
      session &&
      (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN')
    ) {
      enableForm();
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearFormErrors(form);
    hideStatus();

    const passwordInput = form.elements.password;
    const confirmInput = form.elements.confirmPassword;
    const password = passwordInput.value;
    const confirmPassword = confirmInput.value;
    const submitButton = form.querySelector('[type="submit"]');

    if (password.length < 8) {
      showFieldError(passwordInput, 'Password baru minimal 8 karakter.');
      return;
    }

    if (password !== confirmPassword) {
      showFieldError(confirmInput, 'Konfirmasi password tidak sama.');
      return;
    }

    setButtonLoading(submitButton, true, 'Menyimpan...');

    try {
      await updatePassword(password);
      const success = document.getElementById('reset-success');
      const defaultContent = form
        .closest('.auth-form-wrap')
        ?.querySelector('[data-auth-default]');

      if (defaultContent) {
        defaultContent.hidden = true;
      }
      if (success) {
        success.hidden = false;
      }
      showToast('Password berhasil diperbarui.', 'success');
      refreshIcons();
    } catch (error) {
      console.error('Failed to update password:', error);
      setButtonLoading(submitButton, false);
      showStatus(mapAuthError(error), 'error');
    }
  });
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function mapAuthError(error) {
  const message = String(error?.message || '');

  if (/invalid login credentials/i.test(message)) {
    return 'Email atau password salah. Periksa kembali data Anda.';
  }

  if (/email not confirmed/i.test(message)) {
    return 'Email belum diverifikasi. Periksa kotak masuk dan klik tautan verifikasi.';
  }

  if (/user already registered/i.test(message)) {
    return 'Email ini sudah terdaftar. Silakan masuk atau reset password.';
  }

  if (/password should be at least/i.test(message)) {
    return 'Password minimal 8 karakter.';
  }

  if (/unable to validate email|invalid email/i.test(message)) {
    return 'Format email tidak valid.';
  }

  if (/for security purposes|rate limit|too many requests/i.test(message)) {
    return 'Terlalu banyak percobaan. Tunggu beberapa saat lalu coba lagi.';
  }

  if (/signups? not allowed|email signups? (are )?disabled/i.test(message)) {
    return 'Pendaftaran email sedang dinonaktifkan pada project Supabase ini.';
  }

  if (/auth session missing|recovery session/i.test(message)) {
    return 'Tautan reset tidak valid atau sudah kedaluwarsa. Minta tautan baru.';
  }

  return getErrorMessage(
    error,
    'Terjadi kesalahan. Silakan coba lagi beberapa saat lagi.'
  );
}

function showStatus(message, type = 'error') {
  const status = document.getElementById('auth-message');

  if (!status) {
    return;
  }

  status.hidden = false;
  status.className = `form-status form-status-${type}`;
  status.innerHTML = `
    <span class="form-status-icon">${icon(
      type === 'success' ? 'check-circle-2' : 'alert-circle'
    )}</span>
    <span>${escapeHtml(message)}</span>
  `;
  refreshIcons();
}

function hideStatus() {
  const status = document.getElementById('auth-message');

  if (status) {
    status.hidden = true;
    status.textContent = '';
  }
}
