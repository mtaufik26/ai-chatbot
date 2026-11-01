// ============================================================
// CHATBOT AI - CLIENT SCRIPT (TAILWIND CSS MURNI)
// ============================================================

const STORAGE_KEY = 'chatbot_ai_sessions_v1';
const ACTIVE_SESSION_KEY = 'chatbot_ai_active_session_id';
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

// DOM Elements
const sidebar = document.getElementById('sidebar');
const sidebarBackdrop = document.getElementById('sidebar-backdrop');
const toggleSidebarBtn = document.getElementById('toggle-sidebar-btn');
const closeSidebarBtn = document.getElementById('close-sidebar-btn');
const newChatBtn = document.getElementById('new-chat-btn');
const quickNewChatBtn = document.getElementById('quick-new-chat-btn');
const clearAllHistoryBtn = document.getElementById('clear-all-history-btn');
const historyList = document.getElementById('history-list');
const historySearchInput = document.getElementById('history-search-input');
const historySearchClear = document.getElementById('history-search-clear');

const chatBox = document.getElementById('chat-box');
const chatTitle = document.getElementById('chat-title');
const chatSubtitle = document.getElementById('chat-subtitle');
const btnRenameCurrent = document.getElementById('btn-rename-current');
const navbarTitleWrap = document.getElementById('navbar-title-wrap');
const navbarRenameForm = document.getElementById('navbar-rename-form');
const navbarRenameInput = document.getElementById('navbar-rename-input');
const navbarRenameCancelBtn = document.getElementById('navbar-rename-cancel-btn');
const chatHeader = document.getElementById('chat-header');
const headerRightActions = document.getElementById('header-right-actions');
const personaSelect = document.getElementById('persona');
const personaBadgeIcon = document.getElementById('persona-badge-icon');
const exportChatBtn = document.getElementById('export-chat-btn');
const modelNameLabel = document.getElementById('model-name-label');

const chatForm = document.getElementById('chat-form');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const stopBtn = document.getElementById('stop-btn');
const attachBtn = document.getElementById('attach-btn');
const attachIcon = document.getElementById('attach-icon');
const fileInput = document.getElementById('file-input');
const geminiToolsPopup = document.getElementById('gemini-tools-popup');
const toolsPopupCloseBtn = document.getElementById('tools-popup-close-btn');
const menuItemUpload = document.getElementById('menu-item-upload');
const menuItemGenerateImage = document.getElementById('menu-item-generate-image');

const filePreviewCard = document.getElementById('file-preview-card');
const filePreviewIcon = document.getElementById('file-preview-icon');
const filePreviewName = document.getElementById('file-preview-name');
const filePreviewSize = document.getElementById('file-preview-size');
const filePreviewRemove = document.getElementById('file-preview-remove');

const dragDropOverlay = document.getElementById('drag-drop-overlay');

const imageLightboxModal = document.getElementById('image-lightbox-modal');
const lightboxBackdrop = document.getElementById('lightbox-backdrop');
const lightboxImg = document.getElementById('lightbox-img');
const lightboxCaption = document.getElementById('lightbox-caption');
const lightboxCloseBtn = document.getElementById('lightbox-close-btn');

const toastContainer = document.getElementById('toast-container');

// Modal Konfirmasi Hapus
const confirmDeleteModal = document.getElementById('confirm-delete-modal');
const confirmDeleteBackdrop = document.getElementById('confirm-delete-backdrop');
const deleteSessionTitle = document.getElementById('delete-session-title');
const deleteModalTitle = document.getElementById('delete-modal-title');
const deleteModalDesc = document.getElementById('delete-modal-desc');
const deleteCancelBtn = document.getElementById('delete-cancel-btn');
const deleteConfirmBtn = document.getElementById('delete-confirm-btn');

let sessionToDeleteId = null;
let renamingSessionId = null;

// State Aplikasi
let personas = [];
let defaultPersona = 'chatbot';
let sessions = [];
let activeSessionId = null;
let selectedFile = null;
let isGenerating = false;
let currentAbortController = null;
let activeSpeakingBtn = null;

// Persona icon mapping
const PERSONA_ICONS = {
  edukasi: '🎓',
  travel: '✈️',
  cs: '🎧',
  produktivitas: '⚡',
};

// ============================================================
// CLIPBOARD & TOAST NOTIFIKASI ELEGAN
// ============================================================
async function copyToClipboard(text) {
  if (!text) return false;
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      console.warn('navigator.clipboard failed, fallback to execCommand', e);
    }
  }

  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    textArea.style.top = '-9999px';
    textArea.setAttribute('readonly', '');
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error('Fallback copy failed:', err);
    return false;
  }
}

function showToast(message, duration = 2500) {
  const toast = document.createElement('div');
  toast.className = 'bg-[#18181b] text-[#fafafa] border border-white/15 rounded-[10px] px-4 py-2.5 text-[0.84rem] shadow-[0_8px_24px_rgba(0,0,0,0.5)] flex items-center gap-2 pointer-events-auto animate-toast-in';
  toast.innerHTML = `
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" class="text-emerald-400">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
    <span>${escapeHtml(message)}</span>
  `;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px) scale(0.95)';
    toast.style.transition = 'all 0.2s ease';
    setTimeout(() => toast.remove(), 200);
  }, duration);
}

function formatRelativeTime(timestamp) {
  if (!timestamp) return '';
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
}

function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getFileIcon(mimeType = '') {
  if (mimeType.startsWith('image/')) return '🖼️';
  if (mimeType.startsWith('audio/')) return '🎵';
  if (mimeType.startsWith('video/')) return '🎬';
  if (mimeType.includes('pdf')) return '📕';
  if (mimeType.includes('json') || mimeType.includes('javascript') || mimeType.includes('html') || mimeType.includes('css')) return '💻';
  return '📄';
}

// ============================================================
// LOCAL STORAGE MANAGEMENT
// ============================================================
function loadSessionsFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    sessions = raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Gagal memuat sesi dari localStorage:', e);
    sessions = [];
  }
}

function saveSessionsToStorage() {
  try {
    const sanitizedSessions = sessions.map((s) => ({
      ...s,
      messages: s.messages.map((m) => {
        if (!m.file) return m;
        return {
          ...m,
          file: {
            name: m.file.name,
            mimeType: m.file.mimeType,
            size: m.file.size,
            previewUrl: (m.file.data && m.file.data.length < 250000) ? m.file.previewUrl : null,
          },
        };
      }),
    }));

    localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizedSessions));
    if (activeSessionId) {
      localStorage.setItem(ACTIVE_SESSION_KEY, activeSessionId);
    }
  } catch (e) {
    console.warn('LocalStorage kuota peringatan:', e);
  }
}

function getActiveSession() {
  return sessions.find((s) => s.id === activeSessionId) || null;
}

// ============================================================
// CHAT SESSION LIFECYCLE
// ============================================================
function createNewChat() {
  if (isGenerating) {
    stopGeneration();
  }
  cancelNavbarRename();
  cancelInlineRename();
  stopSpeech();
  const newId = 'session_' + Date.now();
  const currentP = personaSelect.value || defaultPersona;

  const newSession = {
    id: newId,
    title: 'New Chat',
    persona: currentP,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [],
  };

  sessions.unshift(newSession);
  activeSessionId = newId;
  saveSessionsToStorage();
  renderHistoryList();
  renderActiveChat();

  if (window.innerWidth <= 768) {
    closeSidebar();
  }
  userInput.focus();
}

function switchSession(id) {
  if (activeSessionId === id) return;
  if (isGenerating) {
    stopGeneration();
  }
  cancelNavbarRename();
  cancelInlineRename();
  stopSpeech();
  activeSessionId = id;
  localStorage.setItem(ACTIVE_SESSION_KEY, id);
  renderHistoryList();
  renderActiveChat();

  if (window.innerWidth <= 768) {
    closeSidebar();
  }
}

// ============================================================
// RENAME SIDEBAR & NAVBAR (TERPISAH & TERSINKRONISASI)
// ============================================================

// --- Mode Rename Khusus Sidebar ---
function startInlineRename(id, e) {
  if (e) e.stopPropagation();
  const session = sessions.find((s) => s.id === id);
  if (!session) return;
  renamingSessionId = id;
  renderHistoryList();
}

function saveInlineRename(id, newTitle) {
  const session = sessions.find((s) => s.id === id);
  if (session) {
    const trimmed = (newTitle || '').trim();
    if (trimmed && trimmed !== session.title) {
      session.title = trimmed;
      saveSessionsToStorage();
      // Sinkronisasi: jika yang di-rename di sidebar adalah chat aktif, sinkronkan teks navbar
      if (session.id === activeSessionId) {
        chatTitle.textContent = session.title;
      }
      showToast('Chat title updated');
    }
  }
  renamingSessionId = null;
  renderHistoryList();
}

function cancelInlineRename() {
  renamingSessionId = null;
  renderHistoryList();
}

