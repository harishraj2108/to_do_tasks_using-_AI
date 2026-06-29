// Aegis AI Calendar / Time-Blocking Scripts

let currentNavDate = new Date(); // Tracks month/year displayed on the monthly calendar
let currentSelectedDate = new Date().toISOString().split('T')[0]; // Tracks active daily date (YYYY-MM-DD)

window.loadCalendar = async () => {
  try {
    const tasks = await window.api.getTasks();
    const schedule = await window.api.getSchedule();

    // 1. Render Month Calendar
    renderMonthCalendar(schedule);

    // Update Header Date Label to display active date
    const headerP = document.querySelector('.header-title-section p');
    if (headerP) {
      const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
      const displayDate = new Date(currentSelectedDate + 'T00:00:00').toLocaleDateString('en-US', options);
      headerP.textContent = `Schedule details for ${displayDate}`;
    }

    // 2. Render Calendar Rows (24-Hour Cycle)
    const gridBody = document.getElementById('calendar-grid-body');
    gridBody.innerHTML = '';

    const timeSlots = [];
    for (let h = 0; h < 24; h += 0.5) {
      timeSlots.push(h);
    }

    // Filter schedule blocks specifically for the selected date
    const dailyBlocks = schedule.filter(b => b.date === currentSelectedDate);

    // Overlap helper: returns all blocks overlapping with blockA
    const getOverlappingBlocks = (blockA, list) => {
      return list.filter(blockB => {
        const endA = blockA.startHour + blockA.duration;
        const endB = blockB.startHour + blockB.duration;
        return blockA.startHour < endB && endA > blockB.startHour;
      });
    };

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

      // Render blocks starting exactly at this half-hour slot
      const startingBlocks = dailyBlocks.filter(b => b.startHour === slot);
      
      startingBlocks.forEach(b => {
        const block = document.createElement('div');
        
        // Dynamic overlap alignment math
        const group = getOverlappingBlocks(b, dailyBlocks).sort((x, y) => x.startHour - y.startHour || x.id.localeCompare(y.id));
        const N = group.length;
        const index = group.findIndex(x => x.id === b.id);
        const isCoinciding = N > 1;
        
        block.className = `scheduled-block ${b.category?.toLowerCase() || 'work'} ${b.locked ? 'locked' : ''} ${isCoinciding ? 'coinciding' : ''}`;
        
        // Calculate height based on duration: duration * 2 rows * 3.5rem per row - padding adjustment
        block.style.height = `${b.duration * 2 * 3.5 - 0.5}rem`;
        block.style.position = 'absolute';
        block.style.top = '0.25rem';
        block.style.left = `calc(${(index * 100) / N}% + 0.25rem)`;
        block.style.right = `calc(${((N - 1 - index) * 100) / N}% + 0.25rem)`;
        block.style.zIndex = '2';
        block.style.minHeight = '2.5rem';

        block.innerHTML = `
          <span class="block-title" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: calc(100% - 1.5rem); display: inline-block;">
            ${isCoinciding ? '⚠️ ' : ''}${b.title}
          </span>
          <div class="block-meta">
            <span>${formatTime(b.startHour)} - ${formatTime(b.startHour + b.duration)}</span>
            ${b.locked ? '<span>🔒 Locked</span>' : `
              <button style="background: transparent; border: none; color: inherit; cursor: pointer; font-size: 0.85rem;" onclick="removeBlock('${b.id}')">✕</button>
            `}
          </div>
        `;
        content.appendChild(block);
      });

      gridBody.appendChild(row);
    });

    // 3. Render Unscheduled Sidebar
    const unscheduledList = document.getElementById('unscheduled-task-list');
    unscheduledList.innerHTML = '';

    // A task is scheduled if it has a block on ANY date
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
          unscheduledList.querySelectorAll('div').forEach(el => el.style.borderColor = 'var(--border-light)');
          item.style.borderColor = 'var(--accent-cyan)';
          revealManualForm(task);
        });

        unscheduledList.appendChild(item);
      });
    }

  } catch (e) {
    console.error(e);
    window.showToast("Failed to fetch schedule logs.", "error");
  }
};

