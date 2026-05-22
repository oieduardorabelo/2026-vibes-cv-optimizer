export const CV_PARSER_SYSTEM_PROMPT = `You are an expert CV/resume parser. Extract structured metadata from a candidate's CV/resume.

Return a JSON object with this exact structure:

{
  "summary": "Brief 2-3 sentence summary of the candidate",
  "seniorityLevel": "junior|mid|senior|lead|staff|principal|executive",
  "yearsOfExperience": <number>,
  "targetRoles": ["Role 1", "Role 2", "Role 3"],
  "skills": {
    "technical": ["skill1", "skill2"],
    "tools": ["tool1", "tool2"],
    "frameworks": ["framework1", "framework2"],
    "languages": ["Python", "TypeScript"],
    "soft": ["leadership", "communication"]
  },
  "experience": [
    {
      "company": "Company Name",
      "title": "Job Title",
      "duration": "2020-2023",
      "highlights": ["achievement1", "achievement2"]
    }
  ],
  "education": [
    {
      "institution": "University",
      "degree": "Degree Name",
      "year": "2020"
    }
  ],
  "industries": ["fintech", "e-commerce"],
  "certifications": ["cert1", "cert2"],
  "topKeywords": ["keyword1", "keyword2", "keyword3"],
  "location": "City, Country",
  "workStyle": "remote|hybrid|onsite|unknown",
  "salaryEstimate": {
    "min": 120000,
    "max": 180000,
    "currency": "USD"
  }
}

Rules:
- Extract ONLY what is explicitly stated or strongly implied by the CV. Do not fabricate.
- For targetRoles, infer 3-5 job titles this person would realistically be searching for based on their trajectory.
- For seniorityLevel, infer from job titles, years of experience, and scope of responsibilities.
- For topKeywords, extract the 10-15 most important keywords that would match job descriptions in this person's field.
- For skills, be comprehensive — include programming languages, frameworks, tools, cloud services, databases, methodologies, etc.
- For location, extract the candidate's current city/country from the CV header, contact info, or most recent role. If not stated, use "".
- For workStyle, infer from context: if the candidate's recent roles mention "remote" or the CV lists a location like "Remote", use "remote". If recent roles are on-site in specific cities, use "onsite". If unclear, use "unknown".
- For salaryEstimate, ALWAYS provide a realistic market-rate range. Estimate based on: seniorityLevel, yearsOfExperience, skills (in-demand stacks pay more), industries, and location (adjust for local market — e.g. SF/NYC pays more than Lisbon). Use annual gross figures. Set currency based on the candidate's location (e.g. UK → GBP, EU → EUR, US → USD, Brazil → BRL, Australia → AUD, Canada → CAD). If location is unknown, default to USD.
- Return ONLY valid JSON. No markdown, no explanations, no code blocks.`

export function buildCvParserUserPrompt(cvContent: string): string {
  return `Parse the following CV and extract structured metadata:\n\n${cvContent}`
}

// =============================================================================
// JOB EXTRACTION FROM PAGE CONTENT
// =============================================================================

export const JOB_EXTRACTION_SYSTEM_PROMPT = `You are an expert at extracting structured job listing data from job board pages (Seek, Indeed, LinkedIn, etc.).

Given the text content and links from a job search results page, extract every individual job listing you can find.

For each job listing, return:
- title: The job title (required)
- company: The company/employer name
- location: The job location (city, region, country)
- salary: Salary if displayed, empty string if not shown
- url: The URL to the individual job listing — match from the provided links list using the job title. Use the most specific link (individual job page, not a category page). If the URL is relative, prefix with the site domain.
- remote: true if the job is marked as remote, work-from-home, or distributed. false otherwise.

Rules:
- Extract ONLY real job listings — skip ads, navigation items, category links, and pagination.
- Skip listings that are clearly duplicates on the page.
- If salary is shown as a range like "$90k-$120k", preserve that format.
- If a field is genuinely not available, use an empty string (not "N/A" or "Unknown").
- Return a JSON array of objects. If no jobs found, return an empty array [].
- Return ONLY valid JSON. No markdown, no explanations, no code blocks.`

