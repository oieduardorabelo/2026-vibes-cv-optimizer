import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api, type Pipeline } from '../lib/api'

export function Dashboard() {
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')

  const { data: pipelines = [], isLoading } = useQuery({
    queryKey: ['pipelines'],
    queryFn: api.pipelines.list,
  })

  const createMutation = useMutation({
    mutationFn: (data: Partial<Pipeline>) => api.pipelines.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipelines'] })
      setShowCreate(false)
      setName('')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.pipelines.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pipelines'] }),
  })

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              CVCV
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              CV optimization pipelines
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            New Pipeline
          </button>
        </div>

        {showCreate && (
          <div className="mb-6 p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                createMutation.mutate({ name: name || 'Untitled Pipeline' })
              }}
              className="flex gap-3"
            >
              <input
                type="text"
                placeholder="Pipeline name..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                Create
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreate(false)
                  setName('')
                }}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              >
                Cancel
              </button>
            </form>
          </div>
        )}

        {isLoading ? (
          <p className="text-gray-500 dark:text-gray-400">Loading...</p>
        ) : pipelines.length === 0 ? (
          <div className="text-center py-16 text-gray-400 dark:text-gray-500">
            <p className="text-lg">No pipelines yet</p>
            <p className="mt-1">Create one to get started</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pipelines.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors"
              >
                <Link
                  to={`/pipelines/${p.id}`}
                  className="flex-1 min-w-0"
                >
                  <h3 className="font-medium text-gray-900 dark:text-gray-100 truncate">
                    {p.name}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                    Updated {new Date(p.updatedAt).toLocaleDateString()}
                  </p>
                </Link>
                <button
                  onClick={() => deleteMutation.mutate(p.id)}
                  className="ml-4 p-2 text-gray-400 hover:text-red-500 transition-colors"
                  title="Delete pipeline"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
