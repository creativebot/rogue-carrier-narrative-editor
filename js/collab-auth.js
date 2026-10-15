// ============================================================================
// js/collab-auth.js - @n-ix.com Auth, Team Manager, Snapshots, Comments & Notifications
// ============================================================================

/* ==========================================================================
   AUTHENTICATION & DOMAIN ACCESS CONTROL (@n-ix.com)
   ========================================================================== */
const GENERIC_PLACEHOLDER_NAMES = new Set([
  'authorized editor',
  'editor user',
  'daniel (local pc)',
  'user',
  'n-ix member',
  'member',
  'anonymous',
  'unknown'
]);

function isGenericPlaceholderName(name) {
  if (!name || typeof name !== 'string') return true;
  return GENERIC_PLACEHOLDER_NAMES.has(name.trim().toLowerCase());
}

function resolveUserDisplayName(email, candidateName = '') {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cand = String(candidateName || '').trim();
  if (cand && !isGenericPlaceholderName(cand)) {
    return cand;
  }
  if (cleanEmail) {
    if (Array.isArray(allNixUsers)) {
      const matched = allNixUsers.find(u => u && String(u.email || '').trim().toLowerCase() === cleanEmail);
      if (matched && matched.name && !isGenericPlaceholderName(matched.name)) {
        return matched.name.trim();
      }
    }
    if (cleanEmail === 'dpoludonnyi@n-ix.com' || cleanEmail === 'daniel.poludyonny@gmail.com') {
      return 'Daniel Poludyonny';
    }
    if (cleanEmail.includes('@')) {
      return cleanEmail.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  }
  return cand || 'Daniel Poludyonny';
}

function sanitizeUserProfile(u) {
  if (!u || typeof u !== 'object') return u;
  const email = String(u.email || 'dpoludonnyi@n-ix.com').trim().toLowerCase();
  u.email = email;
  u.name = resolveUserDisplayName(email, u.name);
  if (email === 'dpoludonnyi@n-ix.com' || email === 'daniel.poludyonny@gmail.com') {
    u.role = 'admin';
    u.isAdmin = true;
    u.status = 'approved';
    u.canEdit = true;
  }
  return u;
}

let allNixUsers = [];
let currentUser = (() => {
  try {
    const raw = localStorage.getItem('rogue_carrier_auth_user');
    if (!raw) return null;
    const parsed = sanitizeUserProfile(JSON.parse(raw));
    localStorage.setItem('rogue_carrier_auth_user', JSON.stringify(parsed));
    return parsed;
  } catch (e) {
    return null;
  }
})();
let authToken = localStorage.getItem('rogue_carrier_auth_token') || '';

function isLocalEnvironment() {
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '';
}

async function initAuthSystem() {
  if (isLocalEnvironment()) {
    currentUser = sanitizeUserProfile({
      email: 'dpoludonnyi@n-ix.com',
      name: 'Daniel Poludyonny',
      role: 'admin',
      status: 'approved',
      canEdit: true,
      isAdmin: true
    });
    updateAuthHeaderUI();
    preloadTeamUsers();
    return;
  }

  if (currentUser) {
    currentUser = sanitizeUserProfile(currentUser);
  }

  if (authToken) {
    try {
      const res = await fetch('/api/auth/me', {
        headers: getAuthHeaders(false)
      });
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'success' && data.user) {
          const prevRealName = (currentUser && !isGenericPlaceholderName(currentUser.name)) ? currentUser.name : '';
          if (prevRealName && isGenericPlaceholderName(data.user.name)) {
            data.user.name = prevRealName;
          }
          currentUser = sanitizeUserProfile(data.user);
          if (data.token && typeof data.token === 'string' && data.token.startsWith('rctok.')) {
            authToken = data.token;
            try {
              localStorage.setItem('rogue_carrier_auth_token', authToken);
            } catch (e) {}
          }
          try {
            localStorage.setItem('rogue_carrier_auth_user', JSON.stringify(currentUser));
          } catch (e) {}
        } else if (!currentUser) {
          authToken = '';
          localStorage.removeItem('rogue_carrier_auth_token');
        }
      }
    } catch (e) {
      console.warn("Could not verify auth token:", e);
    }
  }
  updateAuthHeaderUI();
  preloadTeamUsers();
}

let isCurrentBoardReadOnly = false;
let currentBoardLock = null;
let boardLockHeartbeatTimer = null;
let boardLockCountdownTimer = null;

function canUserEdit() {
  if (isCurrentBoardReadOnly) return false;
  if (isLocalEnvironment()) return true;
  return Boolean(currentUser && currentUser.status === 'approved' && currentUser.canEdit !== false);
}

function requireAuthToEdit(actionDesc = "edit this element") {
  if (isCurrentBoardReadOnly) {
    const owner = currentBoardLock?.userName || 'another editor';
    const expSec = currentBoardLock?.remainingSeconds || 0;
    const min = Math.floor(expSec / 60);
    const sec = expSec % 60;
    const timeStr = expSec > 0 ? ` (lease expires in ${min}m ${sec}s)` : '';
    showToast(`🔒 Read-Only: This board is currently locked by ${owner}${timeStr}.`, "warning");
    return false;
  }
  if (isLocalEnvironment()) return true;
  if (canUserEdit()) return true;
  showToast(`🔒 Read-Only: Please sign in with your @n-ix.com email to ${actionDesc}.`, "warning");
  openAuthModal();
  return false;
}

function updateAuthHeaderUI() {
  const btnLogin = document.getElementById('btn-header-login');
  const userBadge = document.getElementById('auth-user-badge');
  const badgeRole = document.getElementById('auth-badge-role');
  const badgeName = document.getElementById('auth-badge-name');
  const btnTeam = document.getElementById('btn-admin-team');
  const readonlyBanner = document.getElementById('readonly-mode-banner');
  const regTab = document.getElementById('auth-tab-register');
  const authGate = document.getElementById('public-auth-gate');
  const canvasContainer = document.getElementById('canvas-container');
  const mobileStage = document.getElementById('mobile-stage-view');

  // Disable registration on public web page
  if (regTab) regTab.classList.add('hidden');

  if (isLocalEnvironment() || canUserEdit()) {
    if (authGate) authGate.classList.add('hidden');
    if (canvasContainer) canvasContainer.style.display = '';
    if (readonlyBanner) readonlyBanner.classList.add('hidden');
    if (btnLogin) btnLogin.classList.add('hidden');
    if (userBadge) userBadge.classList.remove('hidden');
    if (badgeName) {
      badgeName.innerText = isLocalEnvironment() ? 'Local (No Auth)' : (currentUser.name || currentUser.email);
      badgeName.title = isLocalEnvironment() ? 'Running on local machine without authorization' : `${currentUser.name} (${currentUser.email})`;
    }
    if (badgeRole) {
      if (isLocalEnvironment() || (currentUser && currentUser.role === 'admin')) {
        badgeRole.innerText = isLocalEnvironment() ? 'Unlocked' : 'Admin';
        badgeRole.className = 'px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40';
      } else {
        badgeRole.innerText = 'Editor';
        badgeRole.className = 'px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/40';
      }
    }
    if (btnTeam) {
      if (isLocalEnvironment() || (currentUser && currentUser.role === 'admin')) btnTeam.classList.remove('hidden');
      else btnTeam.classList.add('hidden');
    }
  } else {
    // Unauthenticated public URI access: completely hide board, show lock gate
    if (authGate) {
      authGate.classList.remove('hidden');
      setupGoogleSignIn();
      if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
    }
    if (canvasContainer) canvasContainer.style.display = 'none';
    if (mobileStage) mobileStage.classList.add('hidden');
    if (readonlyBanner) readonlyBanner.classList.add('hidden');
    if (btnLogin) btnLogin.classList.remove('hidden');
    if (userBadge) userBadge.classList.add('hidden');
    if (btnTeam) btnTeam.classList.add('hidden');
  }
}

let isRegistrationDisabled = true;

function switchAuthTab(tab) {
  const formLogin = document.getElementById('form-auth-login');
  const formRegister = document.getElementById('form-auth-register');
  const tabLogin = document.getElementById('auth-tab-login');
  const tabRegister = document.getElementById('auth-tab-register');
  const errLogin = document.getElementById('auth-login-error');
  const errRegister = document.getElementById('auth-register-error');

  if (errLogin) errLogin.classList.add('hidden');
  if (errRegister) errRegister.classList.add('hidden');

  if (tabRegister && isRegistrationDisabled) {
    tabRegister.style.display = 'none';
    tabRegister.classList.add('hidden');
  }

  if (tab === 'register' && !isRegistrationDisabled) {
    if (formLogin) formLogin.classList.add('hidden');
    if (formRegister) formRegister.classList.remove('hidden');
    if (tabRegister) {
      tabRegister.className = 'flex-1 py-2 text-center font-bold text-sm text-emerald-400 border-b-2 border-emerald-500 transition';
    }
    if (tabLogin) {
      tabLogin.className = 'flex-1 py-2 text-center font-bold text-sm text-gray-400 hover:text-gray-200 border-b-2 border-transparent transition';
    }
    const regName = document.getElementById('register-input-name');
    if (regName) setTimeout(() => regName.focus(), 100);
  } else {
    if (formLogin) formLogin.classList.remove('hidden');
    if (formRegister) formRegister.classList.add('hidden');
    if (tabLogin) {
      tabLogin.className = 'flex-1 py-2 text-center font-bold text-sm text-blue-400 border-b-2 border-blue-500 transition';
    }
    if (tabRegister) {
      tabRegister.className = (isRegistrationDisabled ? 'hidden ' : '') + 'flex-1 py-2 text-center font-bold text-sm text-gray-400 hover:text-gray-200 border-b-2 border-transparent transition';
      if (isRegistrationDisabled) tabRegister.style.display = 'none';
    }
    const logEmail = document.getElementById('login-input-email');
    if (logEmail) setTimeout(() => logEmail.focus(), 100);
  }
}