// Render Month Calendar Grid
function renderMonthCalendar(schedule) {
  const monthDaysGrid = document.getElementById('month-days-grid');
  const monthYearLabel = document.getElementById('month-year-label');
  if (!monthDaysGrid || !monthYearLabel) return;

  monthDaysGrid.innerHTML = '';
  
  const year = currentNavDate.getFullYear();
  const month = currentNavDate.getMonth();
  
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  monthYearLabel.textContent = `${monthNames[month]} ${year}`;

  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();

  // Empty cells padding
  for (let i = 0; i < firstDayIndex; i++) {
    const emptyCell = document.createElement('div');
    monthDaysGrid.appendChild(emptyCell);
  }

  // Days rendering
  for (let d = 1; d <= totalDays; d++) {
    const dayCell = document.createElement('button');
    dayCell.type = 'button';
    dayCell.style.cssText = `
      position: relative;
      background: transparent;
      border: none;
      color: var(--text-primary);
      aspect-ratio: 1;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
      font-size: 0.75rem;
    `;

    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    dayCell.textContent = d;

    if (dateStr === currentSelectedDate) {
      dayCell.style.background = 'rgba(6, 182, 212, 0.2)';
      dayCell.style.border = '1.5px solid var(--accent-cyan)';
      dayCell.style.color = '#fff';
      dayCell.style.fontWeight = '700';
    } else {
      dayCell.onmouseover = () => dayCell.style.background = 'rgba(255, 255, 255, 0.05)';
      dayCell.onmouseout = () => dayCell.style.background = 'transparent';
    }

    // Check if this date has any schedules
    const hasSchedules = schedule.some(b => b.date === dateStr);
    if (hasSchedules) {
      const redDot = document.createElement('span');
      redDot.style.cssText = `
        width: 4px;
        height: 4px;
        background: var(--accent-red);
        border-radius: 50%;
        position: absolute;
        bottom: 3px;
        left: 50%;
        transform: translateX(-50%);
      `;
      dayCell.appendChild(redDot);
    }

    dayCell.addEventListener('click', () => {
      currentSelectedDate = dateStr;
      window.loadCalendar();
    });

    monthDaysGrid.appendChild(dayCell);
  }
}

// Float hour to time string, e.g. 13.5 -> "1:30 PM", 0.0 -> "12:00 AM"
function formatTime(hour) {
  const hh = Math.floor(hour);
  const mm = hour % 1 === 0.5 ? '30' : '00';
  const ampm = hh >= 24 ? 'AM' : hh >= 12 ? 'PM' : 'AM';
  const displayHour = hh > 12 ? (hh > 24 ? hh - 24 : hh - 12) : hh === 0 ? 12 : hh;
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

  // Generate selectable half-hourly start slots spanning the 24-hour cycle
  for (let slot = 0; slot <= 24 - task.duration; slot += 0.5) {
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

  const prevBtn = document.getElementById('prev-month-btn');
  const nextBtn = document.getElementById('next-month-btn');

  if (prevBtn) {
    prevBtn.addEventListener('click', async () => {
      currentNavDate.setMonth(currentNavDate.getMonth() - 1);
      const schedule = await window.api.getSchedule();
      renderMonthCalendar(schedule);
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', async () => {
      currentNavDate.setMonth(currentNavDate.getMonth() + 1);
      const schedule = await window.api.getSchedule();
      renderMonthCalendar(schedule);
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', async () => {
      try {
        const schedule = await window.api.getSchedule();
        // Clear only unlocked blocks on the selected date
        const cleaned = schedule.filter(s => s.date !== currentSelectedDate || s.locked);
        await window.api.saveSchedule(cleaned);
        window.showToast("Cleared automated time blocks for this date.", "info");
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
        
        // Add manual block for selected date
        const newBlock = {
          id: `manual-s-${Date.now()}`,
          taskId: task.id,
          title: task.title,
          date: currentSelectedDate,
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

  if (document.getElementById('calendar-grid-body')) {
    await window.loadCalendar();
    
    // Check if voice assistant initiated an auto-optimization redirect
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('optimize') === 'true') {
      const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
      window.history.replaceState({ path: cleanUrl }, '', cleanUrl);
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

// Scheduler optimization logic for current date
async function triggerAIAutoSchedule() {
  try {
    const tasks = await window.api.getTasks();
    const schedule = await window.api.getSchedule();

    const energy = await window.api.getEnergy();

    // Clear unlocked blocks on current date
    const lockedEvents = schedule.filter(s => s.date !== currentSelectedDate || s.locked);
    
    // Uncompleted tasks not scheduled on any date
    const scheduledTaskIds = lockedEvents.map(s => s.taskId).filter(Boolean);
    const uncompletedTasks = tasks.filter(t => !t.completed && !scheduledTaskIds.includes(t.id));

    if (uncompletedTasks.length === 0) {
      window.showToast("No uncompleted tasks to schedule.", "info");
      return;
    }

    const sortedTasks = uncompletedTasks
      .map(t => ({ ...t, focusScore: window.calculateFocusScore(t, energy) }))
      .sort((a, b) => b.focusScore - a.focusScore);

    const newSchedule = [...lockedEvents];
    const slotSize = 0.5;
    const startDay = 0.0;
    const endDay = 24.0;

    const isSlotOccupied = (start, duration) => {
      const end = start + duration;
      // check overlap specifically on this date
      for (const event of newSchedule) {
        if (event.date !== currentSelectedDate) continue;
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
          date: currentSelectedDate,
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
    window.showToast(`Auto-scheduled ${scheduledCount} tasks on this date.`, "success");
    window.loadCalendar();
  } catch (err) {
    console.error(err);
    window.showToast("Failed to run schedule optimization.", "error");
  }
}
