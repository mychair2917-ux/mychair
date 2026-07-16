export interface DataSourceQueryHelpContent {
  header: string;
  description: string;
  subHeader?: string;
  subDescription?: string;
  links?: {
    title: string;
    url: string;
  }[];
}
