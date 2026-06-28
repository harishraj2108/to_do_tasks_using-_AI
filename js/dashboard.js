// Aegis AI Dashboard Scripts

function buildDashboardStats(tasks, savedStats = {}) {
  const derivedPending = tasks.filter(task => !task.completed).length;
  const derivedFinished = tasks.filter(task => task.completed).length;

  const pending = Number.isFinite(savedStats?.pending) ? savedStats.pending : derivedPending;
  const finished = Number.isFinite(savedStats?.finished) ? savedStats.finished : derivedFinished;
  const total = pending + finished;
  const rate = total > 0 ? Math.round((finished / total) * 100) : 0;

  return { pending, rate, finished };
}

window.loadDashboard = async () => {
  try {
    const tasks = await window.api.getTasks();
    const energy = await window.api.getEnergy();
    const savedStats = await window.api.getDashboardStats();

    // Set Energy Slider active state
    const energyBtns = document.querySelectorAll('#energy-btns .energy-btn');
    energyBtns.forEach(btn => {
      const lvl = parseInt(btn.getAttribute('data-level'), 10);
      if (lvl === energy) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // 1. Calculate Scores and Sort
    const scoredTasks = tasks.map(task => ({
      ...task,
      focusScore: window.calculateFocusScore(task, energy)
    })).sort((a, b) => {
      if (a.completed !== b.completed) {
        return a.completed ? 1 : -1;
      }
      return b.focusScore - a.focusScore;
    });

    // 2. Render Statistics
    const stats = buildDashboardStats(scoredTasks, savedStats);

    document.getElementById('stats-pending').textContent = stats.pending;
    document.getElementById('stats-rate').textContent = `${stats.rate}%`;
    document.getElementById('stats-finished').textContent = stats.finished;

    if (!savedStats || savedStats.pending !== stats.pending || savedStats.finished !== stats.finished || savedStats.rate !== stats.rate) {
      await window.api.saveDashboardStats(stats);
    }

    // 3. Render AI Action Recommendation
    const activeTasks = scoredTasks.filter(t => !t.completed);
    const recTitle = document.getElementById('rec-title');
    const recDesc = document.getElementById('rec-desc');
    const recActionBtn = document.getElementById('rec-action-btn');

    if (activeTasks.length === 0) {
      recTitle.textContent = "All tasks completed!";
      recDesc.textContent = "You're fully caught up. Use this time to establish new habits or plan ahead.";
      recActionBtn.style.display = 'none';
    } else {
      const topTask = activeTasks[0];
      let recType = "Recommended Next Action";
      let recText = `Based on deadline proximity and energy, we recommend focusing on "${topTask.title}".`;

      if (energy <= 2) {
        const lowEnergyTask = activeTasks.find(t => t.energy <= 2);
        if (lowEnergyTask) {
          recType = "Low Energy Focus Match";
          recText = `You're feeling low energy. Let's knock out "${lowEnergyTask.title}" which takes less effort and keeps your momentum going.`;
          recActionBtn.setAttribute('data-task-id', lowEnergyTask.id);
        } else {
          recActionBtn.setAttribute('data-task-id', topTask.id);
        }
      } else if (energy >= 4 && topTask.energy >= 4) {
        recType = "Peak Performance Time";
        recText = `Your energy is high and "${topTask.title}" is urgent. This is the perfect window for deep focus work.`;
        recActionBtn.setAttribute('data-task-id', topTask.id);
      } else {
        recActionBtn.setAttribute('data-task-id', topTask.id);
      }

      recTitle.textContent = recType;
      recDesc.textContent = recText;
      recActionBtn.style.display = 'inline-flex';
    }

    // 4. Render Task Feed List
    const feedList = document.getElementById('task-feed-list');
    feedList.innerHTML = '';

    if (scoredTasks.length === 0) {
      feedList.innerHTML = `
        <p style="text-align: center; padding: 2rem; color: var(--text-muted);">
          Your task feed is empty. Add a task to begin!
        </p>
      `;
      return;
    }

    scoredTasks.forEach(task => {
      const remainingText = getRemainingTimeText(task.deadline);
      const isUrgent = new Date(task.deadline) - new Date() < 8 * 60 * 60 * 1000 && !task.completed;
      const subtaskDone = task.subtasks ? task.subtasks.filter(s => s.completed).length : 0;
      const subtaskTotal = task.subtasks ? task.subtasks.length : 0;

      const card = document.createElement('div');
      card.style.display = 'flex';
      card.style.flexDirection = 'column';

      let taskItemHtml = `
        <div class="task-card ${task.completed ? 'completed' : ''}" data-task-id="${task.id}">
          <div class="task-left">
            <button class="checkbox-btn" onclick="event.stopPropagation(); toggleTaskCompletion('${task.id}')">
              ${task.completed ? '✓' : ''}
            </button>
            <div class="task-details">
              <span class="task-title">${task.title}</span>
              <div class="task-meta">
                <span class="tag">${task.category}</span>
                <span>⏱️ ${task.duration}h</span>
                <span>⚡ Energy: ${task.energy}/5</span>
                <span class="${isUrgent ? 'text-red' : ''}">📅 ${remainingText}</span>
                ${subtaskTotal > 0 ? `<span class="subtask-counter">📋 ${subtaskDone}/${subtaskTotal}</span>` : ''}
              </div>
            </div>
          </div>
          <div class="task-right">
            ${!task.completed ? `<span class="focus-badge">Score: ${task.focusScore}</span>` : ''}
            ${!task.completed && subtaskTotal === 0 ? `
              <button class="quick-action-btn" title="AI Plan (Generate subtasks)" onclick="event.stopPropagation(); runAIBreakdown('${task.id}')">🪄</button>
            ` : ''}
            <button class="quick-action-btn text-red" title="Delete task" onclick="event.stopPropagation(); deleteTask('${task.id}')">✕</button>
          </div>
        </div>
      `;

      // Expandable checklist items
      const isExpanded = sessionStorage.getItem(`expanded_t_${task.id}`) === 'true';
      if (isExpanded && subtaskTotal > 0) {
        taskItemHtml += `
          <div style="margin-left: 2.5rem; margin-top: 0.25rem; margin-bottom: 0.75rem; padding: 0.75rem; border-left: 2px solid rgba(255, 255, 255, 0.05); background: rgba(255, 255, 255, 0.01); border-radius: 0 0 0.5rem 0.5rem; display: flex; flex-direction: column; gap: 0.5rem;">
            <p style="font-size: 0.75rem; color: var(--text-secondary); font-weight: 600; margin-bottom: 0.25rem;">Subtask Breakdown:</p>
            ${task.subtasks.map((st, idx) => `
              <div style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.8rem;">
                <button class="checkbox-btn" style="width: 1rem; height: 1rem; font-size: 0.5rem;" onclick="toggleSubtaskComplete('${task.id}', ${idx})">
                  ${st.completed ? '✓' : ''}
                </button>
                <span style="text-decoration: ${st.completed ? 'line-through' : 'none'}; color: ${st.completed ? 'var(--text-muted)' : 'var(--text-primary)'};">
                  ${st.text}
                </span>
              </div>
            `).join('')}
          </div>
        `;
      }

      card.innerHTML = taskItemHtml;

      // Expand toggle
      card.querySelector('.task-card').addEventListener('click', () => {
        if (subtaskTotal > 0) {
          const state = sessionStorage.getItem(`expanded_t_${task.id}`) === 'true';
          sessionStorage.setItem(`expanded_t_${task.id}`, !state);
          window.loadDashboard();
        }
      });

      feedList.appendChild(card);
    });
  } catch (e) {
    console.error(e);
    window.showToast("Failed to fetch tasks from backend server.", "error");
  }
};

// Relative deadline formatting helper
function getRemainingTimeText(deadlineStr) {
  const diffMs = new Date(deadlineStr) - new Date();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours < 0) return 'Overdue';
  if (diffHours < 1) return 'Within 1h';
  if (diffHours < 24) return `in ${Math.round(diffHours)}h`;
  return `in ${Math.round(diffHours / 24)}d`;
}

// Handler: energy buttons
document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('energy-btns');
  if (container) {
    container.addEventListener('click', async (e) => {
      const btn = e.target.closest('.energy-btn');
      if (!btn) return;
      const lvl = parseInt(btn.getAttribute('data-level'), 10);
      
      try {
        await window.api.saveEnergy(lvl);
        window.showToast(`Energy state set to ${lvl}/5. Recalculating priority.`, "info");
        window.loadDashboard();
      } catch (err) {
        window.showToast("Failed to update energy state.", "error");
      }
    });
  }

  // Recommendation action click
  const recActionBtn = document.getElementById('rec-action-btn');
  if (recActionBtn) {
    recActionBtn.addEventListener('click', (e) => {
      const taskId = recActionBtn.getAttribute('data-task-id');
      if (taskId) {
        sessionStorage.setItem('active_deepwork_task_id', taskId);
      }
    });
  }

  // Form submit handler: add task
  const form = document.getElementById('add-task-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const title = document.getElementById('task-title-input').value.trim();
      const category = document.getElementById('task-category-select').value;
      const deadlineDays = parseInt(document.getElementById('task-deadline-input').value, 10);
      const duration = parseFloat(document.getElementById('task-duration-input').value);
      const energy = parseInt(document.getElementById('task-energy-input').value, 10);
      
      const activePriorityBtn = document.querySelector('#priority-btn-group .btn.active');
      const priority = activePriorityBtn ? parseInt(activePriorityBtn.getAttribute('data-priority'), 10) : 3;

      if (!title) return;

      const deadlineDate = new Date(Date.now() + deadlineDays * 24 * 60 * 60 * 1000);
      const newTask = {
        id: `t-${Date.now()}`,
        title,
        priority,
        duration,
        energy,
        deadline: deadlineDate.toISOString(),
        category,
        completed: false,
        subtasks: []
      };

      try {
        const tasks = await window.api.getTasks();
        tasks.push(newTask);
        await window.api.saveTasks(tasks);
        
        window.showToast("Task added and prioritized.", "success");
        form.reset();
        
        // Reset priority group visual state to default 3
        document.querySelectorAll('#priority-btn-group .btn').forEach(b => {
          if (b.getAttribute('data-priority') === '3') b.classList.add('active');
          else b.classList.remove('active');
        });

        window.loadDashboard();
      } catch (err) {
        window.showToast("Failed to write new task.", "error");
      }
    });

    // Priority button selectors inside form
    const priorityGroup = document.getElementById('priority-btn-group');
    if (priorityGroup) {
      priorityGroup.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn');
        if (!btn) return;
        priorityGroup.querySelectorAll('.btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    }
  }

  // Load dashboard
  if (document.getElementById('task-feed-list')) {
    window.loadDashboard();
  }
});

