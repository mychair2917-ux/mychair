import { QUERY_STATUS, ROUTE_PATHS } from '../constants';
import { QueryRow } from '../pages/Admin/Types';
import { useAppDispatch } from '../redux/hooks';
import { setProjectInfo } from '../redux/slices/projects/projectSlice';
import { setSelectedQueryInfo } from '../redux/slices/queries/selectedQueryInfoSlice';
import { setSelectedQuery } from '../redux/slices/queries/selectedQuerySlice';
import { QueryItem } from '../redux/slices/queries/Types';
import { SharedQueryData } from '../redux/slices/sharedQueries/Types';

// Redirects to the Query Dashboard if the query status is READY, and sets the selected query in state.
export const redirectToQueryAnalysis = (
  row: QueryItem | SharedQueryData | QueryRow,
  navigate: (path: string) => void,
  dispatch: ReturnType<typeof useAppDispatch>,
  availableProjectIds: string[]
) => {
  if (row.query_status === QUERY_STATUS.READY || row.query_status === QUERY_STATUS.EXPIRED) {
    dispatch(setSelectedQuery(row?.id));
    dispatch(setSelectedQueryInfo(row));

    const isValidProject =
      row?.project_id && row?.project_name && availableProjectIds.includes(row?.project_id);
    if (isValidProject) {
      dispatch(
        setProjectInfo({
          id: row.project_id ?? '',
          name: row.project_name ?? '',
        })
      );
    } else {
      const defaultProject = {
        id: '',
        name: 'All Projects',
      };
      dispatch(setProjectInfo(defaultProject));
    }
    if (row.query_status === QUERY_STATUS.EXPIRED)
      navigate(`/${ROUTE_PATHS.SEGMENTATION}?query_id=${row.id}`);
    else navigate(`/${ROUTE_PATHS.DASHBOARD}?query_id=${row.id}`);
  }
};