function openAuthModal() {
  const errGoogle = document.getElementById('auth-google-error');
  if (errGoogle) errGoogle.classList.add('hidden');
  openModal('modal-auth');
  setupGoogleSignIn();
}

let googleClientId = '436412031999-5hjf625k2417tn0ua2lb395731111dvb.apps.googleusercontent.com';

async function setupGoogleSignIn() {
  try {
    const res = await fetch('/api/auth/me');
    if (res.ok) {
      const data = await res.json();
      if (data.googleClientId) {
        googleClientId = data.googleClientId;
      }
    }
  } catch (e) {}

  if (window.google && window.google.accounts && window.google.accounts.id && googleClientId) {
    try {
      google.accounts.id.initialize({
        client_id: googleClientId,
        callback: handleGoogleSignInResponse,
        auto_select: false
      });
      const gBtn = document.getElementById('g_id_signin');
      if (gBtn) {
        google.accounts.id.renderButton(gBtn, {
          theme: 'outline',
          size: 'large',
          text: 'signin_with',
          shape: 'rectangular',
          width: 320
        });
        const customBtn = document.getElementById('btn-custom-google-signin');
        if (customBtn) customBtn.classList.add('hidden');
      }

      const gateBtn = document.getElementById('gate_g_id_signin');
      if (gateBtn) {
        google.accounts.id.renderButton(gateBtn, {
          theme: 'outline',
          size: 'large',
          text: 'signin_with',
          shape: 'rectangular',
          width: 320
        });
      }
    } catch (err) {
      console.warn("Google Sign-In initialization:", err);
    }
  }
}

async function handleGoogleSignInResponse(response) {
  const errEl = document.getElementById('auth-google-error');
  const gateErrEl = document.getElementById('gate-google-error');
  if (errEl) errEl.classList.add('hidden');
  if (gateErrEl) gateErrEl.classList.add('hidden');

  if (!response || !response.credential) {
    const msg = "No credential received from Google.";
    if (errEl) { errEl.innerText = msg; errEl.classList.remove('hidden'); }
    if (gateErrEl) { gateErrEl.innerText = msg; gateErrEl.classList.remove('hidden'); }
    return;
  }

  try {
    const res = await fetch('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: response.credential })
    });
    const data = await res.json();
    if (res.ok && data.status === 'success') {
      authToken = data.token;
      currentUser = data.user;
      localStorage.setItem('rogue_carrier_auth_token', authToken);
      try {
        localStorage.setItem('rogue_carrier_auth_user', JSON.stringify(currentUser));
      } catch (e) {}
      updateAuthHeaderUI();
      closeModal('modal-auth');
      showToast(data.message || `Signed in with Google as ${currentUser.name}!`, 'success');
      preloadTeamUsers();

      // Unlock and render full narrative board
      await loadProjectData();
      await loadAllCommentCounts();
      setupCanvasEvents();
      setupPdfImportEvents();
      setupPickerEvents();
      setupPortDragEvents();

      // Auto-detect narrow phone devices (< 768px, iPhone, Android phones, etc.) - keep iPad / tablets in PC canvas mode
      const isPhoneDevice = window.innerWidth < 768 && /Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      if (isPhoneDevice) {
        switchAppViewMode('mobile-stage', true);
      } else {
        renderApp();
        setTimeout(() => {
          updateCanvasTransform();
          fitWholeSchematic();
        }, 150);
      }
    } else {
      const msg = data.message || "Google authentication failed.";
      if (errEl) { errEl.innerText = msg; errEl.classList.remove('hidden'); }
      if (gateErrEl) { gateErrEl.innerText = msg; gateErrEl.classList.remove('hidden'); }
    }
  } catch (e) {
    const msg = "Network error connecting to auth server.";
    if (errEl) { errEl.innerText = msg; errEl.classList.remove('hidden'); }
    if (gateErrEl) { gateErrEl.innerText = msg; gateErrEl.classList.remove('hidden'); }
  }
}

async function triggerGoogleSignIn() {
  const errEl = document.getElementById('auth-google-error');
  if (errEl) errEl.classList.add('hidden');

  if (window.google && window.google.accounts && window.google.accounts.id && googleClientId) {
    google.accounts.id.prompt((notification) => {
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        console.log("OneTap dismissed or not displayed:", notification.getNotDisplayedReason());
      }
    });
    return;
  }

  const inputCid = prompt(
    "To enable 'Sign in with Google' on this web domain, please enter your Google OAuth 2.0 Client ID (from Google Cloud Console):\n\n(Example: 123456789-abc.apps.googleusercontent.com)",
    googleClientId || ""
  );
  if (inputCid && inputCid.trim()) {
    googleClientId = inputCid.trim();
    showToast("Configured Google Client ID! Initializing...", "info");
    setupGoogleSignIn();
  }
}

async function submitUserLogin() {
  const inputEmail = document.getElementById('login-input-email');
  const inputPass = document.getElementById('login-input-password');
  const errEl = document.getElementById('auth-login-error');
  const btnSubmit = document.getElementById('btn-submit-login');

  const email = (inputEmail ? inputEmail.value.trim().toLowerCase() : '');
  const password = (inputPass ? inputPass.value : '');

  if (!email || !email.endsWith('@n-ix.com')) {
    if (errEl) {
      errEl.innerText = 'Access restricted: Only emails ending in @n-ix.com are permitted.';
      errEl.classList.remove('hidden');
    }
    return;
  }

  if (errEl) errEl.classList.add('hidden');
  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = 'Signing In...';
  }

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (res.ok && data.status === 'success') {
      authToken = data.token;
      currentUser = data.user;
      localStorage.setItem('rogue_carrier_auth_token', authToken);
      try {
        localStorage.setItem('rogue_carrier_auth_user', JSON.stringify(currentUser));
      } catch (e) {}
      updateAuthHeaderUI();
      closeModal('modal-auth');

      if (currentUser.status === 'pending') {
        showToast(`Signed in! Account is in review queue by Admin Daniel Poludonnyi (Read-Only until approved).`, 'info');
      } else {
        showToast(`Welcome back, ${currentUser.name}! (${currentUser.role.toUpperCase()})`, 'success');
      }
      preloadTeamUsers();
    } else {
      if (errEl) {
        errEl.innerText = data.message || 'Login failed. Please check credentials.';
        errEl.classList.remove('hidden');
      }
    }
  } catch (err) {
    if (errEl) {
      errEl.innerText = 'Server error during sign in.';
      errEl.classList.remove('hidden');
    }
  } finally {
    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = '<i data-lucide="log-in" class="w-4 h-4"></i> Sign In';
      if (window.lucide) lucide.createIcons();
    }
  }
}

async function submitUserRegister() {
  const inputName = document.getElementById('register-input-name');
  const inputEmail = document.getElementById('register-input-email');
  const inputPass = document.getElementById('register-input-password');
  const errEl = document.getElementById('auth-register-error');
  const btnSubmit = document.getElementById('btn-submit-register');

  const name = (inputName ? inputName.value.trim() : '');
  const email = (inputEmail ? inputEmail.value.trim().toLowerCase() : '');
  const password = (inputPass ? inputPass.value : '');

  if (!email || !email.endsWith('@n-ix.com')) {
    if (errEl) {
      errEl.innerText = 'Access restricted: Only emails ending in @n-ix.com can register.';
      errEl.classList.remove('hidden');
    }
    return;
  }

  if (password.length < 6) {
    if (errEl) {
      errEl.innerText = 'Password must be at least 6 characters long.';
      errEl.classList.remove('hidden');
    }
    return;
  }

  if (errEl) errEl.classList.add('hidden');
  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = 'Registering...';
  }

  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });
    const data = await res.json();
    if (res.ok && data.status === 'success') {
      authToken = data.token;
      currentUser = data.user;
      localStorage.setItem('rogue_carrier_auth_token', authToken);
      try {
        localStorage.setItem('rogue_carrier_auth_user', JSON.stringify(currentUser));
      } catch (e) {}
      updateAuthHeaderUI();
      closeModal('modal-auth');

      if (currentUser.role === 'admin') {
        showToast(`Administrator account activated! Full editor permissions unlocked.`, 'success');
      } else {
        showToast(data.message || `Account created! Pending approval by Admin Daniel Poludonnyi.`, 'info');
      }
      preloadTeamUsers();
    } else {
      if (errEl) {
        errEl.innerText = data.message || 'Registration failed.';
        errEl.classList.remove('hidden');
      }
    }
  } catch (err) {
    if (errEl) {
      errEl.innerText = 'Server error during registration.';
      errEl.classList.remove('hidden');
    }
  } finally {
    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = '<i data-lucide="user-plus" class="w-4 h-4"></i> Create Account';
      if (window.lucide) lucide.createIcons();
    }
  }
}

function logoutUser() {
  authToken = '';
  currentUser = null;
  localStorage.removeItem('rogue_carrier_auth_token');
  localStorage.removeItem('rogue_carrier_auth_user');
  updateAuthHeaderUI();
  showToast('Signed out of Rogue Carrier Editor.', 'info');
}

