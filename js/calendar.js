// Aegis AI Calendar / Time-Blocking Scripts

window.loadCalendar = async () => {
  try {
    const tasks = await window.api.getTasks();
    const schedule = await window.api.getSchedule();

    // 1. Render Calendar Rows
    const gridBody = document.getElementById('calendar-grid-body');
    gridBody.innerHTML = '';

    const timeSlots = [];
    for (let h = 8; h <= 19.5; h += 0.5) {
      timeSlots.push(h);
    }

    timeSlots.forEach(slot => {
      const row = document.createElement('div');
      row.className = 'time-row';
      
      const label = document.createElement('div');
      row.appendChild(label);
      label.className = 'time-label';
      label.textContent = formatTime(slot);

      const content = document.createElement('div');
      content.className = 'time-slot-content';
      row.appendChild(content);

      // Check if slot matches the start of any scheduled block
      const activePrimaryBlock = schedule.find(b => slot >= b.startHour && slot < b.startHour + b.duration);
      if (activePrimaryBlock && slot === activePrimaryBlock.startHour) {
        const block = document.createElement('div');
        block.className = `scheduled-block ${activePrimaryBlock.category?.toLowerCase() || 'work'} ${activePrimaryBlock.locked ? 'locked' : ''}`;
        
        // Calculate height: duration * 2 slots * 3.5rem per row - padding adjustment
        block.style.height = `${activePrimaryBlock.duration * 2 * 3.5 - 0.5}rem`;
        block.style.position = 'absolute';
        block.style.top = '0.25rem';
        block.style.left = '0.25rem';
        block.style.right = '0.25rem';
        block.style.zIndex = '2';
        block.style.minHeight = '2.5rem';

        block.innerHTML = `
          <span class="block-title">${activePrimaryBlock.title}</span>
          <div class="block-meta">
            <span>${formatTime(activePrimaryBlock.startHour)} - ${formatTime(activePrimaryBlock.startHour + activePrimaryBlock.duration)}</span>
            ${activePrimaryBlock.locked ? '<span>🔒 Locked</span>' : `
              <button style="background: transparent; border: none; color: inherit; cursor: pointer; font-size: 0.85rem;" onclick="removeBlock('${activePrimaryBlock.id}')">✕</button>
            `}
          </div>
        `;
        content.appendChild(block);
      }

      gridBody.appendChild(row);
    });

    // 2. Render Unscheduled Sidebar
    const unscheduledList = document.getElementById('unscheduled-task-list');
    unscheduledList.innerHTML = '';

    const scheduledTaskIds = schedule.map(s => s.taskId).filter(Boolean);
    const unscheduled = tasks.filter(t => !t.completed && !scheduledTaskIds.includes(t.id));

    if (unscheduled.length === 0) {
      unscheduledList.innerHTML = `
        <p style="font-size: 0.8rem; color: var(--text-muted); text-align: center; padding: 1rem;">
          All active tasks scheduled!
        </p>
      `;
    } else {
      unscheduled.forEach(task => {
        const item = document.createElement('div');
        item.style.background = 'rgba(255, 255, 255, 0.02)';
        item.style.border = '1px solid var(--border-light)';
        item.style.borderRadius = '0.5rem';
        item.style.padding = '0.6rem';
        item.style.cursor = 'pointer';
        item.style.fontSize = '0.8rem';
        item.style.transition = 'border-color 0.2s ease';

        item.innerHTML = `
          <div style="font-weight: 600; color: #fff;">${task.title}</div>
          <div style="display: flex; justify-content: space-between; color: var(--text-secondary); margin-top: 0.25rem; font-size: 0.7rem;">
            <span>Category: ${task.category}</span>
            <span>Duration: ${task.duration}h</span>
          </div>
        `;

        item.addEventListener('click', () => {
          // Highlight selection
          unscheduledList.querySelectorAll('div').forEach(el => el.style.borderColor = 'var(--border-light)');
          item.style.borderColor = 'var(--accent-cyan)';
          revealManualForm(task);
        });

        unscheduledList.appendChild(item);
      });
    }

  } catch (e) {
    window.showToast("Failed to fetch schedule logs.", "error");
  }
};

// Float hour to time string, e.g. 13.5 -> "1:30 PM"
function formatTime(hour) {
  const hh = Math.floor(hour);
  const mm = hour % 1 === 0.5 ? '30' : '00';
  const ampm = hh >= 12 ? 'PM' : 'AM';
  const displayHour = hh > 12 ? hh - 12 : hh === 0 ? 12 : hh;
  return `${displayHour}:${mm} ${ampm}`;
}

// Reveal and populate manual scheduling form
let selectedTaskIdToSchedule = null;
function revealManualForm(task) {
  selectedTaskIdToSchedule = task.id;
  
  const form = document.getElementById('manual-schedule-form');
  const title = document.getElementById('manual-form-title');
  const select = document.getElementById('manual-time-select');

  title.textContent = `Schedule: ${task.title}`;
  select.innerHTML = '';

  // Generate selectable half-hourly start slots
  for (let slot = 8; slot <= 20 - task.duration; slot += 0.5) {
    const opt = document.createElement('option');
    opt.value = slot;
    opt.textContent = formatTime(slot);
    select.appendChild(opt);
  }

  form.style.display = 'flex';
}

