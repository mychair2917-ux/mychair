import { ProgressBarProps } from './Types';

const ProgressBar = ({ positive, negative }: ProgressBarProps) => {
  const positiveWidth = `${positive}%`;
  const negativeWidth = `${negative}%`;
  const remainingWidth = `${100 - (positive + negative)}%`;
  return (
    <div className="flex h-6 w-full overflow-hidden rounded border border-gray-400">
      <div className="bg-green-500" style={{ width: positiveWidth }}></div>
      <div className="bg-red-500" style={{ width: negativeWidth }}></div>
      <div className="bg-gray-300" style={{ width: remainingWidth }}></div>
    </div>
  );
};
export default ProgressBar;
