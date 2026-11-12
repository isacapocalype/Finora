import {
  clearFormErrors,
  setButtonLoading,
  showFieldError
} from './components/states.js';
import { renderIdentity } from './components/layout.js';
import { showToast } from './components/toast.js';
import { updateProfile } from './services/profile.service.js';
import { icon, refreshIcons } from './icons.js';
import { escapeHtml, getErrorMessage } from './utils.js';

const elements = {
  profileForm: document.getElementById('profile-form'),
  profileName: document.getElementById('profile-name'),
  profileMessage: document.getElementById('profile-message'),
  profileSubmit: document.getElementById('profile-submit')
};

let currentUser = null;

export async function initPage({ user, profile }) {
  currentUser = user;
  elements.profileName.value = profile?.full_name || '';

  bindProfileForm();
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
      renderIdentity({ profile: updated });
      showStatus(
        elements.profileMessage,
        'Profil berhasil diperbarui dan tersimpan di perangkat ini.',
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