document.addEventListener('DOMContentLoaded', async () => {
  const clearBtn = document.getElementById('clear-schedule-btn');
  const optimizeBtn = document.getElementById('optimize-schedule-btn');
  const cancelBtn = document.getElementById('manual-form-cancel-btn');
  const form = document.getElementById('manual-schedule-form');

  if (clearBtn) {
    clearBtn.addEventListener('click', async () => {
      try {
        const schedule = await window.api.getSchedule();
        const cleaned = schedule.filter(s => s.locked);
        await window.api.saveSchedule(cleaned);
        window.showToast("Cleared all automated time blocks.", "info");
        window.loadCalendar();
      } catch (err) {
        window.showToast("Error clearing blocks.", "error");
      }
    });
  }

  if (optimizeBtn) {
    optimizeBtn.addEventListener('click', triggerAIAutoSchedule);
  }

  if (cancelBtn && form) {
    cancelBtn.addEventListener('click', () => {
      form.style.display = 'none';
      selectedTaskIdToSchedule = null;
    });
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!selectedTaskIdToSchedule) return;

      try {
        const tasks = await window.api.getTasks();
        const schedule = await window.api.getSchedule();
        
        const task = tasks.find(t => t.id === selectedTaskIdToSchedule);
        if (!task) return;

        const startHour = parseFloat(document.getElementById('manual-time-select').value);
        const duration = task.duration;
        const endHour = startHour + duration;

        // Check scheduling overlaps
        const isOccupied = schedule.some(event => {
          const eventEnd = event.startHour + event.duration;
          return startHour < eventEnd && endHour > event.startHour;
        });

        if (isOccupied) {
          window.showToast("This block overlaps with an existing appointment.", "error");
          return;
        }

        const newBlock = {
          id: `manual-s-${Date.now()}`,
          taskId: task.id,
          title: task.title,
          startHour,
          duration,
          category: task.category,
          locked: false
        };

        schedule.push(newBlock);
        schedule.sort((a, b) => a.startHour - b.startHour);
        await window.api.saveSchedule(schedule);

        window.showToast("Time block added successfully.", "success");
        form.style.display = 'none';
        selectedTaskIdToSchedule = null;
        window.loadCalendar();
      } catch (err) {
        window.showToast("Failed to schedule block.", "error");
      }
    });
  }

  // Load calendar grid
  if (document.getElementById('calendar-grid-body')) {
    await window.loadCalendar();
    
    // Check if voice assistant initiated an auto-optimization redirect
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('optimize') === 'true') {
      // Clean query parameter from address bar
      const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
      window.history.replaceState({ path: cleanUrl }, '', cleanUrl);
      
      // Trigger optimizer
      setTimeout(() => {
        triggerAIAutoSchedule();
      }, 500);
    }
  }
});

// Inline onclick target
window.removeBlock = async (id) => {
  try {
    const schedule = await window.api.getSchedule();
    const updated = schedule.filter(b => b.id !== id);
    await window.api.saveSchedule(updated);
    window.showToast("Calendar block removed.", "info");
    window.loadCalendar();
  } catch (e) {
    window.showToast("Failed to remove calendar block.", "error");
  }
};

// Scheduler optimization logic (identical to taskEngine helper)
async function triggerAIAutoSchedule() {
  try {
    const tasks = await window.api.getTasks();
    const schedule = await window.api.getSchedule();

    const uncompletedTasks = tasks.filter(t => !t.completed);
    if (uncompletedTasks.length === 0) {
      window.showToast("You have no uncompleted tasks to schedule.", "info");
      return;
    }

    const energy = await window.api.getEnergy();
    const lockedEvents = schedule.filter(item => item.locked);
    
    // Sort uncompleted tasks by dynamic focus score
    const sortedTasks = uncompletedTasks
      .map(t => ({ ...t, focusScore: window.calculateFocusScore(t, energy) }))
      .sort((a, b) => b.focusScore - a.focusScore);

    const newSchedule = [...lockedEvents];
    const slotSize = 0.5;
    const startDay = 8.0;
    const endDay = 20.0;

    const isSlotOccupied = (start, duration) => {
      const end = start + duration;
      for (const event of newSchedule) {
        const eventEnd = event.startHour + event.duration;
        if (start < eventEnd && end > event.startHour) return true;
      }
      return false;
    };

    const getEnergyForHour = (hour) => {
      if (hour >= 9 && hour < 12) return 4.5;
      if (hour >= 12 && hour < 14) return 2.0;
      if (hour >= 14 && hour < 17) return 4.0;
      if (hour >= 17 && hour < 19) return 3.0;
      return 2.5;
    };

    for (const task of sortedTasks) {
      const duration = task.duration || 1.0;
      let bestSlot = -1;
      let highestSlotScore = -Infinity;

      for (let slot = startDay; slot <= endDay - duration; slot += slotSize) {
        if (!isSlotOccupied(slot, duration)) {
          const slotEnergy = getEnergyForHour(slot);
          const energyDiff = Math.abs(task.energy - slotEnergy);
          
          const timeDecay = (endDay - slot) * 0.1;
          const slotScore = (10 - energyDiff * 3) + timeDecay;

          if (slotScore > highestSlotScore) {
            highestSlotScore = slotScore;
            bestSlot = slot;
          }
        }
      }

      if (bestSlot !== -1) {
        newSchedule.push({
          id: `auto-s-${task.id}`,
          taskId: task.id,
          title: task.title,
          startHour: bestSlot,
          duration: duration,
          category: task.category,
          locked: false
        });
      }
    }

    newSchedule.sort((a, b) => a.startHour - b.startHour);
    await window.api.saveSchedule(newSchedule);

    const scheduledCount = newSchedule.length - lockedEvents.length;
    window.showToast(`Scheduled ${scheduledCount} tasks in your peak energy slots.`, "success");
    window.loadCalendar();
  } catch (err) {
    window.showToast("Failed to run schedule optimization.", "error");
  }
}
