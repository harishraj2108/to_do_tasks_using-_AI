// Aegis AI Common Client Script
const API_URL = '/api';

// Toast Notifications System
window.showToast = (message, type = 'info', duration = 4000) => {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const id = 'toast-' + Math.random().toString(36).substr(2, 9);
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.id = id;

  let icon = 'ℹ️';
  if (type === 'success') icon = '✅';
  if (type === 'error') icon = '❌';
  if (type === 'warning') icon = '⚠️';

  toast.innerHTML = `
    <div class="toast-icon">${icon}</div>
    <div class="toast-content">
      <div class="toast-message">${message}</div>
    </div>
  `;

  container.appendChild(toast);

  // Exit trigger
  setTimeout(() => {
    toast.classList.add('exiting');
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, duration - 300);
};

// REST API helper utilities
window.api = {
  getTasks: async () => {
    const res = await fetch(`${API_URL}/tasks`);
    return res.json();
  },
  saveTasks: async (tasks) => {
    await fetch(`${API_URL}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tasks)
    });
  },
  deleteTask: async (id) => {
    await fetch(`${API_URL}/tasks/${id}`, {
      method: 'DELETE'
    });
  },
  getHabits: async () => {
    const res = await fetch(`${API_URL}/habits`);
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(errorText || 'Failed to fetch habits.');
    }
    return res.json();
  },
  saveHabits: async (habits) => {
    const res = await fetch(`${API_URL}/habits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(habits)
    });
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(errorText || 'Failed to save habits.');
    }
  },
  getSchedule: async () => {
    const res = await fetch(`${API_URL}/schedule`);
    return res.json();
  },
  saveSchedule: async (schedule) => {
    await fetch(`${API_URL}/schedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(schedule)
    });
  },
  getEnergy: async () => {
    const res = await fetch(`${API_URL}/energy`);
    const data = await res.json();
    return data.energy;
  },
  saveEnergy: async (energy) => {
    await fetch(`${API_URL}/energy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ energy })
    });
  },
  getDashboardStats: async () => {
    try {
      const res = await fetch(`${API_URL}/dashboard-stats`);
      if (!res.ok) {
        return { pending: 0, rate: 0, finished: 0 };
      }
      return res.json();
    } catch (err) {
      return { pending: 0, rate: 0, finished: 0 };
    }
  },
  saveDashboardStats: async (stats) => {
    try {
      await fetch(`${API_URL}/dashboard-stats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(stats)
      });
    } catch (err) {
      // Ignore stats persistence failures so the dashboard stays usable.
    }
  },
  getChatHistory: async () => {
    const res = await fetch(`${API_URL}/chat`);
    return res.json();
  },
  sendChatMessage: async (message) => {
    const localDate = new Date().toISOString().split('T')[0];
    const res = await fetch(`${API_URL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, localDate })
    });
    return res.json();
  },
  clearChatHistory: async () => {
    const res = await fetch(`${API_URL}/chat`, {
      method: 'DELETE'
    });
    return res.json();
  },
  resetAll: async () => {
    await fetch(`${API_URL}/reset`, { method: 'POST' });
    window.location.reload();
  }
};

// Task Score Calculation Helper
window.calculateFocusScore = (task, currentEnergy = 3) => {
  if (task.completed) return 0;

  const now = new Date();
  const deadlineDate = new Date(task.deadline);
  const timeRemainingMs = deadlineDate - now;
  const timeRemainingHours = timeRemainingMs / (1000 * 60 * 60);

  let urgencyScore = 0;
  if (timeRemainingHours <= 0) {
    urgencyScore = 100 + Math.abs(timeRemainingHours) * 10;
  } else if (timeRemainingHours <= 2) {
    urgencyScore = 80 + (2 - timeRemainingHours) * 10;
  } else if (timeRemainingHours <= 8) {
    urgencyScore = 50 + (8 - timeRemainingHours) * 4;
  } else if (timeRemainingHours <= 24) {
    urgencyScore = 30 + (24 - timeRemainingHours) * 0.8;
  } else if (timeRemainingHours <= 72) {
    urgencyScore = 15 + (72 - timeRemainingHours) * 0.2;
  } else {
    urgencyScore = Math.max(0, 10 - (timeRemainingHours - 72) * 0.05);
  }

  const importanceScore = task.priority * 8;

  let energyMatchScore = 0;
  const energyDiff = Math.abs(task.energy - currentEnergy);
  
  if (currentEnergy >= 4 && task.energy >= 4) {
    energyMatchScore = 15;
  } else if (currentEnergy <= 2 && task.energy >= 4) {
    energyMatchScore = -15;
  } else if (currentEnergy <= 2 && task.energy <= 2) {
    energyMatchScore = 10;
  } else {
    energyMatchScore = Math.max(0, 8 - energyDiff * 3);
  }

  const rawScore = importanceScore + urgencyScore + energyMatchScore;
  return Math.max(1, parseFloat(rawScore.toFixed(1)));
};

