export interface Profile {
  id: string
  name: string
  cvContent: string
  parsedProfile: string | null
  preferences: string | null
  createdAt: string
  updatedAt: string
}

export interface Search {
  id: string
  profileId: string
  name: string
  status: string
  createdAt: string
  updatedAt: string
}

export interface Job {
  id: string
  searchId: string
  title: string
  company: string
  location: string
  url: string
  source: string
  description: string
  salary: string
  remote: boolean
  matchScore: number | null
  matchAnalysis: string | null
  createdAt: string
}

const BASE = '/api'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}

export const api = {
  profiles: {
    list: () => request<Profile[]>('/profiles'),
    get: (id: string) => request<Profile>(`/profiles/${id}`),
    create: (data: Partial<Profile>) =>
      request<Profile>('/profiles', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Partial<Profile>) =>
      request<Profile>(`/profiles/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request<{ ok: boolean }>(`/profiles/${id}`, { method: 'DELETE' }),
    parseCv: (id: string) =>
      request<Profile>(`/profiles/${id}/parse-cv`, { method: 'POST' }),
  },
  searches: {
    list: (profileId: string) =>
      request<Search[]>(`/profiles/${profileId}/searches`),
    get: (id: string) => request<Search>(`/searches/${id}`),
    create: (profileId: string) =>
      request<Search>(`/profiles/${profileId}/searches`, { method: 'POST' }),
    delete: (id: string) =>
      request<{ ok: boolean }>(`/searches/${id}`, { method: 'DELETE' }),
    run: (id: string) =>
      request<{ ok: boolean; jobCount: number }>(`/searches/${id}/run`, {
        method: 'POST',
      }),
    jobs: (id: string) => request<Job[]>(`/searches/${id}/jobs`),
  },
}
