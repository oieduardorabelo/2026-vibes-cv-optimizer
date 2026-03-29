export interface Pipeline {
  id: string
  name: string
  cvContent: string
  createdAt: string
  updatedAt: string
}

export interface SupplementaryContent {
  id: string
  pipelineId: string
  title: string
  content: string
  createdAt: string
  updatedAt: string
}

export interface Branch {
  id: string
  pipelineId: string
  name: string
  jobDescription: string
  matrixResult: string | null
  optimizedCv: string | null
  coverLetter: string | null
  createdAt: string
  updatedAt: string
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
  pipelines: {
    list: () => request<Pipeline[]>('/pipelines'),
    get: (id: string) => request<Pipeline>(`/pipelines/${id}`),
    create: (data: Partial<Pipeline>) =>
      request<Pipeline>('/pipelines', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Partial<Pipeline>) =>
      request<Pipeline>(`/pipelines/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request<{ ok: boolean }>(`/pipelines/${id}`, { method: 'DELETE' }),
  },
  supplementaryContents: {
    list: (pipelineId: string) =>
      request<SupplementaryContent[]>(
        `/pipelines/${pipelineId}/supplementary-contents`
      ),
    get: (id: string) =>
      request<SupplementaryContent>(`/supplementary-contents/${id}`),
    create: (pipelineId: string, data: Partial<SupplementaryContent>) =>
      request<SupplementaryContent>(
        `/pipelines/${pipelineId}/supplementary-contents`,
        { method: 'POST', body: JSON.stringify(data) }
      ),
    update: (id: string, data: Partial<SupplementaryContent>) =>
      request<SupplementaryContent>(`/supplementary-contents/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request<{ ok: boolean }>(`/supplementary-contents/${id}`, {
        method: 'DELETE',
      }),
  },
  branches: {
    list: (pipelineId: string) =>
      request<Branch[]>(`/pipelines/${pipelineId}/branches`),
    get: (id: string) => request<Branch>(`/branches/${id}`),
    create: (pipelineId: string, data: Partial<Branch>) =>
      request<Branch>(`/pipelines/${pipelineId}/branches`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Partial<Branch>) =>
      request<Branch>(`/branches/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request<{ ok: boolean }>(`/branches/${id}`, { method: 'DELETE' }),
    analyze: (id: string) =>
      request<Branch>(`/branches/${id}/analyze`, { method: 'POST' }),
    optimize: (id: string) =>
      request<Branch>(`/branches/${id}/optimize`, { method: 'POST' }),
    coverLetter: (id: string) =>
      request<Branch>(`/branches/${id}/cover-letter`, { method: 'POST' }),
    runPipeline: (id: string) =>
      request<Branch>(`/branches/${id}/run-pipeline`, { method: 'POST' }),
  },
}
