import { partnerApi } from '../partnerApi';
import { isWonStatus } from '../studioMoney';
import { pmApi, type PmOverview } from './api';

export interface PmProject {
  id: string;
  title?: string;
  status?: string;
  location?: string;
  city?: string;
  propertyType?: string;
  clientName?: string;
  hasAwarded?: boolean;
  awardedToAnotherStudio?: boolean;
  proposalStatus?: string | null;
  selectedProfessionalId?: string;
  designerId?: string;
}

/** What one project card needs: the project plus its PM overview (or why there is none). */
export interface PmProjectRow {
  project: PmProject;
  overview: PmOverview | null;
  /** 'locked' = the server says this studio is not the awarded one; 'error' = the overview could not be read. */
  problem?: 'locked' | 'error';
  message?: string;
}

function isAwarded(p: PmProject): boolean {
  if (p.awardedToAnotherStudio) return false;
  if (p.hasAwarded) return true;
  if (p.proposalStatus && isWonStatus(p.proposalStatus)) return true;
  if (p.selectedProfessionalId || p.designerId) return true;
  const status = String(p.status || '').toLowerCase().replace(/[\s_-]+/g, '');
  return ['awarded', 'inprogress', 'completed', 'execution'].includes(status);
}

export async function loadAwardedProjects(designerId: string): Promise<PmProject[]> {
  let list: unknown = designerId ? await partnerApi.assignedStudioProjects(designerId).catch(() => []) : [];
  if (!Array.isArray(list) || list.length === 0) list = await partnerApi.assignedStudioProjectsMe().catch(() => []);
  const raw = (Array.isArray(list) ? list : ((list as { projects?: unknown[] })?.projects || [])) as PmProject[];
  return raw.map(p => ({ ...p, id: String(p.id || (p as { _id?: string })._id) })).filter(isAwarded);
}

/** Projects with their PM overview. Projects the server says are not assigned to this studio are not asked for an
 *  overview at all (it would answer 403), and one failing project never hides the others. */
export async function loadProjectRows(designerId: string): Promise<PmProjectRow[]> {
  const projects = await loadAwardedProjects(designerId);
  return Promise.all(projects.map(async (project): Promise<PmProjectRow> => {
    if (project.hasAwarded === false) return { project, overview: null, problem: 'locked' };
    try {
      return { project, overview: await pmApi.overview(project.id) };
    } catch (error) {
      const status = (error as { status?: number })?.status;
      if (status === 403) return { project, overview: null, problem: 'locked' };
      return { project, overview: null, problem: 'error', message: error instanceof Error ? error.message : undefined };
    }
  }));
}
