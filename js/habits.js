// Aegis AI Habits Scripts

window.loadHabits = async () => {
  const grid = document.getElementById('habits-cards-grid');
  if (!grid) return;
  grid.innerHTML = '';

  try {
    const habits = await window.api.getHabits();

    if (habits.length === 0) {
      grid.innerHTML = `
        <p style="text-align: center; padding: 2rem; color: var(--text-muted); width: 100%;">
          No habits defined yet. Establish one using the panel on the right!
        </p>
      `;
      return;
    }

    habits.forEach(habit => {
      // Radial ring offset calculation (Radius = 40, Circumference = 251.2)
      const offset = habit.completedToday ? 0 : 251.2;

      const card = document.createElement('div');
      card.className = 'glass-card habit-card';

      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; width: 100%; align-items: flex-start;">
          <div style="text-align: left;">
            <h3>${habit.name}</h3>
            <p class="habit-micro">Fallback: ${habit.microHabit}</p>
          </div>
          <button class="quick-action-btn text-red" onclick="deleteHabit('${habit.id}')" style="padding: 0;">✕</button>
        </div>

        <div class="habit-ring-container">
          <svg width="100" height="100" class="habit-ring-svg">
            <circle cx="50" cy="50" r="40" class="habit-ring-bg" />
            <circle cx="50" cy="50" r="40" class="habit-ring-progress" 
              stroke-dashoffset="${offset}"
              style="stroke: ${habit.safeguarded ? 'var(--accent-indigo)' : 'var(--accent-green)'}; 
                     filter: ${habit.completedToday ? (habit.safeguarded ? 'drop-shadow(0 0 5px rgba(99, 102, 241, 0.4))' : 'drop-shadow(0 0 5px rgba(16, 185, 129, 0.4))') : 'none'}" />
          </svg>
          <div class="habit-streak-display">
            <span class="habit-streak-count">${habit.streak}d</span>
            <span class="habit-streak-label">Streak</span>
          </div>
        </div>

        <div class="habit-actions">
          <button class="btn ${habit.completedToday ? 'btn-primary' : ''}" 
            style="width: 100%; justify-content: center; 
                   background: ${habit.completedToday ? (habit.safeguarded ? 'linear-gradient(135deg, var(--accent-indigo) 0%, var(--accent-purple) 100%)' : 'linear-gradient(135deg, var(--accent-green) 0%, #059669 100%)') : 'rgba(255, 255, 255, 0.03)'};
                   border-color: ${habit.completedToday ? 'transparent' : 'var(--border-light)'};
                   color: #fff;"
            onclick="checkHabit('${habit.id}')">
            ${habit.completedToday ? (habit.safeguarded ? '🛡️ Safeguarded' : '✓ Completed Today') : 'Mark Done'}
          </button>
          
          ${!habit.completedToday ? `
            <button class="btn" 
              style="width: 100%; justify-content: center; font-size: 0.8rem; background: rgba(99, 102, 241, 0.08); border-color: rgba(99, 102, 241, 0.2); color: #c7d2fe;"
              onclick="activateSafeguard('${habit.id}')">
              🛡️ Activate AI Safeguard
            </button>
          ` : ''}
        </div>

        ${habit.completedToday && habit.safeguarded ? `
          <span class="safeguard-note" style="margin-top: 0.5rem;">
            * Streak preserved via micro-habit
          </span>
        ` : ''}
      `;

      grid.appendChild(card);
    });
  } catch (e) {
    console.error("Failed to fetch habits list:", e);
    window.showToast(`Failed to fetch habits list: ${e.message}`, "error");
  }
};

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('add-habit-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const name = document.getElementById('habit-name-input').value.trim();
      const microHabit = document.getElementById('habit-micro-input').value.trim();

      if (!name || !microHabit) return;

      const newHabit = {
        id: `h-${Date.now()}`,
        name,
        streak: 0,
        lastChecked: null,
        completedToday: false,
        microHabit
      };

      try {
        const habits = await window.api.getHabits();
        habits.push(newHabit);
        await window.api.saveHabits(habits);

        window.showToast(`Habit loop established: ${newHabit.name}`, "success");
        form.reset();
        window.loadHabits();
      } catch (err) {
        console.error("Failed to create habit loop:", err);
        window.showToast(`Failed to create habit loop: ${err.message}`, "error");
      }
    });
  }

  // Load habits
  if (document.getElementById('habits-cards-grid')) {
    window.loadHabits();
  }
});

// Inline onclick targets
window.checkHabit = async (id) => {
  try {
    const habits = await window.api.getHabits();
    const todayStr = new Date().toISOString().split('T')[0];
    let isChecking = false;
    let habitName = "";
    let finalStreak = 0;

    const updated = habits.map(h => {
      if (h.id === id) {
        isChecking = !h.completedToday;
        habitName = h.name;
        finalStreak = isChecking ? h.streak + 1 : Math.max(0, h.streak - 1);
        
        return {
          ...h,
          completedToday: isChecking,
          streak: finalStreak,
          lastChecked: isChecking ? todayStr : null,
          safeguarded: isChecking ? h.safeguarded : false
        };
      }
      return h;
    });

    await window.api.saveHabits(updated);
    window.showToast(
      isChecking ? `Streak active: ${finalStreak} days for ${habitName}!` : `Streak reset for ${habitName}.`,
      isChecking ? "success" : "info"
    );
    window.loadHabits();
  } catch (e) {
    console.error("Failed to update habit status:", e);
    window.showToast(`Failed to update habit status: ${e.message}`, "error");
  }
};

window.activateSafeguard = async (id) => {
  try {
    const habits = await window.api.getHabits();
    const todayStr = new Date().toISOString().split('T')[0];
    let habitName = "";
    let finalStreak = 0;

    const updated = habits.map(h => {
      if (h.id === id) {
        if (h.completedToday) return h;
        finalStreak = h.streak + 1;
        habitName = h.name;

        return {
          ...h,
          completedToday: true,
          streak: finalStreak,
          lastChecked: todayStr,
          safeguarded: true
        };
      }
      return h;
    });

    await window.api.saveHabits(updated);
    window.showToast(`AI Safeguard: Streak preserved for ${habitName}!`, "success");
    window.loadHabits();
  } catch (e) {
    console.error("Failed to activate safeguard fallback:", e);
    window.showToast(`Failed to activate safeguard fallback: ${e.message}`, "error");
  }
};

window.deleteHabit = async (id) => {
  try {
    const habits = await window.api.getHabits();
    const habit = habits.find(h => h.id === id);
    const updated = habits.filter(h => h.id !== id);
    
    await window.api.saveHabits(updated);
    if (habit) window.showToast(`Deleted habit: ${habit.name}`, "info");
    window.loadHabits();
  } catch (e) {
    console.error("Failed to delete habit loop:", e);
    window.showToast(`Failed to delete habit loop: ${e.message}`, "error");
  }
};