// --- Mode Rename Khusus Navbar ---
function startNavbarRename() {
  const session = getActiveSession();
  if (!session) return;

  if (navbarRenameInput) {
    navbarRenameInput.value = session.title || 'New Chat';
  }
  if (navbarTitleWrap) navbarTitleWrap.classList.add('hidden');
  if (chatSubtitle) chatSubtitle.classList.add('hidden');
  if (navbarRenameForm) {
    navbarRenameForm.classList.remove('hidden');
    navbarRenameForm.classList.add('flex');
  }
  if (headerRightActions) {
    headerRightActions.classList.add('max-sm:hidden');
  }
  if (chatHeader) {
    chatHeader.classList.add('is-renaming');
  }

  setTimeout(() => {
    if (navbarRenameInput) {
      navbarRenameInput.focus();
      navbarRenameInput.select();
    }
  }, 40);
}

function saveNavbarRename() {
  const session = getActiveSession();
  if (session && navbarRenameInput) {
    const trimmed = (navbarRenameInput.value || '').trim();
    if (trimmed && trimmed !== session.title) {
      session.title = trimmed;
      saveSessionsToStorage();
      chatTitle.textContent = session.title;
      // Sinkronisasi data: perbarui teks judul item di sidebar tanpa membuka mode edit di sidebar
      renderHistoryList();
      showToast('Chat title updated');
    }
  }
  cancelNavbarRename();
}

function cancelNavbarRename() {
  if (navbarRenameForm) {
    navbarRenameForm.classList.add('hidden');
    navbarRenameForm.classList.remove('flex');
  }
  if (navbarTitleWrap) {
    navbarTitleWrap.classList.remove('hidden');
  }
  if (chatSubtitle) {
    chatSubtitle.classList.remove('hidden');
  }
  if (headerRightActions) {
    headerRightActions.classList.remove('max-sm:hidden');
  }
  if (chatHeader) {
    chatHeader.classList.remove('is-renaming');
  }
}

function openDeleteModal(id, e) {
  if (e) e.stopPropagation();

  if (id === '__all__') {
    if (!sessions.length) {
      showToast('No chat history to clear.');
      return;
    }
    sessionToDeleteId = '__all__';
    if (deleteModalTitle) deleteModalTitle.textContent = 'Clear All Chat History?';
    if (deleteModalDesc) {
      deleteModalDesc.innerHTML = `All <strong>${sessions.length} conversations</strong> will be permanently deleted from chat history.`;
    }
    if (deleteConfirmBtn) deleteConfirmBtn.textContent = 'Clear All';
  } else {
    const session = sessions.find((s) => s.id === id);
    if (!session) return;

    sessionToDeleteId = id;
    if (deleteModalTitle) deleteModalTitle.textContent = 'Delete Conversation?';
    if (deleteModalDesc) {
      deleteModalDesc.innerHTML = `Conversation <strong id="delete-session-title" class="text-[#fafafa] font-semibold break-all">"${escapeHtml(session.title || 'Chat')}"</strong> will be permanently deleted from chat history.`;
    }
    if (deleteConfirmBtn) deleteConfirmBtn.textContent = 'Delete';
  }

  if (confirmDeleteModal) {
    confirmDeleteModal.classList.remove('hidden');
    confirmDeleteModal.classList.add('flex');
  }
}

function closeDeleteModal() {
  if (!confirmDeleteModal) return;
  confirmDeleteModal.classList.remove('flex');
  confirmDeleteModal.classList.add('hidden');
  sessionToDeleteId = null;
}

function clearAllHistory() {
  openDeleteModal('__all__');
}

// ============================================================
// EKSPOR CHAT KE MARKDOWN
// ============================================================
function exportChatToMarkdown() {
  const session = getActiveSession();
  if (!session || !session.messages.length) {
    alert('No messages in this chat to export.');
    return;
  }

  const pObj = personas.find((p) => p.id === session.persona);
  let md = `# ${session.title}\n\n`;
  md += `**Date:** ${new Date(session.createdAt).toLocaleString('en-US')}\n`;
  md += `**Persona:** ${pObj ? pObj.label : session.persona}\n\n---\n\n`;

  session.messages.forEach((m) => {
    const sender = m.role === 'user' ? '👤 User' : `🤖 AI Assistant (${pObj ? pObj.label : 'Assistant'})`;
    md += `### ${sender}\n\n`;
    if (m.file) {
      md += `*Attachment: [${m.file.name}] (${formatFileSize(m.file.size)})*\n\n`;
    }
    md += `${m.text}\n\n---\n\n`;
  });

  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${session.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast('Chat exported as Markdown (.md)');
}

// ============================================================
// TEXT-TO-SPEECH (BACA SUARA ASISTEN AI)
// ============================================================
function speakText(text, btnElement) {
  if (!('speechSynthesis' in window)) {
    alert('Your browser does not support Text-to-Speech.');
    return;
  }

  if (window.speechSynthesis.speaking) {
    window.speechSynthesis.cancel();
    if (activeSpeakingBtn) {
      activeSpeakingBtn.classList.remove('border-sky-400/30', 'bg-sky-400/10', 'text-sky-400', 'animate-pulse-border');
      activeSpeakingBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
        <span>Listen</span>
      `;
    }
    if (activeSpeakingBtn === btnElement) {
      activeSpeakingBtn = null;
      return;
    }
  }

  const cleanText = text.replace(/```[\s\S]*?```/g, 'Code block omitted.').replace(/[*_#`[\]]/g, '');
  const utterance = new SpeechSynthesisUtterance(cleanText);
  const isIndonesian = /\b(yang|dan|di|ini|itu|untuk|saya|kamu|tidak|adalah|bisa|ada|dengan|pada|oleh|kita|mereka|akan|sudah)\b/i.test(cleanText);
  utterance.lang = isIndonesian ? 'id-ID' : 'en-US';
  utterance.rate = 1.0;

  btnElement.classList.add('border-sky-400/30', 'bg-sky-400/10', 'text-sky-400', 'animate-pulse-border');
  btnElement.innerHTML = `
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
    <span>Stop</span>
  `;
  activeSpeakingBtn = btnElement;

  utterance.onend = () => {
    btnElement.classList.remove('border-sky-400/30', 'bg-sky-400/10', 'text-sky-400', 'animate-pulse-border');
    btnElement.innerHTML = `
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
      <span>Listen</span>
    `;
    activeSpeakingBtn = null;
  };

  utterance.onerror = () => {
    btnElement.classList.remove('border-sky-400/30', 'bg-sky-400/10', 'text-sky-400', 'animate-pulse-border');
    activeSpeakingBtn = null;
  };

  window.speechSynthesis.speak(utterance);
}

function stopSpeech() {
  if ('speechSynthesis' in window && window.speechSynthesis.speaking) {
    window.speechSynthesis.cancel();
  }
  if (activeSpeakingBtn) {
    activeSpeakingBtn.classList.remove('border-sky-400/30', 'bg-sky-400/10', 'text-sky-400', 'animate-pulse-border');
    activeSpeakingBtn = null;
  }
}

// ============================================================
// RENDER SIDEBAR & PENCARIAN RIWAYAT (TAILWIND UTILITY)
// ============================================================
function renderHistoryList(filterQuery = '') {
  historyList.innerHTML = '';

  const q = filterQuery.trim().toLowerCase();
  const filtered = q
    ? sessions.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.messages.some((m) => m.text && m.text.toLowerCase().includes(q))
      )
    : sessions;

  if (filtered.length === 0) {
    historyList.innerHTML = `<div class="p-8 text-center text-[0.8rem] text-[#52525b]">${
      q ? 'No matching conversations found.' : 'No chat history yet.'
    }</div>`;
    return;
  }

  filtered.forEach((s) => {
    const item = document.createElement('div');
    const isActive = s.id === activeSessionId;
    const isEditing = s.id === renamingSessionId;

    if (isEditing) {
      item.className = 'flex items-center px-2 py-1.5 rounded-[6px] text-[0.84rem] bg-[#18181b] border border-white/20 shadow-[0_2px_8px_rgba(0,0,0,0.5)] gap-1.5 my-0.5';
      item.onclick = (e) => e.stopPropagation();

      item.innerHTML = `
        <form class="inline-rename-form flex items-center gap-1.5 w-full m-0 p-0" autocomplete="off">
          <svg class="shrink-0 text-[#a1a1aa]" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
          </svg>
          <input 
            type="text" 
            class="inline-rename-input bg-[#09090b] text-[#fafafa] border border-white/20 focus:border-white/50 text-[0.82rem] px-2 py-1 rounded-[4px] outline-none flex-1 min-w-0 font-medium"
            value="${escapeHtml(s.title || '')}"
            maxlength="60"
            autocomplete="off"
          />
          <button 
            type="submit" 
            class="p-1 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/15 rounded-[4px] transition-colors cursor-pointer shrink-0" 
            title="Save (Enter)"
            aria-label="Save title"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
          </button>
          <button 
            type="button" 
            class="inline-rename-cancel-btn p-1 text-[#71717a] hover:text-[#fafafa] hover:bg-white/[0.08] rounded-[4px] transition-colors cursor-pointer shrink-0" 
            title="Cancel (Esc)"
            aria-label="Cancel rename"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </form>
      `;

      const form = item.querySelector('.inline-rename-form');
      const input = item.querySelector('.inline-rename-input');
      const cancelBtn = item.querySelector('.inline-rename-cancel-btn');

      setTimeout(() => {
        input.focus();
        input.select();
      }, 30);

      form.onsubmit = (e) => {
        e.preventDefault();
        e.stopPropagation();
        saveInlineRename(s.id, input.value);
      };

      cancelBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        cancelInlineRename();
      };

      input.onkeydown = (e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          cancelInlineRename();
        }
      };

      historyList.appendChild(item);
      return;
    }

    item.className = `history-item group flex items-center justify-between px-2.5 py-2 rounded-[6px] cursor-pointer text-[0.84rem] transition-all relative gap-1.5 ${
      isActive
        ? 'active-chat-item bg-[#27272a] text-white font-medium border-l-2 border-white'
        : 'text-[#a1a1aa] hover:bg-[#18181b] hover:text-[#fafafa]'
    }`;
    item.setAttribute('title', s.title || 'Chat');
    item.onclick = () => switchSession(s.id);

    const timeStr = formatRelativeTime(s.updatedAt || s.createdAt);

    item.innerHTML = `
      <div class="history-item-content flex items-center gap-2 overflow-hidden flex-1 pointer-events-none">
        <svg class="shrink-0 ${isActive ? 'text-white' : 'text-[#71717a]'}" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
        </svg>
        <div class="flex flex-col overflow-hidden flex-1 history-details">
          <span class="whitespace-nowrap overflow-hidden text-ellipsis text-[0.84rem]">${escapeHtml(s.title || 'Chat')}</span>
          <span class="text-[0.65rem] text-[#52525b]">${timeStr}</span>
        </div>
      </div>
      <div class="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity history-actions">
        <button type="button" class="history-rename-btn bg-transparent border-0 text-[#71717a] hover:text-[#fafafa] hover:bg-white/[0.08] p-1.5 rounded-[4px] flex items-center justify-center transition-all cursor-pointer" title="Rename chat" aria-label="Rename chat">
          <svg class="pointer-events-none" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
        </button>
        <button type="button" class="history-delete-btn bg-transparent border-0 text-[#71717a] hover:text-red-400 hover:bg-red-500/15 p-1.5 rounded-[4px] flex items-center justify-center transition-all cursor-pointer" title="Delete chat" aria-label="Delete chat">
          <svg class="pointer-events-none" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
        </button>
      </div>
    `;

    const renameBtn = item.querySelector('.history-rename-btn');
    renameBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      startInlineRename(s.id, e);
    };

    const delBtn = item.querySelector('.history-delete-btn');
    delBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      openDeleteModal(s.id, e);
    };

    historyList.appendChild(item);
  });
}