async function preloadTeamUsers() {
  try {
    const res = await fetch('/api/auth/users', { headers: getAuthHeaders(false) });
    if (res.ok) {
      const data = await res.json();
      allNixUsers = data.users || [];
      if (currentUser) {
        currentUser = sanitizeUserProfile(currentUser);
        try {
          localStorage.setItem('rogue_carrier_auth_user', JSON.stringify(currentUser));
        } catch (e) {}
        updateAuthHeaderUI();
      }
    }
  } catch (e) {
    console.warn("Failed preloading team users:", e);
  }
}

async function promptAddTeammateForMention(insertIntoComment = false) {
  const rawEmail = prompt("Enter teammate's @n-ix.com email or handle (e.g. jsmith@n-ix.com or jsmith):", "");
  if (!rawEmail || !rawEmail.trim()) return;
  let email = rawEmail.trim().toLowerCase();
  if (!email.includes('@')) email = `${email}@n-ix.com`;
  const defaultName = email.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  const name = prompt(`Enter display name for ${email}:`, defaultName);
  if (name === null) return;

  try {
    const res = await fetch('/api/auth/users/add', {
      method: 'POST',
      headers: getAuthHeaders(true),
      body: JSON.stringify({ email, name: (name || defaultName).trim() })
    });
    const data = await res.json();
    if (res.ok && data.status === 'success') {
      allNixUsers = data.users || allNixUsers;
      showToast(data.message || `Added ${email} to team list!`, 'success');
      if (insertIntoComment && data.handle) {
        insertMention(data.handle);
      } else {
        const modalTeam = document.getElementById('modal-team-manager');
        if (modalTeam && modalTeam.classList.contains('is-open')) {
          openTeamManagementModal();
        }
      }
    } else {
      showToast(data.message || 'Could not add teammate.', 'error');
    }
  } catch (e) {
    showToast('Error adding teammate: ' + e.message, 'error');
  }
}

async function openTeamManagementModal() {
  await preloadTeamUsers();
  const listContainer = document.getElementById('team-manager-list');
  if (!listContainer) return;

  const addBarHtml = `
    <div class="flex items-center justify-between gap-2 mb-3 pb-2.5 border-b border-gray-800">
      <span class="text-xs text-gray-400">All registered <span class="text-cyan-400 font-mono">@n-ix.com</span> members available for <span class="text-cyan-300 font-mono">@mention</span> tagging:</span>
      <button type="button" onclick="promptAddTeammateForMention(false)" class="px-2.5 py-1 rounded bg-cyan-700 hover:bg-cyan-600 text-white font-bold text-xs shadow transition flex items-center gap-1 shrink-0">
        + Add Teammate
      </button>
    </div>
  `;

  if (allNixUsers.length === 0) {
    listContainer.innerHTML = addBarHtml + '<div class="text-center py-6 text-gray-500">No users registered yet.</div>';
  } else {
    const isAdmin = currentUser && currentUser.role === 'admin';
    listContainer.innerHTML = addBarHtml + `
      <table class="w-full text-left border-collapse">
        <thead>
          <tr class="border-b border-gray-800 text-gray-400 text-[11px] uppercase">
            <th class="py-2 px-3">Team Member</th>
            <th class="py-2 px-3">Email (@n-ix.com)</th>
            <th class="py-2 px-3">Role</th>
            <th class="py-2 px-3">Status</th>
            ${isAdmin ? '<th class="py-2 px-3 text-right">Admin Actions</th>' : ''}
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-800">
          ${allNixUsers.map(u => {
            const isPrimaryAdmin = (u.email.toLowerCase() === 'dpoludonnyi@n-ix.com');
            return `
            <tr class="hover:bg-gray-800/40">
              <td class="py-2.5 px-3 font-semibold text-gray-200">${u.name || 'User'}</td>
              <td class="py-2.5 px-3 font-mono text-cyan-300 text-xs">${u.email}</td>
              <td class="py-2.5 px-3">
                <span class="px-2 py-0.5 rounded text-[10px] font-bold ${u.role === 'admin' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' : 'bg-blue-500/20 text-blue-400 border border-blue-500/40'}">
                  ${u.role.toUpperCase()}
                </span>
              </td>
              <td class="py-2.5 px-3">
                <span class="px-2 py-0.5 rounded text-[10px] font-bold ${u.status === 'approved' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : (u.status === 'pending' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' : 'bg-rose-500/20 text-rose-400 border border-rose-500/40')}">
                  ${u.status.toUpperCase()}
                </span>
              </td>
              ${isAdmin ? `
                <td class="py-2.5 px-3 text-right">
                  ${isPrimaryAdmin ? `
                    <span class="text-[10px] text-gray-500 italic">Primary Admin</span>
                  ` : `
                    <div class="flex items-center justify-end gap-1.5">
                      ${u.status === 'pending' ? `
                        <button type="button" onclick="updateUserStatus('${u.email}', 'approved', '${u.role}')" class="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] shadow transition active:scale-95 flex items-center gap-1">
                          ✔ Approve
                        </button>
                        <button type="button" onclick="updateUserStatus('${u.email}', 'rejected', '${u.role}')" class="px-2 py-1 rounded bg-rose-700 hover:bg-rose-600 text-white font-bold text-[11px] shadow transition active:scale-95 flex items-center gap-1">
                          ✕ Reject
                        </button>
                      ` : `
                        <button type="button" onclick="updateUserStatus('${u.email}', 'pending', '${u.role}')" class="px-2 py-1 rounded bg-gray-800 hover:bg-amber-600 text-amber-300 hover:text-white font-semibold text-[10px] border border-amber-500/40 transition">
                          Set Pending
                        </button>
                      `}
                    </div>
                  `}
                </td>
              ` : ''}
            </tr>
          `}).join('')}
        </tbody>
      </table>
    `;
  }

  openModal('modal-team-manager');
}

async function updateUserStatus(email, status, role) {
  try {
    const res = await fetch('/api/auth/users/update', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ email, status, role })
    });
    const data = await res.json();
    if (res.ok && data.status === 'success') {
      showToast(data.message || `User ${email} updated to ${status}.`, 'success');
      await openTeamManagementModal();
      await preloadTeamUsers();
    } else {
      showToast(data.message || 'Failed to update user status.', 'error');
    }
  } catch (err) {
    showToast('Network error updating user status.', 'error');
  }
}

/* ==========================================================================
   BACKUPS & SNAPSHOT MANAGEMENT
   ========================================================================== */
function switchSaveManagerTab(tab) {
  const tabBoard = document.getElementById('save-manager-tab-board');
  const tabSaves = document.getElementById('save-manager-tab-saves');
  const tabBackups = document.getElementById('save-manager-tab-backups');
  const btnBoard = document.getElementById('tab-btn-board-saves');
  const btnSaves = document.getElementById('tab-btn-saves');
  const btnBackups = document.getElementById('tab-btn-backups');

  if (tabBoard) tabBoard.classList.add('hidden');
  if (tabSaves) tabSaves.classList.add('hidden');
  if (tabBackups) tabBackups.classList.add('hidden');

  const inactiveBtn = 'px-3 py-1.5 rounded-md text-gray-400 hover:text-white transition flex items-center gap-1.5';
  if (btnBoard) btnBoard.className = inactiveBtn;
  if (btnSaves) btnSaves.className = inactiveBtn;
  if (btnBackups) btnBackups.className = inactiveBtn;

  if (tab === 'board') {
    if (tabBoard) tabBoard.classList.remove('hidden');
    if (btnBoard) btnBoard.className = 'px-3 py-1.5 rounded-md bg-cyan-600 text-white shadow transition flex items-center gap-1.5';
    if (typeof renderBoardSavedVersionsList === 'function') {
      renderBoardSavedVersionsList();
    }
  } else if (tab === 'saves') {
    if (tabSaves) tabSaves.classList.remove('hidden');
    if (btnSaves) btnSaves.className = 'px-3 py-1.5 rounded-md bg-cyan-600 text-white shadow transition flex items-center gap-1.5';
    if (typeof renderSavedVersionsList === 'function') {
      renderSavedVersionsList();
    }
  } else {
    if (tabBackups) tabBackups.classList.remove('hidden');
    if (btnBackups) btnBackups.className = 'px-3 py-1.5 rounded-md bg-emerald-600 text-white shadow transition flex items-center gap-1.5';
    loadBackupsList();
  }
}

