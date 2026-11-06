import {
  clearFormErrors,
  setButtonLoading,
  showFieldError
} from './components/states.js';
import { renderIdentity } from './components/layout.js';
import { showToast } from './components/toast.js';
import {
  updatePassword
} from './services/auth.service.js';
import { updateProfile } from './services/profile.service.js';
import { icon, refreshIcons } from './icons.js';
import { escapeHtml, getErrorMessage } from './utils.js';

const elements = {
  profileForm: document.getElementById('profile-form'),
  profileName: document.getElementById('profile-name'),
  profileEmail: document.getElementById('profile-email'),
  profileMessage: document.getElementById('profile-message'),
  profileSubmit: document.getElementById('profile-submit'),
  passwordForm: document.getElementById('password-form'),
  passwordMessage: document.getElementById('password-message'),
  passwordSubmit: document.getElementById('password-submit')
};

let currentUser = null;

export async function initPage({ user, profile }) {
  currentUser = user;

  elements.profileName.value = profile?.full_name || '';
  elements.profileEmail.value = user?.email || '';

  bindPasswordToggles();
  bindProfileForm();
  bindPasswordForm();
  refreshIcons();
}

function bindProfileForm() {
  elements.profileForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearFormErrors(elements.profileForm);
    hideStatus(elements.profileMessage);

    const fullName = elements.profileName.value.trim();

    if (!fullName) {
      showFieldError(elements.profileName, 'Nama lengkap wajib diisi.');
      return;
    }

    if (fullName.length > 120) {
      showFieldError(elements.profileName, 'Nama maksimal 120 karakter.');
      return;
    }

    setButtonLoading(elements.profileSubmit, true, 'Menyimpan...');

    try {
      const updated = await updateProfile(currentUser.id, { fullName });
      renderIdentity({ user: currentUser, profile: updated });
      showStatus(
        elements.profileMessage,
        'Profil berhasil diperbarui.',
        'success'
      );
      showToast('Profil berhasil diperbarui.', 'success');
    } catch (error) {
      console.error('Failed to update profile:', error);
      showStatus(
        elements.profileMessage,
        getErrorMessage(error, 'Profil gagal diperbarui. Silakan coba lagi.'),
        'error'
      );
    } finally {
      setButtonLoading(elements.profileSubmit, false);
    }
  });
}

function bindPasswordForm() {
  elements.passwordForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearFormErrors(elements.passwordForm);
    hideStatus(elements.passwordMessage);

    const passwordInput = elements.passwordForm.elements.password;
    const confirmInput = elements.passwordForm.elements.confirmPassword;
    const password = passwordInput.value;
    const confirmation = confirmInput.value;

    if (password.length < 8) {
      showFieldError(passwordInput, 'Password baru minimal 8 karakter.');
      return;
    }

    if (password !== confirmation) {
      showFieldError(confirmInput, 'Konfirmasi password tidak sama.');
      return;
    }

    setButtonLoading(elements.passwordSubmit, true, 'Memperbarui...');

    try {
      await updatePassword(password);
      elements.passwordForm.reset();
      showStatus(
        elements.passwordMessage,
        'Password berhasil diperbarui. Gunakan password baru pada login berikutnya.',
        'success'
      );
      showToast('Password berhasil diperbarui.', 'success');
    } catch (error) {
      console.error('Failed to update password:', error);
      const message = /should be different|same password/i.test(
        String(error?.message || '')
      )
        ? 'Password baru harus berbeda dari password sebelumnya.'
        : /session/i.test(String(error?.message || ''))
          ? 'Sesi telah berakhir. Silakan masuk kembali lalu coba lagi.'
          : getErrorMessage(error, 'Password gagal diperbarui.');

      showStatus(elements.passwordMessage, message, 'error');
    } finally {
      setButtonLoading(elements.passwordSubmit, false);
    }
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

function showStatus(element, message, type = 'error') {
  if (!element) {
    return;
  }

  element.hidden = false;
  element.className = `form-status form-status-${type}`;
  element.innerHTML = `
    <span class="form-status-icon">${icon(
      type === 'success' ? 'check-circle-2' : 'alert-circle'
    )}</span>
    <span>${escapeHtml(message)}</span>
  `;
  refreshIcons();
}

function hideStatus(element) {
  if (!element) {
    return;
  }

  element.hidden = true;
  element.textContent = '';
}