// Pencarian Riwayat Real-Time dengan Debounce Ringan (Bebas Lag Saat Mengetik)
let searchDebounceTimer = null;
historySearchInput.addEventListener('input', (e) => {
  const val = e.target.value;
  historySearchClear.style.display = val ? 'block' : 'none';
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    renderHistoryList(val);
  }, 100);
});

historySearchClear.addEventListener('click', () => {
  clearTimeout(searchDebounceTimer);
  historySearchInput.value = '';
  historySearchClear.style.display = 'none';
  renderHistoryList();
  historySearchInput.focus();
});

// Rename judul di navbar
if (btnRenameCurrent) {
  btnRenameCurrent.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    startNavbarRename();
  });
}

if (navbarRenameForm) {
  navbarRenameForm.addEventListener('submit', (e) => {
    e.preventDefault();
    e.stopPropagation();
    saveNavbarRename();
  });
}

if (navbarRenameCancelBtn) {
  navbarRenameCancelBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    cancelNavbarRename();
  });
}

if (navbarRenameInput) {
  navbarRenameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      cancelNavbarRename();
    }
  });
}

// Klik di luar form rename navbar untuk membatalkan
document.addEventListener('click', (e) => {
  if (
    navbarRenameForm &&
    !navbarRenameForm.classList.contains('hidden') &&
    !navbarRenameForm.contains(e.target) &&
    e.target !== btnRenameCurrent &&
    !btnRenameCurrent.contains(e.target)
  ) {
    cancelNavbarRename();
  }
});

// ============================================================
// RENDER ACTIVE CHAT
// ============================================================
function renderActiveChat() {
  cancelNavbarRename();
  const session = getActiveSession();
  if (!session) return;

  if (session.persona && personaSelect.value !== session.persona) {
    personaSelect.value = session.persona;
  }
  updatePersonaIcon(session.persona);

  chatTitle.textContent = session.title || 'New Chat';
  const pObj = personas.find((p) => p.id === session.persona);
  chatSubtitle.textContent = pObj && pObj.id !== 'chatbot' ? `ChatBot AI • ${pObj.label.replace('ChatBot AI ', '')}` : 'ChatBot AI';

  chatBox.innerHTML = '';

  if (!session.messages || session.messages.length === 0) {
    renderWelcomeState(pObj);
    return;
  }

  session.messages.forEach((msg, idx) => {
    appendMessageElement(msg.role, msg.text, msg.file, false, idx);
  });

  scrollToBottom();
}

function updatePersonaIcon(personaKey) {
  if (personaBadgeIcon) {
    personaBadgeIcon.textContent = PERSONA_ICONS[personaKey] || '🤖';
  }
}

function renderWelcomeState(persona) {
  const greeting = persona?.greeting || "Hello! I'm ChatBot AI. How can I help you today?";

  const container = document.createElement('div');
  container.className = 'm-auto max-w-[660px] w-full text-center p-[20px_10px_16px] sm:p-[40px_16px_20px] flex flex-col items-center gap-3 sm:gap-4 animate-slide-up';
  container.innerHTML = `
    <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-[#a1a1aa] text-[0.74rem] sm:text-[0.76rem] font-medium">
      <span class="w-1.5 h-1.5 rounded-full bg-[#71717a]"></span>
      <span>ChatBot AI Workspace</span>
    </div>
    <h2 class="text-[1.75rem] sm:text-[2.2rem] font-bold tracking-[-0.03em] text-[#fafafa]">ChatBot AI</h2>
    <p class="text-[0.84rem] sm:text-[0.92rem] text-[#a1a1aa] leading-relaxed max-w-[480px] sm:max-w-[520px]">${escapeHtml(greeting)}</p>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 w-full mt-1 sm:mt-2">
      <div class="suggestion-chip group p-[12px_14px] sm:p-[14px_16px] bg-[#141416] hover:bg-[#1a1a1e] border border-white/[0.08] hover:border-white/20 rounded-[12px] text-left cursor-pointer transition-all duration-200 flex items-start gap-3 sm:gap-3.5 shadow-sm hover:shadow-md hover:-translate-y-0.5" data-prompt="Please summarize the attached document into key takeaways that are easy to understand.">
        <div class="w-7.5 h-7.5 sm:w-8 sm:h-8 rounded-[8px] bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-[#a1a1aa] group-hover:text-[#fafafa] shrink-0 mt-0.5 transition-colors">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <line x1="10" y1="9" x2="8" y2="9"/>
          </svg>
        </div>
        <div class="flex flex-col gap-0.5 flex-1 min-w-0">
          <span class="font-semibold text-[0.84rem] sm:text-[0.88rem] text-[#fafafa]">Summarize Document / PDF</span>
          <span class="text-[0.72rem] sm:text-[0.74rem] text-[#71717a] leading-tight">Quickly extract key takeaways from documents</span>
        </div>
      </div>
      <div class="suggestion-chip group p-[12px_14px] sm:p-[14px_16px] bg-[#141416] hover:bg-[#1a1a1e] border border-white/[0.08] hover:border-white/20 rounded-[12px] text-left cursor-pointer transition-all duration-200 flex items-start gap-3 sm:gap-3.5 shadow-sm hover:shadow-md hover:-translate-y-0.5" data-prompt="Explain in detail the objects, context, and key details you see in this image.">
        <div class="w-7.5 h-7.5 sm:w-8 sm:h-8 rounded-[8px] bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-[#a1a1aa] group-hover:text-[#fafafa] shrink-0 mt-0.5 transition-colors">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
            <circle cx="9" cy="9" r="2"/>
            <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
          </svg>
        </div>
        <div class="flex flex-col gap-0.5 flex-1 min-w-0">
          <span class="font-semibold text-[0.84rem] sm:text-[0.88rem] text-[#fafafa]">Analyze Photos & Images</span>
          <span class="text-[0.72rem] sm:text-[0.74rem] text-[#71717a] leading-tight">Understand diagrams, photos, or screenshots</span>
        </div>
      </div>
      <div class="suggestion-chip group p-[12px_14px] sm:p-[14px_16px] bg-[#141416] hover:bg-[#1a1a1e] border border-white/[0.08] hover:border-white/20 rounded-[12px] text-left cursor-pointer transition-all duration-200 flex items-start gap-3 sm:gap-3.5 shadow-sm hover:shadow-md hover:-translate-y-0.5" data-prompt="Write a JavaScript program and explain step by step how it works.">
        <div class="w-7.5 h-7.5 sm:w-8 sm:h-8 rounded-[8px] bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-[#a1a1aa] group-hover:text-[#fafafa] shrink-0 mt-0.5 transition-colors">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="16 18 22 12 16 6"/>
            <polyline points="8 6 2 12 8 18"/>
          </svg>
        </div>
        <div class="flex flex-col gap-0.5 flex-1 min-w-0">
          <span class="font-semibold text-[0.84rem] sm:text-[0.88rem] text-[#fafafa]">Coding & Programming</span>
          <span class="text-[0.72rem] sm:text-[0.74rem] text-[#71717a] leading-tight">Write technical solutions & debug code</span>
        </div>
      </div>
      <div class="suggestion-chip group p-[12px_14px] sm:p-[14px_16px] bg-[#141416] hover:bg-[#1a1a1e] border border-white/[0.08] hover:border-white/20 rounded-[12px] text-left cursor-pointer transition-all duration-200 flex items-start gap-3 sm:gap-3.5 shadow-sm hover:shadow-md hover:-translate-y-0.5" data-prompt="Design an efficient weekly productivity plan and actionable strategy.">
        <div class="w-7.5 h-7.5 sm:w-8 sm:h-8 rounded-[8px] bg-white/[0.05] border border-white/[0.08] flex items-center justify-center text-[#a1a1aa] group-hover:text-[#fafafa] shrink-0 mt-0.5 transition-colors">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
          </svg>
        </div>
        <div class="flex flex-col gap-0.5 flex-1 min-w-0">
          <span class="font-semibold text-[0.84rem] sm:text-[0.88rem] text-[#fafafa]">Planning & Strategy</span>
          <span class="text-[0.72rem] sm:text-[0.74rem] text-[#71717a] leading-tight">Turn ambitious goals into actionable steps</span>
        </div>
      </div>
    </div>
  `;

  container.querySelectorAll('.suggestion-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      userInput.value = chip.getAttribute('data-prompt');
      userInput.focus();
      autoResizeTextarea();
    });
  });

  chatBox.appendChild(container);
}

