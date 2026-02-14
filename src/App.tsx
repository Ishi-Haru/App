import { useEffect, useMemo, useState } from 'react'
import {
  addDoc,
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import './App.css'
import { db } from './lib/firebase'

type TaskState =
  | 'inbox'
  | 'next'
  | 'scheduled'
  | 'waiting'
  | 'someday'
  | 'done'
  | 'cancelled'

type Task = {
  id: string
  text: string
  projectId: string | null
  parentId: string | null
  state: TaskState
  createdAt: string
  updatedAt: string
  dueAt: string | null
  scheduledAt: string | null
  doneAt: string | null
  order: number
}

type Project = {
  id: string
  name: string
  order: number
  createdAt: string
}

type ViewMode = 'inbox' | 'today' | 'project'

const stateLabels: Record<TaskState, string> = {
  inbox: 'Inbox',
  next: 'Next',
  scheduled: 'Scheduled',
  waiting: 'Waiting',
  someday: 'Someday',
  done: 'Done',
  cancelled: 'Cancelled',
}

const taskStates: TaskState[] = [
  'inbox',
  'next',
  'scheduled',
  'waiting',
  'someday',
  'done',
  'cancelled',
]

const todayString = () => new Date().toISOString().slice(0, 10)
const nowIso = () => new Date().toISOString()

const seedProjects: Project[] = [
  { id: 'p-home', name: 'Home', order: 10, createdAt: nowIso() },
  { id: 'p-work', name: 'Work', order: 20, createdAt: nowIso() },
]

const seedTasks: Task[] = [
  {
    id: 't-1',
    text: 'Collect ideas for weekly review',
    projectId: null,
    parentId: null,
    state: 'inbox',
    createdAt: nowIso(),
    updatedAt: nowIso(),
    dueAt: null,
    scheduledAt: null,
    doneAt: null,
    order: 10,
  },
  {
    id: 't-2',
    text: 'Plan meal prep for Friday',
    projectId: 'p-home',
    parentId: null,
    state: 'next',
    createdAt: nowIso(),
    updatedAt: nowIso(),
    dueAt: null,
    scheduledAt: todayString(),
    doneAt: null,
    order: 20,
  },
  {
    id: 't-3',
    text: 'Draft Q2 roadmap outline',
    projectId: 'p-work',
    parentId: null,
    state: 'scheduled',
    createdAt: nowIso(),
    updatedAt: nowIso(),
    dueAt: null,
    scheduledAt: todayString(),
    doneAt: null,
    order: 10,
  },
  {
    id: 't-4',
    text: 'Gather research notes',
    projectId: 'p-work',
    parentId: 't-3',
    state: 'next',
    createdAt: nowIso(),
    updatedAt: nowIso(),
    dueAt: null,
    scheduledAt: null,
    doneAt: null,
    order: 10,
  },
]

const toIsoString = (value: unknown) => {
  if (!value) {
    return null
  }
  if (typeof value === 'string') {
    return value
  }
  if (typeof value === 'object' && 'toDate' in value) {
    const timestamp = value as { toDate: () => Date }
    return timestamp.toDate().toISOString()
  }
  return null
}

const mapTaskDoc = (id: string, data: Partial<Task>) => {
  return {
    id,
    text: data.text ?? '',
    projectId: data.projectId ?? null,
    parentId: data.parentId ?? null,
    state: (data.state as TaskState) ?? 'inbox',
    createdAt: toIsoString(data.createdAt) ?? nowIso(),
    updatedAt: toIsoString(data.updatedAt) ?? nowIso(),
    dueAt: toIsoString(data.dueAt),
    scheduledAt: toIsoString(data.scheduledAt),
    doneAt: toIsoString(data.doneAt),
    order: typeof data.order === 'number' ? data.order : 0,
  }
}

const mapProjectDoc = (id: string, data: Partial<Project>) => {
  return {
    id,
    name: data.name ?? 'Untitled',
    order: typeof data.order === 'number' ? data.order : 0,
    createdAt: toIsoString(data.createdAt) ?? nowIso(),
  }
}

function App() {
  const [projects, setProjects] = useState<Project[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [view, setView] = useState<ViewMode>('inbox')
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null,
  )
  const [quickText, setQuickText] = useState('')

  useEffect(() => {
    let active = true
    const loadData = async () => {
      const projectQuery = query(collection(db, 'projects'), orderBy('order'))
      const taskQuery = query(
        collection(db, 'tasks'),
        where('state', 'in', taskStates),
        orderBy('order'),
      )
      const [projectSnap, taskSnap] = await Promise.all([
        getDocs(projectQuery),
        getDocs(taskQuery),
      ])
      if (!active) {
        return
      }
      const nextProjects = projectSnap.docs.map((docSnap) =>
        mapProjectDoc(docSnap.id, docSnap.data()),
      )
      const nextTasks = taskSnap.docs.map((docSnap) =>
        mapTaskDoc(docSnap.id, docSnap.data()),
      )
      setProjects(nextProjects.length ? nextProjects : seedProjects)
      setTasks(nextTasks.length ? nextTasks : seedTasks)
    }

    loadData()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!selectedProjectId && projects.length) {
      setSelectedProjectId(projects[0].id)
    }
  }, [projects, selectedProjectId])

  const projectMap = useMemo(() => {
    return new Map(projects.map((project) => [project.id, project]))
  }, [projects])

  const inboxTasks = useMemo(() => {
    return tasks
      .filter((task) => task.state === 'inbox')
      .sort((a, b) => a.order - b.order)
  }, [tasks])

  const todayTasks = useMemo(() => {
    const today = todayString()
    return tasks
      .filter((task) => task.scheduledAt === today && task.state !== 'done')
      .sort((a, b) => a.order - b.order)
  }, [tasks])

  const projectTasks = useMemo(() => {
    if (!selectedProjectId) {
      return []
    }
    return tasks
      .filter((task) => task.projectId === selectedProjectId)
      .sort((a, b) => a.order - b.order)
  }, [tasks, selectedProjectId])

  const addQuickTask = async () => {
    const trimmed = quickText.trim()
    if (!trimmed) {
      return
    }
    const rootOrders = tasks
      .filter((task) => task.parentId === null)
      .map((task) => task.order)
    const nextOrder = (rootOrders.length ? Math.max(...rootOrders) : 0) + 10
    const taskData = {
      text: trimmed,
      projectId: 'p-default',
      parentId: null,
      state: 'inbox' as TaskState,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      dueAt: null,
      scheduledAt: null,
      doneAt: null,
      order: nextOrder,
    }
    const docRef = await addDoc(collection(db, 'tasks'), taskData)
    const newTask: Task = {
      id: docRef.id,
      text: taskData.text,
      projectId: taskData.projectId,
      parentId: taskData.parentId,
      state: taskData.state,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      dueAt: taskData.dueAt,
      scheduledAt: taskData.scheduledAt,
      doneAt: taskData.doneAt,
      order: taskData.order,
    }
    setTasks((prev) => [...prev, newTask])
    setQuickText('')
    setView('inbox')
  }

  const updateTask = async (id: string, patch: Partial<Task>) => {
    setTasks((prev) =>
      prev.map((task) => {
        if (task.id !== id) {
          return task
        }
        let doneAt = task.doneAt
        if (patch.state === 'done') {
          doneAt = nowIso()
        } else if (patch.state && task.state === 'done') {
          doneAt = null
        }
        return {
          ...task,
          ...patch,
          doneAt,
          updatedAt: nowIso(),
        }
      }),
    )

    const updates: Record<string, unknown> = {
      ...patch,
      updatedAt: serverTimestamp(),
    }
    if (patch.state === 'done') {
      updates.doneAt = serverTimestamp()
    } else if (patch.state) {
      updates.doneAt = null
    }
    await updateDoc(doc(db, 'tasks', id), updates)
  }

  const renderTaskRow = (task: Task) => {
    return (
      <div className="task-row" key={task.id}>
        <div className="task-main">
          <span className="task-text">{task.text}</span>
          <span className={`state-pill state-${task.state}`}>
            {stateLabels[task.state]}
          </span>
        </div>
        <div className="task-meta">
          <label className="field">
            State
            <select
              value={task.state}
              onChange={(event) =>
                updateTask(task.id, { state: event.target.value as TaskState })
              }
            >
              {taskStates.map((state) => (
                <option key={state} value={state}>
                  {stateLabels[state]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Project
            <select
              value={task.projectId ?? ''}
              onChange={(event) =>
                updateTask(task.id, {
                  projectId: event.target.value || null,
                })
              }
            >
              <option value="">No project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Scheduled
            <input
              type="date"
              value={task.scheduledAt ?? ''}
              onChange={(event) =>
                updateTask(task.id, {
                  scheduledAt: event.target.value || null,
                })
              }
            />
          </label>
        </div>
      </div>
    )
  }

  const renderProjectTree = (parentId: string | null, depth = 0) => {
    const nodes = projectTasks
      .filter((task) => task.parentId === parentId)
      .sort((a, b) => a.order - b.order)
    if (!nodes.length) {
      return null
    }
    return (
      <ul className="tree" style={{ marginLeft: depth * 16 }}>
        {nodes.map((task) => (
          <li key={task.id}>
            <div className="tree-row">
              <span className="tree-text">{task.text}</span>
              <select
                className="tree-select"
                value={task.state}
                onChange={(event) =>
                  updateTask(task.id, {
                    state: event.target.value as TaskState,
                  })
                }
              >
                {taskStates.map((state) => (
                  <option key={state} value={state}>
                    {stateLabels[state]}
                  </option>
                ))}
              </select>
            </div>
            {renderProjectTree(task.id, depth + 1)}
          </li>
        ))}
      </ul>
    )
  }

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <p className="eyebrow">Todo Canvas</p>
          <h1>Focus, then sort later.</h1>
          <p className="subtitle">
            Capture quickly in Inbox, then organize by state and projects.
          </p>
        </div>
        <div className="quick-add">
          <input
            type="text"
            placeholder="Quick add to Inbox"
            value={quickText}
            onChange={(event) => setQuickText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                addQuickTask()
              }
            }}
          />
          <button onClick={addQuickTask}>Add</button>
        </div>
      </header>

      <div className="layout">
        <nav className="side-nav">
          <button
            className={view === 'inbox' ? 'active' : ''}
            onClick={() => setView('inbox')}
          >
            Inbox
            <span>{inboxTasks.length}</span>
          </button>
          <button
            className={view === 'today' ? 'active' : ''}
            onClick={() => setView('today')}
          >
            Today
            <span>{todayTasks.length}</span>
          </button>
          <button
            className={view === 'project' ? 'active' : ''}
            onClick={() => setView('project')}
          >
            Project
            <span>{projects.length}</span>
          </button>
        </nav>

        <main className="content">
          {view === 'inbox' && (
            <section className="panel">
              <div className="panel-header">
                <div>
                  <h2>Inbox整理</h2>
                  <p>Review quick captures and assign state or project.</p>
                </div>
                <div className="badge">
                  {inboxTasks.length} items
                </div>
              </div>
              <div className="panel-body">
                {inboxTasks.length ? (
                  inboxTasks.map((task) => renderTaskRow(task))
                ) : (
                  <div className="empty">Inbox is clear.</div>
                )}
              </div>
            </section>
          )}

          {view === 'today' && (
            <section className="panel">
              <div className="panel-header">
                <div>
                  <h2>Today</h2>
                  <p>Scheduled for today and not done.</p>
                </div>
                <div className="badge">{todayTasks.length} items</div>
              </div>
              <div className="panel-body">
                {todayTasks.length ? (
                  todayTasks.map((task) => (
                    <div className="task-row" key={task.id}>
                      <div className="task-main">
                        <span className="task-text">{task.text}</span>
                        <span className={`state-pill state-${task.state}`}>
                          {stateLabels[task.state]}
                        </span>
                      </div>
                      <div className="task-meta">
                        <label className="field">
                          State
                          <select
                            value={task.state}
                            onChange={(event) =>
                              updateTask(task.id, {
                                state: event.target.value as TaskState,
                              })
                            }
                          >
                            {taskStates.map((state) => (
                              <option key={state} value={state}>
                                {stateLabels[state]}
                              </option>
                            ))}
                          </select>
                        </label>
                        <div className="field">
                          Project
                          <span>
                            {task.projectId
                              ? projectMap.get(task.projectId)?.name
                              : 'No project'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="empty">No tasks scheduled today.</div>
                )}
              </div>
            </section>
          )}

          {view === 'project' && (
            <section className="panel">
              <div className="panel-header">
                <div>
                  <h2>Project</h2>
                  <p>Tree view based on parent tasks.</p>
                </div>
                <label className="field">
                  Project
                  <select
                    value={selectedProjectId ?? ''}
                    onChange={(event) =>
                      setSelectedProjectId(event.target.value || null)
                    }
                  >
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="panel-body">
                {selectedProjectId ? (
                  <>
                    <div className="project-summary">
                      <span className="project-name">
                        {projectMap.get(selectedProjectId)?.name}
                      </span>
                      <span>{projectTasks.length} tasks</span>
                    </div>
                    {projectTasks.length ? (
                      renderProjectTree(null)
                    ) : (
                      <div className="empty">No tasks in this project.</div>
                    )}
                  </>
                ) : (
                  <div className="empty">Select a project.</div>
                )}
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  )
}

export default App
