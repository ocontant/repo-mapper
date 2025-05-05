// Updated file classification function to be more generic and adaptable
function processFile(filePath, parser, language) {
  console.log(`Processing ${filePath}...`);
  
  const fileInfo = {
    path: filePath,
    classes: [],
    interfaces: [],
    imports: [],
    decorators: [],
    
    // More generic file type classification without framework-specific assumptions
    isComponent: false,
    isService: false,
    isDataModel: false,
    isController: false,
    isUtility: false,
    isConfig: false,
    isTest: false,
    isStylesheet: false,
    isResource: false,
    isScript: false
  };
  
  try {
    const content = readFileContent(filePath);
    if (!content) return fileInfo;
    
    const tree = parser.parse(content);
    
    // Extract data
    fileInfo.classes = extractClasses(tree, language);
    fileInfo.interfaces = extractInterfaces(tree, language);
    fileInfo.imports = extractImports(tree, language);
    fileInfo.decorators = extractDecorators(tree, language);
    
    // Get filename and path info for classification
    const fileName = path.basename(filePath).toLowerCase();
    const dirPath = path.dirname(filePath).toLowerCase();
    
    // Generic classification based on filename and path patterns
    // These patterns are common across many frameworks and languages
    
    // Test files
    fileInfo.isTest = fileName.includes('test') || 
                    fileName.includes('spec') || 
                    fileName.match(/\._?test\./) || 
                    dirPath.includes('/test') || 
                    dirPath.includes('/tests') || 
                    dirPath.includes('/spec');
    
    // Config files
    fileInfo.isConfig = fileName.includes('config') || 
                      fileName.includes('setting') || 
                      fileName.includes('.conf.') || 
                      fileName.endsWith('.config') || 
                      fileName.endsWith('.conf') || 
                      fileName.endsWith('.json') || 
                      fileName.endsWith('.env') || 
                      dirPath.includes('/config') || 
                      dirPath.includes('/settings');
    
    // UI Components 
    fileInfo.isComponent = fileName.includes('component') || 
                        fileName.includes('view') || 
                        fileName.includes('page') || 
                        fileName.includes('template') || 
                        fileName.includes('widget') || 
                        fileName.includes('element') || 
                        fileName.endsWith('.vue') || 
                        fileName.endsWith('.jsx') || 
                        fileName.endsWith('.tsx') || 
                        dirPath.includes('/components') || 
                        dirPath.includes('/views') || 
                        dirPath.includes('/pages') || 
                        dirPath.includes('/ui/') || 
                        (fileInfo.decorators && fileInfo.decorators.some(d => 
                          d.type === 'Component' || 
                          d.type === 'View' || 
                          d.type === 'Page'));
    
    // Data models
    fileInfo.isDataModel = fileName.includes('model') || 
                         fileName.includes('entity') || 
                         fileName.includes('schema') || 
                         fileName.includes('type') || 
                         fileName.includes('interface') || 
                         fileName.includes('dto') || 
                         dirPath.includes('/models') || 
                         dirPath.includes('/entities') || 
                         dirPath.includes('/schemas') || 
                         dirPath.includes('/types') || 
                         dirPath.includes('/interfaces') || 
                         dirPath.includes('/domain');
    
    // Service files
    fileInfo.isService = fileName.includes('service') || 
                      fileName.includes('provider') || 
                      fileName.includes('manager') || 
                      fileName.includes('client') || 
                      fileName.includes('api') || 
                      dirPath.includes('/services') || 
                      dirPath.includes('/providers') || 
                      (fileInfo.decorators && fileInfo.decorators.some(d => 
                        d.type === 'Service' || 
                        d.type === 'Injectable'));
    
    // Controller files (API/route handlers)
    fileInfo.isController = fileName.includes('controller') || 
                         fileName.includes('handler') || 
                         fileName.includes('resource') || 
                         fileName.includes('action') || 
                         fileName.includes('resolver') || 
                         dirPath.includes('/controllers') || 
                         dirPath.includes('/handlers') || 
                         dirPath.includes('/resources') || 
                         dirPath.includes('/actions') || 
                         dirPath.includes('/resolvers') || 
                         (fileInfo.decorators && fileInfo.decorators.some(d => 
                          d.type === 'Controller' || 
                          d.type === 'RestController' || 
                          d.type === 'RequestHandler' || 
                          d.type === 'Resource'));
    
    // Utility/Helper files
    fileInfo.isUtility = fileName.includes('util') || 
                      fileName.includes('helper') || 
                      fileName.includes('common') || 
                      fileName.includes('shared') || 
                      fileName.includes('lib') || 
                      dirPath.includes('/utils') || 
                      dirPath.includes('/helpers') || 
                      dirPath.includes('/common') || 
                      dirPath.includes('/shared') || 
                      dirPath.includes('/lib');
    
    // Stylesheets
    fileInfo.isStylesheet = fileName.endsWith('.css') || 
                         fileName.endsWith('.scss') || 
                         fileName.endsWith('.sass') || 
                         fileName.endsWith('.less') || 
                         fileName.endsWith('.styl');
    
    // Resources (assets, static files)
    fileInfo.isResource = dirPath.includes('/assets') || 
                      dirPath.includes('/resources') || 
                      dirPath.includes('/static') || 
                      dirPath.includes('/public') || 
                      fileName.match(/\.(svg|png|jpg|jpeg|gif|ico|woff|ttf|eot)$/);
    
    // Scripts (build, deployment, CI/CD)
    fileInfo.isScript = fileName.endsWith('.sh') || 
                      fileName.endsWith('.bat') || 
                      fileName.endsWith('.ps1') || 
                      dirPath.includes('/scripts') || 
                      dirPath.includes('/ci') || 
                      dirPath.includes('/build');
    
    return fileInfo;
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
    return fileInfo;
  }
}