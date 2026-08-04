import { useMemo, useState } from 'react'
import Sidebar from './components/Sidebar.jsx'
import { useLedger, useNow } from './lib/ledger.js'
import { useRoute } from './lib/router.js'
import { buildConsoleViewModel } from './lib/console-view-model.js'
import ConsoleOverview from './pages/ConsoleOverview.jsx'
import MissionControl from './pages/MissionControl.jsx'

export default function App() {
  const ledger = useLedger()
  const now = useNow()
  const route = useRoute()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const consoleView = useMemo(() => buildConsoleViewModel(ledger, now), [ledger, now])

  const activeSpace = route.name === 'mission' ? 'missions' : 'overview'
  const closeSidebar = () => setSidebarOpen(false)

  return (
    <div className="app-shell">
      <Sidebar
        activeSpace={activeSpace}
        onNavigate={(path) => { route.navigate(path); closeSidebar() }}
        open={sidebarOpen}
        onClose={closeSidebar}
      />
      <main className="app-main">
        {route.name === 'mission' ? (
          <MissionControl
            missionId={route.params.missionId}
            ledger={ledger}
            now={now}
            onBack={() => route.navigate('/')}
            onMenu={() => setSidebarOpen(true)}
          />
        ) : (
          <ConsoleOverview
            view={consoleView}
            onOpenMission={(missionId) => route.navigate(`/missions/${missionId}`)}
            onMenu={() => setSidebarOpen(true)}
          />
        )}
      </main>
    </div>
  )
}
