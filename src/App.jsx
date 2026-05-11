import React, { useEffect, useMemo, useRef, useState } from "react";

const STORAGE_KEY = "project-time-tracker-v2";

function formatTime(totalSeconds) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds || 0));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

function formatDecimalHours(totalSeconds) {
  return (Math.max(0, totalSeconds || 0) / 3600).toFixed(2);
}

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function getReadableDate() {
  return new Date().toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function createProject(name) {
  return {
    id: crypto.randomUUID(),
    name,
    seconds: 0,
    notes: "",
  };
}

const DEFAULT_PROJECTS = [
  createProject("Project 1"),
  createProject("Project 2"),
  createProject("Project 3"),
];

const defaultState = {
  dateKey: getTodayKey(),
  projects: DEFAULT_PROJECTS,
  activeProjectId: null,
  activeStartedAt: null,
};

function getInitialState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return defaultState;

    const parsed = JSON.parse(saved);

    if (!parsed || !Array.isArray(parsed.projects)) {
      return defaultState;
    }

    const cleanedProjects = parsed.projects.map((project) => ({
      id: project.id || crypto.randomUUID(),
      name: project.name || "Untitled Project",
      seconds: Number(project.seconds) || 0,
      notes: project.notes || "",
    }));

    return {
      dateKey: parsed.dateKey || getTodayKey(),
      projects: cleanedProjects.length ? cleanedProjects : DEFAULT_PROJECTS,
      activeProjectId: parsed.activeProjectId || null,
      activeStartedAt: parsed.activeStartedAt || null,
    };
  } catch {
    return defaultState;
  }
}

