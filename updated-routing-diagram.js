// Generate routing diagram - More generic version
function generateRoutingDiagram(filesInfo, language) {
  // Skip if routing diagram is disabled
  if (!options.routes) {
    return '';
  }

  let diagram = '```mermaid\ngraph LR\n';
  
  // Build a list of routes based on discovered files
  const routes = [];
  
  // Always include root route
  routes.push({ path: '/', name: 'Root' });
  
  // Try to identify potential routes from the codebase structure
  const routeIndicators = ['routes', 'router', 'controllers', 'handlers', 'endpoints', 'views'];
  const routeFileFound = filesInfo.some(info => 
    routeIndicators.some(indicator => info.path.toLowerCase().includes(indicator))
  );
  
  // Add API route if there are likely API endpoints
  const hasApi = filesInfo.some(info => 
    info.path.includes('/api/') || 
    info.path.includes('api.') || 
    info.isController
  );
  
  if (hasApi) {
    routes.push({ path: '/api', name: 'API' });
  }
  
  // Look for controller files that might indicate routes across all languages
  filesInfo.forEach(info => {
    if (info.isController) {
      const controller = path.basename(info.path, path.extname(info.path))
        .toLowerCase()
        .replace('controller', '')
        .replace('view', '')
        .replace('handler', '')
        .replace('resource', '')
        .replace(/\..+$/, ''); // Remove file extensions if present
        
      if (controller && controller !== 'base' && controller !== 'app' && controller !== 'index') {
        const routeName = controller.charAt(0).toUpperCase() + controller.slice(1);
        
        // Avoid duplicates
        if (!routes.some(r => r.path === `/${controller}`)) {
          routes.push({ path: `/${controller}`, name: routeName });
        }
      }
    }
  });
  
  // If no specific routes were detected, add a few placeholder routes
  // based on common patterns in the given language
  if (routes.length < 3) {
    if (routeFileFound) {
      routes.push({ path: '/main', name: 'Main' });
    }
    
    // Add documentation route if it seems like a development project
    const hasReadmeOrDocs = filesInfo.some(info => 
      info.path.toLowerCase().includes('readme') || 
      info.path.toLowerCase().includes('docs/') ||
      info.path.toLowerCase().includes('documentation')
    );
    
    if (hasReadmeOrDocs) {
      routes.push({ path: '/docs', name: 'Docs' });
    }
  }
  
  // Add nodes for each route
  routes.forEach(route => {
    diagram += `  ${route.name.replace(/[^a-zA-Z0-9]/g, '')}["${route.path}"]\n`;
  });
  
  // Add connections between routes
  for (let i = 0; i < routes.length; i++) {
    const route = routes[i];
    if (route.path === '/') {
      // Root route connects to top-level routes
      for (let j = 0; j < routes.length; j++) {
        const target = routes[j];
        if (target.path !== '/' && target.path.split('/').length === 2) {
          diagram += `  ${route.name.replace(/[^a-zA-Z0-9]/g, '')} --> ${target.name.replace(/[^a-zA-Z0-9]/g, '')}\n`;
        }
      }
    }
    else if (route.path.split('/').length === 2) {
      // First-level routes connect to their children
      for (let j = 0; j < routes.length; j++) {
        const target = routes[j];
        if (target.path.startsWith(route.path + '/')) {
          diagram += `  ${route.name.replace(/[^a-zA-Z0-9]/g, '')} --> ${target.name.replace(/[^a-zA-Z0-9]/g, '')}\n`;
        }
      }
    }
  }
  
  // Add styling
  diagram += '\n';
  routes.forEach((route, index) => {
    // Alternate colors for routes
    const colors = ['#4472c4', '#ed7d31', '#a5a5a5', '#70ad47'];
    const color = colors[index % colors.length];
    diagram += `  style ${route.name.replace(/[^a-zA-Z0-9]/g, '')} fill:${color},stroke:#333,stroke-width:1px,color:white\n`;
  });
  
  diagram += '```\n';
  
  return diagram;
}