// Window-scoped action callbacks (to trigger from inline onclicks)
window.toggleTaskCompletion = async (id) => {
  try {
    const currentTasks = await window.api.getTasks();
    let taskCompleted = false;
    const updatedTasks = currentTasks.map(task => {
      if (task.id === id) {
        taskCompleted = !task.completed;
        return { ...task, completed: taskCompleted };
      }
      return task;
    });

    await window.api.saveTasks(updatedTasks);

    const currentStats = await window.api.getDashboardStats();
    const prevPending = currentStats?.pending ?? currentTasks.filter(t => !t.completed).length;
    const prevFinished = currentStats?.finished ?? currentTasks.filter(t => t.completed).length;
    const nextStats = {
      pending: Math.max(prevPending + (taskCompleted ? -1 : 1), 0),
      finished: Math.max(prevFinished + (taskCompleted ? 1 : -1), 0),
      rate: 0
    };
    nextStats.rate = nextStats.finished + nextStats.pending > 0 ? Math.round((nextStats.finished / (nextStats.finished + nextStats.pending)) * 100) : 0;
    await window.api.saveDashboardStats(nextStats);

    window.showToast(taskCompleted ? "Task marked complete." : "Task restored.", taskCompleted ? "success" : "info");
    window.loadDashboard();
  } catch (e) {
    window.showToast("Failed to complete task.", "error");
  }
};

