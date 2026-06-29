// Aegis AI Deep Focus Studio Scripts

// Web Audio API Synthesizer (compiled locally from audio.js utility)
let audioCtx = null;
let brownNoiseNode = null;
let leftOsc = null;
let rightOsc = null;
let masterGain = null;
let activeSoundType = 'none'; // 'none' | 'brown' | 'binaural'

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

function createBrownNoiseBuffer() {
  const bufferSize = 2 * audioCtx.sampleRate;
  const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const output = noiseBuffer.getChannelData(0);
  
  let lastOut = 0.0;
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    output[i] = (lastOut + (0.02 * white)) / 1.02;
    lastOut = output[i];
    output[i] *= 3.5;
  }
  return noiseBuffer;
}

function playBrownNoise(volume = 0.25) {
  try {
    initAudio();
    stopAudio();

    const noiseBuffer = createBrownNoiseBuffer();
    const noiseSource = audioCtx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 500;

    masterGain = audioCtx.createGain();
    masterGain.gain.setValueAtTime(volume, audioCtx.currentTime);

    noiseSource.connect(filter);
    filter.connect(masterGain);
    masterGain.connect(audioCtx.destination);

    noiseSource.start();
    brownNoiseNode = noiseSource;
    activeSoundType = 'brown';
  } catch (e) {
    console.error('Audio synthesizer error: ', e);
  }
}

function playBinauralBeats(volume = 0.15) {
  try {
    initAudio();
    stopAudio();

    masterGain = audioCtx.createGain();
    masterGain.gain.setValueAtTime(volume, audioCtx.currentTime);
    masterGain.connect(audioCtx.destination);

    // Left Ear: 200Hz
    leftOsc = audioCtx.createOscillator();
    leftOsc.type = 'sine';
    leftOsc.frequency.setValueAtTime(200, audioCtx.currentTime);

    const leftPanner = audioCtx.createStereoPanner();
    leftPanner.pan.setValueAtTime(-1, audioCtx.currentTime);

    // Right Ear: 210Hz (gives a 10Hz Alpha beat difference)
    rightOsc = audioCtx.createOscillator();
    rightOsc.type = 'sine';
    rightOsc.frequency.setValueAtTime(210, audioCtx.currentTime);

    const rightPanner = audioCtx.createStereoPanner();
    rightPanner.pan.setValueAtTime(1, audioCtx.currentTime);

    leftOsc.connect(leftPanner);
    leftPanner.connect(masterGain);

    rightOsc.connect(rightPanner);
    rightPanner.connect(masterGain);

    leftOsc.start();
    rightOsc.start();
    activeSoundType = 'binaural';
  } catch (e) {
    console.error('Audio synthesizer error: ', e);
  }
}

function stopAudio() {
  if (brownNoiseNode) {
    try { brownNoiseNode.stop(); } catch (e) {}
    brownNoiseNode = null;
  }
  if (leftOsc) {
    try { leftOsc.stop(); } catch (e) {}
    leftOsc = null;
  }
  if (rightOsc) {
    try { rightOsc.stop(); } catch (e) {}
    rightOsc = null;
  }
  activeSoundType = 'none';
}

function setAudioVolume(volume) {
  if (masterGain && audioCtx) {
    masterGain.gain.setValueAtTime(volume, audioCtx.currentTime);
  }
}

// Chime on Timer Completion
function playChimeAlert() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 1.2);
  } catch (e) {}
}


// Focus Timer Variables
let timerInterval = null;
let durationMinutes = 25;
let timeLeft = durationMinutes * 60;
let isTimerActive = false;
let activeTask = null;

window.loadDeepWork = async () => {
  const activeTaskId = sessionStorage.getItem('active_deepwork_task_id');
  const noTaskContainer = document.getElementById('no-task-focus-container');
  const activeRoomContainer = document.getElementById('active-focus-room-container');

  if (!activeRoomContainer) return;

  if (!activeTaskId) {
    noTaskContainer.style.display = 'flex';
    activeRoomContainer.style.display = 'none';
    await populateUncompletedTasksList();
  } else {
    try {
      const tasks = await window.api.getTasks();
      activeTask = tasks.find(t => t.id === activeTaskId);
      
      if (!activeTask || activeTask.completed) {
        sessionStorage.removeItem('active_deepwork_task_id');
        window.loadDeepWork();
        return;
      }

      noTaskContainer.style.display = 'none';
      activeRoomContainer.style.display = 'grid';

      document.getElementById('focus-task-title').textContent = activeTask.title;
      resetTimer();
      renderChecklist();
    } catch (e) {
      window.showToast("Failed to fetch task from backend.", "error");
    }
  }
};