async function loadBackupsList() {
  const container = document.getElementById('backups-snapshots-list');
  if (!container) return;

  container.innerHTML = '<div class="text-center py-6 text-gray-500 flex items-center justify-center gap-2"><i data-lucide="loader-2" class="w-4 h-4 animate-spin text-cyan-400"></i> Loading snapshots and browser backups...</div>';
  if (window.lucide) lucide.createIcons();

  // 1. Gather browser local storage candidates
  const localCandidates = scanAllLocalRecoveryCandidates();

  // 2. Gather server backups with active board filter
  let serverBackups = [];
  try {
    const qs = `?category=${encodeURIComponent(activeCategoryFilter)}&variationId=${encodeURIComponent(activeVariationId)}`;
    const res = await fetch(`/api/backups${qs}`, {
      headers: getAuthHeaders(false)
    });
    if (res.ok) {
      const data = await res.json();
      serverBackups = data.backups || [];
    }
  } catch (err) {
    console.warn("Server backups not reachable", err);
  }

  if (localCandidates.length === 0 && serverBackups.length === 0) {
    container.innerHTML = '<div class="text-center py-8 bg-gray-950/60 rounded-lg border border-dashed border-gray-800 text-gray-400"><p class="font-semibold text-gray-300">No backup snapshots stored yet</p><p class="text-[11px] text-gray-500 mt-1">Every save and session edit automatically creates safe snapshots here.</p></div>';
    return;
  }

  let html = '';

  // SECTION: Server & Browser Backup History
  if (serverBackups.length > 0 || localCandidates.length > 0) {
    html += `
      <div class="mb-3">
        <div class="text-[11px] font-bold text-cyan-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <span>💾</span> Backup History (${serverBackups.length + localCandidates.length} saves)
        </div>
        <div class="space-y-2">
    `;

    // 1. First render server disk snapshots (primary, real files)
    serverBackups.forEach(s => {
      html += `
        <div class="p-3 bg-gray-950/80 border border-gray-800 hover:border-emerald-500/50 rounded-xl flex items-center justify-between gap-3 transition">
          <div class="space-y-1 min-w-0 flex-1">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="font-bold text-gray-200 text-xs">${s.reason || 'Save Backup'}</span>
              <span class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">Server File</span>
              <span class="text-[10px] text-gray-400 font-mono">🕒 ${s.displayTime || s.timestamp}</span>
              <span class="px-1.5 py-0.5 rounded text-[10px] font-mono bg-gray-900 text-gray-400">👤 ${s.author}</span>
            </div>
            <div class="text-[11px] text-gray-400 flex items-center gap-3">
              <span>Events: <strong class="text-amber-400 font-mono">${s.nodeCount}</strong></span>
              <span>•</span>
              <span>Dialogues: <strong class="text-purple-400 font-mono">${s.dialogueCount}</strong></span>
              <span>•</span>
              <span>Size: <strong class="text-gray-300 font-mono">${Math.round((s.sizeBytes || 0) / 1024)} KB</strong></span>
            </div>
          </div>
          <div class="flex items-center gap-1.5 shrink-0">
            <button type="button" onclick="restoreSnapshot('${s.id}')" 
                    class="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-2.5 py-1.5 rounded flex items-center gap-1 text-xs shadow transition active:scale-95" 
                    title="Restore canvas to this state">
              ↺ Restore
            </button>
            <a href="/api/backups/${s.filename}" download="${s.filename}" 
               class="bg-gray-800 hover:bg-gray-700 text-cyan-300 border border-gray-700 font-semibold px-2 py-1.5 rounded flex items-center gap-1 text-xs shadow transition"
               title="Download raw backup JSON">
              📥 JSON
            </a>
          </div>
        </div>
      `;
    });

    // 2. Render local browser backups
    localCandidates.forEach(cand => {
      html += `
        <div class="p-3 bg-gray-950/80 border border-gray-800 hover:border-cyan-500/50 rounded-xl flex items-center justify-between gap-3 transition">
          <div class="space-y-1 min-w-0 flex-1">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="font-bold text-gray-200 text-xs truncate">${cand.name}</span>
              <span class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">Local Copy</span>
              <span class="text-[10px] text-gray-400 font-mono">🕒 ${cand.displayTime}</span>
              <span class="px-1.5 py-0.5 rounded text-[10px] font-mono bg-gray-900 text-gray-400">👤 ${cand.author || 'User'}</span>
            </div>
            <div class="text-[11px] text-gray-400 flex items-center gap-2 flex-wrap">
              <span>Events: <strong class="text-amber-400 font-mono">${cand.nodeCount}</strong></span>
              <span>•</span>
              <span>Dialogues: <strong class="text-purple-400 font-mono">${cand.dialogueCount}</strong></span>
            </div>
          </div>
          <div class="flex items-center gap-1.5 shrink-0">
            <button type="button" onclick="restoreCandidate('${cand.id}')" 
                    class="bg-cyan-600 hover:bg-cyan-500 text-white font-bold px-2.5 py-1.5 rounded flex items-center gap-1 text-xs shadow transition active:scale-95" 
                    title="Restore canvas to this state">
              ↺ Restore
            </button>
            <button type="button" onclick="downloadCandidateJson('${cand.id}')" 
                    class="bg-gray-800 hover:bg-gray-700 text-cyan-300 border border-gray-700 font-semibold px-2 py-1.5 rounded flex items-center gap-1 text-xs shadow transition" 
                    title="Download backup JSON">
              📥 JSON
            </button>
            <button type="button" onclick="deleteLocalCandidate('${cand.id}')" 
                    class="bg-gray-800 hover:bg-red-900/60 text-gray-400 hover:text-red-300 px-2 py-1.5 rounded text-xs transition" 
                    title="Delete backup">
              🗑️
            </button>
          </div>
        </div>
      `;
    });

    html += `
        </div>
      </div>
    `;
  }

  container.innerHTML = html;
  if (window.lucide) lucide.createIcons();
}

async function createManualSnapshot() {
  const reason = prompt("Enter a label/reason for this manual backup snapshot:", "Manual Checkpoint");
  if (reason === null) return;
  const author = (currentUser && currentUser.name) || 'Editor User';

  try {
    const res = await fetch('/api/backups/create', {
      method: 'POST',
      headers: getAuthHeaders(true),
      body: JSON.stringify({ reason: reason.trim() || 'Manual Snapshot', author })
    });
    if (res.ok) {
      showToast("Manual snapshot captured on server & local copy!", "success");
      loadBackupsList();
    }
  } catch (e) {
    showToast("Failed creating snapshot", "error");
  }
}

async function restoreSnapshot(snapshotId) {
  if (!confirm(`Are you sure you want to rollback to snapshot '${snapshotId}'?\n\nA safety pre-rollback snapshot of your current state will be taken automatically before replacing data.`)) {
    return;
  }

  try {
    const res = await fetch('/api/backups/restore', {
      method: 'POST',
      headers: getAuthHeaders(true),
      body: JSON.stringify({ id: snapshotId })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.status === 'success' && data.data) {
        pushUndoState();
        appData = data.data;
        saveProjectToLocalStorage();
        renderApp();
        fitWholeSchematic();
        closeModal('modal-save-manager');
        showToast(`Rollback complete: Restored to '${snapshotId}'`, 'success');
      }
    }
  } catch (err) {
    showToast("Error restoring snapshot: " + err, "error");
  }
}

/* ==========================================================================
   BLOCK COMMENTING SYSTEM & @MENTIONS EMAIL DISPATCH
   ========================================================================== */
let commentCounts = {};
let activeCommentTarget = null; // { id, type, title }

async function loadAllCommentCounts() {
  try {
    const res = await fetch('/api/comments', { headers: getAuthHeaders(false) });
    if (res.ok) {
      const data = await res.json();
      commentCounts = data.counts || {};
      updateCommentBadgesInDOM();
    }
  } catch (e) {
    console.warn("Failed fetching comments:", e);
  }
}

function getCommentCount(targetId) {
  return commentCounts[targetId] || 0;
}

function updateCommentBadgesInDOM() {
  Object.keys(commentCounts).forEach(id => {
    const badges = document.querySelectorAll(`.cmt-cnt-${id}`);
    badges.forEach(b => {
      b.innerText = commentCounts[id];
      const btn = b.closest('.comment-trigger-badge');
      if (btn && commentCounts[id] > 0) btn.classList.add('has-comments');
    });
  });
}

async function openCommentsDrawer(targetId, targetType, targetTitle) {
  if (!targetTitle) {
    if (targetType === 'event') {
      const node = (appData.nodes || []).find(e => e.id === targetId);
      if (node) targetTitle = `${node.codename ? node.codename + ' - ' : ''}${node.name || 'Event Block'}`;
    } else if (targetType === 'dialogue') {
      const d = (appData.dialogues || []).find(x => x.id === targetId);
      if (d) targetTitle = d.triggerCondition || `Dialogue ${d.id}`;
    }
  }
  targetTitle = targetTitle || targetId;
  activeCommentTarget = { id: targetId, type: targetType, title: targetTitle };

  const drawer = document.getElementById('drawer-comments');
  const backdrop = document.getElementById('comments-drawer-backdrop');
  const typeBadge = document.getElementById('comments-target-type-badge');
  const titleEl = document.getElementById('comments-target-title');
  const inputEl = document.getElementById('comment-input-text');

  if (typeBadge) typeBadge.innerText = (targetType || 'block').toUpperCase();
  if (titleEl) titleEl.innerText = targetTitle || targetId;
  if (inputEl) inputEl.value = '';

  if (backdrop) backdrop.classList.add('is-open');
  if (drawer) drawer.classList.add('is-open');

  await Promise.all([
    loadCommentsStream(targetId),
    preloadTeamUsers()
  ]);

  if (inputEl) setTimeout(() => inputEl.focus(), 250);
}

function closeCommentsDrawer() {
  const drawer = document.getElementById('drawer-comments');
  const backdrop = document.getElementById('comments-drawer-backdrop');
  const dropdown = document.getElementById('mention-autocomplete-dropdown');
  if (drawer) drawer.classList.remove('is-open');
  if (backdrop) backdrop.classList.remove('is-open');
  if (dropdown) dropdown.classList.add('hidden');
  activeCommentTarget = null;
}

