import {
  clearFormErrors,
  setButtonLoading,
  showFieldError
} from './components/states.js';
import { confirmDialog } from './components/modal.js';
import { renderIdentity } from './components/layout.js';
import { showToast } from './components/toast.js';
import {
  updateProfile,
  updateProfilePhoto
} from './services/profile.service.js';
import { fileToAvatarDataUrl } from './photo.js';
import {
  getThemePreference,
  onThemeChange,
  setThemePreference
} from './theme.js';
import { icon, refreshIcons } from './icons.js';
import { escapeHtml, getErrorMessage } from './utils.js';

const THEME_HINTS = {
  light: 'Selalu menggunakan tema terang.',
  dark: 'Selalu menggunakan tema gelap.',
  system: 'Mengikuti pengaturan perangkat.'
};

const elements = {
  profileForm: document.getElementById('profile-form'),
  profileName: document.getElementById('profile-name'),
  profileMessage: document.getElementById('profile-message'),
  profileSubmit: document.getElementById('profile-submit'),
  photoInput: document.getElementById('profile-photo-input'),
  photoUpload: document.getElementById('profile-photo-upload'),
  photoRemove: document.getElementById('profile-photo-remove'),
  photoMessage: document.getElementById('profile-photo-message'),
  themeOptions: Array.from(document.querySelectorAll('[data-theme-option]')),
  themeHint: document.querySelector('[data-theme-hint]')
};

let currentUser = null;
let currentProfile = null;
let photoBound = false;
let themeBound = false;

export async function initPage({ user, profile }) {
  currentUser = user;
  currentProfile = profile;
  elements.profileName.value = profile?.full_name || '';

  bindProfileForm();
  bindPhotoActions();
  bindThemeControls();
  syncThemeControls();
  renderProfilePhoto(profile);
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
      currentProfile = updated;
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

function bindPhotoActions() {
  if (photoBound) {
    return;
  }

  photoBound = true;
  elements.photoUpload?.addEventListener('click', () => {
    elements.photoInput?.click();
  });
  elements.photoInput?.addEventListener('change', handlePhotoUpload);
  elements.photoRemove?.addEventListener('click', handlePhotoRemove);
}

async function handlePhotoUpload() {
  const file = elements.photoInput?.files?.[0];

  if (!file) {
    return;
  }

  hideStatus(elements.photoMessage);
  setButtonLoading(elements.photoUpload, true, 'Memproses...');

  try {
    const dataUrl = await fileToAvatarDataUrl(file);
    const updated = await updateProfilePhoto(currentUser.id, dataUrl);

    currentProfile = updated;
    renderIdentity({ profile: updated });
    showStatus(
      elements.photoMessage,
      'Foto profil berhasil disimpan di perangkat ini.',
      'success'
    );
    showToast('Foto profil berhasil diperbarui.', 'success');
  } catch (error) {
    console.error('Failed to update profile photo:', error);
    showStatus(
      elements.photoMessage,
      getErrorMessage(error, 'Foto profil gagal disimpan. Coba lagi.'),
      'error'
    );
  } finally {
    setButtonLoading(elements.photoUpload, false);
    renderProfilePhoto(currentProfile);

    if (elements.photoInput) {
      elements.photoInput.value = '';
    }
  }
}

async function handlePhotoRemove() {
  if (!currentProfile?.photo) {
    return;
  }

  const confirmed = await confirmDialog({
    title: 'Hapus foto profil?',
    message:
      'Foto profil akan dihapus dari perangkat ini. Nama dan seluruh catatan keuangan tetap tersimpan.',
    confirmLabel: 'Hapus Foto',
    cancelLabel: 'Batal',
    danger: true
  });

  if (!confirmed) {
    return;
  }

  hideStatus(elements.photoMessage);
  setButtonLoading(elements.photoRemove, true, 'Menghapus...');

  try {
    const updated = await updateProfilePhoto(currentUser.id, null);

    currentProfile = updated;
    renderIdentity({ profile: updated });
    showStatus(
      elements.photoMessage,
      'Foto profil berhasil dihapus.',
      'success'
    );
    showToast('Foto profil berhasil dihapus.', 'success');
  } catch (error) {
    console.error('Failed to remove profile photo:', error);
    showStatus(
      elements.photoMessage,
      getErrorMessage(error, 'Foto profil gagal dihapus. Coba lagi.'),
      'error'
    );
  } finally {
    setButtonLoading(elements.photoRemove, false);
    renderProfilePhoto(currentProfile);
  }
}

function renderProfilePhoto(profile) {
  const hasPhoto = Boolean(profile?.photo);
  const uploadLabel = elements.photoUpload?.querySelector('span');

  if (uploadLabel) {
    uploadLabel.textContent = hasPhoto ? 'Ganti Foto' : 'Tambah Foto';
  }

  if (elements.photoRemove) {
    elements.photoRemove.hidden = !hasPhoto;
  }
}

function bindThemeControls() {
  if (themeBound) {
    return;
  }

  themeBound = true;
  elements.themeOptions.forEach((button) => {
    button.addEventListener('click', () => {
      const preference = button.dataset.themeOption;

      if (preference) {
        setThemePreference(preference);
      }
    });
  });

  onThemeChange(syncThemeControls);
}

function syncThemeControls() {
  const preference = getThemePreference();

  elements.themeOptions.forEach((button) => {
    const isActive = button.dataset.themeOption === preference;

    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  });

  if (elements.themeHint) {
    elements.themeHint.textContent = THEME_HINTS[preference] || THEME_HINTS.system;
  }
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