async function populateUncompletedTasksList() {
  const list = document.getElementById('uncompleted-focus-task-list');
  if (!list) return;
  list.innerHTML = '';

  try {
    const tasks = await window.api.getTasks();
    const active = tasks.filter(t => !t.completed);

    if (active.length === 0) {
      list.innerHTML = `<p style="color: var(--text-muted); font-size: 0.85rem; text-align: center;">No pending tasks. Create one on the dashboard!</p>`;
      return;
    }

    const energy = await window.api.getEnergy();

    active.forEach(t => {
      const score = window.calculateFocusScore(t, energy);
      const btn = document.createElement('button');
      btn.className = 'btn';
      btn.style.width = '100%';
      btn.style.justifyContent = 'space-between';
      btn.style.padding = '0.8rem';
      
      btn.innerHTML = `
        <span>${t.title}</span>
        <span class="focus-badge" style="font-size: 0.7rem;">Score: ${score}</span>
      `;

      btn.addEventListener('click', () => {
        sessionStorage.setItem('active_deepwork_task_id', t.id);
        window.loadDeepWork();
      });

      list.appendChild(btn);
    });
  } catch (e) {
    window.showToast("Failed to connect to database.", "error");
  }
}

// Timer Render
function updateTimerDisplay() {
  const display = document.getElementById('timer-time-display');
  const m = Math.floor(timeLeft / 60);
  const s = timeLeft % 60;
  display.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

  // Circular ring offset calculation (Radius = 100, C = 628)
  const total = durationMinutes * 60;
  const progressCircle = document.getElementById('timer-progress-circle-node');
  if (progressCircle) {
    const offset = total > 0 ? 628 - (timeLeft / total) * 628 : 0;
    progressCircle.setAttribute('stroke-dashoffset', offset);
  }
}

function startTimer() {
  const toggleBtn = document.getElementById('timer-toggle-btn');
  const statusLabel = document.getElementById('timer-status-label');
  
  isTimerActive = true;
  toggleBtn.textContent = '⏸️ Pause';
  statusLabel.textContent = 'FOCUSING';

  timerInterval = setInterval(() => {
    if (timeLeft <= 1) {
      clearInterval(timerInterval);
      isTimerActive = false;
      toggleBtn.textContent = '▶️ Start Focus';
      statusLabel.textContent = 'PAUSED';
      timeLeft = 0;
      updateTimerDisplay();
      handleTimerComplete();
    } else {
      timeLeft -= 1;
      updateTimerDisplay();
    }
  }, 1000);
}

function pauseTimer() {
  const toggleBtn = document.getElementById('timer-toggle-btn');
  const statusLabel = document.getElementById('timer-status-label');
  
  isTimerActive = false;
  clearInterval(timerInterval);
  toggleBtn.textContent = '▶️ Start Focus';
  statusLabel.textContent = 'PAUSED';
}

function resetTimer() {
  pauseTimer();
  timeLeft = durationMinutes * 60;
  updateTimerDisplay();
}

function handleTimerComplete() {
  playChimeAlert();
  window.showToast("Focus block completed! Outstanding work.", "success");
}