async function loadCommentsStream(targetId) {
  const container = document.getElementById('comments-stream');
  if (!container) return;

  container.innerHTML = '<div class="text-center py-8 text-gray-500">Loading comments...</div>';

  try {
    const res = await fetch(`/api/comments?targetId=${encodeURIComponent(targetId)}`, { headers: getAuthHeaders(false) });
    if (res.ok) {
      const data = await res.json();
      const comments = data.comments || [];
      if (comments.length === 0) {
        container.innerHTML = `
          <div class="text-center py-10 text-gray-500">
            <div class="text-3xl mb-2">💬</div>
            <p class="font-bold text-gray-400">No comments yet</p>
            <p class="text-[11px] text-gray-500 mt-1">Start a discussion and tag teammates with @</p>
          </div>
        `;
        return;
      }

      container.innerHTML = comments.map(c => {
        const resolvedEmail = c.authorEmail || (isGenericPlaceholderName(c.author) ? 'dpoludonnyi@n-ix.com' : '');
        const resolvedAuthor = resolveUserDisplayName(resolvedEmail, c.author);
        const authorInitials = (resolvedAuthor || 'User').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
        // Format mentions highlight
        const formattedText = escapeHtml(c.text).replace(/@([a-zA-Z0-9._-]+(?:@n-ix\.com)?)/g, '<span class="mention-pill">@$1</span>');

        const canDelete = currentUser && (currentUser.role === 'admin' || currentUser.email === resolvedEmail);

        return `
          <div class="comment-card space-y-1.5" id="comment-card-${c.id}">
            <div class="flex items-start justify-between text-xs gap-2">
              <div class="flex items-center gap-2 min-w-0">
                <div class="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                  ${authorInitials}
                </div>
                <div class="flex flex-col min-w-0 leading-tight">
                  <span class="font-bold text-gray-200 truncate">${escapeHtml(resolvedAuthor)}</span>
                  ${resolvedEmail ? `<span class="text-[10px] text-cyan-400/90 font-mono truncate">${escapeHtml(resolvedEmail)}</span>` : ''}
                </div>
              </div>
              <div class="flex items-center gap-1.5 shrink-0">
                <span class="text-[10px] text-gray-400 font-mono">${c.displayTime || ''}</span>
                ${canDelete ? `
                  <button type="button" onclick="deleteComment('${c.id}')" class="text-gray-500 hover:text-red-400 text-xs px-1" title="Delete Comment">
                    ✕
                  </button>
                ` : ''}
              </div>
            </div>
            <div class="text-xs text-gray-200 leading-relaxed pl-8">
              ${formattedText}
            </div>
          </div>
        `;
      }).join('');
    } else {
      container.innerHTML = '<div class="text-center py-8 text-red-400">Failed to load comments</div>';
    }
  } catch (e) {
    container.innerHTML = '<div class="text-center py-8 text-red-400">Failed to load comments</div>';
  }
}

async function postComment() {
  if (!activeCommentTarget) return;
  const inputEl = document.getElementById('comment-input-text');
  const text = (inputEl ? inputEl.value.trim() : '');
  if (!text) return;

  if (currentUser) {
    currentUser = sanitizeUserProfile(currentUser);
  }
  const authorEmail = (currentUser && currentUser.email) || 'dpoludonnyi@n-ix.com';
  const authorName = resolveUserDisplayName(authorEmail, currentUser && currentUser.name);

  const btnPost = document.getElementById('btn-post-comment');
  if (btnPost) {
    btnPost.disabled = true;
    btnPost.innerText = 'Posting...';
  }

  try {
    const res = await fetch('/api/comments', {
      method: 'POST',
      headers: getAuthHeaders(true),
      body: JSON.stringify({
        targetId: activeCommentTarget.id,
        targetType: activeCommentTarget.type,
        targetTitle: activeCommentTarget.title,
        text: text,
        author: authorName,
        authorEmail: authorEmail
      })
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.status === 'success') {
      inputEl.value = '';
      await loadCommentsStream(activeCommentTarget.id);
      commentCounts[activeCommentTarget.id] = (commentCounts[activeCommentTarget.id] || 0) + 1;
      updateCommentBadgesInDOM();

      if (data.notifiedCount > 0) {
        showToast(`Comment posted! Notification sent to ${data.notifiedUsers.join(', ')}`, 'success');
      } else {
        showToast('Comment posted', 'info');
      }
    } else {
      showToast(data.message || 'Failed to post comment', 'error');
    }
  } catch (err) {
    showToast('Failed to post comment: ' + err.message, 'error');
  } finally {
    if (btnPost) {
      btnPost.disabled = false;
      btnPost.innerHTML = '<i data-lucide="send" class="w-3.5 h-3.5"></i> Post Comment';
      if (window.lucide) lucide.createIcons();
    }
  }
}

async function deleteComment(commentId) {
  if (!confirm("Delete this comment?")) return;
  try {
    const res = await fetch(`/api/comments/${commentId}`, { method: 'DELETE', headers: getAuthHeaders(false) });
    if (res.ok) {
      if (activeCommentTarget) {
        await loadCommentsStream(activeCommentTarget.id);
        if (commentCounts[activeCommentTarget.id] > 0) {
          commentCounts[activeCommentTarget.id]--;
          updateCommentBadgesInDOM();
        }
      }
      showToast('Comment deleted', 'info');
    }
  } catch (e) {
    showToast('Error deleting comment', 'error');
  }
}

// Mention Autocomplete Listener & Ctrl+Enter Submit
function setupMentionAutocomplete() {
  const inputEl = document.getElementById('comment-input-text');
  const dropdown = document.getElementById('mention-autocomplete-dropdown');
  if (!inputEl || !dropdown) return;

  inputEl.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      dropdown.classList.add('hidden');
      postComment();
    }
  });

  inputEl.addEventListener('input', (e) => {
    const text = inputEl.value;
    const cursorPos = inputEl.selectionStart;
    const textBefore = text.slice(0, cursorPos);
    const mentionMatch = textBefore.match(/(?:^|\s)@([a-zA-Z0-9._\- ]*)$/);

    if (mentionMatch) {
      const query = mentionMatch[1].trim().toLowerCase();
      const matches = allNixUsers.filter(u => 
        u.email.toLowerCase().includes(query) || 
        (u.name && u.name.toLowerCase().includes(query))
      );

      const addTeammateItem = `
        <div class="mention-item border-t border-gray-800/80 text-cyan-400 hover:text-cyan-300" onclick="promptAddTeammateForMention(true)">
          <span class="font-semibold text-[11px]">+ Add missing @n-ix.com teammate...</span>
          <span class="text-[10px] font-mono text-gray-400">Register & tag</span>
        </div>
      `;

      dropdown.innerHTML = matches.map(u => `
        <div class="mention-item" onclick="insertMention('${u.email.split('@')[0]}')">
          <span class="font-bold text-gray-200 text-xs">${u.name || u.email.split('@')[0]}</span>
          <span class="text-[10px] font-mono text-cyan-400">@${u.email}</span>
        </div>
      `).join('') + addTeammateItem;
      dropdown.classList.remove('hidden');
      return;
    }
    dropdown.classList.add('hidden');
  });

  document.addEventListener('click', (e) => {
    if (!dropdown.contains(e.target) && e.target !== inputEl) {
      dropdown.classList.add('hidden');
    }
  });
}

function insertMention(handle) {
  const inputEl = document.getElementById('comment-input-text');
  const dropdown = document.getElementById('mention-autocomplete-dropdown');
  if (!inputEl) return;

  const text = inputEl.value;
  const cursorPos = inputEl.selectionStart;
  const textBefore = text.slice(0, cursorPos);
  const textAfter = text.slice(cursorPos);
  const newBefore = textBefore.replace(/@([a-zA-Z0-9._\- ]*)$/, `@${handle} `);

  inputEl.value = newBefore + textAfter;
  if (dropdown) dropdown.classList.add('hidden');
  inputEl.focus();
  inputEl.setSelectionRange(newBefore.length, newBefore.length);
}

function setupAuthAndCollaborationEvents() {
  const btnHeaderLogin = document.getElementById('btn-header-login');
  if (btnHeaderLogin) btnHeaderLogin.onclick = () => openAuthModal();

  const btnHeaderLogout = document.getElementById('btn-header-logout');
  if (btnHeaderLogout) btnHeaderLogout.onclick = () => logoutUser();

  const btnAdminTeam = document.getElementById('btn-admin-team');
  if (btnAdminTeam) btnAdminTeam.onclick = () => openTeamManagementModal();

  const formLogin = document.getElementById('form-auth-login');
  if (formLogin) {
    formLogin.onsubmit = (e) => {
      e.preventDefault();
      submitUserLogin();
    };
  }

  const formRegister = document.getElementById('form-auth-register');
  if (formRegister) {
    formRegister.onsubmit = (e) => {
      e.preventDefault();
      submitUserRegister();
    };
  }

  const btnCreateManualSnap = document.getElementById('btn-create-manual-snapshot');
  if (btnCreateManualSnap) btnCreateManualSnap.onclick = () => createManualSnapshot();

  const btnRefreshBackups = document.getElementById('btn-refresh-backups-list');
  if (btnRefreshBackups) btnRefreshBackups.onclick = () => loadBackupsList();

  const btnPostComment = document.getElementById('btn-post-comment');
  if (btnPostComment) btnPostComment.onclick = () => postComment();

  setupMentionAutocomplete();

  // Close notifications dropdown on outside click
  document.addEventListener('click', (e) => {
    const container = document.getElementById('container-notifications');
    const dropdown = document.getElementById('dropdown-notifications');
    if (container && dropdown && !container.contains(e.target)) {
      dropdown.classList.add('hidden');
    }
  });

  // Start notification polling
  setTimeout(() => fetchUserNotifications(false), 800);
  setInterval(() => fetchUserNotifications(true), 12000);
}

