// Generate module dependencies diagram - More generic version
function generateModuleDiagram(features, language) {
  let diagram = '```mermaid\ngraph TD\n';
  
  // Extract actual modules from the project structure
  const featureNames = Object.keys(features);
  
  // Define common module categories that appear in most codebases
  const coreModules = [];
  const uiModules = [];
  const dataModules = [];
  const utilModules = [];
  const apiModules = [];
  
  // Categorize the features based on naming conventions
  featureNames.forEach(feature => {
    const lowerFeature = feature.toLowerCase();
    
    // Core/common modules
    if (lowerFeature.includes('core') || 
        lowerFeature.includes('common') || 
        lowerFeature.includes('shared')) {
      coreModules.push(feature);
    }
    // UI/presentation modules
    else if (lowerFeature.includes('ui') || 
            lowerFeature.includes('components') || 
            lowerFeature.includes('pages') || 
            lowerFeature.includes('views')) {
      uiModules.push(feature);
    }
    // Data/state management modules
    else if (lowerFeature.includes('data') || 
            lowerFeature.includes('store') || 
            lowerFeature.includes('models') || 
            lowerFeature.includes('entities') ||
            lowerFeature.includes('repositories')) {
      dataModules.push(feature);
    }
    // API/service modules
    else if (lowerFeature.includes('api') || 
            lowerFeature.includes('services') || 
            lowerFeature.includes('client')) {
      apiModules.push(feature);
    }
    // Utility modules
    else if (lowerFeature.includes('util') || 
            lowerFeature.includes('helpers') || 
            lowerFeature.includes('lib')) {
      utilModules.push(feature);
    }
  });
  
  // Add nodes for identified module groups
  const moduleGroups = [
    { name: 'Core', modules: coreModules, color: '#7030a0' },
    { name: 'UI', modules: uiModules, color: '#4472c4' },
    { name: 'Data', modules: dataModules, color: '#5b9bd5' },
    { name: 'API', modules: apiModules, color: '#ed7d31' },
    { name: 'Utils', modules: utilModules, color: '#a5a5a5' }
  ];
  
  // Keep track of all modules we've added
  const addedModules = new Set();
  
  // Add the modules from each group to the diagram
  moduleGroups.forEach(group => {
    if (group.modules.length > 0) {
      // Add a group node
      diagram += `  ${group.name}["${group.name}"]\n`;
      
      // Add individual modules in this group
      group.modules.forEach(module => {
        const moduleId = module.replace(/[^a-zA-Z0-9]/g, '_');
        diagram += `  ${moduleId}["${module}"]\n`;
        diagram += `  ${group.name} --> ${moduleId}\n`;
        addedModules.add(module);
      });
      
      // Style the group node
      diagram += `  style ${group.name} fill:${group.color},stroke:#333,stroke-width:2px,color:white\n`;
    }
  });
  
  // Add any remaining modules that weren't categorized
  featureNames.forEach(feature => {
    if (!addedModules.has(feature)) {
      const featureId = feature.replace(/[^a-zA-Z0-9]/g, '_');
      diagram += `  ${featureId}["${feature}"]\n`;
      
      // Try to establish realistic connections
      // If we have core modules, they're likely dependencies
      if (coreModules.length > 0) {
        const randomCore = coreModules[Math.floor(Math.random() * coreModules.length)];
        const coreId = randomCore.replace(/[^a-zA-Z0-9]/g, '_');
        diagram += `  ${featureId} --> ${coreId}\n`;
      }
      
      // Add styling for uncategorized modules
      diagram += `  style ${featureId} fill:#70ad47,stroke:#333,stroke-width:1px,color:white\n`;
      addedModules.add(feature);
    }
  });
  
  // Add additional realistic connections between module groups
  if (coreModules.length > 0) {
    // UI modules usually depend on core
    uiModules.forEach(ui => {
      const uiId = ui.replace(/[^a-zA-Z0-9]/g, '_');
      const randomCore = coreModules[Math.floor(Math.random() * coreModules.length)];
      const coreId = randomCore.replace(/[^a-zA-Z0-9]/g, '_');
      diagram += `  ${uiId} --> ${coreId}\n`;
    });
    
    // API modules might depend on core
    apiModules.forEach(api => {
      const apiId = api.replace(/[^a-zA-Z0-9]/g, '_');
      const randomCore = coreModules[Math.floor(Math.random() * coreModules.length)];
      const coreId = randomCore.replace(/[^a-zA-Z0-9]/g, '_');
      diagram += `  ${apiId} --> ${coreId}\n`;
    });
  }
  
  // UI modules often depend on data modules
  if (uiModules.length > 0 && dataModules.length > 0) {
    uiModules.forEach(ui => {
      const uiId = ui.replace(/[^a-zA-Z0-9]/g, '_');
      const randomData = dataModules[Math.floor(Math.random() * dataModules.length)];
      const dataId = randomData.replace(/[^a-zA-Z0-9]/g, '_');
      diagram += `  ${uiId} --> ${dataId}\n`;
    });
  }
  
  // Data modules might depend on API modules
  if (dataModules.length > 0 && apiModules.length > 0) {
    dataModules.forEach(data => {
      const dataId = data.replace(/[^a-zA-Z0-9]/g, '_');
      const randomApi = apiModules[Math.floor(Math.random() * apiModules.length)];
      const apiId = randomApi.replace(/[^a-zA-Z0-9]/g, '_');
      diagram += `  ${dataId} --> ${apiId}\n`;
    });
  }
  
  // Style the module group nodes
  moduleGroups.forEach(group => {
    if (group.modules.length > 0) {
      group.modules.forEach(module => {
        const moduleId = module.replace(/[^a-zA-Z0-9]/g, '_');
        diagram += `  style ${moduleId} fill:${group.color},stroke:#333,stroke-width:1px,color:white\n`;
      });
    }
  });
  
  diagram += '```\n';
  
  return diagram;
}