// Checklist rendering
function renderChecklist() {
  const container = document.getElementById('focus-checklist-items');
  if (!container) return;
  container.innerHTML = '';

  if (!activeTask.subtasks || activeTask.subtasks.length === 0) {
    container.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; flex: 1; padding: 2rem; text-align: center;">
        <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 1rem;">No micro-tasks generated for this item yet.</p>
        <button class="btn btn-primary" style="font-size: 0.8rem;" id="generate-ai-subtasks-btn">🪄 Generate Checklist</button>
      </div>
    `;
    
    document.getElementById('generate-ai-subtasks-btn')?.addEventListener('click', generateAISubtasks);
    return;
  }

  activeTask.subtasks.forEach((st, idx) => {
    const div = document.createElement('div');
    div.className = `checklist-item ${st.completed ? 'completed' : ''}`;
    div.style.cursor = 'pointer';

    div.innerHTML = `
      <button class="checkbox-btn">
        ${st.completed ? '✓' : ''}
      </button>
      <span style="font-size: 0.85rem;">${st.text}</span>
    `;

    div.addEventListener('click', () => {
      toggleFocusSubtask(idx);
    });

    container.appendChild(div);
  });
}

// Generate checklists based on title
async function generateAISubtasks() {
  const list = breakDownGoal(activeTask.title);
  activeTask.subtasks = list;

  try {
    const tasks = await window.api.getTasks();
    const updated = tasks.map(t => (t.id === activeTask.id ? activeTask : t));
    await window.api.saveTasks(updated);
    window.showToast(`AI checklist generated with ${list.length} actionable items.`, "success");
    renderChecklist();
  } catch (e) {
    window.showToast("Failed to write subtasks checklist.", "error");
  }
}

async function toggleFocusSubtask(idx) {
  let subtaskCompleted = false;
  activeTask.subtasks = activeTask.subtasks.map((st, i) => {
    if (i === idx) {
      subtaskCompleted = !st.completed;
      return { ...st, completed: subtaskCompleted };
    }
    return st;
  });

  try {
    const tasks = await window.api.getTasks();
    const updated = tasks.map(t => (t.id === activeTask.id ? activeTask : t));
    await window.api.saveTasks(updated);
    window.showToast(subtaskCompleted ? "Subtask completed." : "Subtask restored.", subtaskCompleted ? "success" : "info");
    renderChecklist();
  } catch (e) {
    window.showToast("Failed to update checklist status.", "error");
  }
}

// Exit Deep focus session
function exitSession() {
  stopAudio();
  sessionStorage.removeItem('active_deepwork_task_id');
  window.loadDeepWork();
}

// Complete main task
async function completeActiveTask() {
  if (!activeTask) return;
  stopAudio();

  try {
    const tasks = await window.api.getTasks();
    const updated = tasks.map(t => (t.id === activeTask.id ? { ...t, completed: true } : t));
    await window.api.saveTasks(updated);

    window.showToast(`Task completed: ${activeTask.title}`, "success");
    sessionStorage.removeItem('active_deepwork_task_id');
    
    // Redirect to dashboard
    const username = window.location.pathname.split('/')[1] || 'guest';
    setTimeout(() => {
      window.location.href = `/${username}/index`;
    }, 1000);
  } catch (e) {
    window.showToast("Failed to mark task completed.", "error");
  }
}

// Subtask breakdown keywords match
function breakDownGoal(title) {
  const query = title.toLowerCase();
  if (query.includes('slide') || query.includes('deck') || query.includes('presentation')) {
    return [
      { text: 'Define key message & structure target narrative', completed: false },
      { text: 'Gather metrics, charts, and support data points', completed: false },
      { text: 'Draft text contents & outline slide-by-slide', completed: false },
      { text: 'Design layouts, select colors & icons', completed: false }
    ];
  }
  return [
    { text: 'Understand core objective', completed: false },
    { text: 'Draft first block outline', completed: false },
    { text: 'Execute main task logic', completed: false },
    { text: 'Review visual output', completed: false }
  ];
}

// Setup Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  const toggleBtn = document.getElementById('timer-toggle-btn');
  const resetBtn = document.getElementById('timer-reset-btn');
  const exitBtn = document.getElementById('exit-focus-session-btn');
  const completeBtn = document.getElementById('complete-main-task-btn');
  
  // Sound controls
  const soundMute = document.getElementById('sound-btn-none');
  const soundBrown = document.getElementById('sound-btn-brown');
  const soundBinaural = document.getElementById('sound-btn-binaural');
  const volumeSlider = document.getElementById('sound-volume-slider');
  const volumeContainer = document.getElementById('volume-slider-container');
  const volumeLabel = document.getElementById('sound-volume-percent-label');

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      if (isTimerActive) pauseTimer();
      else startTimer();
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', resetTimer);
  }

  if (exitBtn) {
    exitBtn.addEventListener('click', exitSession);
  }

  if (completeBtn) {
    completeBtn.addEventListener('click', completeActiveTask);
  }

  // Audio button options click
  const soundBtns = [soundMute, soundBrown, soundBinaural].filter(Boolean);
  soundBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      soundBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const sound = btn.getAttribute('data-sound');
      const vol = parseFloat(volumeSlider ? volumeSlider.value : 0.25);

      if (sound === 'none') {
        stopAudio();
        if (volumeContainer) volumeContainer.style.display = 'none';
        window.showToast("Ambient audio muted.", "info");
      } else if (sound === 'brown') {
        playBrownNoise(vol);
        if (volumeContainer) volumeContainer.style.display = 'flex';
        window.showToast("Synthesizing ocean wave focus sounds.", "info");
      } else if (sound === 'binaural') {
        playBinauralBeats(vol);
        if (volumeContainer) volumeContainer.style.display = 'flex';
        window.showToast("Synthesizing 10Hz Alpha binaural beats.", "info");
      }
    });
  });

  if (volumeSlider) {
    volumeSlider.addEventListener('input', (e) => {
      const vol = parseFloat(e.target.value);
      setAudioVolume(vol);
      if (volumeLabel) {
        volumeLabel.textContent = `${Math.round(vol * 200)}%`;
      }
    });
  }

  // Handle Tab exit cleanup
  window.addEventListener('beforeunload', stopAudio);

  // Initialize Deep Work views
  if (document.getElementById('focus-time-display') || document.getElementById('timer-time-display')) {
    window.loadDeepWork();
  }
});