/* ==========================================================================
   IN-APP NOTIFICATIONS & @MENTIONS SYSTEM
   ========================================================================== */
let userNotifications = [];
let lastUnreadCount = 0;
let hasShownInitialNotifToast = false;

async function fetchUserNotifications(silent = false) {
  try {
    const email = (currentUser && currentUser.email) ? encodeURIComponent(currentUser.email) : '';
    const headers = {};
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
    const res = await fetch(`/api/notifications?email=${email}`, { headers });
    if (res.ok) {
      const data = await res.json();
      userNotifications = data.notifications || [];
      const unreadCount = data.unreadCount || 0;

      const badge = document.getElementById('notif-badge-count');
      if (badge) {
        if (unreadCount > 0) {
          badge.innerText = unreadCount > 9 ? '9+' : unreadCount;
          badge.classList.remove('hidden');
        } else {
          badge.classList.add('hidden');
        }
      }

      // If user has unread notifications and hasn't been alerted this session or count increased
      if (unreadCount > 0 && (!hasShownInitialNotifToast || unreadCount > lastUnreadCount)) {
        if (!silent) {
          showToast(`🔔 You have ${unreadCount} unread mention(s)! Click the bell to view.`, 'info');
        }
        hasShownInitialNotifToast = true;
      }
      lastUnreadCount = unreadCount;
    }
  } catch (err) {
    console.warn("Could not fetch notifications:", err);
  }
}

function toggleNotificationsDropdown() {
  const dropdown = document.getElementById('dropdown-notifications');
  if (!dropdown) return;

  if (dropdown.classList.contains('hidden')) {
    renderNotificationsList();
    dropdown.classList.remove('hidden');
  } else {
    dropdown.classList.add('hidden');
  }
}

function renderNotificationsList() {
  const listContainer = document.getElementById('notifications-stream-list');
  if (!listContainer) return;

  if (userNotifications.length === 0) {
    const userHandle = (currentUser && currentUser.email) ? currentUser.email.split('@')[0] : 'yourname';
    listContainer.innerHTML = `
      <div class="text-center py-8 text-gray-500 px-4">
        <div class="text-2xl mb-1.5">🔕</div>
        <p class="font-bold text-gray-300 text-xs">No notifications yet</p>
        <p class="text-[11px] text-gray-400 mt-1">When teammates tag you with <span class="text-cyan-400 font-mono">@${userHandle}</span> in comments, your alerts will appear here.</p>
      </div>
    `;
    return;
  }

  listContainer.innerHTML = userNotifications.map(n => {
    const resolvedSenderEmail = n.senderEmail || (isGenericPlaceholderName(n.senderName) ? 'dpoludonnyi@n-ix.com' : '');
    const resolvedSenderName = resolveUserDisplayName(resolvedSenderEmail, n.senderName);
    const authorInitials = (resolvedSenderName || 'User').split(' ').map(part => part[0]).join('').toUpperCase().slice(0, 2);
    const isUnread = !n.read;
    return `
      <div class="p-3 hover:bg-gray-800/60 cursor-pointer transition flex items-start gap-2.5 ${isUnread ? 'bg-blue-950/30 border-l-2 border-cyan-400' : ''}" 
           onclick="openNotificationTarget('${n.id}', '${n.targetId}', '${n.targetType}', '${escapeHtml(n.targetTitle)}')">
        <div class="w-7 h-7 rounded-full bg-blue-600 text-white font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5 shadow">
          ${authorInitials}
        </div>
        <div class="min-w-0 flex-1 space-y-1">
          <div class="flex items-start justify-between gap-1 text-[11px]">
            <div class="flex flex-col min-w-0 leading-tight">
              <span class="font-bold text-gray-200 truncate">${escapeHtml(resolvedSenderName)}</span>
              ${resolvedSenderEmail ? `<span class="text-[10px] text-cyan-400/90 font-mono truncate">${escapeHtml(resolvedSenderEmail)}</span>` : ''}
            </div>
            <span class="text-[10px] text-gray-400 font-mono shrink-0">${n.displayTime}</span>
          </div>
          <div class="text-[11px] text-gray-300">
            Mentioned you on <strong class="text-cyan-300 font-semibold">${n.targetTitle}</strong>:
          </div>
          <div class="text-[11px] text-gray-400 bg-gray-950/60 p-2 rounded border border-gray-800 line-clamp-2 italic">
            "${escapeHtml(n.commentText)}"
          </div>
        </div>
        <div class="flex items-center gap-1 shrink-0 pt-0.5">
          ${isUnread ? `<span class="w-2 h-2 rounded-full bg-cyan-400" title="Unread"></span>` : ''}
          <button type="button" onclick="event.stopPropagation(); deleteNotificationItem('${n.id}')" class="text-gray-500 hover:text-red-400 p-1 text-xs" title="Dismiss notification">✕</button>
        </div>
      </div>
    `;
  }).join('');
}

async function markNotificationRead(notifId) {
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
    await fetch('/api/notifications/read', {
      method: 'POST',
      headers,
      body: JSON.stringify({ id: notifId })
    });
    const found = userNotifications.find(n => n.id === notifId);
    if (found) found.read = true;
    fetchUserNotifications(true);
  } catch (e) {}
}

async function markAllNotificationsAsRead() {
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
    const email = (currentUser && currentUser.email) || '';
    await fetch('/api/notifications/read', {
      method: 'POST',
      headers,
      body: JSON.stringify({ all: true, email })
    });
    userNotifications.forEach(n => n.read = true);
    fetchUserNotifications(true);
    renderNotificationsList();
    showToast("All notifications marked as read.", "info");
  } catch (e) {}
}

async function clearAllNotifications() {
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
    const email = (currentUser && currentUser.email) || '';
    await fetch('/api/notifications/clear', {
      method: 'POST',
      headers,
      body: JSON.stringify({ email })
    });
    userNotifications = [];
    fetchUserNotifications(true);
    renderNotificationsList();
    showToast("Notifications cleared.", "info");
  } catch (e) {}
}

async function deleteNotificationItem(notifId) {
  try {
    const headers = {};
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
    await fetch(`/api/notifications/${notifId}`, { method: 'DELETE', headers });
    userNotifications = userNotifications.filter(n => n.id !== notifId);
    fetchUserNotifications(true);
    renderNotificationsList();
  } catch (e) {}
}

async function openNotificationTarget(notifId, targetId, targetType, targetTitle) {
  await markNotificationRead(notifId);
  const dropdown = document.getElementById('dropdown-notifications');
  if (dropdown) dropdown.classList.add('hidden');

  // Open the comments drawer directly on that target
  openCommentsDrawer(targetId, targetType, targetTitle);

  // Focus and highlight target element on canvas
  const nodeEl = document.getElementById(`node-${targetId}`) || document.getElementById(`diag-${targetId}`);
  if (nodeEl) {
    nodeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    nodeEl.classList.add('ring-4', 'ring-cyan-400');
    setTimeout(() => nodeEl.classList.remove('ring-4', 'ring-cyan-400'), 2500);
  }
}

window.openAuthModal = openAuthModal;
window.switchAuthTab = switchAuthTab;
window.submitUserLogin = submitUserLogin;
window.submitUserRegister = submitUserRegister;
window.updateUserStatus = updateUserStatus;
window.logoutUser = logoutUser;
window.openTeamManagementModal = openTeamManagementModal;
window.switchSaveManagerTab = switchSaveManagerTab;
window.loadBackupsList = loadBackupsList;
window.createManualSnapshot = createManualSnapshot;
window.restoreSnapshot = restoreSnapshot;
window.openCommentsDrawer = openCommentsDrawer;
window.closeCommentsDrawer = closeCommentsDrawer;
window.postComment = postComment;
window.deleteComment = deleteComment;
window.insertMention = insertMention;
window.setupAuthAndCollaborationEvents = setupAuthAndCollaborationEvents;
window.setupGoogleSignIn = setupGoogleSignIn;
window.triggerGoogleSignIn = triggerGoogleSignIn;
window.handleGoogleSignInResponse = handleGoogleSignInResponse;
window.fetchUserNotifications = fetchUserNotifications;
window.toggleNotificationsDropdown = toggleNotificationsDropdown;
window.markAllNotificationsAsRead = markAllNotificationsAsRead;
window.clearAllNotifications = clearAllNotifications;
window.deleteNotificationItem = deleteNotificationItem;
window.openNotificationTarget = openNotificationTarget;

/* ==========================================================================
   BOARD RESERVATION LOCKS & MULTI-USER COORDINATION
   ========================================================================== */

function getCurrentBoardIdentifier() {
  if (typeof activeCategoryFilter !== 'undefined') {
    if (activeCategoryFilter === 'GenericPool') return 'GenericPool';
    if (activeCategoryFilter === 'DeckPool') return 'DeckPool';
    const tl = typeof activeTimelineId !== 'undefined' ? activeTimelineId : 'timeline_1';
    const v = typeof activeVariationId !== 'undefined' ? activeVariationId : 'var_v1';
    if (activeCategoryFilter === 'SecretChain') return `SecretChain:${tl}:${v}`;
    return `KeyChain:${tl}:${v}`;
  }
  return 'KeyChain:timeline_1:var_v1';
}

