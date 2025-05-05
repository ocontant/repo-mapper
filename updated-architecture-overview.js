// Updated architecture overview generation to be more universal
function generateArchitectureOverview(filesInfo, features, language) {
  let markdown = '## Architecture Overview\n\n';
  
  // Analyze the codebase structure to determine architecture
  const folderStructure = new Set();
  const fileTypes = new Set();
  
  // Extract directory structure and file types
  filesInfo.forEach(info => {
    // Get directory structure
    const dirs = path.dirname(info.path).split(path.sep);
    dirs.forEach(dir => {
      if (dir && dir !== '.' && dir !== '..') {
        folderStructure.add(dir.toLowerCase());
      }
    });
    
    // Track file types
    if (info.isComponent) fileTypes.add('component');
    if (info.isService) fileTypes.add('service');
    if (info.isDataModel) fileTypes.add('data-model');
    if (info.isController) fileTypes.add('controller');
    if (info.isUtility) fileTypes.add('utility');
    if (info.isConfig) fileTypes.add('config');
    if (info.isTest) fileTypes.add('test');
    if (info.isStylesheet) fileTypes.add('stylesheet');
    if (info.isResource) fileTypes.add('resource');
    if (info.isScript) fileTypes.add('script');
  });
  
  // Convert Sets to Arrays for easier manipulation
  const folders = Array.from(folderStructure);
  const types = Array.from(fileTypes);
  
  // Determine the architecture type based on the codebase structure
  let architectureType = 'modular';
  
  // Check for frontend framework indicators
  const frontendIndicators = ['components', 'views', 'pages', 'ui', 'templates', 'styles', 'assets'];
  const hasComponentBased = frontendIndicators.some(indicator => folders.includes(indicator));
  
  // Check for backend/API indicators
  const backendIndicators = ['controllers', 'routes', 'api', 'endpoints', 'handlers', 'middleware'];
  const hasBackendApi = backendIndicators.some(indicator => folders.includes(indicator));
  
  // Check for data-centric indicators
  const dataIndicators = ['models', 'entities', 'repositories', 'dao', 'schemas', 'database', 'types', 'dto'];
  const hasDataDriven = dataIndicators.some(indicator => folders.includes(indicator));
  
  // Check for service-oriented indicators
  const serviceIndicators = ['services', 'providers', 'managers', 'clients'];
  const hasServiceOriented = serviceIndicators.some(indicator => folders.includes(indicator));
  
  // Determine primary architecture paradigm
  if (hasComponentBased && hasBackendApi) {
    architectureType = 'full-stack application';
  } else if (hasComponentBased) {
    architectureType = 'component-based frontend application';
  } else if (hasBackendApi && hasDataDriven) {
    architectureType = 'API/backend service';
  } else if (hasServiceOriented) {
    architectureType = 'service-oriented application';
  } else if (hasDataDriven) {
    architectureType = 'data-centric application';
  } else if (types.includes('script')) {
    architectureType = 'utility/script library';
  }
  
  // Write the architecture description
  markdown += `The codebase implements a ${architectureType} with the following main components:\n\n`;
  
  // Create a list of architecture components based on discovered structure
  const architectureComponents = [];
  
  // Common architecture components across many applications
  if (hasDataDriven || types.includes('data-model')) {
    architectureComponents.push('**Data Models**: Define the core business data structures and entities');
  }
  
  if (hasServiceOriented || types.includes('service')) {
    architectureComponents.push('**Services**: Implement core business logic and operations');
  }
  
  if (hasBackendApi || types.includes('controller')) {
    architectureComponents.push('**API Layer**: Handles external requests and responses');
  }
  
  if (hasComponentBased || types.includes('component')) {
    architectureComponents.push('**UI Components**: Reusable interface elements and views');
  }
  
  if (types.includes('utility')) {
    architectureComponents.push('**Utilities**: Helper functions and shared code');
  }
  
  if (folders.includes('config') || types.includes('config')) {
    architectureComponents.push('**Configuration**: System settings and environment-specific parameters');
  }
  
  if (types.includes('test')) {
    architectureComponents.push('**Tests**: Automated test suites for code validation');
  }
  
  if (folders.some(f => ['assets', 'resources', 'static', 'public'].includes(f)) || types.includes('resource')) {
    architectureComponents.push('**Resources**: Static assets and resources');
  }
  
  // Add the identified components to the markdown
  architectureComponents.forEach(component => {
    markdown += `- ${component}\n`;
  });
  
  // Add more structure info based on feature organization
  if (Object.keys(features).length > 0) {
    markdown += '\n### Module Organization\n\n';
    markdown += 'The application is organized into the following logical modules:\n\n';
    
    // List significant features (only a few to keep it concise)
    const significantFeatures = Object.keys(features).filter(f => 
      !['app', 'test', 'tests', 'node_modules'].includes(f)
    ).slice(0, 5);
    
    significantFeatures.forEach(feature => {
      markdown += `- **${feature.charAt(0).toUpperCase() + feature.slice(1)}**: `;
      
      // Describe what's in this feature
      const components = [];
      if (features[feature].services.length > 0) components.push('services');
      if (features[feature].components.length > 0) components.push('components');
      if (features[feature].controllers.length > 0) components.push('controllers');
      if (features[feature].models.length > 0) components.push('data models');
      if (features[feature].utils.length > 0) components.push('utilities');
      
      markdown += components.length > 0
        ? `Contains ${components.join(', ')}`
        : 'Application module';
      
      markdown += '\n';
    });
    
    if (Object.keys(features).length > significantFeatures.length) {
      markdown += `- **Additional modules**: The application contains ${Object.keys(features).length - significantFeatures.length} additional modules not listed above\n`;
    }
  }
  
  markdown += '\n';
  return markdown;
}