// AI assistant side drawer toggle
document.addEventListener('DOMContentLoaded', () => {
  const toggleBtn = document.getElementById('ai-toggle-btn');
  const closeBtn = document.getElementById('ai-panel-close-btn');
  const panel = document.getElementById('ai-panel');

  if (toggleBtn && panel) {
    toggleBtn.addEventListener('click', () => {
      panel.classList.toggle('open');
    });
  }

  if (closeBtn && panel) {
    closeBtn.addEventListener('click', () => {
      panel.classList.remove('open');
    });
  }

  initAIAssistant();
  setupProfileModal();
});

// AI Assistant Chat & Speech Input logic
function initAIAssistant() {
  const container = document.getElementById('ai-messages-container');
  const form = document.getElementById('ai-chat-form');
  const input = document.getElementById('ai-chat-input');
  const micBtn = document.getElementById('ai-mic-btn');

  if (!container) return;

  // Inject Clear Chat button in the header if not already present
  const header = document.querySelector('.ai-assistant-panel .ai-header');
  if (header && !document.getElementById('ai-clear-btn')) {
    const closeBtn = document.getElementById('ai-panel-close-btn');
    
    const clearBtn = document.createElement('button');
    clearBtn.id = 'ai-clear-btn';
    clearBtn.title = 'Clear chat history';
    clearBtn.style.cssText = 'background: transparent; border: none; cursor: pointer; font-size: 0.75rem; color: var(--text-muted); margin-right: 0.5rem; display: flex; align-items: center; gap: 0.25rem; transition: color 0.2s;';
    clearBtn.innerHTML = '🗑️ <span>Clear</span>';
    
    clearBtn.onmouseover = () => clearBtn.style.color = 'var(--accent-red)';
    clearBtn.onmouseout = () => clearBtn.style.color = 'var(--text-muted)';
    
    header.insertBefore(clearBtn, closeBtn);
    
    clearBtn.addEventListener('click', async () => {
      if (confirm("Are you sure you want to clear your conversation history?")) {
        try {
          const res = await window.api.clearChatHistory();
          if (res.success) {
            chatHistory = [{
              sender: 'assistant',
              text: "Greetings. I am Aegis, your proactive productivity companion. Feel free to talk to me or ask for help scheduling."
            }];
            renderHistory();
            window.showToast("Conversation history cleared.", "success");
          }
        } catch (err) {
          window.showToast("Failed to clear chat logs.", "error");
        }
      }
    });
  }

  let chatHistory = [];

  const renderHistory = () => {
    container.innerHTML = '';
    chatHistory.forEach(msg => {
      const bubble = document.createElement('div');
      bubble.className = `ai-message ${msg.sender}`;
      bubble.textContent = msg.text;
      container.appendChild(bubble);
    });
    container.scrollTop = container.scrollHeight;
  };

  const loadHistory = async () => {
    try {
      chatHistory = await window.api.getChatHistory();
      renderHistory();
    } catch (err) {
      console.error("Failed to load chat history:", err);
      chatHistory = [{
        sender: 'assistant',
        text: "Greetings. I am Aegis, your proactive productivity companion. Feel free to talk to me or ask for help scheduling."
      }];
      renderHistory();
    }
  };

  loadHistory();

  // Setup browser Speech Recognition
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognizer = null;
  let isListening = false;

  if (SpeechRecognition) {
    recognizer = new SpeechRecognition();
    recognizer.continuous = false;
    recognizer.lang = 'en-US';

    recognizer.onstart = () => {
      isListening = true;
      micBtn.classList.add('listening');
      window.showToast("Voice assistant listening...", "info");
    };

    recognizer.onerror = () => {
      isListening = false;
      micBtn.classList.remove('listening');
      window.showToast("Voice recognition failed. Try again.", "error");
    };

    recognizer.onend = () => {
      isListening = false;
      micBtn.classList.remove('listening');
    };

    recognizer.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      processVoiceCommand(transcript);
    };
  }

  if (micBtn) {
    micBtn.addEventListener('click', () => {
      if (!recognizer) {
        window.showToast("Speech recognition is not supported in this browser.", "warning");
        return;
      }
      if (isListening) {
        recognizer.stop();
      } else {
        recognizer.start();
      }
    });
  }

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!input.value.trim()) return;
      const text = input.value.trim();
      input.value = '';
      processVoiceCommand(text);
    });
  }

  const processVoiceCommand = async (commandText) => {
    chatHistory.push({ sender: 'user', text: commandText });
    renderHistory();

    const loaderBubble = document.createElement('div');
    loaderBubble.className = 'ai-message assistant';
    loaderBubble.textContent = '...';
    container.appendChild(loaderBubble);
    container.scrollTop = container.scrollHeight;

    try {
      const result = await window.api.sendChatMessage(commandText);
      loaderBubble.remove();

      chatHistory.push({ sender: 'assistant', text: result.reply });
      renderHistory();

      if (result.action) {
        const { type, data } = result.action;
        
        if (type === 'add_task') {
          window.showToast(`Task "${data.title}" added to your focus list.`, "success");
          if (window.loadDashboard) window.loadDashboard();
          if (window.loadCalendar) window.loadCalendar();
        } 
        else if (type === 'optimize_schedule') {
          window.showToast("Initiating schedule optimization...", "info");
          const username = window.location.pathname.split('/')[1] || 'guest';
          setTimeout(() => {
            window.location.href = `/${username}/calendar?optimize=true`;
          }, 1200);
        }
        else if (type === 'start_focus') {
          window.showToast(`Starting deep focus session for "${data.taskTitle}"...`, "info");
          if (result.action.taskId) {
            sessionStorage.setItem('active_deepwork_task_id', result.action.taskId);
          } else {
            sessionStorage.setItem('active_deepwork_task_title', data.taskTitle);
          }
          const username = window.location.pathname.split('/')[1] || 'guest';
          setTimeout(() => {
            window.location.href = `/${username}/deepwork`;
          }, 1200);
        }
        else if (type === 'view_habits') {
          window.showToast("Navigating to Habit Loops manager...", "info");
          const username = window.location.pathname.split('/')[1] || 'guest';
          setTimeout(() => {
            window.location.href = `/${username}/habits`;
          }, 1000);
        }
        else if (type === 'add_schedule') {
          window.showToast(`Calendar block "${data.title}" scheduled successfully.`, "success");
          if (window.loadCalendar) window.loadCalendar();
          if (window.loadDashboard) window.loadDashboard();
        }
      }
    } catch (e) {
      console.error(e);
      loaderBubble.remove();
      const bubble = document.createElement('div');
      bubble.className = 'ai-message assistant';
      bubble.textContent = "Apologies, I encountered an issue connecting to my core processor.";
      container.appendChild(bubble);
      container.scrollTop = container.scrollHeight;
    }
  };
}