function getCurrentBoardDisplayName() {
  if (typeof activeCategoryFilter !== 'undefined') {
    if (activeCategoryFilter === 'GenericPool') return 'Generic Event Pool';
    if (activeCategoryFilter === 'DeckPool') return 'Deck Event Pool';
    const vObj = (appData.variations || []).find(v => v.id === activeVariationId);
    const varName = vObj ? (vObj.name || vObj.id) : (typeof activeVariationId !== 'undefined' ? activeVariationId : 'Var 1');
    const tlObj = (appData.timelines || []).find(tl => tl.id === activeTimelineId);
    const tlName = tlObj ? `Timeline ${tlObj.number || 1}` : 'Timeline 1';
    if (activeCategoryFilter === 'SecretChain') return `Secret Events (${tlName} • ${varName})`;
    return `Key Events (${tlName} • ${varName})`;
  }
  return 'Key Events';
}

function isCurrentUserAdmin() {
  if (isLocalEnvironment()) return true;
  if (!currentUser) return false;
  const email = (currentUser.email || '').toLowerCase();
  return email === 'dpoludonnyi@n-ix.com' || email === 'daniel.poludyonny@gmail.com' || currentUser.isAdmin === true || currentUser.role === 'admin';
}

let lastLoadedBoardRevisions = {};
let collabSyncPollInterval = null;
let lockTouchDebounceTimer = null;
let pendingBoardRevision = null;

function formatLockRemaining(totalSeconds) {
  if (totalSeconds <= 0) return '0:00';
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function renderBoardLockBanner(mode) {
  const banner = document.getElementById('board-lock-banner');
  const iconEl = document.getElementById('board-lock-icon');
  const msgEl = document.getElementById('board-lock-message');
  const actionsEl = document.getElementById('board-lock-actions');
  if (!banner || !iconEl || !msgEl || !actionsEl) return;

  if (mode === 'hidden') {
    banner.classList.add('hidden');
    banner.classList.remove('flex');
    return;
  }

  banner.classList.remove('hidden');
  banner.classList.add('flex');

  if (mode === 'owned') {
    banner.className = 'fixed top-[60px] left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 px-4 py-1.5 rounded-full shadow-2xl border border-emerald-500/50 bg-emerald-950/95 text-emerald-200 text-xs font-semibold pointer-events-auto transition-all duration-300';
    iconEl.innerHTML = `<i data-lucide="shield-check" class="w-4 h-4 text-emerald-400"></i>`;
    const bName = currentBoardLock?.boardName || getCurrentBoardDisplayName();
    const remSec = (currentBoardLock?.remainingSeconds !== undefined) ? currentBoardLock.remainingSeconds : 180;
    msgEl.innerHTML = `<span>Editing <strong class="text-white">${bName}</strong> (Lock expires in <span id="lock-countdown-timer-owned" class="font-mono text-white font-bold">${formatLockRemaining(remSec)}</span>)</span>`;
    actionsEl.innerHTML = `
      <button type="button" onclick="releaseActiveBoardLock()" class="text-emerald-400 hover:text-emerald-100 text-[11px] underline ml-2 transition cursor-pointer">
        Release
      </button>
    `;
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons({ root: banner });
    }
  } else if (mode === 'locked') {
    banner.className = 'fixed top-[60px] left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 px-4 py-2 rounded-full shadow-2xl border border-rose-500/60 bg-rose-950/95 text-rose-200 text-xs font-semibold pointer-events-auto transition-all duration-300';
    iconEl.innerHTML = `<i data-lucide="lock" class="w-4 h-4 text-rose-400 shrink-0"></i>`;
    const bName = currentBoardLock?.boardName || getCurrentBoardDisplayName();
    const ownerName = currentBoardLock?.userName || 'another designer';
    const remSec = (currentBoardLock?.remainingSeconds !== undefined) ? currentBoardLock.remainingSeconds : 0;
    msgEl.innerHTML = `<span><strong>${bName}</strong> is locked by <strong class="text-white">${ownerName}</strong> (Expires in <span id="lock-countdown-timer" class="font-mono text-white font-bold">${formatLockRemaining(remSec)}</span>) • <strong class="text-rose-300 uppercase tracking-wide">Read-Only Mode</strong></span>`;
    
    let adminBtnHtml = '';
    if (isCurrentUserAdmin()) {
      adminBtnHtml = `
        <button type="button" onclick="performAdminLockOverride()" class="bg-amber-500 hover:bg-amber-400 text-gray-950 px-2.5 py-1 rounded-full text-xs font-bold shadow transition cursor-pointer flex items-center gap-1 active:scale-95">
          <i data-lucide="zap" class="w-3 h-3 text-gray-950"></i> Admin Override
        </button>
      `;
    }
    actionsEl.innerHTML = adminBtnHtml;
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons({ root: banner });
    }
  }
}

function updateEditControlsLockState() {
  const btnAddEvent = document.getElementById('btn-add-event');
  const btnAddDialogue = document.getElementById('btn-add-dialogue');
  if (isCurrentBoardReadOnly) {
    if (btnAddEvent) {
      btnAddEvent.classList.add('opacity-40', 'cursor-not-allowed');
      btnAddEvent.title = 'Board is locked in Read-Only mode by another editor';
    }
    if (btnAddDialogue) {
      btnAddDialogue.classList.add('opacity-40', 'cursor-not-allowed');
      btnAddDialogue.title = 'Board is locked in Read-Only mode by another editor';
    }
  } else {
    if (btnAddEvent) {
      btnAddEvent.classList.remove('opacity-40', 'cursor-not-allowed');
      btnAddEvent.title = 'Add new event block to canvas';
    }
    if (btnAddDialogue) {
      btnAddDialogue.classList.remove('opacity-40', 'cursor-not-allowed');
      btnAddDialogue.title = 'Create a standalone dialogue card';
    }
  }
}

function startLockCountdown() {
  if (boardLockCountdownTimer) clearInterval(boardLockCountdownTimer);
  boardLockCountdownTimer = setInterval(() => {
    if (!currentBoardLock) {
      clearInterval(boardLockCountdownTimer);
      boardLockCountdownTimer = null;
      return;
    }
    if (currentBoardLock.remainingSeconds > 0) {
      currentBoardLock.remainingSeconds -= 1;
      const timerLocked = document.getElementById('lock-countdown-timer');
      if (timerLocked) {
        timerLocked.innerText = formatLockRemaining(currentBoardLock.remainingSeconds);
      }
      const timerOwned = document.getElementById('lock-countdown-timer-owned');
      if (timerOwned) {
        timerOwned.innerText = formatLockRemaining(currentBoardLock.remainingSeconds);
      }
    } else {
      clearInterval(boardLockCountdownTimer);
      boardLockCountdownTimer = null;
      if (!isCurrentBoardReadOnly) {
        // Lock owner ran out of time due to inactivity!
        showToast("Board lock expired due to inactivity (3 min). Switched to Read-Only mode.", "warning");
        releaseActiveBoardLock(false);
      } else {
        // Spectator: lock expired on server!
        syncActiveBoardLock();
      }
    }
  }, 1000);
}

async function touchActiveBoardLock() {
  if (!currentBoardLock || isCurrentBoardReadOnly) return;
  if (lockTouchDebounceTimer) return;
  lockTouchDebounceTimer = setTimeout(async () => {
    lockTouchDebounceTimer = null;
    if (!currentBoardLock || isCurrentBoardReadOnly) return;
    try {
      const boardId = getCurrentBoardIdentifier();
      const res = await fetch('/api/lock/heartbeat', {
        method: 'POST',
        headers: getAuthHeaders(true),
        body: JSON.stringify({ boardId })
      });
      const data = await res.json();
      if (res.ok && data.success && data.lock) {
        currentBoardLock = data.lock;
        currentBoardLock.remainingSeconds = 180;
        const timerOwned = document.getElementById('lock-countdown-timer-owned');
        if (timerOwned) {
          timerOwned.innerText = formatLockRemaining(180);
        }
      } else if (data.status === 'lost') {
        syncActiveBoardLock();
      }
    } catch (e) {}
  }, 400);
}

async function syncActiveBoardLock() {
  const boardId = getCurrentBoardIdentifier();
  const boardName = getCurrentBoardDisplayName();

  if (boardLockCountdownTimer) {
    clearInterval(boardLockCountdownTimer);
    boardLockCountdownTimer = null;
  }

  try {
    const res = await fetch('/api/lock/acquire', {
      method: 'POST',
      headers: getAuthHeaders(true),
      body: JSON.stringify({ boardId, boardName })
    });
    const data = await res.json();

    if (res.ok && data.success) {
      currentBoardLock = data.lock;
      currentBoardLock.remainingSeconds = (data.lock && data.lock.remainingSeconds) || 180;
      isCurrentBoardReadOnly = false;
      renderBoardLockBanner('owned');
      startLockCountdown();
      updateEditControlsLockState();
      startCollabSyncPoll();
    } else if (res.status === 423 || data.status === 'locked') {
      currentBoardLock = data.lock;
      isCurrentBoardReadOnly = true;
      renderBoardLockBanner('locked');
      startLockCountdown();
      updateEditControlsLockState();
      startCollabSyncPoll();
    } else {
      isCurrentBoardReadOnly = false;
      renderBoardLockBanner('hidden');
      updateEditControlsLockState();
      startCollabSyncPoll();
    }
  } catch (err) {
    isCurrentBoardReadOnly = false;
    renderBoardLockBanner('hidden');
    updateEditControlsLockState();
    startCollabSyncPoll();
  }
}

