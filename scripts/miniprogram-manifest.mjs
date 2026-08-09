function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeSegment(value) {
  return value.replace(/^\/+|\/+$/g, '');
}

function readPages(value, label) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new TypeError(`${label} must be an array of non-empty strings`);
  }
  const pages = value.map((page) => (typeof page === 'string' ? normalizeSegment(page) : ''));
  if (pages.some((page) => page.length === 0)) {
    throw new TypeError(`${label} must be an array of non-empty strings`);
  }
  return pages;
}

export function listRegisteredPages(appJson) {
  if (!isRecord(appJson)) {
    throw new TypeError('app.json must contain an object');
  }

  const routes = readPages(appJson.pages, 'app.json pages');
  const subPackages = appJson.subPackages ?? [];
  if (!Array.isArray(subPackages)) {
    throw new TypeError('app.json subPackages must be an array');
  }

  subPackages.forEach((subPackage, index) => {
    if (!isRecord(subPackage)) {
      throw new TypeError(`subPackages[${index}] must be an object`);
    }
    if (typeof subPackage.root !== 'string' || normalizeSegment(subPackage.root).length === 0) {
      throw new TypeError(`subPackages[${index}].root must be a non-empty string`);
    }
    const root = normalizeSegment(subPackage.root);
    for (const page of readPages(subPackage.pages, `subPackages[${index}].pages`)) {
      routes.push(`${root}/${page}`);
    }
  });

  const seen = new Set();
  for (const route of routes) {
    if (seen.has(route)) {
      throw new Error(`Duplicate miniprogram route: ${route}`);
    }
    seen.add(route);
  }
  return routes;
}
