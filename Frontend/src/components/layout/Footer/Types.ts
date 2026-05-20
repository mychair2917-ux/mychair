export interface FooterLinkProps {
  name: string;
  path: string;
}

export interface FooterSectionProps {
  title: string;
  links: { name: string; path: string }[];
}
