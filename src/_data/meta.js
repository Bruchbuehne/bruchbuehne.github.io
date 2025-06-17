export const url = process.env.URL || 'https://bruchbuehne.de';
// Extract domain from `url`
export const domain = new URL(url).hostname;
export const siteName = 'Bruchbühne Tübingen';
export const siteDescription = 'Webseite der Bruchbühne Tübingen';
export const siteType = 'Organisation'; // schema
export const locale = 'de_DE';
export const lang = 'de';
export const skipContent = 'Skip to content';
export const author = {
  name: 'Bertbold Bühne', // i.e. Lene Saile - page / blog author's name. Must be set.
  avatar: '/icon-512x512.png', // path to the author's avatar. In this case just using a favicon.
  email: 'bruchbuehne@gmail.com', // i.e. hola@lenesaile.com - email of the author
}
export const creator = {
  name: 'Nicolai Plenk', // i.e. Lene Saile - creator's (developer) name.
  email: 'nicolai@mujstan.email',
  website: 'https://nicola.ink',
  social: 'https://instagram.com/untitledsophisticated', // i.e. https://instagram.com/lenesaile - creator's social media link
};
export const pathToSvgLogo = 'src/assets/svg/misc/logo.svg'; // used for favicon generation
export const themeColor = '#dd4462'; // used in manifest, for example primary color value
export const themeLight = '#f8f8f8'; // used for meta tag theme-color, if light colors are prefered. best use value set for light bg
export const themeDark = '#2e2e2e'; // used for meta tag theme-color, if dark colors are prefered. best use value set for dark bg
export const blog = {
  // RSS feed
  name: 'Bruchbühne Tübingen',
  description: 'Updates zu neuen Stücken der Bruchbühne Tübingen.',
  // feed links are looped over in the head. You may add more to the array.
  feedLinks: [
    {
      title: 'Atom Feed',
      url: '/feed.xml',
      type: 'application/atom+xml'
    },
    {
      title: 'JSON Feed',
      url: '/feed.json',
      type: 'application/json'
    }
  ],
  // Tags
  tagSingle: 'Tag',
  tagPlural: 'Tags',
  tagMore: 'More tags:',
  // pagination
  paginationLabel: 'Blog',
  paginationPage: 'Page',
  paginationPrevious: 'Previous',
  paginationNext: 'Next',
  paginationNumbers: true
};
export const details = {
  aria: 'section controls',
  expand: 'expand all',
  collapse: 'collapse all'
};
export const dialog = {
  close: 'Close'
};
export const navigation = {
  navLabel: 'Menu',
  ariaTop: 'Main',
  ariaBottom: 'Complementary',
  ariaPlatforms: 'Platforms',
  drawerNav: false
};
export const themeSwitch = {
  title: 'Theme',
  light: 'light',
  dark: 'dark'
};
/* export const greenweb = {
  // https://carbontxt.org/
  disclosures: [
    {
      docType: 'sustainability-page',
      url: `${url}/sustainability/`,
      domain: domain
    }
  ],
  services: [{domain: 'github.com', serviceType: 'hosting-provider'}],
}; */
export const viewRepo = {
  // this is for the view/edit on github link. The value in the package.json will be pulled in.
  allow: true,
  infoText: 'View this page on GitHub'
};
export const easteregg = true;
