import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, type Job } from '../lib/api'

export function SearchView() {
  const { profileId, searchId } = useParams<{
    profileId: string
    searchId: string
  }>()
  const queryClient = useQueryClient()
  const [expandedJob, setExpandedJob] = useState<string | null>(null)

  const { data: search, isLoading: searchLoading } = useQuery({
    queryKey: ['search', searchId],
    queryFn: () => api.searches.get(searchId!),
    enabled: !!searchId,
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status === 'running' ? 2000 : false
    },
  })

  const { data: jobList = [], isLoading: jobsLoading } = useQuery({
    queryKey: ['jobs', searchId],
    queryFn: () => api.searches.jobs(searchId!),
    enabled: !!searchId && search?.status === 'completed',
  })

  const runMutation = useMutation({
    mutationFn: () => api.searches.run(searchId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['search', searchId] })
      queryClient.invalidateQueries({ queryKey: ['jobs', searchId] })
    },
  })

  // Auto-run if search is pending (just created)
  useEffect(() => {
    if (search?.status === 'pending' && !runMutation.isPending) {
      runMutation.mutate()
    }
  }, [search?.status])

  if (searchLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    )
  }

  const isRunning = search?.status === 'running' || runMutation.isPending

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <Link
          to={`/profiles/${profileId}`}
          className="text-indigo-600 dark:text-indigo-400 hover:underline text-sm mb-6 inline-block"
        >
          &larr; Back to Profile
        </Link>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              {search?.name || 'Job Search'}
            </h1>
            <div className="mt-2">
              <StatusBadge status={search?.status || 'pending'} />
            </div>
          </div>
          {search?.status === 'completed' && (
            <button
              onClick={() => runMutation.mutate()}
              disabled={runMutation.isPending}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              Re-run Search
            </button>
          )}
        </div>

        {/* Running State */}
        {isRunning && (
          <div className="p-8 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 text-center">
            <div className="inline-block w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-gray-700 dark:text-gray-300 text-lg">
              Searching for jobs...
            </p>
            <p className="text-gray-400 dark:text-gray-500 mt-2 text-sm">
              Querying job boards, then scoring each result with AI
            </p>
          </div>
        )}

        {/* Failed State */}
        {search?.status === 'failed' && !isRunning && (
          <div className="p-6 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800 text-center">
            <p className="text-red-700 dark:text-red-300 text-lg">
              Search failed
            </p>
            {runMutation.isError && (
              <p className="text-red-500 text-sm mt-1">
                {runMutation.error.message}
              </p>
            )}
            <button
              onClick={() => runMutation.mutate()}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Results */}
        {search?.status === 'completed' && !isRunning && (
          <>
            {jobsLoading ? (
              <p className="text-gray-500">Loading results...</p>
            ) : jobList.length === 0 ? (
              <div className="p-8 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-lg text-center">
                <p className="text-gray-500 dark:text-gray-400 text-lg">
                  No jobs found
                </p>
                <p className="text-gray-400 dark:text-gray-500 mt-1 text-sm">
                  Try adjusting your preferences or target roles, then re-run
                </p>
              </div>
            ) : (
              <div className="space-y-8">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {jobList.length} job{jobList.length !== 1 ? 's' : ''} found
                  across {Object.keys(groupJobsBySource(jobList)).length} sources
                </p>
                {Object.entries(groupJobsBySource(jobList)).map(
                  ([source, sourceJobs]) => (
                    <div key={source}>
                      <div className="flex items-center gap-3 mb-3">
                        <SourceIcon source={source} />
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                          {source}
                        </h2>
                        <span className="text-sm text-gray-400 dark:text-gray-500">
                          {sourceJobs.length} job
                          {sourceJobs.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="space-y-3">
                        {sourceJobs.map((job) => (
                          <JobCard
                            key={job.id}
                            job={job}
                            expanded={expandedJob === job.id}
                            onToggle={() =>
                              setExpandedJob(
                                expandedJob === job.id ? null : job.id
                              )
                            }
                          />
                        ))}
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function JobCard({
  job,
  expanded,
  onToggle,
}: {
  job: Job
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
      <div
        className="p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-start gap-3">
          <ScoreBadge score={job.matchScore} />
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-gray-900 dark:text-gray-100">
              {job.url ? (
                <a
                  href={job.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {job.title}
                </a>
              ) : (
                job.title
              )}
            </h3>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-sm text-gray-500 dark:text-gray-400">
              {job.company && <span>{job.company}</span>}
              {job.location && (
                <span className="flex items-center gap-1">
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                  {job.location}
                </span>
              )}
              {job.salary && (
                <span className="text-green-600 dark:text-green-400">
                  {job.salary}
                </span>
              )}
            </div>
            {job.remote && (
              <div className="mt-2">
                <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded">
                  Remote
                </span>
              </div>
            )}
          </div>
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-800 pt-3">
          {job.matchAnalysis && (
            <div className="mb-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Match Analysis
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {job.matchAnalysis}
              </p>
            </div>
          )}

          {job.description && (
            <div className="mb-3">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-line line-clamp-6">
                {job.description}
              </p>
            </div>
          )}

          {job.url && (
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition-colors"
            >
              View Job
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            </a>
          )}
        </div>
      )}
    </div>
  )
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) {
    return (
      <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
        <span className="text-sm font-medium text-gray-400">--</span>
      </div>
    )
  }

  let bg: string
  let text: string
  if (score >= 70) {
    bg = 'bg-green-100 dark:bg-green-900'
    text = 'text-green-700 dark:text-green-300'
  } else if (score >= 40) {
    bg = 'bg-yellow-100 dark:bg-yellow-900'
    text = 'text-yellow-700 dark:text-yellow-300'
  } else {
    bg = 'bg-red-100 dark:bg-red-900'
    text = 'text-red-700 dark:text-red-300'
  }

  return (
    <div
      className={`flex-shrink-0 w-12 h-12 rounded-lg ${bg} flex items-center justify-center`}
    >
      <span className={`text-sm font-bold ${text}`}>{score}</span>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending:
      'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
    running:
      'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300',
    completed:
      'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300',
    failed: 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300',
  }

  return (
    <span
      className={`text-xs px-2 py-0.5 rounded capitalize ${styles[status] || styles.pending}`}
    >
      {status}
    </span>
  )
}

const SOURCE_ORDER = ['Seek', 'Indeed', 'LinkedIn', 'Adzuna', 'JSearch']

function groupJobsBySource(jobs: Job[]): Record<string, Job[]> {
  const groups: Record<string, Job[]> = {}
  for (const job of jobs) {
    const source = job.source || 'Other'
    if (!groups[source]) groups[source] = []
    groups[source].push(job)
  }
  // Sort groups by SOURCE_ORDER, unknowns at end
  const sorted: Record<string, Job[]> = {}
  for (const s of SOURCE_ORDER) {
    if (groups[s]) {
      sorted[s] = groups[s]
      delete groups[s]
    }
  }
  for (const [s, jobs] of Object.entries(groups)) {
    sorted[s] = jobs
  }
  return sorted
}

function SourceIcon({ source }: { source: string }) {
  const lower = source.toLowerCase()
  if (lower.includes('seek')) {
    return (
      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
        <span className="text-sm font-bold text-purple-700 dark:text-purple-300">S</span>
      </div>
    )
  }
  if (lower.includes('indeed')) {
    return (
      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
        <span className="text-sm font-bold text-blue-700 dark:text-blue-300">I</span>
      </div>
    )
  }
  if (lower.includes('linkedin')) {
    return (
      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-sky-100 dark:bg-sky-900 flex items-center justify-center">
        <span className="text-sm font-bold text-sky-700 dark:text-sky-300">in</span>
      </div>
    )
  }
  return (
    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
      <span className="text-sm font-bold text-gray-500">{source[0]}</span>
    </div>
  )
}