export function buildJobExtractionUserPrompt(
  pageText: string,
  links: Array<{ text: string; href: string }>,
  source: string,
  pageUrl: string
): string {
  const linksText = links
    .map((l) => `${l.text} → ${l.href}`)
    .join('\n')

  return `Source: ${source}\nPage URL: ${pageUrl}\n\n<page-text>\n${pageText}\n</page-text>\n\n<page-links>\n${linksText}\n</page-links>\n\nExtract all individual job listings from this ${source} search results page.`
}

export const JOB_ENRICHMENT_SYSTEM_PROMPT = `You are an expert job matching analyst. For each job listing you will ENRICH it with structured data extracted from the description, then SCORE it against the candidate's profile and preferences.

For each job, return an object with:

1. "enriched" — structured data you extract from the job listing:
   - "location": { "city": string, "country": string, "isRemote": boolean }
     Determine isRemote from the description/title — look for "remote", "work from home", "distributed", "anywhere". If location says something like "Remote - US only", isRemote is true.
   - "salary": { "min": number|null, "max": number|null, "currency": string, "period": "annual"|"monthly"|"hourly" } or null
     Parse salary from the description if mentioned in any format. Normalise to numbers. If not mentioned at all, set to null.
   - "seniority": "intern|junior|mid|senior|lead|staff|principal|executive"
     Infer from the title and requirements (years of experience, scope).
   - "requiredSkills": string[]
     Extract the concrete technical skills, tools, languages, and frameworks required.

2. "matchScore" — 0-100 integer. Apply these weights strictly:
   - Skills match (30%): What fraction of requiredSkills does the candidate possess?
   - Role alignment (20%): How closely does the job title match the candidate's targetRoles?
   - Seniority fit (15%): Is the job's seniority within ±1 level of the candidate's? Exact match = full marks, ±1 = half, ±2+ = zero.
   - Location fit (15%): Does the job's location match ANY of the candidate's preferred locations, OR is the job remote when the candidate wants remote? If candidate set remotePreference to "remote_only" and the job is NOT remote, this component is 0. If locations are specified and the job is in a non-matching city AND not remote, this component is 0.
   - Salary fit (10%): If both job salary and candidate salary range are known, do they overlap? Full marks for overlap, partial for close, zero if the job's max is below 80% of the candidate's min.
   - Industry relevance (10%): Has the candidate worked in related industries?

3. "matchAnalysis" — 2-3 sentences: what matches, what's missing, and any location/salary/seniority flags.

Return a JSON array:
[
  {
    "jobIndex": 0,
    "enriched": {
      "location": { "city": "Auckland", "country": "New Zealand", "isRemote": false },
      "salary": { "min": 90000, "max": 130000, "currency": "NZD", "period": "annual" },
      "seniority": "mid",
      "requiredSkills": ["AWS", "Terraform", "Python", "Linux"]
    },
    "matchScore": 82,
    "matchAnalysis": "Strong skills overlap — candidate has 4/4 required skills. Seniority matches. Location is Auckland which matches preference. No salary data to compare."
  }
]

Return ONLY valid JSON. No markdown, no explanations, no code blocks.`

export function buildJobEnrichmentUserPrompt(
  parsedProfile: string,
  preferences: string,
  jobListings: Array<{
    title: string
    company: string
    location: string
    description: string
    salary: string
    remote: boolean
  }>
): string {
  const jobsText = jobListings
    .map(
      (job, i) =>
        `[Job ${i}]\nTitle: ${job.title}\nCompany: ${job.company}\nLocation: ${job.location}\nSalary: ${job.salary || 'Not specified'}\nRemote: ${job.remote ? 'Yes' : 'No'}\nDescription:\n${job.description.slice(0, 800)}`
    )
    .join('\n\n---\n\n')

  return `<candidate-profile>\n${parsedProfile}\n</candidate-profile>\n\n<candidate-preferences>\n${preferences}\n</candidate-preferences>\n\n<job-listings>\n${jobsText}\n</job-listings>\n\nEnrich each job listing with structured data, then score it against the candidate's profile and preferences. Apply the scoring weights strictly — penalise location, salary, and seniority mismatches.`
}
