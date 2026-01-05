const Image = require("@11ty/eleventy-img");

// Image shortcode for responsive images
async function imageShortcode(src, alt, sizes = "100vw") {
  // Handle both absolute and relative paths
  let imagePath = src;
  if (src.startsWith('./')) {
    imagePath = src;
  } else if (!src.startsWith('http') && !src.startsWith('/')) {
    imagePath = `./src/${src}`;
  } else if (src.startsWith('/')) {
    imagePath = `.${src}`;
  }

  let metadata = await Image(imagePath, {
    widths: [300, 600, 900, 1200],
    formats: ["webp", "jpeg"],
    outputDir: "./_site/images/optimized/",
    urlPath: "/images/optimized/",
    sharpOptions: {
      animated: false
    }
  });

  let imageAttributes = {
    alt,
    sizes,
    loading: "lazy",
    decoding: "async",
  };

  return Image.generateHTML(metadata, imageAttributes);
}

module.exports = function(eleventyConfig) {
  // Add image shortcode
  eleventyConfig.addNunjucksAsyncShortcode("image", imageShortcode);

  // Passthrough copies
  eleventyConfig.addPassthroughCopy("src/assets/css");
  eleventyConfig.addPassthroughCopy("src/assets/js");
  eleventyConfig.addPassthroughCopy("src/assets/fonts");
  eleventyConfig.addPassthroughCopy("src/images");
  eleventyConfig.addPassthroughCopy("src/files");
  eleventyConfig.addPassthroughCopy("src/assets/**/*.{jpg,jpeg,png,gif,svg,pdf}");

  // Collections
  // Main inszenierungen collection - sorted by date (newest first)
  eleventyConfig.addCollection("inszenierungen", function(collectionApi) {
    return collectionApi.getFilteredByGlob("src/inszenierungen/*.md")
      .sort((a, b) => {
        const aDate = new Date(a.data.date);
        const bDate = new Date(b.data.date);
        return bDate - aDate; // Newest first
      });
  });

  // Group productions by semester
  eleventyConfig.addCollection("inszenierungBySemester", function(collectionApi) {
    const productions = collectionApi.getFilteredByGlob("src/inszenierungen/*.md");
    const grouped = {};

    productions.forEach(prod => {
      // Extract semester from date if not provided
      let semester = prod.data.semester;
      if (!semester) {
        const date = new Date(prod.data.date);
        const year = date.getFullYear();
        const month = date.getMonth() + 1; // 0-indexed

        // In Germany: WS (Oct-Mar), SS (Apr-Sep)
        if (month >= 10 || month <= 3) {
          // Winter semester spans two years, use the starting year
          const semesterYear = month >= 10 ? year : year - 1;
          semester = `WS ${semesterYear}`;
        } else {
          semester = `SS ${year}`;
        }
      }

      if (!grouped[semester]) {
        grouped[semester] = [];
      }
      grouped[semester].push(prod);
    });

    // Sort semesters (newest first, WS before SS in same year)
    return Object.keys(grouped)
      .sort((a, b) => {
        const parseKey = (key) => {
          const [type, year] = key.split(' ');
          return { year: parseInt(year), isWinter: type === 'WS' };
        };
        const aData = parseKey(a);
        const bData = parseKey(b);

        if (aData.year !== bData.year) return bData.year - aData.year;
        // Within same year, WS comes after SS (chronologically)
        return aData.isWinter ? 1 : -1;
      })
      .map(semester => ({
        semester,
        productions: grouped[semester].sort((a, b) => {
          return new Date(b.data.date) - new Date(a.data.date);
        })
      }));
  });

  // Filters
  // Format date in German locale
  eleventyConfig.addFilter("formatDate", function(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC'
    });
  });

  // Get first performance date from dates string
  eleventyConfig.addFilter("firstDate", function(datesString) {
    if (!datesString) return '';
    // Extract first date-like pattern from string
    const match = datesString.match(/\d{1,2}\.\s*\w+\s*\d{4}/);
    return match ? match[0] : datesString.split(',')[0];
  });

  // Watch targets for dev mode
  eleventyConfig.addWatchTarget("src/assets/css/");
  eleventyConfig.addWatchTarget("src/assets/js/");

  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
      data: "_data"
    },
    templateFormats: ["md", "njk", "html"],
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk"
  };
};
