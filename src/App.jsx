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
const CATEGORIES = ['Work', 'Personal', 'Study', 'Other']
const PRIORITIES = ['Low', 'Medium', 'High']
const PRIORITY_WEIGHT = { High: 3, Medium: 2, Low: 1 }
const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'priority', label: 'Priority: High to Low' },
  { value: 'dueDate', label: 'Due date: Earliest first' },
]
const STORAGE_KEY = 'task-tracker-tasks'

function getTodayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDate(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function sortTasks(tasks, sortBy) {
  const sorted = [...tasks]
  switch (sortBy) {
    case 'oldest':
      return sorted.sort((a, b) =>
        (a.createdAt || 0) - (b.createdAt || 0) || a.id - b.id
      )
    case 'priority':
      return sorted.sort(
        (a, b) =>
          (PRIORITY_WEIGHT[b.priority] || 2) -
            (PRIORITY_WEIGHT[a.priority] || 2) || a.id - b.id
      )
    case 'dueDate':
      return sorted.sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return a.id - b.id
        if (!a.dueDate) return 1
        if (!b.dueDate) return -1
        return a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : a.id - b.id
      })
    default:
      return sorted.sort((a, b) =>
        (b.createdAt || 0) - (a.createdAt || 0) || a.id - b.id
      )
  }
}

function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(
        t =>
          typeof t.id === 'number' &&
          typeof t.text === 'string' &&
          typeof t.completed === 'boolean'
      )
      .map(t => ({
        ...t,
        priority: PRIORITIES.includes(t.priority) ? t.priority : 'Medium',
        createdAt: typeof t.createdAt === 'number' ? t.createdAt : 0,
        category: CATEGORIES.includes(t.category) ? t.category : 'Other',
      }))
  } catch {
    return []
  }
}

function App() {
  const [tasks, setTasks] = useState(() => {
    return loadTasks()
  })
  const [input, setInput] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [priority, setPriority] = useState('Medium')
  const [category, setCategory] = useState('Other')
  const [filter, setFilter] = useState('All')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('newest')
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [editingId, setEditingId] = useState(null)
  const [editText, setEditText] = useState('')
  const [editDueDate, setEditDueDate] = useState('')
  const [editPriority, setEditPriority] = useState('Medium')
  const [editCategory, setEditCategory] = useState('Other')

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
      { id: nextId.current++, text: trimmed, completed: false, dueDate: dueDate || null, priority, category, createdAt: Date.now() },
    ])
    setInput('')
    setDueDate('')
    setPriority('Medium')
    setCategory('Other')
  }, [input, dueDate, priority, category])

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
    setEditDueDate(task.dueDate || '')
    setEditPriority(task.priority || 'Medium')
    setEditCategory(task.category || 'Other')
  }, [])

  const saveEdit = useCallback(
    id => {
      const trimmed = editText.trim()
      if (!trimmed) return
      setTasks(prev =>
        prev.map(task => (task.id === id ? { ...task, text: trimmed, dueDate: editDueDate || null, priority: editPriority, category: editCategory } : task))
      )
      setEditingId(null)
      setEditText('')
      setEditDueDate('')
      setEditPriority('Medium')
      setEditCategory('Other')
    },
    [editText, editDueDate, editPriority, editCategory]
  )

  const cancelEdit = useCallback(() => {
    setEditingId(null)
    setEditText('')
    setEditDueDate('')
    setEditPriority('Medium')
    setEditCategory('Other')
  }, [])

  const handleEditKeyDown = useCallback(
    (e, id) => {
      if (e.key === 'Enter') saveEdit(id)
      if (e.key === 'Escape') cancelEdit()
    },
    [saveEdit, cancelEdit]
  )

  const filteredTasks = tasks.filter(task => {
    if (filter === 'Pending' && task.completed) return false
    if (filter === 'Completed' && !task.completed) return false
    if (categoryFilter !== 'All' && task.category !== categoryFilter) return false
    if (search.trim() && !task.text.toLowerCase().includes(search.trim().toLowerCase())) return false
    return true
  })

  const sortedTasks = sortTasks(filteredTasks, sortBy)

  const totalCount = tasks.length
  const completedCount = tasks.filter(t => t.completed).length
  const pendingCount = totalCount - completedCount
  const today = getTodayStr()

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
            <input
              className="task-input task-input--date"
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              aria-label="Task due date"
            />
            <select
              className="task-input task-input--select"
              value={priority}
              onChange={e => setPriority(e.target.value)}
              aria-label="Task priority"
            >
              {PRIORITIES.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <select
              className="task-input task-input--select"
              value={category}
              onChange={e => setCategory(e.target.value)}
              aria-label="Task category"
            >
              {CATEGORIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
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

        <section className="category-filter" aria-label="Filter by category">
          <label className="category-filter__label" htmlFor="category-select">Category</label>
          <select
            id="category-select"
            className="category-filter__select"
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
          >
            <option value="All">All categories</option>
            {CATEGORIES.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </section>

        <section className="sort" aria-label="Sort tasks">
          <label className="sort__label" htmlFor="sort-select">Sort by</label>
          <select
            id="sort-select"
            className="sort__select"
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
          >
            {SORT_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </section>

        <section className="search" aria-label="Search tasks">
          <span className="search__icon" aria-hidden="true">🔍</span>
          <input
            className="search__input"
            type="search"
            placeholder="Search tasks..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            aria-label="Search tasks"
          />
        </section>

        <section className="task-list-section" aria-label="Task list">
          {sortedTasks.length === 0 ? (
            <div className="empty-state">
              {tasks.length === 0
                ? 'No tasks yet. Add one above!'
                : search.trim()
                  ? `No tasks match "${search.trim()}".`
                  : categoryFilter !== 'All'
                    ? `No ${categoryFilter.toLowerCase()} tasks.`
                    : `No ${filter.toLowerCase()} tasks.`}
            </div>
          ) : (
            <ul className="task-list" role="list">
              {sortedTasks.map(task => (
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
                      <input
                        className="task-input task-input--inline task-input--date"
                        type="date"
                        value={editDueDate}
                        onChange={e => setEditDueDate(e.target.value)}
                        aria-label="Edit task due date"
                      />
                      <select
                        className="task-input task-input--inline task-input--select"
                        value={editPriority}
                        onChange={e => setEditPriority(e.target.value)}
                        aria-label="Edit task priority"
                      >
                        {PRIORITIES.map(p => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                      <select
                        className="task-input task-input--inline task-input--select"
                        value={editCategory}
                        onChange={e => setEditCategory(e.target.value)}
                        aria-label="Edit task category"
                      >
                        {CATEGORIES.map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
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
                        <div className="task-item__content">
                          <span className="task-item__text">{task.text}</span>
                          <div className="task-item__meta">
                            <span className={`task-item__badge task-item__badge--priority-${(task.priority || 'Medium').toLowerCase()}`}>
                              {task.priority || 'Medium'}
                            </span>
                            <span className={`task-item__badge task-item__badge--category-${(task.category || 'Other').toLowerCase()}`}>
                              {task.category || 'Other'}
                            </span>
                            {task.dueDate && (
                              <span className="task-item__due-date">
                                {formatDate(task.dueDate)}
                              </span>
                            )}
                            {!task.completed && task.dueDate < today && (
                              <span className="task-item__badge task-item__badge--overdue">
                                Overdue
                              </span>
                            )}
                            {!task.completed && task.dueDate === today && (
                              <span className="task-item__badge task-item__badge--due-today">
                                Due today
                              </span>
                            )}
                          </div>
                        </div>
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