function startCollabSyncPoll() {
  if (collabSyncPollInterval) return;
  collabSyncPollInterval = setInterval(async () => {
    try {
      const res = await fetch('/api/locks', { headers: getAuthHeaders(false) });
      if (!res.ok) return;
      const data = await res.json();
      const boardId = getCurrentBoardIdentifier();
      const allLocks = data.locks || {};
      const revisions = data.boardRevisions || {};

      // 1. Sync lock status & countdown for active board
      if (isCurrentBoardReadOnly) {
        const activeLock = allLocks[boardId];
        if (activeLock) {
          currentBoardLock = activeLock;
          const timerLocked = document.getElementById('lock-countdown-timer');
          if (timerLocked) {
            timerLocked.innerText = formatLockRemaining(activeLock.remainingSeconds);
          }
        } else if (currentBoardLock) {
          // Lock was released or expired on server
          syncActiveBoardLock();
        }
      } else {
        // We hold the lock: verify we haven't been overridden by admin
        const activeLock = allLocks[boardId];
        const myEmail = (currentUser?.email || '').trim().toLowerCase();
        if (activeLock && activeLock.userEmail && activeLock.userEmail.toLowerCase() !== myEmail) {
          showToast(`Lock for ${activeLock.boardName} was taken over by ${activeLock.userName}.`, "warning");
          syncActiveBoardLock();
        }
      }

      // 2. Real-time board update notification (Option 1)
      const serverRev = revisions[boardId];
      if (serverRev && serverRev.lastModified) {
        const myRev = lastLoadedBoardRevisions[boardId];
        const myName = (currentUser?.name || '').trim().toLowerCase();
        const authorName = (serverRev.author || '').trim().toLowerCase();
        const isMyOwnSave = Boolean(authorName && myName && (authorName === myName || authorName.includes(myName) || myName.includes(authorName)));

        if (!myRev) {
          // Record current server revision baseline if not set yet
          lastLoadedBoardRevisions[boardId] = serverRev;
        } else if (serverRev.lastModified > myRev.lastModified && !isMyOwnSave) {
          showBoardUpdateNotification(serverRev);
        }
      }
    } catch (e) {}
  }, 6000);
}

function showBoardUpdateNotification(rev) {
  pendingBoardRevision = rev;
  const banner = document.getElementById('board-update-notification-banner');
  const msgEl = document.getElementById('board-update-notification-message');
  if (!banner || !msgEl) return;
  msgEl.innerHTML = `<span><strong>${rev.author || 'A teammate'}</strong> saved updates to this board (${rev.timestamp || 'recently'}).</span>`;
  banner.classList.remove('hidden');
  banner.classList.add('flex');
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons({ root: banner });
  }
}

function dismissBoardUpdateNotification() {
  const banner = document.getElementById('board-update-notification-banner');
  if (banner) {
    banner.classList.add('hidden');
    banner.classList.remove('flex');
  }
  if (pendingBoardRevision) {
    const boardId = getCurrentBoardIdentifier();
    lastLoadedBoardRevisions[boardId] = pendingBoardRevision;
  }
}

function nodeBelongsToBoard(node, boardId) {
  if (!node || !boardId) return false;
  const cat = node.category || 'KeyChain';
  const varId = node.variationId || '';
  if (boardId === 'GenericPool') return cat === 'GenericPool';
  if (boardId === 'DeckPool') return cat === 'DeckPool' || cat === 'deck' || varId === 'deck_events';
  const parts = boardId.split(':');
  if (parts[0] === 'KeyChain') return cat === 'KeyChain' && (!parts[2] || varId === parts[2]);
  if (parts[0] === 'SecretChain') return cat === 'SecretChain' && (!parts[2] || varId === parts[2]);
  return false;
}

function dialogueBelongsToBoard(diag, boardId, activeNodeIds) {
  if (!diag || !boardId) return false;
  const links = Array.isArray(diag.links) ? diag.links : (diag.targetEventId ? [{ targetEventId: diag.targetEventId }] : []);
  const linkedIds = links.map(l => l.targetEventId).filter(Boolean);
  if (diag.targetEventId) linkedIds.push(diag.targetEventId);

  if (linkedIds.length > 0 && activeNodeIds) {
    return linkedIds.some(eid => activeNodeIds.has(eid));
  }
  const cat = diag.category || 'KeyChain';
  const varId = diag.variationId || '';
  if (boardId === 'GenericPool') return cat === 'GenericPool';
  if (boardId === 'DeckPool') return cat === 'DeckPool' || cat === 'deck' || varId === 'deck_events';
  const parts = boardId.split(':');
  if (parts[0] === 'KeyChain' || parts[0] === 'SecretChain') {
    return cat === parts[0] && (!parts[2] || varId === parts[2]);
  }
  return false;
}

async function refreshActiveBoardFromServer() {
  dismissBoardUpdateNotification();
  showToast("Updating board view with latest changes...", "info");
  try {
    const res = await fetch('/api/load', { headers: getAuthHeaders(false) });
    if (!res.ok) {
      showToast("Could not fetch latest board data.", "error");
      return;
    }
    const fullData = await res.json();
    const boardId = getCurrentBoardIdentifier();

    const serverNodes = (fullData.nodes || []).filter(n => nodeBelongsToBoard(n, boardId));
    const serverActiveNodeIds = new Set(serverNodes.map(n => n.id));
    const serverDialogues = (fullData.dialogues || []).filter(d => dialogueBelongsToBoard(d, boardId, serverActiveNodeIds));

    appData.nodes = (appData.nodes || []).filter(n => !nodeBelongsToBoard(n, boardId)).concat(serverNodes);
    const localExistingNodeIds = new Set((appData.nodes || []).filter(n => nodeBelongsToBoard(n, boardId)).map(n => n.id));
    appData.dialogues = (appData.dialogues || []).filter(d => !dialogueBelongsToBoard(d, boardId, localExistingNodeIds)).concat(serverDialogues);

    normalizeAllProjectData();
    localStorage.setItem('rc_narrative_project_v26', JSON.stringify(appData));

    lastLoadedBoardRevisions[boardId] = {
      boardId,
      lastModified: fullData._lastModified || new Date().toISOString(),
      author: fullData.projectInfo?.author || 'Server'
    };

    renderApp();
    showToast("Board refreshed with latest team updates!", "success");
  } catch (err) {
    showToast("Error refreshing board: " + err.message, "error");
  }
}

async function releaseActiveBoardLock(notifyServer = true) {
  const boardId = getCurrentBoardIdentifier();
  if (boardLockCountdownTimer) {
    clearInterval(boardLockCountdownTimer);
    boardLockCountdownTimer = null;
  }
  if (notifyServer) {
    try {
      await fetch('/api/lock/release', {
        method: 'POST',
        headers: getAuthHeaders(true),
        body: JSON.stringify({ boardId })
      });
    } catch (e) {}
  }
  currentBoardLock = null;
  isCurrentBoardReadOnly = true;
  renderBoardLockBanner('hidden');
  updateEditControlsLockState();
  if (notifyServer) {
    showToast(`Released lock for ${getCurrentBoardDisplayName()}. Board in spectator mode.`, 'info');
  }
}

async function performAdminLockOverride() {
  const boardId = getCurrentBoardIdentifier();
  const boardName = getCurrentBoardDisplayName();
  const ownerName = currentBoardLock?.userName || 'the current editor';

  const confirmed = confirm(
    `⚡ ADMIN OVERRIDE CONFIRMATION\n\n` +
    `You are about to break the lock held by "${ownerName}" on:\n` +
    `▶ ${boardName}\n\n` +
    `Any future saves from their open tab will be safely prevented from overwriting.\n\n` +
    `Do you wish to proceed with taking over this board?`
  );
  if (!confirmed) return;

  try {
    const res = await fetch('/api/lock/override', {
      method: 'POST',
      headers: getAuthHeaders(true),
      body: JSON.stringify({ boardId, boardName })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast(`⚡ Lock successfully overridden! You now hold edit lock for ${boardName}.`, 'success');
      currentBoardLock = data.lock;
      currentBoardLock.remainingSeconds = (data.lock && data.lock.remainingSeconds) || 180;
      isCurrentBoardReadOnly = false;
      renderBoardLockBanner('owned');
      startLockCountdown();
      updateEditControlsLockState();
    } else {
      showToast(`Override error: ${data.message || 'Unauthorized'}`, 'error');
    }
  } catch (err) {
    showToast(`Override request failed: ${err.message}`, 'error');
  }
}

window.addEventListener('beforeunload', () => {
  if (currentBoardLock && !isCurrentBoardReadOnly) {
    const boardId = getCurrentBoardIdentifier();
    navigator.sendBeacon('/api/lock/release', JSON.stringify({ boardId }));
  }
});

window.syncActiveBoardLock = syncActiveBoardLock;
window.releaseActiveBoardLock = releaseActiveBoardLock;
window.performAdminLockOverride = performAdminLockOverride;
window.touchActiveBoardLock = touchActiveBoardLock;
window.refreshActiveBoardFromServer = refreshActiveBoardFromServer;
window.dismissBoardUpdateNotification = dismissBoardUpdateNotification;
window.nodeBelongsToBoard = nodeBelongsToBoard;
window.dialogueBelongsToBoard = dialogueBelongsToBoard;
window.getCurrentBoardIdentifier = getCurrentBoardIdentifier;
window.getCurrentBoardDisplayName = getCurrentBoardDisplayName;
window.isCurrentBoardReadOnly = () => isCurrentBoardReadOnly;
window.getCurrentBoardLock = () => currentBoardLock;
window.lastLoadedBoardRevisions = lastLoadedBoardRevisions;
