const Image = require("@11ty/eleventy-img");

// Image shortcode for responsive images
async function imageShortcode(src, alt, sizes = "100vw", className = "") {
  // Handle both absolute and relative paths
  let imagePath = src;
  if (src.startsWith('./')) {
    imagePath = src;
  } else if (!src.startsWith('http') && !src.startsWith('/')) {
    imagePath = `./src/${src}`;
  } else if (src.startsWith('/')) {
    imagePath = `./src${src}`;
  }

  let metadata = await Image(imagePath, {
    widths: [300, 600, 900, 1200],
    formats: ["avif", "webp", "jpeg"],
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
    class: className
  };

  return Image.generateHTML(metadata, imageAttributes);
}

// Shortcode to get just the URL of a large optimized image (for Lightbox/Open Graph)
async function imageUrlShortcode(src) {
  let imagePath = src;
  if (src.startsWith('./')) {
    imagePath = src;
  } else if (!src.startsWith('http') && !src.startsWith('/')) {
    imagePath = `./src/${src}`;
  } else if (src.startsWith('/')) {
    imagePath = `./src${src}`;
  }

  let metadata = await Image(imagePath, {
    widths: [1200],
    formats: ["jpeg"],
    outputDir: "./_site/images/optimized/",
    urlPath: "/images/optimized/",
    sharpOptions: {
      animated: false
    }
  });

  return metadata.jpeg[0].url;
}

module.exports = function(eleventyConfig) {
  // Add image shortcode
  eleventyConfig.addNunjucksAsyncShortcode("image", imageShortcode);
  eleventyConfig.addNunjucksAsyncShortcode("imageUrl", imageUrlShortcode);

  // Passthrough copies
  eleventyConfig.addPassthroughCopy("src/assets/css");
  eleventyConfig.addPassthroughCopy("src/assets/js");
  eleventyConfig.addPassthroughCopy("src/assets/fonts");
  eleventyConfig.addPassthroughCopy("src/images");
  eleventyConfig.addPassthroughCopy("src/files");
  eleventyConfig.addPassthroughCopy("src/robots.txt");
  eleventyConfig.addPassthroughCopy("src/_headers");
  eleventyConfig.addPassthroughCopy("src/favicon.ico");
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
      const semester = prod.data.semester;
      if (semester) {
        if (!grouped[semester]) {
          grouped[semester] = [];
        }
        grouped[semester].push(prod);
      }
    });

    // Sort semesters (newest first)
    // Format: "SoSe 24", "WiSe 24/25"
    return Object.keys(grouped)
      .sort((a, b) => {
        const parseSemester = (sem) => {
          // Extract year and type
          if (sem.startsWith('WiSe')) {
            // WiSe 24/25 -> year 24, isWinter: true
            const yearMatch = sem.match(/WiSe (\d+)/);
            const year = yearMatch ? parseInt(yearMatch[1]) : 0;
            return year * 2 + 1; // Winter semester gets +1
          } else if (sem.startsWith('SoSe')) {
            // SoSe 24 -> year 24, isWinter: false
            const yearMatch = sem.match(/SoSe (\d+)/);
            const year = yearMatch ? parseInt(yearMatch[1]) : 0;
            return year * 2; // Summer semester
          }
          return 0;
        };

        // Sort descending (newest first)
        return parseSemester(b) - parseSemester(a);
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

  // Group consecutive items by 'scene' property
  // Input: [{role: "A", scene: "1"}, {role: "B", scene: "1"}, {role: "C", scene: "2"}]
  // Output: [{scene: "1", items: [{role: "A"...}, {role: "B"...}]}, {scene: "2", items: [{role: "C"...}]}]
  eleventyConfig.addFilter("groupByScene", function(list) {
    if (!list || !Array.isArray(list)) return [];
    
    const groups = [];
    let currentGroup = null;

    list.forEach(item => {
      const itemScene = item.scene || null;
      
      // If no group or scene changed
      if (!currentGroup || currentGroup.scene !== itemScene) {
        currentGroup = {
          scene: itemScene,
          items: []
        };
        groups.push(currentGroup);
      }
      
      currentGroup.items.push(item);
    });

    return groups;
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