// ============================================================
// MESSAGE UI HELPERS & INTERACTIVE ACTION BARS (TAILWIND UTILITY)
// ============================================================
function appendMessageElement(role, text, file = null, isPending = false, messageIndex = -1) {
  const row = document.createElement('div');
  row.className = role === 'user'
    ? 'flex gap-3 sm:gap-3.5 max-w-[840px] w-full mx-auto flex-row-reverse py-1.5'
    : 'flex items-start gap-3 sm:gap-4 max-w-[840px] w-full mx-auto py-2 sm:py-3.5';

  const avatar = document.createElement('div');
  if (role === 'user') {
    avatar.className = 'w-7 h-7 sm:w-8 sm:h-8 rounded-[8px] flex items-center justify-center shrink-0 mt-0.5 shadow-sm bg-[#27272a] text-[#d4d4d8] border border-white/[0.12]';
    avatar.innerHTML = `
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
    `;
  } else {
    // Sleek Gemini / Claude Sparkle Avatar
    avatar.className = 'w-7 h-7 sm:w-8 sm:h-8 rounded-[8px] flex items-center justify-center shrink-0 mt-0.5 shadow-sm bg-gradient-to-tr from-[#1c1c22] to-[#2a2a38] border border-white/15 text-[#e4e4e7]';
    avatar.innerHTML = `
      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
        <path d="M12 2L14.2 9.8L22 12L14.2 14.2L12 22L9.8 14.2L2 12L9.8 9.8L12 2Z"/>
      </svg>
    `;
  }

  const wrapper = document.createElement('div');
  wrapper.className = role === 'user'
    ? 'flex flex-col gap-1.5 max-w-[85%] sm:max-w-[75%] items-end'
    : 'flex-1 min-w-0 w-full flex flex-col gap-1';

  const bubble = document.createElement('div');
  bubble.className = role === 'user'
    ? 'p-[11px_16px] sm:p-[13px_18px] rounded-[18px] rounded-br-sm bg-[#27272a] text-[#fafafa] text-[0.91rem] sm:text-[0.95rem] leading-relaxed relative break-words border border-white/[0.08] shadow-[0_2px_8px_rgba(0,0,0,0.3)]'
    : 'w-full text-[0.94rem] sm:text-[0.98rem] leading-[1.78] text-[#ececf1] relative break-words pt-0.5';

  // Lampiran media
  if (file) {
    const attachWrap = document.createElement('div');
    attachWrap.className = 'mb-2.5 rounded-[10px] overflow-hidden';

    const mime = file.mimeType || '';
    const src = file.previewUrl || (file.data ? `data:${mime};base64,${file.data}` : null);

    if (mime.startsWith('image/') && src) {
      attachWrap.className += ' max-w-[380px] border border-white/10 cursor-zoom-in';
      attachWrap.innerHTML = `<img src="${src}" alt="${escapeHtml(file.name)}" loading="lazy" class="w-full h-auto block max-h-[280px] object-cover transition-transform duration-200 hover:scale-[1.03]" />`;
      attachWrap.querySelector('img').onclick = () => openImageLightbox(src, file.name);
    } else if (mime.startsWith('audio/') && src) {
      attachWrap.className += ' max-w-[320px]';
      attachWrap.innerHTML = `<audio controls src="${src}" class="w-full rounded-[30px] invert-[0.9] hue-rotate-180"></audio>`;
    } else if (mime.startsWith('video/') && src) {
      attachWrap.className += ' max-w-[400px] border border-white/10 rounded-[10px] overflow-hidden';
      attachWrap.innerHTML = `<video controls src="${src}" class="w-full max-h-[260px] bg-black"></video>`;
    } else {
      attachWrap.className += ' flex items-center gap-3 p-[10px_14px] bg-white/[0.04] border border-white/10 rounded-[10px] max-w-[340px]';
      attachWrap.innerHTML = `
        <div class="text-[1.6rem] leading-none">${getFileIcon(mime)}</div>
        <div class="flex flex-col overflow-hidden">
          <span class="font-semibold text-[0.85rem] text-[#fafafa] truncate">${escapeHtml(file.name)}</span>
          <span class="text-[0.7rem] text-[#71717a]">${formatFileSize(file.size)}</span>
        </div>
      `;
    }
    wrapper.appendChild(attachWrap);
  }

  // Teks pesan
  if (isPending) {
    bubble.innerHTML = `
      <div class="flex items-center gap-2.5 py-1 text-[#a1a1aa]">
        <div class="flex items-center gap-1.5">
          <span class="w-2 h-2 bg-indigo-400 rounded-full thinking-dot-1"></span>
          <span class="w-2 h-2 bg-purple-400 rounded-full thinking-dot-2"></span>
          <span class="w-2 h-2 bg-pink-400 rounded-full thinking-dot-3"></span>
        </div>
        <span class="text-[0.82rem] font-medium text-[#71717a] tracking-wide">Thinking...</span>
      </div>
    `;
  } else if (role === 'model') {
    bubble.innerHTML = `<div class="markdown-body text-[#ececf1]">${renderMarkdown(text)}</div>`;
    attachCodeCopyButtons(bubble);
    attachMarkdownImageLightbox(bubble);
  } else {
    bubble.textContent = text;
  }

  wrapper.appendChild(bubble);

  // Action Bar untuk pesan user (Salin & Edit Pesan)
  if (role === 'user' && !isPending && text) {
    const userActionsBar = document.createElement('div');
    userActionsBar.className = 'flex items-center gap-1 mt-1 opacity-70 hover:opacity-100 transition-opacity justify-end';

    // Tombol Salin Pesan User
    const copyUserBtn = document.createElement('button');
    copyUserBtn.type = 'button';
    copyUserBtn.className = 'bg-transparent border border-transparent hover:border-white/[0.08] hover:bg-white/[0.05] text-[#71717a] hover:text-[#fafafa] px-2 py-1 rounded-[6px] text-[0.75rem] flex items-center gap-1.5 cursor-pointer transition-all';
    copyUserBtn.title = 'Copy message';
    copyUserBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
      <span>Copy</span>
    `;
    copyUserBtn.onclick = async () => {
      const success = await copyToClipboard(text);
      if (success) {
        copyUserBtn.innerHTML = `
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" class="text-emerald-400"><polyline points="20 6 9 17 4 12"/></svg>
          <span class="text-emerald-400 font-semibold">Copied!</span>
        `;
        showToast('Message copied to clipboard');
        setTimeout(() => {
          copyUserBtn.innerHTML = `
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
            <span>Copy</span>
          `;
        }, 2200);
      }
    };

    // Tombol Edit Pesan User
    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'bg-transparent border border-transparent hover:border-white/[0.08] hover:bg-white/[0.05] text-[#71717a] hover:text-[#fafafa] px-2 py-1 rounded-[6px] text-[0.75rem] flex items-center gap-1.5 cursor-pointer transition-all';
    editBtn.title = 'Edit message';
    editBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
      <span>Edit</span>
    `;
    editBtn.onclick = () => {
      startEditingUserMessage(bubble, userActionsBar, text, messageIndex);
    };

    userActionsBar.appendChild(copyUserBtn);
    userActionsBar.appendChild(editBtn);
    wrapper.appendChild(userActionsBar);
  }

  // Action Bar untuk balasan bot (Salin Respons AI, Dengarkan, Regenerate - Gaya ChatGPT/Claude)
  if (role === 'model' && !isPending && text) {
    const actionsBar = document.createElement('div');
    actionsBar.className = 'flex items-center gap-1 mt-2.5 pt-0.5 text-[#71717a]';

    // Tombol Salin Respons AI
    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'px-2 py-1 rounded-[6px] text-[0.75rem] text-[#71717a] hover:text-[#e4e4e7] hover:bg-white/[0.06] flex items-center gap-1.5 transition-colors cursor-pointer';
    copyBtn.title = 'Copy response';
    copyBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
      <span>Copy</span>
    `;
    copyBtn.onclick = async () => {
      const success = await copyToClipboard(text);
      if (success) {
        copyBtn.innerHTML = `
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" class="text-emerald-400"><polyline points="20 6 9 17 4 12"/></svg>
          <span class="text-emerald-400 font-medium">Copied!</span>
        `;
        showToast('Response copied to clipboard');
        setTimeout(() => {
          copyBtn.innerHTML = `
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
            <span>Copy</span>
          `;
        }, 2200);
      }
    };

    // Tombol Text-to-Speech (Dengarkan)
    const speakBtn = document.createElement('button');
    speakBtn.type = 'button';
    speakBtn.className = 'px-2 py-1 rounded-[6px] text-[0.75rem] text-[#71717a] hover:text-[#e4e4e7] hover:bg-white/[0.06] flex items-center gap-1.5 transition-colors cursor-pointer';
    speakBtn.title = 'Listen to response';
    speakBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
      <span>Listen</span>
    `;
    speakBtn.onclick = () => speakText(text, speakBtn);

    // Tombol Coba Lagi / Regenerate
    const regenBtn = document.createElement('button');
    regenBtn.type = 'button';
    regenBtn.className = 'px-2 py-1 rounded-[6px] text-[0.75rem] text-[#71717a] hover:text-[#e4e4e7] hover:bg-white/[0.06] flex items-center gap-1.5 transition-colors cursor-pointer';
    regenBtn.title = 'Regenerate response';
    regenBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
      <span>Retry</span>
    `;
    regenBtn.onclick = () => regenerateLastResponse();

    actionsBar.appendChild(copyBtn);
    actionsBar.appendChild(speakBtn);
    actionsBar.appendChild(regenBtn);
    wrapper.appendChild(actionsBar);
  }

  row.appendChild(avatar);
  row.appendChild(wrapper);

  chatBox.appendChild(row);
  scrollToBottom();
  return bubble;
}

// Inline Edit Pesan Pengguna
function startEditingUserMessage(bubble, userActionsBar, currentText, messageIdx) {
  if (bubble.dataset.isEditing === 'true') return;
  bubble.dataset.isEditing = 'true';

  userActionsBar.style.display = 'none';

  const wrapper = bubble.parentElement;
  const originalWrapperClasses = wrapper ? wrapper.className : '';
  const originalContent = bubble.innerHTML;
  const originalClasses = bubble.className;

  // Perlebar wrapper dan bubble ke samping agar sangat lapang, rapi, dan leluasa
  if (wrapper) {
    wrapper.className = 'flex flex-col items-end w-full max-w-full flex-1 transition-all';
  }
  bubble.className = 'w-full max-w-full p-3.5 sm:p-4 rounded-[16px] bg-[#18181c] border border-white/15 shadow-[0_8px_30px_rgba(0,0,0,0.5)] transition-all';

  const editWrap = document.createElement('div');
  editWrap.className = 'flex flex-col gap-2.5 w-full';

  const textarea = document.createElement('textarea');
  textarea.className = 'w-full bg-[#0c0c0e] text-[#fafafa] border border-white/10 focus:border-white/30 rounded-[11px] p-3 text-[0.88rem] sm:text-[0.92rem] outline-none resize-none leading-relaxed font-inherit transition-all shadow-inner overflow-hidden chat-scrollbar';
  textarea.value = currentText;

  const autoResize = () => {
    textarea.style.height = 'auto';
    const scrollH = textarea.scrollHeight;
    const newHeight = Math.min(Math.max(scrollH, 48), 280);
    textarea.style.height = newHeight + 'px';
    textarea.style.overflowY = scrollH > 280 ? 'auto' : 'hidden';
  };

  const actionRow = document.createElement('div');
  actionRow.className = 'flex items-center justify-between gap-2 pt-0.5';

  const hint = document.createElement('span');
  hint.className = 'text-[0.68rem] text-[#71717a] select-none hidden sm:inline';
  hint.innerHTML = 'Press <kbd class="font-mono text-[0.62rem] text-[#a1a1aa] bg-white/[0.08] px-1 py-0.5 rounded border border-white/10">Enter</kbd> to send • <kbd class="font-mono text-[0.62rem] text-[#a1a1aa] bg-white/[0.08] px-1 py-0.5 rounded border border-white/10">Esc</kbd> to cancel';

  const btnGroup = document.createElement('div');
  btnGroup.className = 'flex items-center gap-2 ml-auto';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'px-3.5 py-1.5 rounded-[8px] text-[0.78rem] font-medium text-[#a1a1aa] hover:text-[#fafafa] hover:bg-white/[0.08] transition-all cursor-pointer';
  cancelBtn.textContent = 'Cancel';

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'px-4 py-1.5 rounded-[8px] text-[0.78rem] font-semibold bg-[#fafafa] hover:bg-white text-[#09090b] transition-all cursor-pointer shadow-[0_2px_8px_rgba(0,0,0,0.3)] flex items-center gap-1.5 hover:scale-[1.02] active:scale-[0.98]';
  saveBtn.innerHTML = `
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
    <span>Send</span>
  `;

  btnGroup.appendChild(cancelBtn);
  btnGroup.appendChild(saveBtn);

  actionRow.appendChild(hint);
  actionRow.appendChild(btnGroup);

  editWrap.appendChild(textarea);
  editWrap.appendChild(actionRow);

  bubble.innerHTML = '';
  bubble.appendChild(editWrap);

  setTimeout(() => {
    autoResize();
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  }, 30);

  textarea.addEventListener('input', autoResize);

  const cleanupAndRestore = () => {
    delete bubble.dataset.isEditing;
    bubble.className = originalClasses;
    bubble.innerHTML = originalContent;
    if (wrapper) wrapper.className = originalWrapperClasses;
    userActionsBar.style.display = 'flex';
  };

  cancelBtn.onclick = () => {
    cleanupAndRestore();
  };

  const handleSave = () => {
    const updatedText = textarea.value.trim();
    if (!updatedText) {
      showToast('Message cannot be empty');
      textarea.focus();
      return;
    }
    if (isGenerating) {
      showToast('Please wait for AI response to finish');
      return;
    }

    const session = getActiveSession();
    if (!session || !session.messages) {
      cleanupAndRestore();
      return;
    }

    // Tentukan target index pesan
    let targetIdx = messageIdx;
    if (targetIdx < 0 || targetIdx >= session.messages.length || session.messages[targetIdx].role !== 'user') {
      targetIdx = session.messages.findLastIndex((m) => m.role === 'user' && m.text === currentText);
    }
    if (targetIdx === -1) {
      targetIdx = session.messages.length - 1;
    }

    session.messages[targetIdx].text = updatedText;

    // Jika pesan user pertama diedit, sesuaikan judul chat
    const firstUserIdx = session.messages.findIndex((m) => m.role === 'user');
    if (firstUserIdx === targetIdx) {
      const rawTitle = updatedText || session.messages[targetIdx].file?.name || 'New Chat';
      session.title = rawTitle.slice(0, 30) + (rawTitle.length > 30 ? '...' : '');
      chatTitle.textContent = session.title;
      renderHistoryList();
    }

    // Truncate pesan setelah index ini agar respon AI diperbarui dari giliran ini
    session.messages = session.messages.slice(0, targetIdx + 1);
    session.updatedAt = Date.now();
    saveSessionsToStorage();

    // Render ulang dan jalankan respons AI baru
    renderActiveChat();
    executeChatTurn(null, false);
    showToast('Message updated & regenerating response');
  };

  saveBtn.onclick = handleSave;

  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      cleanupAndRestore();
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
  });
}

// Regenerate Respons Terakhir
async function regenerateLastResponse() {
  if (isGenerating) return;
  const session = getActiveSession();
  if (!session || !session.messages.length) return;

  if (session.messages[session.messages.length - 1].role === 'model') {
    session.messages.pop();
  }

  renderActiveChat();
  executeChatTurn(null, false);
}

// Markdown parser
function renderMarkdown(rawText) {
  if (!rawText) return '';
  if (window.marked && typeof window.marked.parse === 'function') {
    return window.marked.parse(rawText, { breaks: true });
  }

  let html = escapeHtml(rawText);
  html = html.replace(/```([a-z0-9_-]*)\n([\s\S]*?)```/gi, (_match, lang, code) => {
    const displayLang = lang ? lang.toLowerCase() : 'code';
    return `
      <div class="my-4 bg-[#0d0d12] rounded-[10px] overflow-hidden border border-white/[0.08] shadow-[0_4px_16px_rgba(0,0,0,0.35)] code-block-wrapper">
        <div class="flex items-center justify-between px-4 py-2 bg-[#18181f] border-b border-white/[0.06] text-[#a1a1aa] text-[0.74rem] font-mono select-none">
          <div class="flex items-center gap-1.5 font-medium lowercase text-[#a1a1aa]">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" class="text-[#71717a]"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
            <span>${escapeHtml(displayLang)}</span>
          </div>
          <button type="button" class="btn-copy-code flex items-center gap-1.5 px-2.5 py-1 rounded-[5px] bg-white/[0.04] hover:bg-white/[0.1] border border-white/[0.08] text-[#d4d4d8] hover:text-white text-[0.72rem] transition-all cursor-pointer">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
            <span>Copy code</span>
          </button>
        </div>
        <pre class="m-0 p-4 sm:p-5 overflow-x-auto text-[#f4f4f5] font-mono text-[0.86rem] leading-relaxed"><code>${code}</code></pre>
      </div>
    `;
  });
  html = html.replace(/`([^`]+)`/g, '<code class="font-mono text-[0.86em] bg-white/[0.08] border border-white/10 px-1.5 py-0.5 rounded text-blue-300">$1</code>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  html = html.replace(/\n/g, '<br>');
  return html;
}

function attachCodeCopyButtons(container) {
  container.querySelectorAll('pre').forEach((pre) => {
    if (pre.parentElement.classList.contains('code-block-wrapper')) return;

    const codeElem = pre.querySelector('code');
    const langMatch = codeElem ? (codeElem.className.match(/language-([a-z0-9_-]+)/i) || [])[1] : '';
    const displayLang = langMatch ? langMatch.toLowerCase() : 'code';

    const wrapper = document.createElement('div');
    wrapper.className = 'my-4 bg-[#0d0d12] rounded-[10px] overflow-hidden border border-white/[0.08] shadow-[0_4px_16px_rgba(0,0,0,0.35)] code-block-wrapper';
    pre.parentNode.insertBefore(wrapper, pre);

    const header = document.createElement('div');
    header.className = 'flex items-center justify-between px-4 py-2 bg-[#18181f] border-b border-white/[0.06] text-[#a1a1aa] text-[0.74rem] font-mono select-none';
    header.innerHTML = `
      <div class="flex items-center gap-1.5 font-medium lowercase text-[#a1a1aa]">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" class="text-[#71717a]"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
        <span>${escapeHtml(displayLang)}</span>
      </div>
      <button type="button" class="btn-copy-code flex items-center gap-1.5 px-2.5 py-1 rounded-[5px] bg-white/[0.04] hover:bg-white/[0.1] border border-white/[0.08] text-[#d4d4d8] hover:text-white text-[0.72rem] transition-all cursor-pointer">
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
        <span>Copy code</span>
      </button>
    `;

    wrapper.appendChild(header);
    wrapper.appendChild(pre);
  });

  container.querySelectorAll('.btn-copy-code').forEach((btn) => {
    btn.onclick = async () => {
      const pre = btn.closest('.code-block-wrapper')?.querySelector('pre') || btn.closest('div')?.parentElement?.querySelector('pre');
      const textToCopy = pre ? pre.innerText : '';
      const success = await copyToClipboard(textToCopy);
      if (success) {
        btn.innerHTML = `
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" class="text-emerald-400"><polyline points="20 6 9 17 4 12"/></svg>
          <span class="text-emerald-400 font-medium">Copied!</span>
        `;
        showToast('Code copied to clipboard');
        setTimeout(() => {
          btn.innerHTML = `
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
            <span>Copy code</span>
          `;
        }, 2200);
      }
    };
  });
}

function scrollToBottom() {
  chatBox.scrollTop = chatBox.scrollHeight;
}

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ============================================================
// IMAGE LIGHTBOX MODAL
// ============================================================
function openImageLightbox(src, caption = '') {
  lightboxImg.src = src;
  lightboxCaption.textContent = caption;
  imageLightboxModal.classList.remove('hidden');
  imageLightboxModal.classList.add('flex');
}

function closeImageLightbox() {
  imageLightboxModal.classList.remove('flex');
  imageLightboxModal.classList.add('hidden');
  lightboxImg.src = '';
}

lightboxBackdrop.addEventListener('click', closeImageLightbox);
lightboxCloseBtn.addEventListener('click', closeImageLightbox);

function attachMarkdownImageLightbox(container) {
  if (!container) return;
  const imgs = container.querySelectorAll('.markdown-body img');
  imgs.forEach((img) => {
    img.loading = 'lazy';
    img.style.cursor = 'zoom-in';
    img.onclick = () => {
      openImageLightbox(img.src, img.alt || 'Gambar AI');
    };
  });
}

// ============================================================
// POPUP MENU "MINTA GEMINI" & LAMPIRAN FILE
// ============================================================
function openToolsMenu() {
  if (!geminiToolsPopup) return;
  geminiToolsPopup.classList.remove('hidden');
  geminiToolsPopup.classList.add('flex');
  attachBtn.setAttribute('aria-expanded', 'true');
  if (attachIcon) {
    attachIcon.classList.add('rotate-45', 'text-[#fafafa]');
  }
}

function closeToolsMenu() {
  if (!geminiToolsPopup) return;
  geminiToolsPopup.classList.remove('flex');
  geminiToolsPopup.classList.add('hidden');
  attachBtn.setAttribute('aria-expanded', 'false');
  if (attachIcon) {
    attachIcon.classList.remove('rotate-45', 'text-[#fafafa]');
  }
}

function toggleToolsMenu() {
  if (!geminiToolsPopup) return;
  if (geminiToolsPopup.classList.contains('hidden')) {
    openToolsMenu();
  } else {
    closeToolsMenu();
  }
}

attachBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  toggleToolsMenu();
});

toolsPopupCloseBtn?.addEventListener('click', (e) => {
  e.stopPropagation();
  closeToolsMenu();
});

menuItemUpload?.addEventListener('click', () => {
  closeToolsMenu();
  fileInput.click();
});

menuItemGenerateImage?.addEventListener('click', () => {
  closeToolsMenu();
  const prefix = 'Buat gambar: ';
  if (!userInput.value.trim()) {
    userInput.value = prefix;
  } else if (!userInput.value.toLowerCase().startsWith('buat gambar')) {
    userInput.value = prefix + userInput.value.trim();
  }
  userInput.focus();
  userInput.setSelectionRange(userInput.value.length, userInput.value.length);
  autoResizeTextarea();
  showToast('Mode "Buat gambar" aktif. Tuliskan deskripsi visual Anda.');
});

// Tutup menu jika klik di luar popup
document.addEventListener('click', (e) => {
  if (geminiToolsPopup && !geminiToolsPopup.classList.contains('hidden')) {
    if (!geminiToolsPopup.contains(e.target) && !attachBtn.contains(e.target)) {
      closeToolsMenu();
    }
  }
});

fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) handleSelectedFile(file);
});