function setupProfileModal() {
  const profileCard = document.querySelector('.user-profile');
  if (!profileCard) return;

  profileCard.style.cursor = 'pointer';
  profileCard.title = 'View profile details';
  
  profileCard.addEventListener('mouseenter', () => {
    profileCard.style.background = 'rgba(255, 255, 255, 0.05)';
  });
  profileCard.addEventListener('mouseleave', () => {
    profileCard.style.background = 'transparent';
  });

  profileCard.addEventListener('click', async () => {
    try {
      const res = await fetch('/api/profile');
      if (!res.ok) {
        window.showToast("Failed to fetch profile details.", "error");
        return;
      }
      const data = await res.json();
      if (data.success) {
        showProfileModal(data.user);
      }
    } catch (err) {
      window.showToast("Network error loading profile.", "error");
    }
  });
}

function showProfileModal(user) {
  let modal = document.getElementById('profile-details-modal');
  if (modal) modal.remove();

  modal = document.createElement('div');
  modal.id = 'profile-details-modal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(2, 6, 23, 0.7);
    backdrop-filter: blur(8px);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 0.3s ease;
  `;

  const initial = user.fullname ? user.fullname.charAt(0).toUpperCase() : 'U';

  modal.innerHTML = `
    <div class="glass-card" style="
      width: 100%;
      max-width: 400px;
      padding: 2.5rem 2rem;
      text-align: center;
      position: relative;
      transform: translateY(20px);
      transition: transform 0.3s ease;
      box-shadow: 0 20px 40px rgba(0,0,0,0.5);
      border: 1px solid var(--border-light);
    ">
      <button id="profile-modal-close" style="
        position: absolute;
        top: 1rem;
        right: 1.25rem;
        background: transparent;
        border: none;
        color: var(--text-secondary);
        font-size: 1.2rem;
        cursor: pointer;
      ">✕</button>

      <div style="
        width: 4.5rem;
        height: 4.5rem;
        border-radius: 50%;
        background: linear-gradient(135deg, var(--accent-cyan), var(--accent-indigo));
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 2rem;
        font-weight: 700;
        color: #fff;
        margin: 0 auto 1.5rem;
        box-shadow: 0 0 20px rgba(6, 182, 212, 0.3);
      ">${initial}</div>

      <h2 style="font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 1.3rem; color: #fff; margin-bottom: 0.25rem; line-height: 1.2;">
        ${user.fullname}
      </h2>
      <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 2rem;">
        ${user.email}
      </p>

      <div style="display: flex; flex-direction: column; gap: 0.75rem;">
        <a href="/logout" class="btn btn-primary" style="justify-content: center; background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.25); color: #fca5a5;">
          Log Out Account
        </a>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  setTimeout(() => {
    modal.style.opacity = '1';
    modal.querySelector('.glass-card').style.transform = 'translateY(0)';
  }, 50);

  const closeModal = () => {
    modal.style.opacity = '0';
    modal.querySelector('.glass-card').style.transform = 'translateY(20px)';
    setTimeout(() => {
      modal.remove();
    }, 300);
  };

  modal.querySelector('#profile-modal-close').addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
}