export default function App() {
  const initialState = getInitialState();

  const [dateKey, setDateKey] = useState(initialState.dateKey);
  const [projects, setProjects] = useState(initialState.projects);
  const [activeProjectId, setActiveProjectId] = useState(
    initialState.activeProjectId
  );
  const [activeStartedAt, setActiveStartedAt] = useState(
    initialState.activeStartedAt
  );
  const [newProjectName, setNewProjectName] = useState("");
  const [statusMessage, setStatusMessage] = useState(
    "Saved locally in this browser."
  );
  const [now, setNow] = useState(Date.now());
  const hasLoaded = useRef(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const currentDateKey = getTodayKey();

    if (dateKey !== currentDateKey && !activeProjectId) {
      setStatusMessage(
        "A new day has started. Use Reset Day when you are ready to start a fresh log."
      );
    }
  }, [dateKey, activeProjectId]);

  useEffect(() => {
    if (!hasLoaded.current) {
      hasLoaded.current = true;
      return;
    }

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        dateKey,
        projects,
        activeProjectId,
        activeStartedAt,
      })
    );

    setStatusMessage("Saved locally in this browser.");
  }, [dateKey, projects, activeProjectId, activeStartedAt]);

  const liveProjects = useMemo(() => {
    if (!activeProjectId || !activeStartedAt) {
      return projects.map((project) => ({
        ...project,
        liveSeconds: project.seconds,
      }));
    }

    const elapsedSeconds = Math.floor((now - activeStartedAt) / 1000);

    return projects.map((project) =>
      project.id === activeProjectId
        ? {
            ...project,
            liveSeconds: project.seconds + Math.max(0, elapsedSeconds),
          }
        : {
            ...project,
            liveSeconds: project.seconds,
          }
    );
  }, [projects, activeProjectId, activeStartedAt, now]);

  const totalSeconds = useMemo(
    () => liveProjects.reduce((total, project) => total + project.liveSeconds, 0),
    [liveProjects]
  );

  const activeProject = liveProjects.find(
    (project) => project.id === activeProjectId
  );

  function commitActiveTime() {
    if (!activeProjectId || !activeStartedAt) return;

    const elapsedSeconds = Math.floor((Date.now() - activeStartedAt) / 1000);

    setProjects((currentProjects) =>
      currentProjects.map((project) =>
        project.id === activeProjectId
          ? {
              ...project,
              seconds: project.seconds + Math.max(0, elapsedSeconds),
            }
          : project
      )
    );
  }

  function toggleProject(projectId) {
    if (activeProjectId === projectId) {
      commitActiveTime();
      setActiveProjectId(null);
      setActiveStartedAt(null);
      setStatusMessage("Timer paused.");
      return;
    }

    if (activeProjectId) {
      commitActiveTime();
    }

    setActiveProjectId(projectId);
    setActiveStartedAt(Date.now());
    setDateKey(getTodayKey());
    setStatusMessage("Timer running.");
  }

  function stopTimer() {
    commitActiveTime();
    setActiveProjectId(null);
    setActiveStartedAt(null);
    setStatusMessage("Timer stopped.");
  }

  function addProject() {
    const trimmedName = newProjectName.trim();
    if (!trimmedName) return;

    setProjects((currentProjects) => [
      ...currentProjects,
      createProject(trimmedName),
    ]);

    setNewProjectName("");
    setStatusMessage("Project added.");
  }

  function updateProjectName(projectId, name) {
    setProjects((currentProjects) =>
      currentProjects.map((project) =>
        project.id === projectId ? { ...project, name } : project
      )
    );
  }

  function updateProjectNotes(projectId, notes) {
    setProjects((currentProjects) =>
      currentProjects.map((project) =>
        project.id === projectId ? { ...project, notes } : project
      )
    );
  }

  function deleteProject(projectId) {
    if (activeProjectId === projectId) {
      setActiveProjectId(null);
      setActiveStartedAt(null);
    }

    setProjects((currentProjects) =>
      currentProjects.filter((project) => project.id !== projectId)
    );

    setStatusMessage("Project deleted.");
  }

  function resetDay() {
    const confirmed = window.confirm(
      "Reset all tracked time for today? Project names and notes will stay."
    );

    if (!confirmed) return;

    setActiveProjectId(null);
    setActiveStartedAt(null);
    setDateKey(getTodayKey());
    setProjects((currentProjects) =>
      currentProjects.map((project) => ({ ...project, seconds: 0 }))
    );
    setStatusMessage("Day reset.");
  }

  function clearEverything() {
    const confirmed = window.confirm(
      "Clear all saved projects, notes, and time from this browser?"
    );

    if (!confirmed) return;

    localStorage.removeItem(STORAGE_KEY);
    setDateKey(getTodayKey());
    setProjects([
      createProject("Project 1"),
      createProject("Project 2"),
      createProject("Project 3"),
    ]);
    setActiveProjectId(null);
    setActiveStartedAt(null);
    setStatusMessage("All saved data cleared.");
  }

  function exportCsv() {
    const rows = [
      ["Date", "Project", "Tracked Time", "Decimal Hours", "Seconds", "Notes"],
      ...liveProjects.map((project) => [
        dateKey,
        project.name,
        formatTime(project.liveSeconds),
        formatDecimalHours(project.liveSeconds),
        project.liveSeconds,
        project.notes || "",
      ]),
      [
        dateKey,
        "TOTAL",
        formatTime(totalSeconds),
        formatDecimalHours(totalSeconds),
        totalSeconds,
        "",
      ],
    ];

    const csv = rows
      .map((row) =>
        row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `project-time-tracker-${dateKey}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    setStatusMessage("CSV exported.");
  }

  const styles = {
    page: {
      minHeight: "100vh",
      background: "#f1f5f9",
      color: "#0f172a",
      fontFamily: "Arial, Helvetica, sans-serif",
      padding: "32px 20px",
    },
    shell: {
      maxWidth: "1120px",
      margin: "0 auto",
    },
    header: {
      display: "grid",
      gridTemplateColumns: "1fr minmax(260px, 320px)",
      gap: "24px",
      alignItems: "end",
      marginBottom: "22px",
    },
    datePill: {
      display: "inline-flex",
      gap: "8px",
      alignItems: "center",
      background: "white",
      color: "#475569",
      padding: "8px 12px",
      borderRadius: "999px",
      boxShadow: "0 2px 8px rgba(15, 23, 42, 0.08)",
      marginBottom: "12px",
      fontSize: "14px",
    },
    title: {
      margin: 0,
      fontSize: "clamp(2rem, 5vw, 4rem)",
      letterSpacing: "-0.04em",
      lineHeight: 1,
    },
    subtitle: {
      maxWidth: "680px",
      color: "#475569",
      lineHeight: 1.5,
      marginTop: "12px",
    },
    totalCard: {
      background: "white",
      borderRadius: "20px",
      boxShadow: "0 4px 16px rgba(15, 23, 42, 0.08)",
      padding: "20px",
    },
    totalTime: {
      display: "block",
      fontFamily: "Consolas, monospace",
      fontSize: "34px",
      fontWeight: 800,
      margin: "6px 0",
    },
    muted: {
      color: "#64748b",
      fontSize: "14px",
    },
    controls: {
      display: "flex",
      flexWrap: "wrap",
      gap: "12px",
      padding: "16px",
      marginBottom: "16px",
      background: "white",
      borderRadius: "20px",
      boxShadow: "0 4px 16px rgba(15, 23, 42, 0.08)",
    },
    input: {
      border: "1px solid #cbd5e1",
      borderRadius: "12px",
      padding: "12px 14px",
      outline: "none",
      font: "inherit",
    },
    projectInput: {
      width: "100%",
      border: "1px solid transparent",
      borderRadius: "12px",
      padding: "8px 10px",
      outline: "none",
      fontSize: "20px",
      fontWeight: 800,
      color: "#0f172a",
      background: "transparent",
    },
    noteInput: {
      width: "100%",
      border: "1px solid #e2e8f0",
      borderRadius: "12px",
      padding: "10px 12px",
      outline: "none",
      font: "inherit",
      marginTop: "10px",
      color: "#334155",
    },
    button: {
      border: 0,
      borderRadius: "12px",
      padding: "12px 16px",
      cursor: "pointer",
      background: "#0f172a",
      color: "white",
      fontWeight: 800,
      font: "inherit",
    },
    secondaryButton: {
      border: "1px solid #cbd5e1",
      borderRadius: "12px",
      padding: "12px 16px",
      cursor: "pointer",
      background: "white",
      color: "#0f172a",
      fontWeight: 800,
      font: "inherit",
    },
    dangerButton: {
      border: 0,
      borderRadius: "12px",
      padding: "12px 16px",
      cursor: "pointer",
      background: "#fee2e2",
      color: "#991b1b",
      fontWeight: 800,
      font: "inherit",
    },
    status: {
      margin: "0 0 18px",
      color: "#475569",
      fontSize: "14px",
    },
    projectList: {
      display: "grid",
      gap: "14px",
    },
    projectCard: {
      display: "grid",
      gridTemplateColumns: "1fr auto auto",
      alignItems: "center",
      gap: "20px",
      background: "white",
      borderRadius: "20px",
      boxShadow: "0 4px 16px rgba(15, 23, 42, 0.08)",
      border: "2px solid transparent",
      padding: "18px",
    },
    activeCard: {
      border: "2px solid #0f172a",
    },
    progressTrack: {
      height: "8px",
      background: "#e2e8f0",
      borderRadius: "999px",
      overflow: "hidden",
      marginTop: "8px",
    },
    progressFill: {
      height: "100%",
      background: "#0f172a",
      transition: "width 0.2s",
    },
    time: {
      fontFamily: "Consolas, monospace",
      fontSize: "30px",
      fontWeight: 800,
      whiteSpace: "nowrap",
    },
    decimal: {
      color: "#64748b",
      fontSize: "13px",
      textAlign: "right",
      marginTop: "4px",
    },
    actions: {
      display: "flex",
      alignItems: "center",
      gap: "10px",
    },
    toggle: {
      position: "relative",
      width: "64px",
      height: "36px",
      border: 0,
      borderRadius: "999px",
      padding: "4px",
      background: "#cbd5e1",
      cursor: "pointer",
    },
    toggleOn: {
      background: "#0f172a",
    },
    knob: {
      display: "block",
      width: "28px",
      height: "28px",
      background: "white",
      borderRadius: "50%",
      transition: "transform 0.2s",
      boxShadow: "0 2px 6px rgba(15, 23, 42, 0.2)",
    },
    knobOn: {
      transform: "translateX(28px)",
    },
    deleteButton: {
      width: "36px",
      height: "36px",
      border: 0,
      borderRadius: "12px",
      padding: 0,
      cursor: "pointer",
      background: "#e2e8f0",
      color: "#0f172a",
      fontSize: "22px",
      fontWeight: 800,
    },
  };

  return (
    <main style={styles.page}>
      <div style={styles.shell}>
        <section style={styles.header}>
          <div>
            <div style={styles.datePill}>⏱ {getReadableDate()}</div>
            <h1 style={styles.title}>Project Time Tracker</h1>
            <p style={styles.subtitle}>
              Track multiple projects throughout the day. Only one project can
              run at a time, and your data is saved locally in this browser.
            </p>
          </div>

          <div style={styles.totalCard}>
            <span style={styles.muted}>Total tracked today</span>
            <strong style={styles.totalTime}>{formatTime(totalSeconds)}</strong>
            <small style={styles.muted}>
              {formatDecimalHours(totalSeconds)} decimal hours
            </small>
            <small style={{ ...styles.muted, display: "block", marginTop: "6px" }}>
              Active: {activeProject ? activeProject.name : "None"}
            </small>
          </div>
        </section>

        <section style={styles.controls}>
          <input
            style={{ ...styles.input, flex: 1, minWidth: "240px" }}
            value={newProjectName}
            placeholder="Add project name..."
            onChange={(event) => setNewProjectName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") addProject();
            }}
          />

          <button style={styles.button} onClick={addProject}>
            + Add Project
          </button>

          <button style={styles.secondaryButton} onClick={stopTimer}>
            Stop Timer
          </button>

          <button style={styles.secondaryButton} onClick={exportCsv}>
            ↓ Export CSV
          </button>

          <button style={styles.secondaryButton} onClick={resetDay}>
            ↻ Reset Day
          </button>

          <button style={styles.dangerButton} onClick={clearEverything}>
            Clear Saved Data
          </button>
        </section>

        <p style={styles.status}>{statusMessage}</p>

        <section style={styles.projectList}>
          {liveProjects.map((project) => {
            const isActive = activeProjectId === project.id;
            const percentage =
              totalSeconds === 0
                ? 0
                : (project.liveSeconds / totalSeconds) * 100;

            return (
              <article
                key={project.id}
                style={{
                  ...styles.projectCard,
                  ...(isActive ? styles.activeCard : {}),
                }}
              >
                <div>
                  <input
                    style={styles.projectInput}
                    value={project.name}
                    onChange={(event) =>
                      updateProjectName(project.id, event.target.value)
                    }
                  />

                  <div style={styles.progressTrack}>
                    <div
                      style={{
                        ...styles.progressFill,
                        width: `${Math.max(
                          project.liveSeconds > 0 ? 4 : 0,
                          percentage
                        )}%`,
                      }}
                    />
                  </div>

                  <input
                    style={styles.noteInput}
                    value={project.notes}
                    placeholder="Optional notes for this project..."
                    onChange={(event) =>
                      updateProjectNotes(project.id, event.target.value)
                    }
                  />
                </div>

                <div>
                  <div style={styles.time}>{formatTime(project.liveSeconds)}</div>
                  <div style={styles.decimal}>
                    {formatDecimalHours(project.liveSeconds)} hrs
                  </div>
                </div>

                <div style={styles.actions}>
                  <button
                    style={{
                      ...styles.toggle,
                      ...(isActive ? styles.toggleOn : {}),
                    }}
                    onClick={() => toggleProject(project.id)}
                    aria-label={`Toggle ${project.name}`}
                  >
                    <span
                      style={{
                        ...styles.knob,
                        ...(isActive ? styles.knobOn : {}),
                      }}
                    />
                  </button>

                  <strong
                    style={{
                      color: isActive ? "#0f172a" : "#94a3b8",
                      width: "34px",
                    }}
                  >
                    {isActive ? "ON" : "OFF"}
                  </strong>

                  <button
                    style={styles.deleteButton}
                    onClick={() => deleteProject(project.id)}
                    aria-label={`Delete ${project.name}`}
                  >
                    ×
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}