function handleSelectedFile(file) {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    alert(`File "${file.name}" (${formatFileSize(file.size)}) exceeds the 25 MB limit.`);
    fileInput.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target.result;
    const base64Data = dataUrl.split(',')[1];
    const mimeType = file.type || inferMimeType(file.name);

    selectedFile = {
      name: file.name,
      size: file.size,
      mimeType,
      data: base64Data,
      previewUrl: dataUrl,
    };

    filePreviewIcon.textContent = getFileIcon(mimeType);
    filePreviewName.textContent = file.name;
    filePreviewSize.textContent = formatFileSize(file.size);
    filePreviewCard.style.display = 'flex';

    showToast(`File "${file.name}" ready to upload`);
    userInput.focus();
  };

  reader.onerror = () => {
    alert('Failed to read file. Please select again.');
  };

  reader.readAsDataURL(file);
}

filePreviewRemove.addEventListener('click', () => {
  clearSelectedFile();
});

function clearSelectedFile() {
  selectedFile = null;
  fileInput.value = '';
  filePreviewCard.style.display = 'none';
}

function inferMimeType(fileName = '') {
  const ext = fileName.split('.').pop()?.toLowerCase();
  const map = {
    pdf: 'application/pdf',
    txt: 'text/plain',
    md: 'text/markdown',
    csv: 'text/csv',
    json: 'application/json',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    mp3: 'audio/mp3',
    wav: 'audio/wav',
    m4a: 'audio/m4a',
    mp4: 'video/mp4',
    webm: 'video/webm',
  };
  return map[ext] || 'application/octet-stream';
}