window.deleteTask = async (id) => {
  try {
    const currentTasks = await window.api.getTasks();
    const task = currentTasks.find(t => t.id === id);
    await window.api.deleteTask(id);

    const currentStats = await window.api.getDashboardStats();
    const nextStats = {
      pending: Math.max((currentStats?.pending ?? currentTasks.filter(t => !t.completed).length) - (task && !task.completed ? 1 : 0), 0),
      finished: currentStats?.finished ?? 0,
      rate: 0
    };
    nextStats.rate = nextStats.finished + nextStats.pending > 0 ? Math.round((nextStats.finished / (nextStats.finished + nextStats.pending)) * 100) : 0;
    await window.api.saveDashboardStats(nextStats);
    window.showToast("Task deleted from MongoDB.", "info");
    window.loadDashboard();
  } catch (e) {
    window.showToast("Failed to delete task.", "error");
  }
};

window.runAIBreakdown = async (id) => {
  try {
    const tasks = await window.api.getTasks();
    let subtasksCount = 0;
    const updated = tasks.map(t => {
      if (t.id === id) {
        const list = breakDownGoal(t.title);
        subtasksCount = list.length;
        return { ...t, subtasks: list };
      }
      return t;
    });
    await window.api.saveTasks(updated);
    sessionStorage.setItem(`expanded_t_${id}`, 'true');
    window.showToast(`AI checklist generated with ${subtasksCount} actionable items.`, "success");
    window.loadDashboard();
  } catch (e) {
    window.showToast("Failed to run AI breakdown.", "error");
  }
};

