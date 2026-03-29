import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Dashboard } from './pages/Dashboard'
import { PipelineView } from './pages/PipelineView'
import { BranchView } from './pages/BranchView'

const queryClient = new QueryClient()

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/pipelines/:id" element={<PipelineView />} />
          <Route path="/pipelines/:id/branches/:branchId" element={<BranchView />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
