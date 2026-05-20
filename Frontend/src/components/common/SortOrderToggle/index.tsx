import DownFillIcon from '../../Icons/DownFillIcon';
import UpFillIcon from '../../Icons/UpFillIcon';

const SortOrderToggle = ({
  handleSortClick,
  sortOrder,
  isDisabled = false,
}: {
  handleSortClick: (sortBy: 'asc' | 'desc') => void;
  sortOrder: string;
  isDisabled?: boolean;
}) => {
  /**
    Handles icon click for sort order (asc or desc).
    Prevents propagation to avoid triggering the parent div's click handler.
    Calls handleSortClick if not disabled and the clicked sort order is different.
  */
  const handleIconClick = (clickedSortOrder: 'asc' | 'desc', event: React.MouseEvent) => {
    event.stopPropagation();
    if (!isDisabled && sortOrder !== clickedSortOrder) {
      handleSortClick(clickedSortOrder);
    }
  };

  /**
   Handles click on the container div.
   Toggles the sort order between 'asc' and 'desc' if not disabled.
  */
  const handleDivClick = () => {
    if (!isDisabled) {
      // Toggle between asc and desc when clicking the div (but not icons)
      const newSortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
      handleSortClick(newSortOrder);
    }
  };

  return (
    <div
      className={`border-gray-350 bg-white-100 mr-3 ml-2 flex h-[36px] min-w-[40px] flex-col items-center justify-center rounded-[7px] border shadow-none ${
        isDisabled ? 'cursor-not-allowed' : 'cursor-pointer'
      }`}
      onClick={handleDivClick}
    >
      <UpFillIcon
        className={`h-[0.5rem] w-2 ${sortOrder === 'asc' ? 'text-grey-600' : 'text-gray-500'} ${
          isDisabled ? 'cursor-not-allowed' : 'cursor-pointer'
        }`}
        onClick={(e) => handleIconClick('asc', e)}
        disabled={isDisabled}
      />
      <DownFillIcon
        className={`h-[0.5rem] w-2 ${sortOrder === 'desc' ? 'text-grey-600' : 'text-gray-500'} ${
          isDisabled ? 'cursor-not-allowed' : 'cursor-pointer'
        }`}
        onClick={(e) => handleIconClick('desc', e)}
        disabled={isDisabled}
      />
    </div>
  );
};

export default SortOrderToggle;
