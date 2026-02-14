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

type TaskState = 'inbox' | 'today' | 'active' | 'done'

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
  state: 'active' | 'done'
  order: number
  createdAt: string
}

type ViewMode = 'inbox' | 'today' | 'project'

const stateLabels: Record<TaskState, string> = {
  inbox: 'Inbox',
  today: 'Today',
  active: 'Active',
  done: 'Done',
}

const taskStates: TaskState[] = ['inbox', 'today', 'active', 'done']

const todayString = () => new Date().toISOString().slice(0, 10)
const nowIso = () => new Date().toISOString()

const seedProjects: Project[] = [
  { id: 'p-home', name: 'Home', state: 'active', order: 10, createdAt: nowIso() },
  { id: 'p-work', name: 'Work', state: 'active', order: 20, createdAt: nowIso() },
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
    state: 'active',
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
    state: 'active',
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
    state: 'active',
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
    state: (data.state as 'active' | 'done') ?? 'active',
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
  const [projectListView, setProjectListView] = useState(true)
  const [quickText, setQuickText] = useState('')
  const [newProjectName, setNewProjectName] = useState('')
  const [showNewProjectForm, setShowNewProjectForm] = useState(false)

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
    return tasks
      .filter((task) => task.state === 'today')
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

  // Get all descendant tasks recursively
  const getDescendantTasks = (taskId: string, allTasks: Task[]): Task[] => {
    const children = allTasks.filter((t) => t.parentId === taskId)
    const descendants: Task[] = [...children]
    children.forEach((child) => {
      descendants.push(...getDescendantTasks(child.id, allTasks))
    })
    return descendants
  }

  const updateTask = async (id: string, patch: Partial<Task>) => {
    // Check if we're marking as done and there are descendant tasks
    if (patch.state === 'done') {
      const descendants = getDescendantTasks(id, tasks)
      const incompletedDescendants = descendants.filter((t) => t.state !== 'done')
      
      if (incompletedDescendants.length > 0) {
        const confirmed = window.confirm(
          `This task has ${incompletedDescendants.length} incomplete subtask(s). ` +
          `Marking this task as done will also mark all subtasks as done. Continue?`
        )
        if (!confirmed) {
          return
        }
      }

      // Update all descendants to done
      const allToUpdate = [id, ...descendants.map((t) => t.id)]
      
      setTasks((prev) =>
        prev.map((task) => {
          if (!allToUpdate.includes(task.id)) {
            return task
          }
          return {
            ...task,
            state: 'done' as TaskState,
            doneAt: nowIso(),
            updatedAt: nowIso(),
          }
        }),
      )

      // Update in Firestore
      await Promise.all(
        allToUpdate.map((taskId) =>
          updateDoc(doc(db, 'tasks', taskId), {
            state: 'done',
            doneAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        )
      )
      return
    }

    // Normal update flow for non-done state changes
    setTasks((prev) =>
      prev.map((task) => {
        if (task.id !== id) {
          return task
        }
        let doneAt = task.doneAt
        if (patch.state && task.state === 'done') {
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
    // Set doneAt to null when changing from done to another state
    const currentTask = tasks.find((t) => t.id === id)
    if (patch.state && currentTask?.state === 'done') {
      updates.doneAt = null
    }
    await updateDoc(doc(db, 'tasks', id), updates)
  }

  const renderTaskRow = (task: Task) => {
    // Get potential parent tasks: same project, not self, not inbox state
    const potentialParents = tasks.filter(
      (t) =>
        t.projectId === task.projectId &&
        t.id !== task.id &&
        t.state !== 'inbox',
    )

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
              value={task.projectId ?? 'p-default'}
              onChange={(event) =>
                updateTask(task.id, {
                  projectId: event.target.value,
                })
              }
            >
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Parent Task
            <select
              value={task.parentId ?? ''}
              onChange={(event) =>
                updateTask(task.id, {
                  parentId: event.target.value || null,
                })
              }
            >
              <option value="">No parent</option>
              {potentialParents.map((parent) => (
                <option key={parent.id} value={parent.id}>
                  {parent.text}
                </option>
              ))}
            </select>
          </label>
          {task.state !== 'today' && (
            <button
              className="btn-today"
              onClick={() => updateTask(task.id, { state: 'today' })}
            >
              ⭐ Add to Today
            </button>
          )}
        </div>
      </div>
    )
  }

  const renderTodayTree = (projectId: string, parentId: string | null, depth = 0) => {
    const nodes = todayTasks
      .filter((task) => task.projectId === projectId && task.parentId === parentId)
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
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {task.state !== 'done' && (
                  <button
                    className="btn-done-small"
                    onClick={() => updateTask(task.id, { state: 'done' })}
                  >
                    ✓
                  </button>
                )}
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
            </div>
            {renderTodayTree(projectId, task.id, depth + 1)}
          </li>
        ))}
      </ul>
    )
  }

  const renderProjectTree = (parentId: string | null, depth = 0) => {
    const allNodes = projectTasks
      .filter((task) => task.parentId === parentId)
      .sort((a, b) => a.order - b.order)
    
    const activeNodes = allNodes.filter((task) => task.state !== 'done')
    const doneNodes = allNodes.filter((task) => task.state === 'done')
    
    if (allNodes.length === 0) {
      return null
    }
    
    return (
      <>
        {activeNodes.length > 0 && (
          <ul className="tree" style={{ marginLeft: depth * 16 }}>
            {activeNodes.map((task) => (
              <li key={task.id}>
                <div className="tree-row">
                  <span className="tree-text">{task.text}</span>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {task.state !== 'today' && (
                      <button
                        className="btn-today-small"
                        onClick={() => updateTask(task.id, { state: 'today' })}
                      >
                        ⭐
                      </button>
                    )}
                    {task.state !== 'done' && (
                      <button
                        className="btn-done-small"
                        onClick={() => updateTask(task.id, { state: 'done' })}
                      >
                        ✓
                      </button>
                    )}
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
                </div>
                {renderProjectTree(task.id, depth + 1)}
              </li>
            ))}
          </ul>
        )}
        {doneNodes.length > 0 && (
          <>
            {activeNodes.length > 0 && (
              <div className={depth === 0 ? "tree-separator" : "tree-separator-small"}>
                {depth === 0 ? <span>Completed Tasks</span> : <span>Completed</span>}
              </div>
            )}
            <ul className="tree" style={{ marginLeft: depth * 16 }}>
              {doneNodes.map((task) => (
                <li key={task.id}>
                  <div className="tree-row tree-row-done">
                    <span className="tree-text">{task.text}</span>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
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
                  </div>
                  {renderProjectTree(task.id, depth + 1)}
                </li>
              ))}
            </ul>
          </>
        )}
      </>
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
            onClick={() => {
              setView('project')
              setProjectListView(true)
            }}
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
                  <p>Tasks scheduled for today.</p>
                </div>
                <div className="badge">{todayTasks.length} items</div>
              </div>
              <div className="panel-body">
                {todayTasks.length ? (
                  (() => {
                    // Group tasks by projectId
                    const projectIds = Array.from(
                      new Set(todayTasks.map((task) => task.projectId))
                    )
                    return projectIds.map((projectId) => {
                      const project = projectId ? projectMap.get(projectId) : null
                      return (
                        <div key={projectId || 'no-project'} className="today-project-group">
                          <h3 className="today-project-title">
                            {project ? project.name : 'No Project'}
                          </h3>
                          {renderTodayTree(projectId || '', null)}
                        </div>
                      )
                    })
                  })()
                ) : (
                  <div className="empty">No tasks for today.</div>
                )}
              </div>
            </section>
          )}

          {view === 'project' && projectListView && (
            <section className="panel">
              <div className="panel-header">
                <div>
                  <h2>Projects</h2>
                  <p>Select a project to view details.</p>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <div className="badge">{projects.length} projects</div>
                  <button
                    className="btn-primary"
                    onClick={() => setShowNewProjectForm(!showNewProjectForm)}
                  >
                    {showNewProjectForm ? 'Cancel' : '+ New Project'}
                  </button>
                </div>
              </div>
              <div className="panel-body">
                {showNewProjectForm && (
                  <div className="new-project-form">
                    <input
                      type="text"
                      placeholder="Project name"
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      onKeyDown={async (e) => {
                        if (e.key === 'Enter' && newProjectName.trim()) {
                          const maxOrder = projects.reduce(
                            (max, p) => Math.max(max, p.order),
                            0,
                          )
                          await addDoc(collection(db, 'projects'), {
                            name: newProjectName.trim(),
                            state: 'active',
                            order: maxOrder + 10,
                            createdAt: serverTimestamp(),
                          })
                          const projectSnap = await getDocs(
                            query(collection(db, 'projects'), orderBy('order')),
                          )
                          const nextProjects = projectSnap.docs.map((docSnap) =>
                            mapProjectDoc(docSnap.id, docSnap.data()),
                          )
                          setProjects(nextProjects)
                          setNewProjectName('')
                          setShowNewProjectForm(false)
                        }
                      }}
                    />
                    <button
                      className="btn-primary"
                      onClick={async () => {
                        if (newProjectName.trim()) {
                          const maxOrder = projects.reduce(
                            (max, p) => Math.max(max, p.order),
                            0,
                          )
                          await addDoc(collection(db, 'projects'), {
                            name: newProjectName.trim(),
                            state: 'active',
                            order: maxOrder + 10,
                            createdAt: serverTimestamp(),
                          })
                          const projectSnap = await getDocs(
                            query(collection(db, 'projects'), orderBy('order')),
                          )
                          const nextProjects = projectSnap.docs.map((docSnap) =>
                            mapProjectDoc(docSnap.id, docSnap.data()),
                          )
                          setProjects(nextProjects)
                          setNewProjectName('')
                          setShowNewProjectForm(false)
                        }
                      }}
                    >
                      Add
                    </button>
                  </div>
                )}
                {projects.length ? (
                  <>
                    {projects.filter((p) => p.state === 'active').length > 0 && (
                      <div className="project-section">
                        <h3 className="project-section-title">Active Projects</h3>
                        <div className="project-list">
                          {projects
                            .filter((project) => project.state === 'active')
                            .map((project) => {
                              const projectTaskCount = tasks.filter(
                                (task) => task.projectId === project.id,
                              ).length
                              return (
                                <div
                                  key={project.id}
                                  className="project-card"
                                  onClick={() => {
                                    setSelectedProjectId(project.id)
                                    setProjectListView(false)
                                  }}
                                >
                                  <div className="project-card-header">
                                    <span className="project-card-name">
                                      {project.name}
                                    </span>
                                    <span className="project-card-count">
                                      {projectTaskCount}{' '}
                                      {projectTaskCount === 1 ? 'task' : 'tasks'}
                                    </span>
                                  </div>
                                </div>
                              )
                            })}
                        </div>
                      </div>
                    )}

                    {projects.filter((p) => p.state === 'done').length > 0 && (
                      <div className="project-section">
                        <h3 className="project-section-title">Completed Projects</h3>
                        <div className="project-list">
                          {projects
                            .filter((project) => project.state === 'done')
                            .map((project) => {
                              const projectTaskCount = tasks.filter(
                                (task) => task.projectId === project.id,
                              ).length
                              return (
                                <div
                                  key={project.id}
                                  className="project-card project-card-done"
                                  onClick={() => {
                                    setSelectedProjectId(project.id)
                                    setProjectListView(false)
                                  }}
                                >
                                  <div className="project-card-header">
                                    <span className="project-card-name">
                                      {project.name}
                                    </span>
                                    <span className="project-card-count">
                                      {projectTaskCount}{' '}
                                      {projectTaskCount === 1 ? 'task' : 'tasks'}
                                    </span>
                                  </div>
                                </div>
                              )
                            })}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="empty">No projects available.</div>
                )}
              </div>
            </section>
          )}

          {view === 'project' && !projectListView && selectedProjectId && (
            <section className="panel">
              <div className="panel-header">
                <div>
                  <button
                    className="back-button"
                    onClick={() => setProjectListView(true)}
                  >
                    ← Back to Projects
                  </button>
                  <h2>{projectMap.get(selectedProjectId)?.name}</h2>
                  <p>Tree view based on parent tasks.</p>
                  {selectedProjectId !== 'p-default' && (
                    <div style={{ marginTop: '12px' }}>
                      <label style={{ fontSize: '0.9rem', color: '#52606d', marginRight: '8px' }}>
                        Status:
                      </label>
                      <select
                        value={projectMap.get(selectedProjectId)?.state || 'active'}
                        onChange={async (e) => {
                          const newState = e.target.value as 'active' | 'done'
                          
                          // Check if we're marking project as done
                          if (newState === 'done') {
                            const projectTasks = tasks.filter(
                              (t) => t.projectId === selectedProjectId
                            )
                            const incompletedTasks = projectTasks.filter(
                              (t) => t.state !== 'done'
                            )
                            
                            if (incompletedTasks.length > 0) {
                              const confirmed = window.confirm(
                                `This project has ${incompletedTasks.length} incomplete task(s). ` +
                                `Marking this project as done will also mark all tasks as done. Continue?`
                              )
                              if (!confirmed) {
                                return
                              }
                              
                              // Update all project tasks to done
                              setTasks((prev) =>
                                prev.map((task) => {
                                  if (task.projectId !== selectedProjectId || task.state === 'done') {
                                    return task
                                  }
                                  return {
                                    ...task,
                                    state: 'done' as TaskState,
                                    doneAt: nowIso(),
                                    updatedAt: nowIso(),
                                  }
                                }),
                              )
                              
                              // Update in Firestore
                              await Promise.all(
                                incompletedTasks.map((task) =>
                                  updateDoc(doc(db, 'tasks', task.id), {
                                    state: 'done',
                                    doneAt: serverTimestamp(),
                                    updatedAt: serverTimestamp(),
                                  })
                                )
                              )
                            }
                          }
                          
                          const projectRef = doc(db, 'projects', selectedProjectId)
                          await updateDoc(projectRef, { state: newState })
                          
                          // Update local state
                          const updatedProjects = projects.map((p) =>
                            p.id === selectedProjectId ? { ...p, state: newState } : p
                          )
                          setProjects(updatedProjects)
                        }}
                        style={{
                          padding: '6px 10px',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e0',
                          background: '#fff',
                          fontSize: '0.9rem',
                          cursor: 'pointer',
                        }}
                      >
                        <option value="active">Active</option>
                        <option value="done">Completed</option>
                      </select>
                    </div>
                  )}
                </div>
                <div className="badge">{projectTasks.length} tasks</div>
              </div>
              <div className="panel-body">
                {projectTasks.length ? (
                  renderProjectTree(null)
                ) : (
                  <div className="empty">No tasks in this project.</div>
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
