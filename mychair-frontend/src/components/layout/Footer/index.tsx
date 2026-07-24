import { Link } from 'react-router';
import moment from 'moment';

import { ROUTE_PATHS } from '../../../constants';
import { FooterLinkProps, FooterSectionProps } from './Types';

const footerSections = [
  {
    title: 'Product',
    links: [
      { name: 'About Us', path: ROUTE_PATHS.ABOUT },
      { name: 'FAQs', path: ROUTE_PATHS.FAQS },
      // TODO: Uncomment this line when release notes will be added to the application
      // { name: 'Release Notes', path: ROUTE_PATHS.RELEASE_NOTES },
    ],
  },
  {
    title: 'Support',
    links: [
      { name: 'Troubleshooting', path: ROUTE_PATHS.TROUBLESHOOTING },
      { name: 'Contact Us', path: ROUTE_PATHS.CONTACT_US },
    ],
  },
  {
    title: 'About',
    links: [
      { name: 'Privacy Policy', path: ROUTE_PATHS.PRIVACY_POLICY },
      // TODO: Uncomment this line when terms of Use notes will be added to the application
      // { name: 'Terms of Use', path: ROUTE_PATHS.TERMS_OF_USE },
    ],
  },
];

const FooterLink = ({ name, path }: FooterLinkProps) => (
  <li className="h-[1.0625rem]">
    <Link to={path} className="leading-[17px] text-white hover:underline">
      {name}
    </Link>
  </li>
);

const FooterSection = ({ title, links }: FooterSectionProps) => (
  <div>
    <h3 className="mb-1 text-sm leading-[17px] font-semibold md:mt-0 [@media(min-width:1440px)]:mt-[1.5625rem]">
      {title}
    </h3>
    <ul className="space-y-1 text-sm">
      {links.map((link) => (
        <FooterLink key={link.name} {...link} />
      ))}
    </ul>
  </div>
);

const Footer = () => (
  <>
    <div className="h-2 w-full bg-gradient-to-r from-blue-500 to-blue-400" />
    <footer className="bg-gray-900 text-white md:px-18 md:py-3 [@media(min-width:1440px)]:py-[4.5rem] [@media(min-width:1440px)]:pt-[3.375rem] [@media(min-width:1440px)]:pb-[0.6875rem]">
      <div className="w-[80%]">
        <div className="flex flex-wrap gap-3">
          <div className="mr-[5rem] [@media(min-width:1440px)]:mr-[12.125rem]">
            <h2 className="text-sm leading-[15px] font-bold">T E L L A G E N C E</h2>
          </div>
          <div className="flex flex-wrap gap-24 [@media(min-width:1440px)]:gap-[4.6875rem]">
            {footerSections.map((section) => (
              <FooterSection key={section.title} {...section} />
            ))}
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-r from-[#3131F5] to-[#0D8BFD] bg-clip-text text-center text-sm leading-[17px] text-transparent md:mt-0 [@media(min-width:1440px)]:mt-[3.875rem]">
        &copy; {moment().year()} mychair
      </div>
    </footer>
  </>
);

export default Footer;