// Drag & Drop Handlers (Reliable dengan Counter)
let dragCounter = 0;
window.addEventListener('dragenter', (e) => {
  e.preventDefault();
  dragCounter++;
  dragDropOverlay.classList.remove('hidden');
  dragDropOverlay.classList.add('flex');
});

window.addEventListener('dragover', (e) => {
  e.preventDefault();
});

window.addEventListener('dragleave', (e) => {
  e.preventDefault();
  dragCounter--;
  if (dragCounter <= 0) {
    dragCounter = 0;
    dragDropOverlay.classList.remove('flex');
    dragDropOverlay.classList.add('hidden');
  }
});

window.addEventListener('drop', (e) => {
  e.preventDefault();
  dragCounter = 0;
  dragDropOverlay.classList.remove('flex');
  dragDropOverlay.classList.add('hidden');
  const files = e.dataTransfer?.files;
  if (files && files.length > 0) {
    handleSelectedFile(files[0]);
  }
});

// ============================================================
// CHAT SUBMIT & API DISPATCH
// ============================================================
chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (isGenerating) return;

  const text = userInput.value.trim();
  if (!text && !selectedFile) return;

  const session = getActiveSession();
  if (!session) return;

  const welcome = chatBox.querySelector('.animate-slide-up');
  if (welcome) welcome.remove();

  const userMsg = {
    role: 'user',
    text: text || (selectedFile ? 'Please analyze and explain the attached file in detail.' : ''),
    file: selectedFile ? { ...selectedFile } : null,
  };

  session.messages.push(userMsg);
  appendMessageElement('user', userMsg.text, userMsg.file, false, session.messages.length - 1);

  if (session.messages.filter((m) => m.role === 'user').length === 1) {
    const rawTitle = text || userMsg.file?.name || 'New Chat';
    session.title = rawTitle.slice(0, 30) + (rawTitle.length > 30 ? '...' : '');
    chatTitle.textContent = session.title;
    renderHistoryList();
  }

  userInput.value = '';
  autoResizeTextarea();
  clearSelectedFile();

  executeChatTurn(userMsg, true);
});

