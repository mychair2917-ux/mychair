import { useAppDispatch } from '../redux/hooks';
import { setProjectInfo } from '../redux/slices/projects/projectSlice';

/**
  Updates the selected project information in the Redux store.
  If the provided project data is valid (exists in availableProjectIds),
  it sets the project info to that project. Otherwise, it falls back
  to a default "All Projects" selection.
 
  Parameters:
  @param projectData - The project information containing project id and name.
  @param dispatch - The Redux dispatch function used to update project state.
  @param availableProjectIds - List of valid project IDs to validate the project selection.

  Returns:
  @return void

  Exception Handling:
  None
 */
const updateProjectSelection = (
  projectData: { id: string | null | undefined; name: string | null | undefined },
  dispatch: ReturnType<typeof useAppDispatch>,
  availableProjectIds: string[]
) => {
  const isValidProject =
    projectData?.id && projectData?.name && availableProjectIds.includes(projectData.id);
  if (isValidProject) {
    dispatch(
      setProjectInfo({
        id: projectData.id ?? '',
        name: projectData.name ?? '',
      })
    );
  } else {
    const defaultProject = {
      id: '',
      name: 'All Projects',
    };
    dispatch(setProjectInfo(defaultProject));
  }
};

export default updateProjectSelection;