window.toggleSubtaskComplete = async (taskId, idx) => {
  try {
    const tasks = await window.api.getTasks();
    let subtaskCompleted = false;
    const updated = tasks.map(t => {
      if (t.id === taskId) {
        const subtasks = t.subtasks.map((st, i) => {
          if (i === idx) {
            subtaskCompleted = !st.completed;
            return { ...st, completed: subtaskCompleted };
          }
          return st;
        });
        return { ...t, subtasks };
      }
      return t;
    });
    await window.api.saveTasks(updated);
    window.showToast(subtaskCompleted ? "Subtask completed." : "Subtask restored.", subtaskCompleted ? "success" : "info");
    window.loadDashboard();
  } catch (e) {
    window.showToast("Failed to toggle subtask status.", "error");
  }
};

// Keyword goal breakdown planner (mock LLM logic matched from taskEngine)
function breakDownGoal(title) {
  const query = title.toLowerCase();
  
  if (query.includes('slide') || query.includes('deck') || query.includes('presentation') || query.includes('talk')) {
    return [
      { text: 'Define key message & structure target narrative', completed: false },
      { text: 'Gather metrics, charts, and support data points', completed: false },
      { text: 'Draft text contents & outline slide-by-slide', completed: false },
      { text: 'Design layouts, select colors & icons', completed: false },
      { text: 'Write conversational presenter notes', completed: false },
      { text: 'Rehearse delivery and time constraints twice', completed: false }
    ];
  }
  
  if (query.includes('code') || query.includes('app') || query.includes('website') || query.includes('dev') || query.includes('build')) {
    return [
      { text: 'Sketch UI layout & state flow diagram', completed: false },
      { text: 'Scaffold project components & stylesheets', completed: false },
      { text: 'Configure local storage db schema & utilities', completed: false },
      { text: 'Implement visual components and logic bindings', completed: false },
      { text: 'Test user flows, edge cases & exception bounds', completed: false },
      { text: 'Build production bundle and deploy', completed: false }
    ];
  }

  if (query.includes('workout') || query.includes('gym') || query.includes('health') || query.includes('fit')) {
    return [
      { text: 'Select exercise focus areas and target metrics', completed: false },
      { text: 'Time-block training sessions in main calendar', completed: false },
      { text: 'Pack gym bag, shake bottle, and select apparel', completed: false },
      { text: 'Execute scheduled workout routine & record weights', completed: false },
      { text: 'Complete dynamic stretches and log cool down', completed: false }
    ];
  }

  if (query.includes('report') || query.includes('write') || query.includes('paper') || query.includes('article') || query.includes('essay')) {
    return [
      { text: 'Conduct preliminary research & compile reference links', completed: false },
      { text: 'Write bullet outline of chapters or sections', completed: false },
      { text: 'Draft introduction and core thesis statement', completed: false },
      { text: 'Flesh out body sections with arguments & citations', completed: false },
      { text: 'Refine grammar, spelling, and transition flows', completed: false },
      { text: 'Format margins, exports, and submit final copy', completed: false }
    ];
  }

  return [
    { text: 'Formulate specific, measurable success criteria', completed: false },
    { text: 'Conduct initial research & collect key tools', completed: false },
    { text: 'Execute core task focus blocks (45 mins)', completed: false },
    { text: 'Review draft outcome & check for errors', completed: false },
    { text: 'Finalize output and document work summary', completed: false }
  ];
}
