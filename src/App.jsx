import { useState, useEffect, useRef, useCallback } from 'react'
import './App.css'

/* ── Summary dashboard ──────────────────────────────── */
function TaskSummary({ total, pending, completed }) {
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100)

  return (
    <section className="summary" aria-label="Task summary dashboard">
      <div className="summary__cards">
        <div className="summary__card summary__card--total">
          <span className="summary__card-value">{total}</span>
          <span className="summary__card-label">Total</span>
        </div>
        <div className="summary__card summary__card--pending">
          <span className="summary__card-value">{pending}</span>
          <span className="summary__card-label">Pending</span>
        </div>
        <div className="summary__card summary__card--completed">
          <span className="summary__card-value">{completed}</span>
          <span className="summary__card-label">Completed</span>
        </div>
      </div>

      <div className="summary__progress" aria-label={`${pct}% of tasks completed`}>
        <div className="summary__progress-header">
          <span className="summary__progress-label">Progress</span>
          <span className="summary__progress-pct">{pct}%</span>
        </div>
        <div
          className="summary__progress-track"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="summary__progress-fill"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </section>
  )
}

const FILTERS = ['All', 'Pending', 'Completed']
const STORAGE_KEY = 'task-tracker-tasks'

function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      t =>
        typeof t.id === 'number' &&
        typeof t.text === 'string' &&
        typeof t.completed === 'boolean'
    )
  } catch {
    return []
  }
}

function App() {
  const [tasks, setTasks] = useState(() => {
    return loadTasks()
  })
  const [input, setInput] = useState('')
  const [filter, setFilter] = useState('All')
  const [editingId, setEditingId] = useState(null)
  const [editText, setEditText] = useState('')

  // useRef for the auto-increment ID so it never causes re-renders
  // and is not stale across closures the way a module-level let would be
  const nextId = useRef(1)
  useEffect(() => {
    const saved = loadTasks()
    if (saved.length > 0) {
      nextId.current = Math.max(...saved.map(t => t.id)) + 1
    }
  }, []) // runs once on mount to seed the ref from storage

  // Persist to localStorage on every tasks change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks))
  }, [tasks])

  const addTask = useCallback(() => {
    const trimmed = input.trim()
    if (!trimmed) return
    setTasks(prev => [
      ...prev,
      { id: nextId.current++, text: trimmed, completed: false },
    ])
    setInput('')
  }, [input])

  const handleKeyDown = useCallback(
    e => {
      if (e.key === 'Enter') addTask()
    },
    [addTask]
  )

  const toggleTask = useCallback(id => {
    setTasks(prev =>
      prev.map(task =>
        task.id === id ? { ...task, completed: !task.completed } : task
      )
    )
  }, [])

  const deleteTask = useCallback((id, text) => {
    if (!window.confirm(`Delete "${text}"?`)) return
    setTasks(prev => prev.filter(task => task.id !== id))
  }, [])

  const startEdit = useCallback(task => {
    setEditingId(task.id)
    setEditText(task.text)
  }, [])

  const saveEdit = useCallback(
    id => {
      const trimmed = editText.trim()
      if (!trimmed) return
      setTasks(prev =>
        prev.map(task => (task.id === id ? { ...task, text: trimmed } : task))
      )
      setEditingId(null)
      setEditText('')
    },
    [editText]
  )

  const cancelEdit = useCallback(() => {
    setEditingId(null)
    setEditText('')
  }, [])

  const handleEditKeyDown = useCallback(
    (e, id) => {
      if (e.key === 'Enter') saveEdit(id)
      if (e.key === 'Escape') cancelEdit()
    },
    [saveEdit, cancelEdit]
  )

  const filteredTasks = tasks.filter(task => {
    if (filter === 'Pending') return !task.completed
    if (filter === 'Completed') return task.completed
    return true
  })

  const totalCount = tasks.length
  const completedCount = tasks.filter(t => t.completed).length
  const pendingCount = totalCount - completedCount

  return (
    <div className="app">
      <header className="header">
        <h1 className="header__title">Task Tracker</h1>
        <p className="header__subtitle">Stay organized, get things done</p>
      </header>

      <main className="main">
        <TaskSummary
          total={totalCount}
          pending={pendingCount}
          completed={completedCount}
        />

        <section className="input-section" aria-label="Add a new task">
          <div className="input-row">
            <input
              className="task-input"
              type="text"
              placeholder="What needs to be done?"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              aria-label="New task"
            />
            <button className="add-btn" onClick={addTask} aria-label="Add task">
              Add
            </button>
          </div>
        </section>

        <section className="filters" aria-label="Filter tasks">
          {FILTERS.map(f => (
            <button
              key={f}
              className={`filter-btn${filter === f ? ' filter-btn--active' : ''}`}
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
            >
              {f}
            </button>
          ))}
        </section>

        <section className="task-list-section" aria-label="Task list">
          {filteredTasks.length === 0 ? (
            <div className="empty-state">
              {tasks.length === 0
                ? 'No tasks yet. Add one above!'
                : `No ${filter.toLowerCase()} tasks.`}
            </div>
          ) : (
            <ul className="task-list" role="list">
              {filteredTasks.map(task => (
                <li
                  key={task.id}
                  className={`task-item${
                    task.completed && editingId !== task.id
                      ? ' task-item--completed'
                      : ''
                  }`}
                >
                  {editingId === task.id ? (
                    <div className="task-item__edit-row">
                      <input
                        className="task-input task-input--inline"
                        type="text"
                        value={editText}
                        onChange={e => setEditText(e.target.value)}
                        onKeyDown={e => handleEditKeyDown(e, task.id)}
                        aria-label="Edit task title"
                        autoFocus
                      />
                      <div className="task-item__edit-actions">
                        <button
                          className="task-item__save"
                          onClick={() => saveEdit(task.id)}
                          disabled={!editText.trim()}
                          aria-label="Save changes"
                        >
                          Save
                        </button>
                        <button
                          className="task-item__cancel"
                          onClick={cancelEdit}
                          aria-label="Cancel editing"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <label className="task-item__label">
                        <input
                          type="checkbox"
                          className="task-item__checkbox"
                          checked={task.completed}
                          onChange={() => toggleTask(task.id)}
                          aria-label={`Mark "${task.text}" as ${
                            task.completed ? 'pending' : 'completed'
                          }`}
                        />
                        <span className="task-item__text">{task.text}</span>
                      </label>
                      <button
                        className="task-item__edit"
                        onClick={() => startEdit(task)}
                        aria-label={`Edit task "${task.text}"`}
                      >
                        ✎
                      </button>
                      <button
                        className="task-item__delete"
                        onClick={() => deleteTask(task.id, task.text)}
                        aria-label={`Delete task "${task.text}"`}
                      >
                        ✕
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {tasks.length > 0 && (
          <footer className="counts" aria-label="Task summary">
            <span className="counts__item">
              Total: <strong>{totalCount}</strong>
            </span>
            <span className="counts__divider"></span>
            <span className="counts__item counts__item--pending">
              Pending: <strong>{pendingCount}</strong>
            </span>
            <span className="counts__divider"></span>
            <span className="counts__item counts__item--completed">
              Completed: <strong>{completedCount}</strong>
            </span>
          </footer>
        )}
      </main>
    </div>
  )
}

export default App
