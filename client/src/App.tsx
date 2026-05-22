import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Dashboard } from './pages/Dashboard'
import { ProfileView } from './pages/ProfileView'
import { SearchView } from './pages/SearchView'

const queryClient = new QueryClient()

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/profiles/:id" element={<ProfileView />} />
          <Route path="/profiles/:profileId/searches/:searchId" element={<SearchView />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