// Helper untuk mengatur status UI saat AI sedang merespons vs selesai
function setGeneratingState(generating) {
  isGenerating = generating;
  if (generating) {
    userInput.disabled = true;
    attachBtn.disabled = true;
    attachBtn.classList.add('opacity-40', 'cursor-not-allowed');

    // Tampilkan tombol melayang "Hentikan respons"
    if (stopBtn) {
      stopBtn.classList.remove('hidden');
      stopBtn.classList.add('flex');
    }

    // Ubah tombol kirim menjadi tombol stop (persegi)
    sendBtn.disabled = false;
    sendBtn.title = 'Hentikan respons (Esc)';
    sendBtn.setAttribute('aria-label', 'Hentikan respons');
    sendBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
        <rect x="6" y="6" width="12" height="12" rx="2.5"/>
      </svg>
    `;
    sendBtn.classList.add('bg-zinc-800', 'text-red-400', 'border', 'border-red-500/30', 'hover:bg-zinc-700');
    sendBtn.classList.remove('bg-[#fafafa]', 'text-[#09090b]', 'hover:bg-white');
  } else {
    userInput.disabled = false;
    attachBtn.disabled = false;
    attachBtn.classList.remove('opacity-40', 'cursor-not-allowed');

    // Sembunyikan tombol melayang "Hentikan respons"
    if (stopBtn) {
      stopBtn.classList.add('hidden');
      stopBtn.classList.remove('flex');
    }

    // Kembalikan tombol kirim seperti semula
    sendBtn.disabled = false;
    sendBtn.title = 'Send message (Enter)';
    sendBtn.setAttribute('aria-label', 'Send message');
    sendBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="22" y1="2" x2="11" y2="13"/>
        <polygon points="22 2 15 22 11 13 2 9 22 2"/>
      </svg>
    `;
    sendBtn.classList.remove('bg-zinc-800', 'text-red-400', 'border', 'border-red-500/30', 'hover:bg-zinc-700');
    sendBtn.classList.add('bg-[#fafafa]', 'text-[#09090b]', 'hover:bg-white');
    userInput.focus();
  }
}

// Fungsi utama untuk menghentikan generasi respons
function stopGeneration() {
  if (!isGenerating) return;
  if (currentAbortController) {
    currentAbortController.abort();
    currentAbortController = null;
  }
  showToast('Respons dihentikan.');
}

async function executeChatTurn(userMsg = null, isNewUserTurn = false) {
  const session = getActiveSession();
  if (!session) return;
  const turnSessionId = session.id;

  setGeneratingState(true);
  currentAbortController = new AbortController();

  const pendingBubble = appendMessageElement('model', '', null, true);
  let replyText = '';
  let wasAborted = false;

  try {
    const conversationPayload = session.messages.map((m) => ({
      role: m.role,
      text: m.text,
      ...(m.file ? { file: m.file } : {}),
    }));

    const response = await fetch('/api/chat?stream=true', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
      },
      signal: currentAbortController.signal,
      body: JSON.stringify({
        conversation: conversationPayload,
        persona: session.persona || personaSelect.value,
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || `Server error (${response.status})`);
    }

    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('text/event-stream') && response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let renderRafId = null;
      let lastRenderTime = 0;

      // Throttle rendering ke ~30-60 FPS agar browser tidak freeze / lag akibat ribuan operasi innerHTML beruntun
      const scheduleRender = (force = false) => {
        if (activeSessionId !== turnSessionId) return;
        const now = performance.now();
        if (force || now - lastRenderTime >= 35) {
          if (renderRafId) {
            cancelAnimationFrame(renderRafId);
            renderRafId = null;
          }
          lastRenderTime = now;
          pendingBubble.innerHTML = `<div class="markdown-body text-[#e4e4e7]">${renderMarkdown(replyText)}</div>`;
          chatBox.scrollTop = chatBox.scrollHeight;
        } else if (!renderRafId) {
          renderRafId = requestAnimationFrame(() => {
            renderRafId = null;
            if (activeSessionId !== turnSessionId) return;
            lastRenderTime = performance.now();
            pendingBubble.innerHTML = `<div class="markdown-body text-[#e4e4e7]">${renderMarkdown(replyText)}</div>`;
            chatBox.scrollTop = chatBox.scrollHeight;
          });
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const payload = trimmed.slice(5).trim();
          if (!payload) continue;
          if (payload === '[DONE]') break;

          try {
            const parsed = JSON.parse(payload);
            if (parsed.error) throw new Error(parsed.error);
            if (parsed.text) {
              replyText += parsed.text;
              scheduleRender();
            }
          } catch (e) {
            if (e.message && !e.message.includes('JSON')) throw e;
          }
        }
      }

      if (renderRafId) {
        cancelAnimationFrame(renderRafId);
        renderRafId = null;
      }
      scheduleRender(true);
    } else {
      const data = await response.json().catch(() => ({}));
      replyText = data.result || 'Sorry, no response text received from AI.';
    }

    if (!replyText.trim()) {
      replyText = 'Sorry, no response text received from AI.';
    }

    session.messages.push({
      role: 'model',
      text: replyText,
    });
    session.updatedAt = Date.now();
    saveSessionsToStorage();

    if (activeSessionId === turnSessionId) {
      pendingBubble.parentElement?.parentElement?.remove();
      appendMessageElement('model', replyText, null, false, session.messages.length - 1);
    }
  } catch (err) {
    if (err.name === 'AbortError' || currentAbortController?.signal?.aborted) {
      wasAborted = true;
      console.log('Respons chatbot dihentikan oleh pengguna.');
    } else {
      console.error('Chat error:', err);
    }

    // Jika dihentikan pengguna dan sudah ada teks yang dihasilkan, simpan teks tersebut
    if (replyText && replyText.trim()) {
      const finalText = wasAborted ? `${replyText.trim()}\n\n*(Respons dihentikan)*` : replyText;
      session.messages.push({
        role: 'model',
        text: finalText,
      });
      session.updatedAt = Date.now();
      saveSessionsToStorage();
      if (activeSessionId === turnSessionId) {
        pendingBubble.parentElement?.parentElement?.remove();
        appendMessageElement('model', finalText, null, false, session.messages.length - 1);
      }
      return;
    }

    // Jika dihentikan saat masih status Thinking (teks masih kosong)
    if (wasAborted) {
      if (activeSessionId === turnSessionId) {
        pendingBubble.parentElement?.parentElement?.remove();
      }
      return;
    }

    if (activeSessionId !== turnSessionId) return;

    pendingBubble.classList.remove('pending');
    pendingBubble.classList.add('bg-red-500/10', 'text-red-300', 'border-red-500/30');
    pendingBubble.innerHTML = `
      <div class="flex flex-col gap-2">
        <div class="flex items-start gap-2">
          <svg class="w-4 h-4 shrink-0 mt-0.5 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span class="text-[0.86rem] leading-relaxed">${escapeHtml(err.message)}</span>
        </div>
        <div class="flex items-center gap-2 mt-1">
          <button type="button" class="btn-retry-chat px-2.5 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-200 border border-red-500/30 rounded-[6px] text-[0.75rem] font-medium transition-colors cursor-pointer flex items-center gap-1.5">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
            <span>Retry</span>
          </button>
        </div>
      </div>
    `;

    const retryBtn = pendingBubble.querySelector('.btn-retry-chat');
    if (retryBtn) {
      retryBtn.onclick = () => {
        pendingBubble.parentElement.parentElement.remove();
        executeChatTurn(null, false);
      };
    }
  } finally {
    currentAbortController = null;
    setGeneratingState(false);
    scrollToBottom();
  }
}

function autoResizeTextarea() {
  userInput.style.height = 'auto';
  userInput.style.height = Math.min(userInput.scrollHeight, 160) + 'px';
}
userInput.addEventListener('input', autoResizeTextarea);

userInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    chatForm.requestSubmit();
  }
});

// Listener untuk Tombol Hentikan Respons
stopBtn?.addEventListener('click', stopGeneration);
sendBtn?.addEventListener('click', (e) => {
  if (isGenerating) {
    e.preventDefault();
    e.stopPropagation();
    stopGeneration();
  }
});

