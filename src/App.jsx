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
  { value: 'manual', label: 'Manual order' },
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'priority', label: 'Priority: High to Low' },
  { value: 'dueDate', label: 'Due date: Earliest first' },
]
const STORAGE_KEY = 'task-tracker-tasks'
const NOTIF_KEY = 'task-tracker-notifications'

function getTodayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDate(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function formatTimestamp(ts) {
  if (typeof ts !== 'number' || isNaN(ts)) return 'Unknown time'
  const d = new Date(ts)
  if (isNaN(d.getTime())) return 'Unknown time'
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function makeActivity(description) {
  return { timestamp: Date.now(), description }
}

function formatReminder(reminderStr) {
  if (!reminderStr) return null
  const d = new Date(reminderStr)
  if (isNaN(d.getTime())) return null
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function loadNotifications() {
  try {
    const raw = localStorage.getItem(NOTIF_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      n =>
        typeof n.id === 'number' &&
        typeof n.taskId === 'number' &&
        typeof n.taskText === 'string' &&
        typeof n.timestamp === 'number' &&
        typeof n.read === 'boolean'
    )
  } catch {
    return []
  }
}

function validateImportData(raw) {
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { error: 'Invalid JSON file. Please select a valid export file.' }
  }
  if (!Array.isArray(parsed)) {
    return { error: 'Invalid file format. Expected an array of tasks.' }
  }
  if (parsed.length === 0) {
    return { error: 'No tasks found in the file.' }
  }
  const validTasks = []
  for (let i = 0; i < parsed.length; i++) {
    const t = parsed[i]
    if (typeof t !== 'object' || t === null) {
      return { error: `Item ${i + 1} is not a valid task object.` }
    }
    if (typeof t.text !== 'string' || !t.text.trim()) {
      return { error: `Task ${i + 1} has an invalid or missing title.` }
    }
    if (typeof t.completed !== 'boolean') {
      return { error: `Task ${i + 1} has an invalid completion status.` }
    }
    validTasks.push({
      id: typeof t.id === 'number' ? t.id : null,
      text: t.text,
      completed: t.completed,
      dueDate: typeof t.dueDate === 'string' ? t.dueDate : null,
      priority: PRIORITIES.includes(t.priority) ? t.priority : 'Medium',
      category: CATEGORIES.includes(t.category) ? t.category : 'Other',
      createdAt: typeof t.createdAt === 'number' ? t.createdAt : Date.now(),
      subtasks: Array.isArray(t.subtasks)
        ? t.subtasks
            .filter(s => typeof s.text === 'string' && typeof s.completed === 'boolean')
            .map(s => ({ id: typeof s.id === 'number' ? s.id : 0, text: s.text, completed: s.completed }))
        : [],
      activity: Array.isArray(t.activity)
        ? t.activity.filter(a => typeof a.timestamp === 'number' && typeof a.description === 'string')
        : [],
      reminder: typeof t.reminder === 'string' ? t.reminder : null,
      reminderNotified: typeof t.reminderNotified === 'boolean' ? t.reminderNotified : false,
      archived: typeof t.archived === 'boolean' ? t.archived : false,
    })
  }
  return { tasks: validTasks }
}

function sortTasks(tasks, sortBy) {
  const sorted = [...tasks]
  switch (sortBy) {
    case 'manual':
      return sorted
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
        subtasks: Array.isArray(t.subtasks)
          ? t.subtasks.filter(
              s =>
                typeof s.id === 'number' &&
                typeof s.text === 'string' &&
                typeof s.completed === 'boolean'
            )
          : [],
        activity: Array.isArray(t.activity)
          ? t.activity.filter(
              a =>
                typeof a.timestamp === 'number' &&
                typeof a.description === 'string'
            )
          : [],
        reminder: typeof t.reminder === 'string' ? t.reminder : null,
        reminderNotified: typeof t.reminderNotified === 'boolean' ? t.reminderNotified : false,
        archived: typeof t.archived === 'boolean' ? t.archived : false,
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
  const [sortBy, setSortBy] = useState('manual')
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [draggedId, setDraggedId] = useState(null)
  const [dragOverId, setDragOverId] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editText, setEditText] = useState('')
  const [editDueDate, setEditDueDate] = useState('')
  const [editPriority, setEditPriority] = useState('Medium')
  const [editCategory, setEditCategory] = useState('Other')
  const [editSubtasks, setEditSubtasks] = useState([])
  const [editSubtaskInput, setEditSubtaskInput] = useState('')
  const [subtaskInput, setSubtaskInput] = useState('')
  const [newSubtasks, setNewSubtasks] = useState([])
  const [inlineSubInputs, setInlineSubInputs] = useState({})
  const [activityTaskId, setActivityTaskId] = useState(null)
  const [reminder, setReminder] = useState('')
  const [editReminder, setEditReminder] = useState('')
  const [notifications, setNotifications] = useState(() => loadNotifications())
  const [notifPanelOpen, setNotifPanelOpen] = useState(false)
  const [showArchive, setShowArchive] = useState(false)

  // useRef for the auto-increment ID so it never causes re-renders
  // and is not stale across closures the way a module-level let would be
  const nextId = useRef(1)
  const nextSubId = useRef(1)
  const fileInputRef = useRef(null)
  useEffect(() => {
    const saved = loadTasks()
    if (saved.length > 0) {
      nextId.current = Math.max(...saved.map(t => t.id)) + 1
      const maxSubId = saved.reduce((max, t) => {
        if (!Array.isArray(t.subtasks)) return max
        const ids = t.subtasks.map(s => s.id || 0)
        return Math.max(max, ...ids, 0)
      }, 0)
      nextSubId.current = maxSubId + 1
    }
  }, []) // runs once on mount to seed the ref from storage

  // Persist to localStorage on every tasks change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks))
  }, [tasks])

  // Persist notifications to localStorage
  useEffect(() => {
    localStorage.setItem(NOTIF_KEY, JSON.stringify(notifications))
  }, [notifications])

  // ── Reminder checking (in-app only, not background) ──
  const tasksRef = useRef(tasks)
  tasksRef.current = tasks

  useEffect(() => {
    const checkReminders = () => {
      const now = Date.now()
      const currentTasks = tasksRef.current
      const newNotifs = []
      const notifiedIds = []
      currentTasks.forEach(task => {
        if (task.completed) return
        if (task.archived) return
        if (!task.reminder) return
        if (task.reminderNotified) return
        const reminderTime = new Date(task.reminder).getTime()
        if (isNaN(reminderTime) || reminderTime > now) return
        newNotifs.push({
          id: Date.now() + Math.random(),
          taskId: task.id,
          taskText: task.text,
          timestamp: Date.now(),
          read: false,
        })
        notifiedIds.push(task.id)
      })
      if (newNotifs.length > 0) {
        setNotifications(prev => [...newNotifs, ...prev])
        setTasks(prev =>
          prev.map(t =>
            notifiedIds.includes(t.id) ? { ...t, reminderNotified: true } : t
          )
        )
      }
    }
    checkReminders()
    const interval = setInterval(checkReminders, 15000)
    return () => clearInterval(interval)
  }, [])

  const addTask = useCallback(() => {
    const trimmed = input.trim()
    if (!trimmed) return
    const ts = Date.now()
    setTasks(prev => [
      ...prev,
      { id: nextId.current++, text: trimmed, completed: false, dueDate: dueDate || null, priority, category, createdAt: ts, subtasks: newSubtasks, activity: [makeActivity('Task created')], reminder: reminder || null, reminderNotified: false, archived: false },
    ])
    setInput('')
    setDueDate('')
    setPriority('Medium')
    setCategory('Other')
    setNewSubtasks([])
    setSubtaskInput('')
    setReminder('')
  }, [input, dueDate, priority, category, newSubtasks, reminder])

  // ── Subtask handlers (add form) ─────────────────────
  const addNewSubtask = useCallback(() => {
    const trimmed = subtaskInput.trim()
    if (!trimmed) return
    setNewSubtasks(prev => [...prev, { id: nextSubId.current++, text: trimmed, completed: false }])
    setSubtaskInput('')
  }, [subtaskInput])

  const deleteNewSubtask = useCallback(id => {
    setNewSubtasks(prev => prev.filter(s => s.id !== id))
  }, [])

  const toggleNewSubtask = useCallback(id => {
    setNewSubtasks(prev => prev.map(s => s.id === id ? { ...s, completed: !s.completed } : s))
  }, [])

  const handleKeyDown = useCallback(
    e => {
      if (e.key === 'Enter') addTask()
    },
    [addTask]
  )

  const toggleTask = useCallback(id => {
    setTasks(prev =>
      prev.map(task =>
        task.id === id
          ? {
              ...task,
              completed: !task.completed,
              activity: [
                makeActivity(task.completed ? 'Task reopened' : 'Task completed'),
                ...(task.activity || []),
              ],
            }
          : task
      )
    )
  }, [])

  const deleteTask = useCallback((id, text) => {
    if (!window.confirm(`Delete "${text}"?`)) return
    setTasks(prev => prev.filter(task => task.id !== id))
  }, [])

  const archiveTask = useCallback(id => {
    setTasks(prev =>
      prev.map(task =>
        task.id === id
          ? { ...task, archived: true, activity: [makeActivity('Task archived'), ...(task.activity || [])] }
          : task
      )
    )
  }, [])

  const restoreTask = useCallback(id => {
    setTasks(prev =>
      prev.map(task =>
        task.id === id
          ? { ...task, archived: false, activity: [makeActivity('Task restored'), ...(task.activity || [])] }
          : task
      )
    )
  }, [])

  const deleteArchivedTask = useCallback((id, text) => {
    if (!window.confirm(`Permanently delete "${text}"? This cannot be undone.`)) return
    setTasks(prev => prev.filter(task => task.id !== id))
  }, [])

  const archiveAllCompleted = useCallback(() => {
    if (!window.confirm('Archive all completed tasks?')) return
    setTasks(prev =>
      prev.map(task =>
        task.completed && !task.archived
          ? { ...task, archived: true, activity: [makeActivity('Task archived'), ...(task.activity || [])] }
          : task
      )
    )
  }, [])

  const startEdit = useCallback(task => {
    setEditingId(task.id)
    setEditText(task.text)
    setEditDueDate(task.dueDate || '')
    setEditPriority(task.priority || 'Medium')
    setEditCategory(task.category || 'Other')
    setEditSubtasks((task.subtasks || []).map(s => ({ ...s })))
    setEditSubtaskInput('')
    setEditReminder(task.reminder || '')
  }, [])

  const saveEdit = useCallback(
    id => {
      const trimmed = editText.trim()
      if (!trimmed) return
      setTasks(prev => {
        const oldTask = prev.find(t => t.id === id)
        if (!oldTask) return prev
        const ts = Date.now()
        const activities = []
        if (trimmed !== oldTask.text)
          activities.push({ timestamp: ts, description: `Title changed from "${oldTask.text}" to "${trimmed}"` })
        const newDueDate = editDueDate || null
        if (newDueDate !== (oldTask.dueDate || null))
          activities.push({ timestamp: ts, description: `Due date set to ${newDueDate ? formatDate(newDueDate) : 'none'}` })
        if (editPriority !== (oldTask.priority || 'Medium'))
          activities.push({ timestamp: ts, description: `Priority changed to ${editPriority}` })
        if (editCategory !== (oldTask.category || 'Other'))
          activities.push({ timestamp: ts, description: `Category changed to ${editCategory}` })
        const newReminder = editReminder || null
        const oldReminder = oldTask.reminder || null
        if (newReminder !== oldReminder)
          activities.push({ timestamp: ts, description: `Reminder ${newReminder ? 'set to ' + formatReminder(newReminder) : 'removed'}` })
        const oldSubs = oldTask.subtasks || []
        const newSubs = editSubtasks
        newSubs.forEach(ns => {
          if (!oldSubs.some(os => os.id === ns.id))
            activities.push({ timestamp: ts, description: `Subtask added: "${ns.text}"` })
        })
        oldSubs.forEach(os => {
          if (!newSubs.some(ns => ns.id === os.id))
            activities.push({ timestamp: ts, description: `Subtask deleted: "${os.text}"` })
        })
        newSubs.forEach(ns => {
          const os = oldSubs.find(o => o.id === ns.id)
          if (os && os.completed !== ns.completed)
            activities.push({ timestamp: ts, description: `Subtask "${ns.text}" ${ns.completed ? 'completed' : 'reopened'}` })
        })
        return prev.map(task =>
          task.id === id
            ? { ...task, text: trimmed, dueDate: editDueDate || null, priority: editPriority, category: editCategory, subtasks: editSubtasks, activity: [...activities, ...(task.activity || [])], reminder: newReminder, reminderNotified: newReminder !== oldReminder ? false : (oldTask.reminderNotified || false) }
            : task
        )
      })
      setEditingId(null)
      setEditText('')
      setEditDueDate('')
      setEditPriority('Medium')
      setEditCategory('Other')
      setEditSubtasks([])
      setEditSubtaskInput('')
      setEditReminder('')
    },
    [editText, editDueDate, editPriority, editCategory, editSubtasks, editReminder]
  )

  const cancelEdit = useCallback(() => {
    setEditingId(null)
    setEditText('')
    setEditDueDate('')
    setEditPriority('Medium')
    setEditCategory('Other')
    setEditSubtasks([])
    setEditSubtaskInput('')
    setEditReminder('')
  }, [])

  // ── Subtask handlers (edit form) ────────────────────
  const addEditSubtask = useCallback(() => {
    const trimmed = editSubtaskInput.trim()
    if (!trimmed) return
    setEditSubtasks(prev => [...prev, { id: nextSubId.current++, text: trimmed, completed: false }])
    setEditSubtaskInput('')
  }, [editSubtaskInput])

  const deleteEditSubtask = useCallback(id => {
    setEditSubtasks(prev => prev.filter(s => s.id !== id))
  }, [])

  const toggleEditSubtask = useCallback(id => {
    setEditSubtasks(prev => prev.map(s => s.id === id ? { ...s, completed: !s.completed } : s))
  }, [])

  // ── Subtask handlers (task list, non-editing) ────────
  const toggleSubtask = useCallback((taskId, subId) => {
    setTasks(prev =>
      prev.map(task => {
        if (task.id !== taskId) return task
        const sub = (task.subtasks || []).find(s => s.id === subId)
        return {
          ...task,
          subtasks: (task.subtasks || []).map(s => s.id === subId ? { ...s, completed: !s.completed } : s),
          activity: [
            makeActivity(`Subtask "${sub ? sub.text : ''}" ${sub && sub.completed ? 'reopened' : 'completed'}`),
            ...(task.activity || []),
          ],
        }
      })
    )
  }, [])

  const addSubtaskToTask = useCallback(taskId => {
    const text = (inlineSubInputs[taskId] || '').trim()
    if (!text) return
    setTasks(prev =>
      prev.map(task =>
        task.id === taskId
          ? {
              ...task,
              subtasks: [...(task.subtasks || []), { id: nextSubId.current++, text, completed: false }],
              activity: [
                makeActivity(`Subtask added: "${text}"`),
                ...(task.activity || []),
              ],
            }
          : task
      )
    )
    setInlineSubInputs(prev => ({ ...prev, [taskId]: '' }))
  }, [inlineSubInputs])

  const deleteSubtaskFromTask = useCallback((taskId, subId) => {
    setTasks(prev =>
      prev.map(task => {
        if (task.id !== taskId) return task
        const sub = (task.subtasks || []).find(s => s.id === subId)
        return {
          ...task,
          subtasks: (task.subtasks || []).filter(s => s.id !== subId),
          activity: [
            makeActivity(`Subtask deleted: "${sub ? sub.text : ''}"`),
            ...(task.activity || []),
          ],
        }
      })
    )
  }, [])

  const handleEditKeyDown = useCallback(
    (e, id) => {
      if (e.key === 'Enter') saveEdit(id)
      if (e.key === 'Escape') cancelEdit()
    },
    [saveEdit, cancelEdit]
  )

  // ── Drag-and-drop handlers (manual sort only) ────────
  const handleDragStart = useCallback((e, taskId) => {
    setDraggedId(taskId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(taskId))
  }, [])

  const handleDragOver = useCallback((e, taskId) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (taskId !== draggedId) setDragOverId(taskId)
  }, [draggedId])

  const handleDragLeave = useCallback(() => {
    setDragOverId(null)
  }, [])

  const handleDrop = useCallback((e, targetId) => {
    e.preventDefault()
    e.stopPropagation()
    if (draggedId === null || draggedId === targetId) {
      setDraggedId(null)
      setDragOverId(null)
      return
    }
    setTasks(prev => {
      const draggedIndex = prev.findIndex(t => t.id === draggedId)
      if (draggedIndex === -1) return prev
      const next = [...prev]
      const [dragged] = next.splice(draggedIndex, 1)
      const targetIndex = next.findIndex(t => t.id === targetId)
      if (targetIndex === -1) {
        next.splice(draggedIndex, 0, dragged)
        return prev
      }
      next.splice(targetIndex, 0, dragged)
      return next
    })
    setDraggedId(null)
    setDragOverId(null)
  }, [draggedId])

  const handleDragEnd = useCallback(() => {
    setDraggedId(null)
    setDragOverId(null)
  }, [])

  // ── Keyboard-accessible move (manual sort only) ──────
  const moveTask = useCallback((taskId, direction) => {
    setTasks(prev => {
      const visible = prev.filter(task => {
        if (task.archived) return false
        if (filter === 'Pending' && task.completed) return false
        if (filter === 'Completed' && !task.completed) return false
        if (categoryFilter !== 'All' && task.category !== categoryFilter) return false
        if (search.trim() && !task.text.toLowerCase().includes(search.trim().toLowerCase())) return false
        return true
      })
      const visibleIndex = visible.findIndex(t => t.id === taskId)
      if (visibleIndex === -1) return prev
      const swapIndex = direction === 'up' ? visibleIndex - 1 : visibleIndex + 1
      if (swapIndex < 0 || swapIndex >= visible.length) return prev
      const swapTaskId = visible[swapIndex].id
      const idx1 = prev.findIndex(t => t.id === taskId)
      const idx2 = prev.findIndex(t => t.id === swapTaskId)
      if (idx1 === -1 || idx2 === -1) return prev
      const next = [...prev]
      const tmp = next[idx1]
      next[idx1] = next[idx2]
      next[idx2] = tmp
      return next
    })
  }, [filter, categoryFilter, search])

  // ── Notification handlers ────────────────────────────
  const dismissNotif = useCallback(id => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }, [])

  const dismissAllNotifs = useCallback(() => {
    setNotifications([])
  }, [])

  // ── Export & Import handlers ─────────────────────────
  const exportTasks = useCallback(() => {
    const data = JSON.stringify(tasks, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const d = new Date()
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    a.download = `task-tracker-export-${dateStr}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [tasks])

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileSelect = useCallback(e => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = event => {
      const raw = event.target.result
      const result = validateImportData(raw)
      if (result.error) {
        window.alert(`Import failed: ${result.error}`)
        e.target.value = ''
        return
      }
      const importedTasks = result.tasks
      const existingIds = new Set(tasks.map(t => t.id))
      const duplicates = importedTasks.filter(t => t.id !== null && existingIds.has(t.id))
      const nonDuplicates = importedTasks.filter(t => t.id === null || !existingIds.has(t.id))
      let tasksToImport
      if (duplicates.length > 0) {
        const importDuplicates = window.confirm(
          `Found ${duplicates.length} duplicate task(s) with existing IDs.\n\n` +
          `Click OK to import ALL ${importedTasks.length} tasks (duplicates get new IDs).\n` +
          `Click Cancel to import only ${nonDuplicates.length} new task(s) (skip duplicates).`
        )
        tasksToImport = importDuplicates ? importedTasks : nonDuplicates
      } else {
        tasksToImport = importedTasks
      }
      if (tasksToImport.length === 0) {
        window.alert('No tasks to import.')
        e.target.value = ''
        return
      }
      if (!window.confirm(`Import ${tasksToImport.length} task(s)?`)) {
        e.target.value = ''
        return
      }
      const usedIds = new Set(tasks.map(t => t.id))
      const newTasks = tasksToImport.map(t => {
        let newId = t.id
        if (t.id === null || usedIds.has(t.id)) {
          newId = nextId.current++
        }
        usedIds.add(newId)
        const subtasks = (t.subtasks || []).map(s => ({
          ...s,
          id: nextSubId.current++,
        }))
        return { ...t, id: newId, subtasks }
      })
      nextId.current = Math.max(nextId.current, ...usedIds, 0) + 1
      setTasks(prev => [...prev, ...newTasks])
      window.alert(`Successfully imported ${newTasks.length} task(s).`)
      e.target.value = ''
    }
    reader.onerror = () => {
      window.alert('Failed to read the file.')
      e.target.value = ''
    }
    reader.readAsText(file)
  }, [tasks])

  const filteredTasks = tasks.filter(task => {
    if (task.archived) return false
    if (filter === 'Pending' && task.completed) return false
    if (filter === 'Completed' && !task.completed) return false
    if (categoryFilter !== 'All' && task.category !== categoryFilter) return false
    if (search.trim() && !task.text.toLowerCase().includes(search.trim().toLowerCase())) return false
    return true
  })

  const sortedTasks = sortTasks(filteredTasks, sortBy)

  const activeTasks = tasks.filter(t => !t.archived)
  const archivedTasks = tasks.filter(t => t.archived)
  const totalCount = activeTasks.length
  const completedCount = activeTasks.filter(t => t.completed).length
  const pendingCount = totalCount - completedCount
  const today = getTodayStr()
  const activityTask = activityTaskId !== null ? tasks.find(t => t.id === activityTaskId) : null
  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <div className="app">
      <header className="header">
        <h1 className="header__title">Task Tracker</h1>
        <p className="header__subtitle">Stay organized, get things done</p>
        <div className="notif-container">
          <button
            className="notif-bell"
            onClick={() => setNotifPanelOpen(prev => !prev)}
            aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
          >
            🔔
            {unreadCount > 0 && (
              <span className="notif-bell__badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
            )}
          </button>
          {notifPanelOpen && (
            <div className="notif-panel" role="dialog" aria-label="Notifications">
              <div className="notif-panel__header">
                <span className="notif-panel__title">Notifications</span>
                {notifications.length > 0 && (
                  <button className="notif-panel__clear" onClick={dismissAllNotifs} aria-label="Dismiss all notifications">Clear all</button>
                )}
              </div>
              {notifications.length === 0 ? (
                <div className="notif-panel__empty">No notifications</div>
              ) : (
                <ul className="notif-panel__list">
                  {notifications.map(n => (
                    <li key={n.id} className={`notif-item${!n.read ? ' notif-item--unread' : ''}`}>
                      <button className="notif-item__dismiss" onClick={() => dismissNotif(n.id)} aria-label="Dismiss notification">✕</button>
                      <div className="notif-item__body">
                        <span className="notif-item__text">Reminder: "{n.taskText}"</span>
                        <span className="notif-item__time">{formatTimestamp(n.timestamp)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <div className="notif-panel__note">Reminders work while the app is open</div>
            </div>
          )}
        </div>
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
            <input
              className="task-input task-input--datetime"
              type="datetime-local"
              value={reminder}
              onChange={e => setReminder(e.target.value)}
              aria-label="Task reminder (optional)"
            />
            <button className="add-btn" onClick={addTask} aria-label="Add task">
              Add
            </button>
          </div>
          <div className="subtask-section">
            <div className="subtask-add-row">
              <input
                className="task-input subtask-input"
                type="text"
                placeholder="Add a subtask..."
                value={subtaskInput}
                onChange={e => setSubtaskInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addNewSubtask() } }}
                aria-label="Add subtask"
              />
              <button className="subtask-add-btn" onClick={addNewSubtask} aria-label="Add subtask">+</button>
            </div>
            {newSubtasks.length > 0 && (
              <ul className="subtask-list">
                {newSubtasks.map(s => (
                  <li key={s.id} className="subtask">
                    <label className="subtask__label">
                      <input type="checkbox" className="subtask__checkbox" checked={s.completed} onChange={() => toggleNewSubtask(s.id)} aria-label={`Mark subtask "${s.text}" as ${s.completed ? 'incomplete' : 'complete'}`} />
                      <span className={`subtask__text${s.completed ? ' subtask__text--done' : ''}`}>{s.text}</span>
                    </label>
                    <button className="subtask__delete" onClick={() => deleteNewSubtask(s.id)} aria-label="Delete subtask">✕</button>
                  </li>
                ))}
              </ul>
            )}
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
              {activeTasks.length === 0
                ? 'No tasks yet. Add one above!'
                : search.trim()
                  ? `No tasks match "${search.trim()}".`
                  : categoryFilter !== 'All'
                    ? `No ${categoryFilter.toLowerCase()} tasks.`
                    : `No ${filter.toLowerCase()} tasks.`}
            </div>
          ) : (
            <ul className="task-list" role="list">
              {sortedTasks.map((task, index) => (
                <li
                  key={task.id}
                  className={`task-item${
                    task.completed && editingId !== task.id
                      ? ' task-item--completed'
                      : ''
                  }${draggedId === task.id ? ' task-item--dragging' : ''}${
                    dragOverId === task.id ? ' task-item--drag-over' : ''
                  }`}
                  draggable={sortBy === 'manual'}
                  onDragStart={sortBy === 'manual' ? e => handleDragStart(e, task.id) : undefined}
                  onDragOver={sortBy === 'manual' ? e => handleDragOver(e, task.id) : undefined}
                  onDragLeave={sortBy === 'manual' ? handleDragLeave : undefined}
                  onDrop={sortBy === 'manual' ? e => handleDrop(e, task.id) : undefined}
                  onDragEnd={sortBy === 'manual' ? handleDragEnd : undefined}
                >
                  {editingId === task.id ? (
                    <>
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
                      <input
                        className="task-input task-input--inline task-input--datetime"
                        type="datetime-local"
                        value={editReminder}
                        onChange={e => setEditReminder(e.target.value)}
                        aria-label="Edit task reminder"
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
                    <div className="subtask-section">
                      <div className="subtask-add-row">
                        <input
                          className="task-input subtask-input"
                          type="text"
                          placeholder="Add a subtask..."
                          value={editSubtaskInput}
                          onChange={e => setEditSubtaskInput(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addEditSubtask() } }}
                          aria-label="Add subtask"
                        />
                        <button className="subtask-add-btn" onClick={addEditSubtask} aria-label="Add subtask">+</button>
                      </div>
                      {editSubtasks.length > 0 && (
                        <ul className="subtask-list">
                          {editSubtasks.map(s => (
                            <li key={s.id} className="subtask">
                              <label className="subtask__label">
                                <input type="checkbox" className="subtask__checkbox" checked={s.completed} onChange={() => toggleEditSubtask(s.id)} aria-label={`Mark subtask "${s.text}" as ${s.completed ? 'incomplete' : 'complete'}`} />
                                <span className={`subtask__text${s.completed ? ' subtask__text--done' : ''}`}>{s.text}</span>
                              </label>
                              <button className="subtask__delete" onClick={() => deleteEditSubtask(s.id)} aria-label="Delete subtask">✕</button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    </>
                  ) : (
                    <>
                      <div className="task-item__main">
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
                            {task.reminder && (
                              <span className="task-item__reminder">
                                🔔 {formatReminder(task.reminder)}
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
                            {task.subtasks && task.subtasks.length > 0 && (
                              <span className="task-item__subtask-count">
                                {task.subtasks.filter(s => s.completed).length}/{task.subtasks.length} subtasks
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
                      <button
                        className="task-item__history"
                        onClick={() => setActivityTaskId(task.id)}
                        aria-label={`View activity history for "${task.text}"`}
                      >
                        🕐
                      </button>
                      <button
                        className="task-item__archive"
                        onClick={() => archiveTask(task.id)}
                        aria-label={`Archive task "${task.text}"`}
                      >
                        📦
                      </button>
                      {sortBy === 'manual' && (
                        <div className="task-item__move-buttons">
                          <button
                            className="task-item__move"
                            onClick={() => moveTask(task.id, 'up')}
                            disabled={index === 0}
                            aria-label="Move task up"
                          >
                            ▲
                          </button>
                          <button
                            className="task-item__move"
                            onClick={() => moveTask(task.id, 'down')}
                            disabled={index === sortedTasks.length - 1}
                            aria-label="Move task down"
                          >
                            ▼
                          </button>
                        </div>
                      )}
                      </div>
                      {task.subtasks && task.subtasks.length > 0 && (
                        <div className="task-item__subtasks">
                          <div className="subtask-progress">
                            {task.subtasks.filter(s => s.completed).length} of {task.subtasks.length} subtasks completed
                          </div>
                          <ul className="subtask-list">
                            {task.subtasks.map(s => (
                              <li key={s.id} className="subtask">
                                <label className="subtask__label">
                                  <input type="checkbox" className="subtask__checkbox" checked={s.completed} onChange={() => toggleSubtask(task.id, s.id)} aria-label={`Mark subtask "${s.text}" as ${s.completed ? 'incomplete' : 'complete'}`} />
                                  <span className={`subtask__text${s.completed ? ' subtask__text--done' : ''}`}>{s.text}</span>
                                </label>
                                <button className="subtask__delete" onClick={() => deleteSubtaskFromTask(task.id, s.id)} aria-label="Delete subtask">✕</button>
                              </li>
                            ))}
                          </ul>
                          <div className="subtask-add-row">
                            <input
                              className="task-input subtask-input"
                              type="text"
                              placeholder="Add a subtask..."
                              value={inlineSubInputs[task.id] || ''}
                              onChange={e => setInlineSubInputs(prev => ({ ...prev, [task.id]: e.target.value }))}
                              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSubtaskToTask(task.id) } }}
                              aria-label="Add subtask"
                            />
                            <button className="subtask-add-btn" onClick={() => addSubtaskToTask(task.id)} aria-label="Add subtask">+</button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {activeTasks.length > 0 && (
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

        {completedCount > 0 && (
          <button
            className="archive-completed-btn"
            onClick={archiveAllCompleted}
            aria-label="Archive all completed tasks"
          >
            Archive all completed ({completedCount})
          </button>
        )}

        {archivedTasks.length > 0 && (
          <section className="archive-section" aria-label="Archived tasks">
            <button
              className="archive-section__toggle"
              onClick={() => setShowArchive(prev => !prev)}
              aria-expanded={showArchive}
            >
              Archived ({archivedTasks.length}) {showArchive ? '▲' : '▼'}
            </button>
            {showArchive && (
              <ul className="task-list archive-list" role="list">
                {archivedTasks.map(task => (
                  <li key={task.id} className="task-item task-item--archived">
                    <div className="task-item__main">
                      <div className="task-item__content">
                        <span className="task-item__text">{task.text}</span>
                        <div className="task-item__meta">
                          <span className={`task-item__badge task-item__badge--priority-${(task.priority || 'Medium').toLowerCase()}`}>
                            {task.priority || 'Medium'}
                          </span>
                          <span className={`task-item__badge task-item__badge--category-${(task.category || 'Other').toLowerCase()}`}>
                            {task.category || 'Other'}
                          </span>
                          {task.completed && (
                            <span className="task-item__badge task-item__badge--completed">Completed</span>
                          )}
                          {task.dueDate && (
                            <span className="task-item__due-date">{formatDate(task.dueDate)}</span>
                          )}
                          {task.reminder && (
                            <span className="task-item__reminder">🔔 {formatReminder(task.reminder)}</span>
                          )}
                          {task.subtasks && task.subtasks.length > 0 && (
                            <span className="task-item__subtask-count">
                              {task.subtasks.filter(s => s.completed).length}/{task.subtasks.length} subtasks
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        className="task-item__restore"
                        onClick={() => restoreTask(task.id)}
                        aria-label={`Restore task "${task.text}"`}
                      >
                        ↩
                      </button>
                      <button
                        className="task-item__delete"
                        onClick={() => deleteArchivedTask(task.id, task.text)}
                        aria-label={`Permanently delete task "${task.text}"`}
                      >
                        ✕
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <section className="data-actions" aria-label="Export and import tasks">
          <button className="data-action-btn" onClick={exportTasks}>
            ⬇ Export
          </button>
          <button className="data-action-btn" onClick={handleImportClick}>
            ⬆ Import
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
        </section>

        {activityTask && (
          <div className="activity-modal-overlay" onClick={() => setActivityTaskId(null)}>
            <div
              className="activity-modal"
              onClick={e => e.stopPropagation()}
              role="dialog"
              aria-label={`Activity history for "${activityTask.text}"`}
            >
              <div className="activity-modal__header">
                <h2 className="activity-modal__title">Activity History</h2>
                <button
                  className="activity-modal__close"
                  onClick={() => setActivityTaskId(null)}
                  aria-label="Close activity history"
                >
                  ✕
                </button>
              </div>
              <div className="activity-modal__task-name">{activityTask.text}</div>
              {(activityTask.activity || []).length === 0 ? (
                <div className="activity-modal__empty">No activity recorded yet.</div>
              ) : (
                <ul className="activity-timeline">
                  {(activityTask.activity || []).map((a, i) => (
                    <li key={i} className="activity-timeline__item">
                      <span className="activity-timeline__time">
                        {formatTimestamp(a.timestamp)}
                      </span>
                      <span className="activity-timeline__desc">{a.description}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default App
