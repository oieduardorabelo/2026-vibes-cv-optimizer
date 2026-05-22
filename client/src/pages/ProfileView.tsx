import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { Markdown } from '../components/Markdown'

interface Preferences {
  locations: string
  remotePreference: string
  targetRoles: string
  salaryMin: string
  salaryMax: string
  salaryCurrency: string
  keywords: string
}

const defaultPrefs: Preferences = {
  locations: '',
  remotePreference: 'any',
  targetRoles: '',
  salaryMin: '',
  salaryMax: '',
  salaryCurrency: 'USD',
  keywords: '',
}

function parsePreferences(json: string | null): Preferences {
  if (!json) return defaultPrefs
  try {
    const p = JSON.parse(json)
    return {
      locations: Array.isArray(p.locations)
        ? p.locations.join(', ')
        : p.locations || '',
      remotePreference: p.remotePreference || 'any',
      targetRoles: Array.isArray(p.targetRoles)
        ? p.targetRoles.join(', ')
        : p.targetRoles || '',
      salaryMin: p.salaryMin?.toString() || '',
      salaryMax: p.salaryMax?.toString() || '',
      salaryCurrency: p.salaryCurrency || 'USD',
      keywords: Array.isArray(p.keywords)
        ? p.keywords.join(', ')
        : p.keywords || '',
    }
  } catch {
    return defaultPrefs
  }
}

function serializePreferences(prefs: Preferences): string {
  return JSON.stringify({
    locations: prefs.locations
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    remotePreference: prefs.remotePreference,
    targetRoles: prefs.targetRoles
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    salaryMin: prefs.salaryMin ? Number(prefs.salaryMin) : undefined,
    salaryMax: prefs.salaryMax ? Number(prefs.salaryMax) : undefined,
    salaryCurrency: prefs.salaryCurrency,
    keywords: prefs.keywords
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  })
}

