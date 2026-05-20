import SadIcon from '../../Icons/SadIcon';
import { ErrorPageProps } from './Types';

/** Renders a customizable error page component with support for different icons, titles, and messages.
This component is typically used for displaying 404 or other error messages in a styled format.
Parameters:
@param {ErrorPageProps} props - Props object containing optional customization values.
@param {React.ElementType} [props.Icon=SadIcon] - The icon component to be displayed.
@param {string} [props.title='404'] - The main title of the error page.
@param {string} [props.description='Page not found'] - A short description message.
@param {string} [props.errorDescription='We’re sorry we can’t find the page you are looking for.'] - A detailed error explanation.
@param {string} [props.buttonLabel='Back to Home Page'] - Label for the action button.
@param {function} props.onButtonClick - Callback function triggered when the button or error description is clicked.
Returns:
@returns {JSX.Element} - A React component rendering a styled error page layout.
Exception Handling:
None
*/
const ErrorPage = ({
  Icon = SadIcon,
  title = '404',
  description = 'Page not found',
  errorDescription = 'We’re sorry we can’t find the page you are looking for.',
  buttonLabel = 'Back to Home Page',
  onButtonClick,
}: ErrorPageProps) => {
  return (
    <div className="flex items-center justify-center p-12">
      <div className="rotate-3 transform rounded-lg bg-white shadow-xl">
        <div className="w-[90vw] max-w-lg -rotate-4 transform p-8 text-center">
          <div className="mb-4">
            <Icon viewBox="0 0 107 107" size="3xl" />
          </div>
          <h1 className="text-3xl text-[#373737]">{title}</h1>
          <p className="text-[#2C2C2C99]">{description}</p>

          <p onClick={onButtonClick} className="my-10 text-black">
            {errorDescription}
          </p>
          <button
            onClick={onButtonClick}
            className="cursor-pointer rounded bg-black px-5 py-2 text-sm font-semibold text-white uppercase transition hover:bg-gray-800"
          >
            {buttonLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ErrorPage;
