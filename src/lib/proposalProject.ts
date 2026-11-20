import { router } from 'expo-router';

// The client project a proposal was sent for. The API names it differently depending on the screen
// that loaded the proposal: a populated `projectId` object, a plain id string, or a `project` summary.
interface ProposalLike {
  projectId?: { _id?: string; id?: string } | string | null;
  project?: { _id?: string; id?: string } | null;
}

export function proposalProjectId(proposal: ProposalLike): string {
  const populated = typeof proposal.projectId === 'object' && proposal.projectId ? proposal.projectId._id || proposal.projectId.id : '';
  const plain = typeof proposal.projectId === 'string' ? proposal.projectId : '';
  return String(populated || plain || proposal.project?._id || proposal.project?.id || '');
}

// Opens that project's own details page inside the app (not the list of all projects).
export function openProposalProject(proposal: ProposalLike): boolean {
  const id = proposalProjectId(proposal);
  if (!id) return false;
  router.navigate({ pathname: '/professional/project-details', params: { id } } as never);
  return true;
}