export function ProfileView() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profiles', id],
    queryFn: () => api.profiles.get(id!),
    enabled: !!id,
  })

  const { data: searchList = [] } = useQuery({
    queryKey: ['searches', id],
    queryFn: () => api.searches.list(id!),
    enabled: !!id,
  })

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, string>) =>
      api.profiles.update(id!, data),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['profiles', id] }),
  })

  const parseCvMutation = useMutation({
    mutationFn: () => api.profiles.parseCv(id!),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['profiles', id] }),
  })

  const createSearchMutation = useMutation({
    mutationFn: async () => {
      const search = await api.searches.create(id!)
      return search
    },
    onSuccess: (search) => {
      queryClient.invalidateQueries({ queryKey: ['searches', id] })
      navigate(`/profiles/${id}/searches/${search.id}`)
    },
  })

  const deleteSearchMutation = useMutation({
    mutationFn: (searchId: string) => api.searches.delete(searchId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['searches', id] }),
  })

  const [editingField, setEditingField] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [prefs, setPrefs] = useState<Preferences>(defaultPrefs)
  const [prefsChanged, setPrefsChanged] = useState(false)

  useEffect(() => {
    if (profile?.preferences) {
      setPrefs(parsePreferences(profile.preferences))
    }
  }, [profile?.preferences])

  const startEdit = (field: string, value: string) => {
    setEditingField(field)
    setEditValue(value)
  }

  const saveEdit = () => {
    if (!editingField) return
    updateMutation.mutate({ [editingField]: editValue })
    setEditingField(null)
    setEditValue('')
  }

  const cancelEdit = () => {
    setEditingField(null)
    setEditValue('')
  }

  const savePrefs = () => {
    updateMutation.mutate({ preferences: serializePreferences(prefs) })
    setPrefsChanged(false)
  }

  const updatePref = (key: keyof Preferences, value: string) => {
    setPrefs((p) => ({ ...p, [key]: value }))
    setPrefsChanged(true)
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

  if (isLoading || !profile) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    )
  }

  const parsed = profile.parsedProfile
    ? JSON.parse(profile.parsedProfile)
    : null

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <Link
          to="/"
          className="text-indigo-600 dark:text-indigo-400 hover:underline text-sm mb-6 inline-block"
        >
          &larr; Back to Dashboard
        </Link>

        {/* Profile Name */}
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
              <button
                onClick={saveEdit}
                className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-sm"
              >
                Save
              </button>
              <button
                onClick={cancelEdit}
                className="px-3 py-1 text-gray-500 text-sm"
              >
                Cancel
              </button>
            </div>
          ) : (
            <h1
              onClick={() => startEdit('name', profile.name)}
              className="text-3xl font-bold text-gray-900 dark:text-gray-100 cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
              title="Click to edit"
            >
              {profile.name}
            </h1>
          )}
        </div>

        {/* CV Content */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              CV Content
            </h2>
            <div className="flex gap-2">
              {editingField !== 'cvContent' && (
                <button
                  onClick={() => startEdit('cvContent', profile.cvContent)}
                  className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Edit
                </button>
              )}
            </div>
          </div>

          {editingField === 'cvContent' ? (
            <div>
              <textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                placeholder="Paste your CV here..."
                autoFocus
                rows={16}
                className="w-full px-4 py-3 border border-indigo-500 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={saveEdit}
                  className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-sm"
                >
                  Save
                </button>
                <button
                  onClick={cancelEdit}
                  className="px-3 py-1 text-gray-500 text-sm"
                >
                  Cancel
                </button>
                <span className="text-xs text-gray-400 ml-auto self-center">
                  Cmd+Enter to save, Esc to cancel
                </span>
              </div>
            </div>
          ) : profile.cvContent ? (
            <div
              className="p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors max-h-96 overflow-y-auto"
              onClick={() => startEdit('cvContent', profile.cvContent)}
              title="Click to edit"
            >
              <Markdown>{profile.cvContent}</Markdown>
            </div>
          ) : (
            <div
              onClick={() => startEdit('cvContent', '')}
              className="p-4 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-lg text-gray-400 dark:text-gray-500 cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors text-center"
            >
              Paste your CV here...
            </div>
          )}
        </div>

        {/* Parse CV Button */}
        {profile.cvContent && (
          <div className="mb-8">
            <button
              onClick={() => parseCvMutation.mutate()}
              disabled={parseCvMutation.isPending}
              className="w-full py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {parseCvMutation.isPending
                ? 'Parsing CV...'
                : parsed
                  ? 'Re-parse CV'
                  : 'Parse CV with AI'}
            </button>
            {parseCvMutation.isPending && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 text-center">
                Extracting skills, experience, and metadata from your CV...
              </p>
            )}
            {parseCvMutation.isError && (
              <p className="text-sm text-red-500 mt-2 text-center">
                Parsing failed: {parseCvMutation.error.message}
              </p>
            )}
          </div>
        )}

        {/* Parsed Profile */}
        {parsed && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Extracted Profile
            </h2>
            <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4 space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Summary
                </p>
                <p className="text-gray-900 dark:text-gray-100 mt-1">
                  {parsed.summary}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Seniority
                  </p>
                  <p className="text-gray-900 dark:text-gray-100 mt-1 capitalize">
                    {parsed.seniorityLevel}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Years of Experience
                  </p>
                  <p className="text-gray-900 dark:text-gray-100 mt-1">
                    {parsed.yearsOfExperience}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Target Roles
                </p>
                <div className="flex flex-wrap gap-2 mt-1">
                  {parsed.targetRoles?.map((role: string) => (
                    <span
                      key={role}
                      className="px-2 py-1 bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 rounded text-sm"
                    >
                      {role}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Technical Skills
                </p>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {[
                    ...(parsed.skills?.technical || []),
                    ...(parsed.skills?.frameworks || []),
                    ...(parsed.skills?.tools || []),
                    ...(parsed.skills?.languages || []),
                  ].map((skill: string) => (
                    <span
                      key={skill}
                      className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded text-xs"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              {parsed.industries?.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Industries
                  </p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {parsed.industries.map((ind: string) => (
                      <span
                        key={ind}
                        className="px-2 py-0.5 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded text-xs"
                      >
                        {ind}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Top Keywords
                </p>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {parsed.topKeywords?.map((kw: string) => (
                    <span
                      key={kw}
                      className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 rounded text-xs"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Preferences */}
        {parsed && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Search Preferences
              </h2>
              <button
                onClick={() => {
                  const skills = [
                    ...(parsed.skills?.technical || []),
                    ...(parsed.skills?.frameworks || []),
                    ...(parsed.skills?.tools || []),
                    ...(parsed.skills?.languages || []),
                  ]
                  const uniqueKeywords = [
                    ...new Set([
                      ...skills,
                      ...(parsed.topKeywords || []),
                    ]),
                  ]

                  const workStyleMap: Record<string, string> = {
                    remote: 'remote_only',
                    hybrid: 'hybrid',
                    onsite: 'onsite',
                  }

                  setPrefs({
                    targetRoles: (parsed.targetRoles || []).join(', '),
                    keywords: uniqueKeywords.join(', '),
                    locations: parsed.location || prefs.locations,
                    remotePreference:
                      workStyleMap[parsed.workStyle] || prefs.remotePreference,
                    salaryMin:
                      parsed.salaryEstimate?.min?.toString() || prefs.salaryMin,
                    salaryMax:
                      parsed.salaryEstimate?.max?.toString() || prefs.salaryMax,
                    salaryCurrency:
                      parsed.salaryEstimate?.currency || prefs.salaryCurrency,
                  })
                  setPrefsChanged(true)
                }}
                className="px-3 py-1.5 text-sm border border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
              >
                Auto Suggest
              </button>
            </div>
            <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Target Roles (comma-separated)
                </label>
                <input
                  type="text"
                  value={prefs.targetRoles}
                  onChange={(e) => updatePref('targetRoles', e.target.value)}
                  placeholder="Senior Software Engineer, Staff Engineer, Tech Lead"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Remote Preference
                </label>
                <select
                  value={prefs.remotePreference}
                  onChange={(e) =>
                    updatePref('remotePreference', e.target.value)
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="any">Any</option>
                  <option value="remote_only">Remote Only</option>
                  <option value="hybrid">Hybrid</option>
                  <option value="onsite">On-site</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Preferred Locations (comma-separated)
                </label>
                <input
                  type="text"
                  value={prefs.locations}
                  onChange={(e) => updatePref('locations', e.target.value)}
                  placeholder="London, Berlin, Remote"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Salary Min
                  </label>
                  <input
                    type="number"
                    value={prefs.salaryMin}
                    onChange={(e) => updatePref('salaryMin', e.target.value)}
                    placeholder="80000"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Salary Max
                  </label>
                  <input
                    type="number"
                    value={prefs.salaryMax}
                    onChange={(e) => updatePref('salaryMax', e.target.value)}
                    placeholder="150000"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Currency
                  </label>
                  <select
                    value={prefs.salaryCurrency}
                    onChange={(e) =>
                      updatePref('salaryCurrency', e.target.value)
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="NZD">NZD</option>
                    <option value="AUD">AUD</option>
                    <option value="USD">USD</option>
                    <option value="GBP">GBP</option>
                    <option value="EUR">EUR</option>
                    <option value="CAD">CAD</option>
                    <option value="BRL">BRL</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Additional Keywords (comma-separated)
                </label>
                <input
                  type="text"
                  value={prefs.keywords}
                  onChange={(e) => updatePref('keywords', e.target.value)}
                  placeholder="TypeScript, React, Node.js, AWS"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {prefsChanged && (
                <button
                  onClick={savePrefs}
                  disabled={updateMutation.isPending}
                  className="w-full py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {updateMutation.isPending
                    ? 'Saving...'
                    : 'Save Preferences'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Search for Jobs */}
        {parsed && (
          <div className="mb-8">
            <button
              onClick={() => createSearchMutation.mutate()}
              disabled={createSearchMutation.isPending}
              className="w-full py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 transition-colors text-lg"
            >
              {createSearchMutation.isPending
                ? 'Creating search...'
                : 'Search for Jobs'}
            </button>
            {createSearchMutation.isError && (
              <p className="text-sm text-red-500 mt-2 text-center">
                Failed: {createSearchMutation.error.message}
              </p>
            )}
          </div>
        )}

        {/* Past Searches */}
        {searchList.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Past Searches
            </h2>
            <div className="space-y-3">
              {searchList.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors"
                >
                  <Link
                    to={`/profiles/${id}/searches/${s.id}`}
                    className="flex-1 min-w-0"
                  >
                    <h3 className="font-medium text-gray-900 dark:text-gray-100 truncate">
                      {s.name}
                    </h3>
                    <div className="flex gap-2 mt-1">
                      <StatusBadge status={s.status} />
                    </div>
                  </Link>
                  <button
                    onClick={() => deleteSearchMutation.mutate(s.id)}
                    className="ml-4 p-2 text-gray-400 hover:text-red-500 transition-colors"
                    title="Delete search"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
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
