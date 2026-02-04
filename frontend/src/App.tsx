import { Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import ChatPage from './pages/ChatPage'
import HistoryPage from './pages/HistoryPage'
import RoleManager from './pages/RoleManager'
import Settings from './pages/Settings'

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/chat/:id" element={<ChatPage />} />
      <Route path="/history" element={<HistoryPage />} />
      <Route path="/roles" element={<RoleManager />} />
      <Route path="/settings" element={<Settings />} />
    </Routes>
  )
}

export default App
