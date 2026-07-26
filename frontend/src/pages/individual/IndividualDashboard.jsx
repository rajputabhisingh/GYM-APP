import { useState, useEffect, useCallback } from 'react'
import Navbar from '../../components/Navbar'
import SidePanel from '../../components/SidePanel'
import client from '../../api/client'
import WorkoutsTab from './WorkoutsTab'
import ProgressTab from './ProgressTab'
import SettingsTab from './SettingsTab'

const TABS = [
  { key: 'workouts', label: 'Workouts' },
  { key: 'progress', label: 'Progress' },
  { key: 'settings', label: 'Settings' },
]

export default function IndividualDashboard() {
  const [tab, setTab] = useState('workouts')
  const [allExercises, setAllExercises] = useState([])
  const [recentExerciseIds, setRecentExerciseIds] = useState([])
  const [snapshotVersion, setSnapshotVersion] = useState(0)

  const loadRecents = useCallback(() => {
    client.get('/workouts', { params: { limit: 10 } }).then((res) => {
      const ids = []
      for (const w of res.data) {
        for (const we of w.workout_exercises || []) {
          if (!ids.includes(we.exercise_id)) ids.push(we.exercise_id)
        }
      }
      setRecentExerciseIds(ids)
    })
    setSnapshotVersion((v) => v + 1)
  }, [])

  const bumpSnapshot = useCallback(() => setSnapshotVersion((v) => v + 1), [])

  useEffect(() => {
    client.get('/exercises').then((res) => setAllExercises(res.data))
    loadRecents()
  }, [loadRecents])

  return (
    <div className="app-shell">
      <Navbar />
      <div className="main">
        <div className="dashboard-layout">
          <div className="tab-nav">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                className={`tab-btn${tab === t.key ? ' active' : ''}`}
                onClick={() => setTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="tab-content" key={tab}>
            <div className="tab-fade">
              {tab === 'workouts' && (
                <WorkoutsTab
                  allExercises={allExercises}
                  recentExerciseIds={recentExerciseIds}
                  onDataChange={loadRecents}
                />
              )}
              {tab === 'progress' && <ProgressTab />}
              {tab === 'settings' && <SettingsTab onGoalsSaved={bumpSnapshot} />}
            </div>
          </div>

          <SidePanel onEditGoals={() => setTab('settings')} refreshKey={snapshotVersion} />
        </div>
      </div>
    </div>
  )
}