import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, type Branch, type SupplementaryContent } from '../lib/api'
import { Markdown } from '../components/Markdown'

export function PipelineView() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()

  const { data: pipeline, isLoading } = useQuery({
    queryKey: ['pipelines', id],
    queryFn: () => api.pipelines.get(id!),
    enabled: !!id,
  })

  const { data: supplementaryContents = [] } = useQuery({
    queryKey: ['supplementary-contents', id],
    queryFn: () => api.supplementaryContents.list(id!),
    enabled: !!id,
  })

  const { data: branchList = [] } = useQuery({
    queryKey: ['branches', id],
    queryFn: () => api.branches.list(id!),
    enabled: !!id,
  })

  const updatePipelineMutation = useMutation({
    mutationFn: (data: Record<string, string>) =>
      api.pipelines.update(id!, data),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['pipelines', id] }),
  })

  const createSupplementaryMutation = useMutation({
    mutationFn: (data: Partial<SupplementaryContent>) =>
      api.supplementaryContents.create(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplementary-contents', id] })
      setShowCreateSupplementary(false)
      setSupplementaryTitle('')
    },
  })

  const updateSupplementaryMutation = useMutation({
    mutationFn: ({ scId, data }: { scId: string; data: Partial<SupplementaryContent> }) =>
      api.supplementaryContents.update(scId, data),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['supplementary-contents', id] }),
  })

  const deleteSupplementaryMutation = useMutation({
    mutationFn: (scId: string) => api.supplementaryContents.delete(scId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['supplementary-contents', id] }),
  })

  const createBranchMutation = useMutation({
    mutationFn: (data: Partial<Branch>) => api.branches.create(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches', id] })
      setShowCreateBranch(false)
      setBranchName('')
    },
  })

  const deleteBranchMutation = useMutation({
    mutationFn: (branchId: string) => api.branches.delete(branchId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['branches', id] }),
  })

  const [showCreateSupplementary, setShowCreateSupplementary] = useState(false)
  const [supplementaryTitle, setSupplementaryTitle] = useState('')
  const [showCreateBranch, setShowCreateBranch] = useState(false)
  const [branchName, setBranchName] = useState('')

  // Editing state: field can be 'name', 'cvContent', or 'sc:<id>' for supplementary content
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [editTitle, setEditTitle] = useState('')

  const startEdit = (field: string, value: string, title?: string) => {
    setEditingField(field)
    setEditValue(value)
    if (title !== undefined) setEditTitle(title)
  }

  const saveEdit = () => {
    if (!editingField) return
    if (editingField.startsWith('sc:')) {
      const scId = editingField.slice(3)
      updateSupplementaryMutation.mutate({
        scId,
        data: { content: editValue, title: editTitle },
      })
    } else {
      updatePipelineMutation.mutate({ [editingField]: editValue })
    }
    setEditingField(null)
    setEditValue('')
    setEditTitle('')
  }

  const cancelEdit = () => {
    setEditingField(null)
    setEditValue('')
    setEditTitle('')
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && editingField) {
        e.preventDefault()
        saveEdit()
      }
      if (e.key === 'Escape' && editingField) {
        cancelEdit()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [editingField, editValue, editTitle])

  if (isLoading || !pipeline) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <Link
          to="/"
          className="text-indigo-600 dark:text-indigo-400 hover:underline text-sm mb-6 inline-block"
        >
          &larr; Back to Dashboard
        </Link>

        {/* Pipeline Name */}
        <div className="mb-8">
          {editingField === 'name' ? (
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                autoFocus
                className="text-3xl font-bold bg-white dark:bg-gray-800 border border-indigo-500 rounded-lg px-3 py-1 flex-1 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button onClick={saveEdit} className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-sm">Save</button>
              <button onClick={cancelEdit} className="px-3 py-1 text-gray-500 text-sm">Cancel</button>
            </div>
          ) : (
            <h1
              onClick={() => startEdit('name', pipeline.name)}
              className="text-3xl font-bold text-gray-900 dark:text-gray-100 cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
              title="Click to edit"
            >
              {pipeline.name}
            </h1>
          )}
        </div>

        {/* CV Content */}
        <ContentSection
          title="CV Content"
          field="cvContent"
          value={pipeline.cvContent}
          editingField={editingField}
          editValue={editValue}
          onStartEdit={startEdit}
          onSave={saveEdit}
          onCancel={cancelEdit}
          onEditValueChange={setEditValue}
          placeholder="Paste your CV here..."
        />

        {/* Supplementary Contents */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Supplementary Content
            </h2>
            <button
              onClick={() => setShowCreateSupplementary(true)}
              className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition-colors"
            >
              Add Content
            </button>
          </div>

          {showCreateSupplementary && (
            <div className="mb-4 p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  createSupplementaryMutation.mutate({
                    title: supplementaryTitle || 'Untitled',
                  })
                }}
                className="flex gap-3"
              >
                <input
                  type="text"
                  placeholder="Title (e.g. Interview Transcript, Project Summary)"
                  value={supplementaryTitle}
                  onChange={(e) => setSupplementaryTitle(e.target.value)}
                  autoFocus
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="submit"
                  disabled={createSupplementaryMutation.isPending}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  Create
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateSupplementary(false)
                    setSupplementaryTitle('')
                  }}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                >
                  Cancel
                </button>
              </form>
            </div>
          )}

          {supplementaryContents.length === 0 && !showCreateSupplementary ? (
            <div className="text-center py-6 text-gray-400 dark:text-gray-500 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-lg">
              <p>No supplementary content yet</p>
              <p className="mt-1 text-sm">Add interview transcripts, project summaries, etc.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {supplementaryContents.map((sc) => {
                const isEditing = editingField === `sc:${sc.id}`
                return (
                  <div
                    key={sc.id}
                    className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800"
                  >
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="font-medium bg-transparent border-b border-indigo-500 text-gray-900 dark:text-gray-100 focus:outline-none"
                        />
                      ) : (
                        <h3 className="font-medium text-gray-900 dark:text-gray-100">
                          {sc.title}
                        </h3>
                      )}
                      <div className="flex gap-2">
                        {!isEditing && (
                          <button
                            onClick={() =>
                              startEdit(`sc:${sc.id}`, sc.content, sc.title)
                            }
                            className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
                          >
                            Edit
                          </button>
                        )}
                        <button
                          onClick={() => deleteSupplementaryMutation.mutate(sc.id)}
                          className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                          title="Delete"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {isEditing ? (
                      <div className="p-4">
                        <textarea
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          placeholder="Paste content here..."
                          autoFocus
                          rows={10}
                          className="w-full px-4 py-3 border border-indigo-500 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
                        />
                        <div className="flex gap-2 mt-2">
                          <button onClick={saveEdit} className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-sm">
                            Save
                          </button>
                          <button onClick={cancelEdit} className="px-3 py-1 text-gray-500 text-sm">
                            Cancel
                          </button>
                          <span className="text-xs text-gray-400 ml-auto self-center">
                            Cmd+Enter to save, Esc to cancel
                          </span>
                        </div>
                      </div>
                    ) : sc.content ? (
                      <div
                        className="p-4 max-h-64 overflow-y-auto cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                        onClick={() => startEdit(`sc:${sc.id}`, sc.content, sc.title)}
                        title="Click to edit"
                      >
                        <Markdown>{sc.content}</Markdown>
                      </div>
                    ) : (
                      <div
                        onClick={() => startEdit(`sc:${sc.id}`, '', sc.title)}
                        className="p-4 text-gray-400 dark:text-gray-500 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors text-center"
                      >
                        Click to add content...
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Branches */}
        <div className="mt-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Job Branches
            </h2>
            <button
              onClick={() => setShowCreateBranch(true)}
              className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition-colors"
            >
              New Branch
            </button>
          </div>

          {showCreateBranch && (
            <div className="mb-4 p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  createBranchMutation.mutate({ name: branchName || 'Untitled Branch' })
                }}
                className="flex gap-3"
              >
                <input
                  type="text"
                  placeholder="Branch name (e.g. Senior Engineer @ Acme)"
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                  autoFocus
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="submit"
                  disabled={createBranchMutation.isPending}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  Create
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateBranch(false)
                    setBranchName('')
                  }}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                >
                  Cancel
                </button>
              </form>
            </div>
          )}

          {branchList.length === 0 ? (
            <div className="text-center py-8 text-gray-400 dark:text-gray-500 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-lg">
              <p>No branches yet</p>
              <p className="mt-1 text-sm">Create a branch for each job opportunity</p>
            </div>
          ) : (
            <div className="space-y-3">
              {branchList.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors"
                >
                  <Link
                    to={`/pipelines/${id}/branches/${b.id}`}
                    className="flex-1 min-w-0"
                  >
                    <h3 className="font-medium text-gray-900 dark:text-gray-100 truncate">
                      {b.name}
                    </h3>
                    <div className="flex gap-3 mt-1">
                      {b.matrixResult && (
                        <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded">
                          Analyzed
                        </span>
                      )}
                      {b.optimizedCv && (
                        <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded">
                          Optimized
                        </span>
                      )}
                      {b.coverLetter && (
                        <span className="text-xs px-2 py-0.5 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded">
                          Cover Letter
                        </span>
                      )}
                      {!b.matrixResult && !b.optimizedCv && (
                        <span className="text-xs text-gray-400">Draft</span>
                      )}
                    </div>
                  </Link>
                  <button
                    onClick={() => deleteBranchMutation.mutate(b.id)}
                    className="ml-4 p-2 text-gray-400 hover:text-red-500 transition-colors"
                    title="Delete branch"
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
    </div>
  )
}

function ContentSection({
  title,
  field,
  value,
  editingField,
  editValue,
  onStartEdit,
  onSave,
  onCancel,
  onEditValueChange,
  placeholder,
}: {
  title: string
  field: string
  value: string
  editingField: string | null
  editValue: string
  onStartEdit: (field: string, value: string) => void
  onSave: () => void
  onCancel: () => void
  onEditValueChange: (value: string) => void
  placeholder: string
}) {
  const isEditing = editingField === field

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {title}
        </h2>
        {!isEditing && (
          <button
            onClick={() => onStartEdit(field, value)}
            className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            Edit
          </button>
        )}
      </div>

      {isEditing ? (
        <div>
          <textarea
            value={editValue}
            onChange={(e) => onEditValueChange(e.target.value)}
            placeholder={placeholder}
            autoFocus
            rows={12}
            className="w-full px-4 py-3 border border-indigo-500 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
          />
          <div className="flex gap-2 mt-2">
            <button onClick={onSave} className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-sm">
              Save
            </button>
            <button onClick={onCancel} className="px-3 py-1 text-gray-500 text-sm">
              Cancel
            </button>
            <span className="text-xs text-gray-400 ml-auto self-center">
              Cmd+Enter to save, Esc to cancel
            </span>
          </div>
        </div>
      ) : value ? (
        <div
          className="p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors max-h-96 overflow-y-auto"
          onClick={() => onStartEdit(field, value)}
          title="Click to edit"
        >
          <Markdown>{value}</Markdown>
        </div>
      ) : (
        <div
          onClick={() => onStartEdit(field, '')}
          className="p-4 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-lg text-gray-400 dark:text-gray-500 cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors text-center"
        >
          {placeholder}
        </div>
      )}
    </div>
  )
}