// Shortcut Keyboard Global: Ctrl+K = Chat Baru, Esc = Hentikan Respons / Tutup Modal
window.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    createNewChat();
  }
  if (e.key === 'Escape') {
    if (geminiToolsPopup && !geminiToolsPopup.classList.contains('hidden')) {
      e.preventDefault();
      closeToolsMenu();
      return;
    }
    if (isGenerating) {
      e.preventDefault();
      stopGeneration();
      return;
    }
    closeImageLightbox();
    cancelInlineRename();
    closeDeleteModal();
    if (sidebar.classList.contains('max-md:translate-x-0')) closeSidebar();
  }
});

// ============================================================
// EVENT LISTENERS UMUM & MODAL
// ============================================================
newChatBtn.addEventListener('click', createNewChat);
quickNewChatBtn.addEventListener('click', createNewChat);
clearAllHistoryBtn.addEventListener('click', clearAllHistory);
exportChatBtn.addEventListener('click', exportChatToMarkdown);

// Modal Delete Listeners
deleteCancelBtn?.addEventListener('click', closeDeleteModal);
confirmDeleteBackdrop?.addEventListener('click', closeDeleteModal);

deleteConfirmBtn?.addEventListener('click', () => {
  if (!sessionToDeleteId) return;

  if (sessionToDeleteId === '__all__') {
    if (isGenerating) {
      stopGeneration();
    }
    stopSpeech();
    sessions = [];
    activeSessionId = null;
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(ACTIVE_SESSION_KEY);
    createNewChat();
    closeDeleteModal();
    showToast('All chat history cleared');
    return;
  }

  const id = sessionToDeleteId;
  stopSpeech();
  sessions = sessions.filter((s) => s.id !== id);
  if (activeSessionId === id) {
    activeSessionId = sessions.length > 0 ? sessions[0].id : null;
  }

  saveSessionsToStorage();
  renderHistoryList();

  if (!activeSessionId) {
    createNewChat();
  } else {
    renderActiveChat();
  }

  closeDeleteModal();
  showToast('Conversation deleted');
});

personaSelect.addEventListener('change', () => {
  const session = getActiveSession();
  if (session) {
    session.persona = personaSelect.value;
    updatePersonaIcon(session.persona);
    const pObj = personas.find((p) => p.id === session.persona);
    chatSubtitle.textContent = pObj && pObj.id !== 'chatbot' ? `ChatBot AI • ${pObj.label.replace('ChatBot AI ', '')}` : 'ChatBot AI';
    saveSessionsToStorage();
    if (!session.messages || session.messages.length === 0) {
      renderActiveChat();
    }
    showToast(`Mode: ${pObj ? pObj.label : 'ChatBot AI'}`);
  }
});

// ============================================================
// SIDEBAR MINIMIZE (SLIM RAIL) LOGIC
// ============================================================
const SIDEBAR_MINIMIZED_KEY = 'chatbot_ai_sidebar_minimized';
let isSidebarMinimized = false;

const ICON_SIDEBAR_COLLAPSE = `
  <rect width="18" height="18" x="3" y="3" rx="2"/>
  <path d="M9 3v18"/>
  <path d="m15 9-3 3 3 3"/>
`;

const ICON_SIDEBAR_EXPAND = `
  <rect width="18" height="18" x="3" y="3" rx="2"/>
  <path d="M9 3v18"/>
  <path d="m13 15 3-3-3-3"/>
`;

function updateSidebarUI() {
  const toggleIcon = document.getElementById('toggle-sidebar-icon');
  const sidebarBrandBtn = document.getElementById('sidebar-brand-btn');
  const closeIconSvg = closeSidebarBtn ? closeSidebarBtn.querySelector('svg') : null;

  if (isSidebarMinimized) {
    sidebar.classList.add('sidebar-minimized');
    sidebar.classList.remove('sidebar-collapsed');
    toggleSidebarBtn.setAttribute('title', 'Expand Sidebar (Ctrl+B)');
    toggleSidebarBtn.setAttribute('aria-label', 'Expand Sidebar');
    if (sidebarBrandBtn) {
      sidebarBrandBtn.setAttribute('title', 'Expand Sidebar (Ctrl+B)');
    }
    if (closeSidebarBtn) {
      closeSidebarBtn.setAttribute('title', 'Expand Sidebar');
      closeSidebarBtn.setAttribute('aria-label', 'Expand Sidebar');
    }
    if (toggleIcon) toggleIcon.innerHTML = ICON_SIDEBAR_EXPAND;
    if (closeIconSvg) closeIconSvg.innerHTML = ICON_SIDEBAR_EXPAND;
  } else {
    sidebar.classList.remove('sidebar-minimized');
    sidebar.classList.remove('sidebar-collapsed');
    toggleSidebarBtn.setAttribute('title', 'Minimize Sidebar (Ctrl+B)');
    toggleSidebarBtn.setAttribute('aria-label', 'Minimize Sidebar');
    if (sidebarBrandBtn) {
      sidebarBrandBtn.setAttribute('title', 'ChatBot AI');
    }
    if (closeSidebarBtn) {
      closeSidebarBtn.setAttribute('title', 'Close Sidebar');
      closeSidebarBtn.setAttribute('aria-label', 'Close Sidebar');
    }
    if (toggleIcon) toggleIcon.innerHTML = ICON_SIDEBAR_COLLAPSE;
    if (closeIconSvg) closeIconSvg.innerHTML = ICON_SIDEBAR_COLLAPSE;
  }
}

function toggleSidebar() {
  if (window.innerWidth < 768) {
    sidebar.classList.toggle('max-md:translate-x-0');
    const isOpen = sidebar.classList.contains('max-md:translate-x-0');
    sidebarBackdrop.style.display = isOpen ? 'block' : 'none';
  } else {
    if (isSidebarMinimized) {
      // Expanding: gunakan sidebar-expanding selama 250ms agar teks memudar mulus tanpa lonjakan layout
      isSidebarMinimized = false;
      localStorage.setItem(SIDEBAR_MINIMIZED_KEY, '0');
      sidebar.classList.remove('sidebar-minimized');
      sidebar.classList.add('sidebar-expanding');
      updateSidebarUI();
      setTimeout(() => {
        sidebar.classList.remove('sidebar-expanding');
      }, 260);
    } else {
      // Minimizing
      isSidebarMinimized = true;
      localStorage.setItem(SIDEBAR_MINIMIZED_KEY, '1');
      sidebar.classList.add('sidebar-minimized');
      sidebar.classList.remove('sidebar-expanding');
      updateSidebarUI();
    }
  }
}

function closeSidebar() {
  if (window.innerWidth < 768) {
    sidebar.classList.remove('max-md:translate-x-0');
    sidebarBackdrop.style.display = 'none';
  } else {
    // Pada desktop, tombol close/minimize di header sidebar melakukan toggle/minimize
    toggleSidebar();
  }
}

toggleSidebarBtn.addEventListener('click', toggleSidebar);
if (closeSidebarBtn) {
  closeSidebarBtn.addEventListener('click', closeSidebar);
}
const sidebarBrandBtn = document.getElementById('sidebar-brand-btn');
if (sidebarBrandBtn) {
  sidebarBrandBtn.addEventListener('click', () => {
    if (window.innerWidth >= 768 && isSidebarMinimized) {
      toggleSidebar();
    }
  });
}
sidebarBackdrop.addEventListener('click', () => {
  sidebar.classList.remove('max-md:translate-x-0');
  sidebarBackdrop.style.display = 'none';
});

// Klik search box saat sidebar diminimize akan membuka sidebar dan fokus ke input
const historySearchBox = document.getElementById('history-search-box');
if (historySearchBox) {
  historySearchBox.addEventListener('click', () => {
    if (window.innerWidth >= 768 && isSidebarMinimized) {
      isSidebarMinimized = false;
      localStorage.setItem(SIDEBAR_MINIMIZED_KEY, '0');
      updateSidebarUI();
      setTimeout(() => historySearchInput.focus(), 300);
    }
  });
}

// Shortcut keyboard Ctrl+B / Cmd+B untuk minimize / buka sidebar
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
    e.preventDefault();
    toggleSidebar();
  }
});

// ============================================================
// INISIALISASI APLIKASI
// ============================================================
async function initApp() {
  loadSessionsFromStorage();

  try {
    const res = await fetch('/api/personas');
    const data = await res.json();
    personas = data.personas || [];
    defaultPersona = data.default || 'chatbot';

    personaSelect.innerHTML = '';
    personas.forEach((p) => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.label;
      personaSelect.appendChild(opt);
    });

    const healthRes = await fetch('/api/health');
    const healthData = await healthRes.json();
    if (healthData.model) {
      modelNameLabel.textContent = 'ChatBot AI';
    }
  } catch (e) {
    console.warn('Failed to load server info:', e);
  }

  const savedActiveId = localStorage.getItem(ACTIVE_SESSION_KEY);
  if (savedActiveId && sessions.some((s) => s.id === savedActiveId)) {
    activeSessionId = savedActiveId;
  } else if (sessions.length > 0) {
    activeSessionId = sessions[0].id;
  } else {
    createNewChat();
    return;
  }

  renderHistoryList();
  renderActiveChat();

  if (window.innerWidth >= 768) {
    isSidebarMinimized = localStorage.getItem(SIDEBAR_MINIMIZED_KEY) === '1';
    updateSidebarUI();
  }
}

initApp();

initApp();
