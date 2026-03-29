import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { Markdown } from '../components/Markdown'

export function BranchView() {
  const { id: pipelineId, branchId } = useParams<{
    id: string
    branchId: string
  }>()
  const queryClient = useQueryClient()

  const { data: branch, isLoading } = useQuery({
    queryKey: ['branch', branchId],
    queryFn: () => api.branches.get(branchId!),
    enabled: !!branchId,
  })

  const { data: pipeline } = useQuery({
    queryKey: ['pipelines', pipelineId],
    queryFn: () => api.pipelines.get(pipelineId!),
    enabled: !!pipelineId,
  })

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, string>) =>
      api.branches.update(branchId!, data),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['branch', branchId] }),
  })

  const analyzeMutation = useMutation({
    mutationFn: () => api.branches.analyze(branchId!),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['branch', branchId] }),
  })

  const optimizeMutation = useMutation({
    mutationFn: () => api.branches.optimize(branchId!),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['branch', branchId] }),
  })

  const coverLetterMutation = useMutation({
    mutationFn: () => api.branches.coverLetter(branchId!),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['branch', branchId] }),
  })

  const pipelineMutation = useMutation({
    mutationFn: () => api.branches.runPipeline(branchId!),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['branch', branchId] }),
  })

  const [copiedField, setCopiedField] = useState<string | null>(null)

  const copyToClipboard = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }

  const [editingField, setEditingField] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  const startEdit = (field: string, value: string) => {
    setEditingField(field)
    setEditValue(value)
  }

  const saveEdit = () => {
    if (editingField) {
      updateMutation.mutate({ [editingField]: editValue })
      setEditingField(null)
    }
  }

  const cancelEdit = () => {
    setEditingField(null)
    setEditValue('')
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
  }, [editingField, editValue])

  if (isLoading || !branch) {
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
          to={`/pipelines/${pipelineId}`}
          className="text-indigo-600 dark:text-indigo-400 hover:underline text-sm mb-6 inline-block"
        >
          &larr; Back to {pipeline?.name || 'Pipeline'}
        </Link>

        {/* Branch Name */}
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
              onClick={() => startEdit('name', branch.name)}
              className="text-3xl font-bold text-gray-900 dark:text-gray-100 cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
              title="Click to edit"
            >
              {branch.name}
            </h1>
          )}
        </div>

        {/* Job Description */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Job Description
            </h2>
            {editingField !== 'jobDescription' && (
              <button
                onClick={() => startEdit('jobDescription', branch.jobDescription)}
                className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Edit
              </button>
            )}
          </div>

          {editingField === 'jobDescription' ? (
            <div>
              <textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                placeholder="Paste the job description here..."
                autoFocus
                rows={16}
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
          ) : branch.jobDescription ? (
            <div
              className="p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors max-h-96 overflow-y-auto"
              onClick={() => startEdit('jobDescription', branch.jobDescription)}
              title="Click to edit"
            >
              <Markdown>{branch.jobDescription}</Markdown>
            </div>
          ) : (
            <div
              onClick={() => startEdit('jobDescription', '')}
              className="p-4 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-lg text-gray-400 dark:text-gray-500 cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors text-center"
            >
              Paste the job description here...
            </div>
          )}
        </div>

        {/* Run Full Pipeline */}
        {branch.jobDescription && (
          <div className="mb-8">
            <button
              onClick={() => pipelineMutation.mutate()}
              disabled={pipelineMutation.isPending}
              className="w-full py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {pipelineMutation.isPending
                ? 'Running pipeline...'
                : branch.matrixResult
                  ? 'Re-run Full Pipeline'
                  : 'Run Full Pipeline'}
            </button>
            {pipelineMutation.isPending && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 text-center">
                Analyzing → then optimizing CV & generating cover letter in parallel
              </p>
            )}
            {pipelineMutation.isError && (
              <p className="text-sm text-red-500 mt-2 text-center">
                Pipeline failed: {pipelineMutation.error.message}
              </p>
            )}
          </div>
        )}

        {/* Matrix Analysis */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Matrix Analysis
            </h2>
            {branch.jobDescription && (
              <button
                onClick={() => analyzeMutation.mutate()}
                disabled={analyzeMutation.isPending}
                className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {analyzeMutation.isPending
                  ? 'Analyzing...'
                  : branch.matrixResult
                    ? 'Re-analyze'
                    : 'Generate Analysis'}
              </button>
            )}
          </div>
          {analyzeMutation.isPending ? (
            <div className="p-6 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 text-center">
              <div className="inline-block w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mb-2" />
              <p className="text-gray-500 dark:text-gray-400">
                Analyzing CV against job description...
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                This may take a minute
              </p>
            </div>
          ) : analyzeMutation.isError ? (
            <div className="p-4 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300">
              <p>Analysis failed: {analyzeMutation.error.message}</p>
              <button
                onClick={() => analyzeMutation.mutate()}
                className="mt-2 text-sm text-red-600 dark:text-red-400 underline"
              >
                Try again
              </button>
            </div>
          ) : branch.matrixResult ? (
            <div className="p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 max-h-[32rem] overflow-y-auto">
              <Markdown>{branch.matrixResult}</Markdown>
            </div>
          ) : (
            <div className="p-6 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-lg text-center">
              <p className="text-gray-400 dark:text-gray-500">
                {branch.jobDescription
                  ? 'Click "Generate Analysis" to analyze your CV against this job'
                  : 'Add a job description first, then generate the analysis'}
              </p>
            </div>
          )}
        </div>

        {/* Optimized CV */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Optimized CV
            </h2>
            <div className="flex gap-2">
              {branch.optimizedCv && (
                <button
                  onClick={() => copyToClipboard(branch.optimizedCv!, 'cv')}
                  className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-700 dark:text-gray-300"
                >
                  {copiedField === 'cv' ? 'Copied!' : 'Copy'}
                </button>
              )}
              {branch.matrixResult && (
                <button
                  onClick={() => optimizeMutation.mutate()}
                  disabled={optimizeMutation.isPending}
                  className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {optimizeMutation.isPending
                    ? 'Optimizing...'
                    : branch.optimizedCv
                      ? 'Regenerate'
                      : 'Generate Optimized CV'}
                </button>
              )}
            </div>
          </div>
          {optimizeMutation.isPending ? (
            <div className="p-6 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 text-center">
              <div className="inline-block w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mb-2" />
              <p className="text-gray-500 dark:text-gray-400">
                Generating optimized CV...
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                This may take a minute
              </p>
            </div>
          ) : optimizeMutation.isError ? (
            <div className="p-4 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300">
              <p>Optimization failed: {optimizeMutation.error.message}</p>
              <button
                onClick={() => optimizeMutation.mutate()}
                className="mt-2 text-sm text-red-600 dark:text-red-400 underline"
              >
                Try again
              </button>
            </div>
          ) : branch.optimizedCv ? (
            <div className="p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 max-h-[32rem] overflow-y-auto">
              <Markdown>{branch.optimizedCv}</Markdown>
            </div>
          ) : (
            <div className="p-6 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-lg text-center">
              <p className="text-gray-400 dark:text-gray-500">
                {branch.matrixResult
                  ? 'Click "Generate Optimized CV" to create a tailored CV for this role'
                  : 'Run the matrix analysis first, then generate the optimized CV'}
              </p>
            </div>
          )}
        </div>

        {/* Cover Letter */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Cover Letter
            </h2>
            <div className="flex gap-2">
              {branch.coverLetter && (
                <button
                  onClick={() => copyToClipboard(branch.coverLetter!, 'cl')}
                  className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-700 dark:text-gray-300"
                >
                  {copiedField === 'cl' ? 'Copied!' : 'Copy'}
                </button>
              )}
              {branch.matrixResult && (
                <button
                  onClick={() => coverLetterMutation.mutate()}
                  disabled={coverLetterMutation.isPending}
                  className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {coverLetterMutation.isPending
                    ? 'Generating...'
                    : branch.coverLetter
                      ? 'Regenerate'
                      : 'Generate Cover Letter'}
                </button>
              )}
            </div>
          </div>
          {coverLetterMutation.isPending ? (
            <div className="p-6 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 text-center">
              <div className="inline-block w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mb-2" />
              <p className="text-gray-500 dark:text-gray-400">
                Generating cover letter...
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                This may take a minute
              </p>
            </div>
          ) : coverLetterMutation.isError ? (
            <div className="p-4 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300">
              <p>Generation failed: {coverLetterMutation.error.message}</p>
              <button
                onClick={() => coverLetterMutation.mutate()}
                className="mt-2 text-sm text-red-600 dark:text-red-400 underline"
              >
                Try again
              </button>
            </div>
          ) : branch.coverLetter ? (
            <div className="p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 max-h-[32rem] overflow-y-auto">
              <Markdown>{branch.coverLetter}</Markdown>
            </div>
          ) : (
            <div className="p-6 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-lg text-center">
              <p className="text-gray-400 dark:text-gray-500">
                {branch.matrixResult
                  ? 'Click "Generate Cover Letter" to create a tailored cover letter'
                  : 'Run the matrix analysis first, then generate the cover letter'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
