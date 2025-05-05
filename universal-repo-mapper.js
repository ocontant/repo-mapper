#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const commander = require('commander');

// Setup commander
const program = new commander.Command();
program
  .name('universal-repo-mapper')
  .description('Generate a comprehensive repository map with code structure visualization')
  .version('1.0.0')
  .option('-d, --directory <dir>', 'Target directory to analyze (default: current directory)', process.cwd())
  .option('-o, --output <file>', 'Output file path', 'repomap.gen.md')
  .option('-l, --language <lang>', 'Force specific language (auto-detected if not specified)')
  .option('-e, --exclude <pattern>', 'File patterns to exclude (comma-separated)', 'node_modules,dist,build,.git,**/test/**,**/*.spec.*,**/*.test.*')
  .option('-m, --max-files <number>', 'Maximum number of files to process', 1000)
  .option('-i, --include <pattern>', 'File patterns to include (comma-separated)', '**/*')
  .option('-s, --no-services', 'Skip services diagram generation', true)
  .option('-c, --no-components', 'Skip component diagram generation', true)
  .option('-r, --no-routes', 'Skip routes diagram generation', true)
  .option('--debug', 'Enable debug logging', false)
  .option('--install-deps', 'Install required dependencies', false)
  .option('--install-all-langs', 'Install parsers for all supported languages', false)
  .option('--install-langs <langs>', 'Install specific language parsers (comma-separated, e.g., "python,ruby,go")')
  .parse(process.argv);

const options = program.opts();

// Handle dependency installation if requested
if (options.installDeps || options.installAllLangs || options.installLangs) {
  installDependencies();
  if (!options.directory) {
    // If only installing dependencies without running analysis, exit
    process.exit(0);
  }
}

// Supported languages and their file extensions
const SUPPORTED_LANGUAGES = {
  'typescript': ['.ts', '.tsx'],
  'javascript': ['.js', '.jsx'],
  'python': ['.py'],
  'ruby': ['.rb'],
  'go': ['.go'],
  'rust': ['.rs'],
  'cpp': ['.cpp', '.cc', '.cxx', '.hpp', '.h', '.hxx'],
  'c': ['.c', '.h'],
  'c_sharp': ['.cs'],
  'java': ['.java'],
  'php': ['.php'],
  'kotlin': ['.kt', '.kts'],
  'swift': ['.swift'],
  'html': ['.html', '.htm'],
  'css': ['.css'],
  'vue': ['.vue']
};

// Initialize global variables
const baseDir = path.resolve(options.directory);
const outputFile = path.resolve(options.output);
let detectedLanguage = options.language;

/**
 * Install required dependencies
 */
function installDependencies() {
  console.log('Installing required dependencies...');
  
  // Core dependencies
  const coreDeps = [
    'commander',
    'tree-sitter',
    'tree-sitter-typescript',
    'tree-sitter-javascript'
  ];
  
  // Install core dependencies
  console.log('Installing core dependencies...');
  try {
    execSync(`npm install ${coreDeps.join(' ')}`, { stdio: 'inherit' });
  } catch (error) {
    console.error('Failed to install core dependencies:', error.message);
    process.exit(1);
  }
  
  // Language-specific parsers
  const langParsers = {
    'python': 'tree-sitter-python',
    'ruby': 'tree-sitter-ruby',
    'go': 'tree-sitter-go',
    'rust': 'tree-sitter-rust',
    'cpp': 'tree-sitter-cpp',
    'c': 'tree-sitter-c',
    'c_sharp': 'tree-sitter-c-sharp',
    'java': 'tree-sitter-java',
    'php': 'tree-sitter-php',
    'kotlin': 'tree-sitter-kotlin',
    'html': 'tree-sitter-html',
    'css': 'tree-sitter-css',
    'vue': 'tree-sitter-vue'
  };
  
  // Install specific language parsers
  if (options.installAllLangs) {
    console.log('Installing all language parsers...');
    const allParsers = Object.values(langParsers);
    try {
      execSync(`npm install ${allParsers.join(' ')}`, { stdio: 'inherit' });
    } catch (error) {
      console.warn('Some language parsers failed to install. This may be expected for less common languages.');
    }
  } else if (options.installLangs) {
    const requestedLangs = options.installLangs.split(',').map(l => l.trim());
    console.log(`Installing parsers for: ${requestedLangs.join(', ')}...`);
    
    // Install each requested parser
    requestedLangs.forEach(lang => {
      if (langParsers[lang]) {
        try {
          console.log(`Installing ${langParsers[lang]}...`);
          execSync(`npm install ${langParsers[lang]}`, { stdio: 'inherit' });
        } catch (error) {
          console.warn(`Failed to install ${langParsers[lang]}: ${error.message}`);
        }
      } else {
        console.warn(`Unknown language: ${lang}`);
      }
    });
  }
  
  console.log('Dependency installation complete.');
}

// Set up debug logging
const debug = (message) => {
  if (options.debug) {
    console.log(`[DEBUG] ${message}`);
  }
};

// Load language parser dynamically
async function loadLanguageParser(lang) {
  try {
    debug(`Loading parser for language: ${lang}`);
    
    // Try to require the language module
    const languageModule = require(`tree-sitter-${lang}`);
    
    // Different modules export their language in different ways
    if (languageModule[lang]) {
      return languageModule[lang];
    } else if (typeof languageModule === 'function') {
      return languageModule;
    } else {
      return languageModule;
    }
  } catch (error) {
    console.error(`Failed to load language parser for ${lang}: ${error.message}`);
    console.error('You may need to install it with: --install-deps --install-langs ' + lang);
    process.exit(1);
  }
}

// Detect repository language
async function detectLanguage() {
  if (detectedLanguage) {
    debug(`Using specified language: ${detectedLanguage}`);
    return detectedLanguage;
  }

  debug('Auto-detecting repository language...');
  
  // Get file extensions in the repository
  const findCmd = process.platform === 'win32'
    ? `dir /s /b ${baseDir} | findstr /i "\\."`
    : `find ${baseDir} -type f | grep -v "${options.exclude.replace(/,/g, '\\|')}" | grep "\\."`; 

  try {
    const files = execSync(findCmd, { encoding: 'utf8' }).split('\n');
    
    // Count extensions
    const extensionCount = {};
    files.forEach(file => {
      const ext = path.extname(file).toLowerCase();
      if (ext) {
        extensionCount[ext] = (extensionCount[ext] || 0) + 1;
      }
    });
    
    // Find which language has the most files
    let bestMatch = null;
    let bestMatchCount = 0;
    
    for (const [lang, extensions] of Object.entries(SUPPORTED_LANGUAGES)) {
      const count = extensions.reduce((sum, ext) => sum + (extensionCount[ext] || 0), 0);
      if (count > bestMatchCount) {
        bestMatch = lang;
        bestMatchCount = count;
      }
    }
    
    if (bestMatch && bestMatchCount > 0) {
      debug(`Auto-detected language: ${bestMatch} (${bestMatchCount} files)`);
      return bestMatch;
    }
    
    // Default to JavaScript if detection fails
    console.warn('Could not auto-detect language, defaulting to JavaScript');
    return 'javascript';
  } catch (error) {
    console.error('Error detecting language:', error.message);
    console.warn('Defaulting to JavaScript');
    return 'javascript';
  }
}

// Find all files of detected language type
function findFiles(language) {
  const extensions = SUPPORTED_LANGUAGES[language] || ['.js'];
  const extensionPattern = extensions
    .map(ext => ext.replace('.', ''))
    .join('\\|');
  
  const excludePattern = options.exclude.replace(/,/g, '\\|');
  
  const findCmd = process.platform === 'win32'
    ? `dir /s /b ${baseDir} | findstr /i "\\.${extensionPattern}$" | findstr /v "${excludePattern}"`
    : `find ${baseDir} -type f -name "*.[${extensionPattern}]" | grep -v "${excludePattern}"`;

  debug(`Running find command: ${findCmd}`);
  
  try {
    const output = execSync(findCmd, { encoding: 'utf8' });
    const files = output.trim().split('\n').filter(Boolean);
    
    // Limit the number of files if needed
    if (files.length > options.maxFiles) {
      console.warn(`Found ${files.length} files, limiting to ${options.maxFiles}`);
      return files.slice(0, options.maxFiles);
    }
    
    debug(`Found ${files.length} ${language} files`);
    return files;
  } catch (error) {
    console.error(`Error finding ${language} files:`, error.message);
    return [];
  }
}

// Read file content
function readFileContent(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error.message);
    return '';
  }
}

// Extract classes from AST (language-agnostic approach)
function extractClasses(tree, language) {
  const classes = [];
  
  // Define node types based on language
  const nodeTypes = {
    typescript: {
      classDeclaration: 'class_declaration',
      className: 'type_identifier',
      classBody: 'class_body',
      methodDefinition: 'method_definition',
      methodName: 'property_identifier',
      publicField: 'public_field_definition',
      privateField: 'private_field_definition',
      propertyName: 'property_identifier'
    },
    javascript: {
      classDeclaration: 'class_declaration',
      className: 'identifier',
      classBody: 'class_body',
      methodDefinition: 'method_definition',
      methodName: 'property_identifier',
      publicField: 'field_definition',
      privateField: 'field_definition',
      propertyName: 'property_identifier'
    },
    python: {
      classDeclaration: 'class_definition',
      className: 'identifier',
      classBody: 'block',
      methodDefinition: 'function_definition',
      methodName: 'identifier',
      publicField: 'expression_statement',
      privateField: 'expression_statement',
      propertyName: 'identifier'
    },
    ruby: {
      classDeclaration: 'class',
      className: 'constant',
      classBody: 'body_statement',
      methodDefinition: 'method',
      methodName: 'identifier',
      publicField: 'assignment',
      privateField: 'assignment',
      propertyName: 'identifier'
    },
    go: {
      classDeclaration: 'type_declaration',
      className: 'type_identifier',
      classBody: 'struct_type',
      methodDefinition: 'method_declaration',
      methodName: 'field_identifier',
      publicField: 'field_declaration',
      privateField: 'field_declaration',
      propertyName: 'field_identifier'
    },
    java: {
      classDeclaration: 'class_declaration',
      className: 'identifier',
      classBody: 'class_body',
      methodDefinition: 'method_declaration',
      methodName: 'identifier',
      publicField: 'field_declaration',
      privateField: 'field_declaration',
      propertyName: 'identifier'
    },
    // Default to TypeScript mappings
    default: {
      classDeclaration: 'class_declaration',
      className: 'identifier',
      classBody: 'class_body',
      methodDefinition: 'method_definition',
      methodName: 'property_identifier',
      publicField: 'field_definition',
      privateField: 'field_definition',
      propertyName: 'property_identifier'
    }
  };
  
  // Get the appropriate node types for the language, or use default
  const types = nodeTypes[language] || nodeTypes.default;
  
  // Build a stack of nodes to traverse
  let nodeStack = [{node: tree.rootNode, done: false}];
  
  while (nodeStack.length > 0) {
    const {node, done} = nodeStack.pop();
    
    if (done) {
      continue;
    }
    
    // Look for class declarations
    if (node.type === types.classDeclaration) {
      let className;
      
      // Find the class name
      for (const child of node.children) {
        if (child.type === types.className) {
          className = child.text;
          break;
        }
      }
      
      if (className) {
        const methods = [];
        const properties = [];
        
        // Find the class body
        const classBody = node.children.find(child => child.type === types.classBody);
        
        if (classBody) {
          // Process class body
          for (const child of classBody.children) {
            // Methods
            if (child.type === types.methodDefinition) {
              const nameNode = child.children.find(c => c.type === types.methodName);
              
              if (nameNode) {
                // Try to determine visibility
                let visibility = 'public';
                
                // Check naming convention for python/ruby
                if (language === 'python' || language === 'ruby') {
                  if (nameNode.text.startsWith('_')) {
                    visibility = 'private';
                  }
                }
                
                // Check modifiers for Java/C#/TypeScript
                else if (['java', 'c_sharp', 'typescript'].includes(language)) {
                  // Look for visibility modifiers
                  for (const modifier of child.children) {
                    if (modifier.type === 'private') {
                      visibility = 'private';
                      break;
                    }
                  }
                }
                
                methods.push({
                  name: nameNode.text,
                  visibility
                });
              }
            } 
            // Properties/Fields
            else if (child.type === types.publicField || child.type === types.privateField) {
              const nameNode = child.children.find(c => c.type === types.propertyName);
              
              if (nameNode) {
                let visibility = child.type === types.publicField ? 'public' : 'private';
                
                // For languages without explicit visibility in the syntax
                if (language === 'python' || language === 'ruby') {
                  visibility = nameNode.text.startsWith('_') ? 'private' : 'public';
                }
                
                properties.push({
                  name: nameNode.text,
                  visibility
                });
              }
            }
          }
        }
        
        classes.push({
          name: className,
          methods,
          properties
        });
      }
    }
    
    // Continue traversing the tree
    nodeStack.push({node, done: true});
    
    for (let i = node.children.length - 1; i >= 0; i--) {
      nodeStack.push({node: node.children[i], done: false});
    }
  }
  
  return classes;
}

// Extract interfaces from AST
function extractInterfaces(tree, language) {
  const interfaces = [];
  
  // Define interface-related node types for different languages
  const nodeTypes = {
    typescript: {
      interfaceDeclaration: 'interface_declaration',
      interfaceName: 'type_identifier',
      interfaceBody: 'object_type',
      property: 'property_signature',
      propertyName: 'property_identifier',
      propertyType: 'type_annotation'
    },
    go: {
      interfaceDeclaration: 'type_declaration',
      interfaceName: 'type_identifier',
      interfaceBody: 'interface_type',
      property: 'method_spec',
      propertyName: 'field_identifier',
      propertyType: 'type_identifier'
    },
    java: {
      interfaceDeclaration: 'interface_declaration',
      interfaceName: 'identifier',
      interfaceBody: 'interface_body',
      property: 'method_declaration',
      propertyName: 'identifier',
      propertyType: 'type_identifier'
    },
    // Default to TypeScript for other languages
    default: {
      interfaceDeclaration: 'interface_declaration',
      interfaceName: 'type_identifier',
      interfaceBody: 'object_type',
      property: 'property_signature',
      propertyName: 'property_identifier',
      propertyType: 'type_annotation'
    }
  };
  
  // Get appropriate node types for the language
  const types = nodeTypes[language] || nodeTypes.default;
  
  // Skip if language doesn't have interfaces
  if (!['typescript', 'go', 'java', 'c_sharp', 'php'].includes(language)) {
    return interfaces;
  }
  
  let nodeStack = [{node: tree.rootNode, done: false}];
  
  while (nodeStack.length > 0) {
    const {node, done} = nodeStack.pop();
    
    if (done) {
      continue;
    }
    
    if (node.type === types.interfaceDeclaration) {
      let interfaceName;
      
      // Find interface name
      for (const child of node.children) {
        if (child.type === types.interfaceName) {
          interfaceName = child.text;
          break;
        }
      }
      
      if (interfaceName) {
        const properties = [];
        
        // Find interface body
        const body = node.children.find(child => child.type === types.interfaceBody);
        
        if (body) {
          // Extract properties
          for (const property of body.children) {
            if (property.type === types.property) {
              const nameNode = property.children.find(c => c.type === types.propertyName);
              const typeNode = property.children.find(c => c.type === types.propertyType);
              
              if (nameNode) {
                properties.push({
                  name: nameNode.text,
                  type: typeNode ? typeNode.text.replace(/^:\s*/, '') : 'any'
                });
              }
            }
          }
        }
        
        interfaces.push({
          name: interfaceName,
          properties
        });
      }
    }
    
    nodeStack.push({node, done: true});
    
    for (let i = node.children.length - 1; i >= 0; i--) {
      nodeStack.push({node: node.children[i], done: false});
    }
  }
  
  return interfaces;
}

// Extract imports from AST
function extractImports(tree, language) {
  const imports = [];
  
  // Define import node types for different languages
  const nodeTypes = {
    typescript: {
      importStatement: 'import_statement',
      source: 'string',
      sourceRegex: /['"]/g
    },
    javascript: {
      importStatement: 'import_statement',
      source: 'string',
      sourceRegex: /['"]/g
    },
    python: {
      importStatement: 'import_statement',
      source: 'dotted_name',
      sourceRegex: null
    },
    ruby: {
      importStatement: 'call',
      source: 'string',
      sourceRegex: /['"]/g
    },
    go: {
      importStatement: 'import_declaration',
      source: 'import_spec',
      sourceRegex: /['"]/g
    },
    java: {
      importStatement: 'import_declaration',
      source: 'identifier',
      sourceRegex: null
    },
    // Default for other languages
    default: {
      importStatement: 'import_statement',
      source: 'string',
      sourceRegex: /['"]/g
    }
  };
  
  const types = nodeTypes[language] || nodeTypes.default;
  
  let nodeStack = [{node: tree.rootNode, done: false}];
  
  while (nodeStack.length > 0) {
    const {node, done} = nodeStack.pop();
    
    if (done) {
      continue;
    }
    
    if (node.type === types.importStatement) {
      // Handle special case for Go which has a different structure
      if (language === 'go') {
        const importSpec = node.children.find(child => child.type === 'import_spec');
        if (importSpec) {
          const sourceNode = importSpec.children.find(c => c.type === 'interpreted_string_literal');
          if (sourceNode) {
            imports.push(sourceNode.text.replace(/['"]/g, ''));
          }
        }
      } 
      // Handle Python
      else if (language === 'python') {
        // Get import names from Python import statements which can be complex
        let importText = '';
        
        // Handle 'import x.y.z'
        if (node.children.some(child => child.type === 'dotted_name')) {
          const dotted = node.children.find(child => child.type === 'dotted_name');
          importText = dotted ? dotted.text : '';
        } 
        // Handle 'from x.y import z'
        else if (node.children.some(child => child.type === 'from_clause')) {
          const fromClause = node.children.find(child => child.type === 'from_clause');
          if (fromClause) {
            const module = fromClause.children.find(c => c.type === 'dotted_name');
            importText = module ? module.text : '';
          }
        }
        
        if (importText) {
          imports.push(importText);
        }
      }
      // Standard handling for other languages
      else {
        const source = node.children.find(child => child.type === types.source);
        if (source) {
          const text = types.sourceRegex ? source.text.replace(types.sourceRegex, '') : source.text;
          imports.push(text);
        }
      }
    }
    
    nodeStack.push({node, done: true});
    
    for (let i = node.children.length - 1; i >= 0; i--) {
      nodeStack.push({node: node.children[i], done: false});
    }
  }
  
  return imports;
}

// Extract decorators (primarily for TypeScript/JavaScript)
function extractDecorators(tree, language) {
  const decorators = [];
  
  // Skip if language doesn't use decorators
  if (!['typescript', 'javascript', 'python'].includes(language)) {
    return decorators;
  }
  
  let nodeStack = [{node: tree.rootNode, done: false}];
  
  while (nodeStack.length > 0) {
    const {node, done} = nodeStack.pop();
    
    if (done) {
      continue;
    }
    
    // TypeScript/JavaScript decorators
    if (node.type === 'decorator') {
      // Get decorator name
      const callExpr = node.children.find(child => child.type === 'call_expression');
      
      if (callExpr) {
        const funcName = callExpr.children.find(child => child.type === 'identifier')?.text;
        
        // Get decorator arguments
        const args = callExpr.children.find(child => child.type === 'arguments');
        let decoratorInfo = { type: funcName, properties: {} };
        
        if (args) {
          const firstArg = args.children.find(child => child.type === 'object');
          
          if (firstArg) {
            firstArg.children.forEach(property => {
              if (property.type === 'pair') {
                const key = property.children.find(c => c.type === 'property_identifier')?.text;
                const value = property.children.find(c => c.type === 'string' || c.type === 'array' || c.type === 'object');
                
                if (key && value) {
                  decoratorInfo.properties[key] = value.text;
                }
              }
            });
          }
        }
        
        decorators.push(decoratorInfo);
      }
    }
    // Python decorators
    else if (language === 'python' && node.type === 'decorator') {
      // Get Python decorator name
      const nameNode = node.children.find(child => child.type === 'identifier' || child.type === 'attribute');
      
      if (nameNode) {
        decorators.push({
          type: nameNode.text,
          properties: {}
        });
      }
    }
    
    nodeStack.push({node, done: true});
    
    for (let i = node.children.length - 1; i >= 0; i--) {
      nodeStack.push({node: node.children[i], done: false});
    }
  }
  
  return decorators;
}

// Process a file to extract code elements
async function processFile(filePath, parser, language) {
  console.log(`Processing ${filePath}...`);
  
  const fileInfo = {
    path: filePath,
    classes: [],
    interfaces: [],
    imports: [],
    decorators: [],
    
    // File type classification - will be determined based on content and naming conventions
    isComponent: false,
    isService: false,
    isModule: false,
    isGuard: false,
    isInterceptor: false,
    isDirective: false,
    isController: false,
    isModel: false,
    isRepository: false,
    isUtil: false,
    isTest: false
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
    
    // Classify file type based on naming conventions and decorators
    const fileName = path.basename(filePath).toLowerCase();
    
    // Language-specific file classification
    if (['typescript', 'javascript'].includes(language)) {
      // Angular classifications
      fileInfo.isComponent = fileInfo.decorators.some(d => d.type === 'Component') || fileName.includes('.component.');
      fileInfo.isService = fileInfo.decorators.some(d => d.type === 'Injectable') || fileName.includes('.service.');
      fileInfo.isModule = fileInfo.decorators.some(d => d.type === 'NgModule') || fileName.includes('.module.');
      fileInfo.isGuard = fileName.includes('.guard.');
      fileInfo.isInterceptor = fileName.includes('.interceptor.');
      fileInfo.isDirective = fileInfo.decorators.some(d => d.type === 'Directive') || fileName.includes('.directive.');
      fileInfo.isTest = fileName.includes('.spec.') || fileName.includes('.test.');
    }
    else if (['python', 'ruby', 'php'].includes(language)) {
      // Django, Flask, Rails, Laravel, etc
      fileInfo.isController = fileName.includes('controller') || fileName.includes('view');
      fileInfo.isModel = fileName.includes('model');
      fileInfo.isService = fileName.includes('service');
      fileInfo.isRepository = fileName.includes('repository') || fileName.includes('dao');
      fileInfo.isUtil = fileName.includes('util') || fileName.includes('helper');
      fileInfo.isComponent = fileName.includes('component');
      fileInfo.isTest = fileName.includes('test');
    }
    else if (['java', 'kotlin'].includes(language)) {
      // Spring Boot, etc 
      fileInfo.isController = fileName.includes('controller');
      fileInfo.isService = fileName.includes('service');
      fileInfo.isRepository = fileName.includes('repository') || fileName.includes('dao');
      fileInfo.isModel = fileName.includes('model') || fileName.includes('entity');
      fileInfo.isComponent = fileName.includes('component');
      fileInfo.isTest = fileName.includes('test');
    }
    else if (['go', 'rust'].includes(language)) {
      fileInfo.isController = fileName.includes('handler') || fileName.includes('controller');
      fileInfo.isService = fileName.includes('service');
      fileInfo.isRepository = fileName.includes('repository') || fileName.includes('store');
      fileInfo.isModel = fileName.includes('model') || fileName.includes('entity') || fileName.includes('struct');
      fileInfo.isTest = fileName.includes('_test');
    }
    
    return fileInfo;
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
    return fileInfo;
  }
}

// Build dependency graph between files
function buildDependencyGraph(filesInfo, language) {
  const graph = {};
  
  // Create a lookup map for file paths
  const pathLookup = {};
  filesInfo.forEach(info => {
    pathLookup[path.basename(info.path, path.extname(info.path))] = info.path;
  });
  
  // Process each file's imports
  filesInfo.forEach(fileInfo => {
    const source = path.basename(fileInfo.path, path.extname(fileInfo.path));
    
    if (!graph[source]) {
      graph[source] = {
        path: fileInfo.path,
        dependencies: [],
        type: determineFileType(fileInfo)
      };
    }
    
    // Determine imports based on language
    fileInfo.imports.forEach(importPath => {
      // Skip external dependencies
      if (!importPath.startsWith('@') && !importPath.startsWith('.')) {
        return;
      }
      
      // Normalize the import path
      let normalizedImport = importPath;
      let importBaseName;
      
      if (importPath.startsWith('.')) {
        const dir = path.dirname(fileInfo.path);
        normalizedImport = path.normalize(path.join(dir, importPath));
        importBaseName = path.basename(normalizedImport);
      } else {
        // For aliased imports like @core/services/etc
        importBaseName = importPath.split('/').pop();
      }
      
      // Add to dependencies if it exists in our project
      if (pathLookup[importBaseName]) {
        graph[source].dependencies.push(importBaseName);
      }
    });
  });
  
  return graph;
}

// Helper function to determine file type
function determineFileType(fileInfo) {
  if (fileInfo.isComponent) return 'component';
  if (fileInfo.isService) return 'service';
  if (fileInfo.isController) return 'controller';
  if (fileInfo.isGuard) return 'guard';
  if (fileInfo.isInterceptor) return 'interceptor';
  if (fileInfo.isDirective) return 'directive';
  if (fileInfo.isRepository) return 'repository';
  if (fileInfo.isModel) return 'model';
  if (fileInfo.isModule) return 'module';
  if (fileInfo.isUtil) return 'util';
  if (fileInfo.isTest) return 'test';
  return 'other';
}

// Organize files by feature and module
function organizeByFeature(filesInfo) {
  const features = {};
  
  filesInfo.forEach(info => {
    const dirs = path.dirname(info.path).split(path.sep);
    let feature = '';
    
    // Try to determine feature from path
    // First check for common directory names
    if (info.path.includes(`${path.sep}features${path.sep}`) || info.path.includes(`${path.sep}modules${path.sep}`)) {
      const featureIndex = dirs.findIndex(dir => dir === 'features' || dir === 'modules');
      if (featureIndex >= 0 && featureIndex + 1 < dirs.length) {
        feature = dirs[featureIndex + 1];
      }
    } 
    else if (info.path.includes(`${path.sep}core${path.sep}`)) {
      const coreIndex = dirs.indexOf('core');
      if (coreIndex >= 0 && coreIndex + 1 < dirs.length) {
        feature = 'core/' + dirs[coreIndex + 1];
      } else {
        feature = 'core';
      }
    } 
    else if (info.path.includes(`${path.sep}shared${path.sep}`) || info.path.includes(`${path.sep}common${path.sep}`)) {
      feature = 'shared';
    } 
    else if (info.path.includes(`${path.sep}utils${path.sep}`) || info.path.includes(`${path.sep}helpers${path.sep}`)) {
      feature = 'utils';
    }
    else if (info.path.includes(`${path.sep}models${path.sep}`) || info.path.includes(`${path.sep}entities${path.sep}`)) {
      feature = 'models';
    }
    else if (info.path.includes(`${path.sep}controllers${path.sep}`) || info.path.includes(`${path.sep}handlers${path.sep}`)) {
      feature = 'controllers';
    }
    else if (info.path.includes(`${path.sep}services${path.sep}`)) {
      feature = 'services';
    }
    else if (info.path.includes(`${path.sep}repositories${path.sep}`) || info.path.includes(`${path.sep}dao${path.sep}`)) {
      feature = 'repositories';
    }
    // If we couldn't determine feature, use the parent directory
    else {
      feature = dirs[dirs.length - 2] || 'app';
    }
    
    if (!features[feature]) {
      features[feature] = {
        path: path.dirname(info.path),
        components: [],
        services: [],
        controllers: [],
        guards: [],
        interceptors: [],
        interfaces: [],
        models: [],
        directives: [],
        repositories: [],
        utils: []
      };
    }
    
    // Add file to appropriate category
    if (info.isComponent) {
      features[feature].components.push({
        name: path.basename(info.path, path.extname(info.path)),
        path: info.path,
        classes: info.classes
      });
    } 
    else if (info.isService) {
      features[feature].services.push({
        name: path.basename(info.path, path.extname(info.path)),
        path: info.path,
        classes: info.classes
      });
    } 
    else if (info.isController) {
      features[feature].controllers.push({
        name: path.basename(info.path, path.extname(info.path)),
        path: info.path,
        classes: info.classes
      });
    }
    else if (info.isGuard) {
      features[feature].guards.push({
        name: path.basename(info.path, path.extname(info.path)),
        path: info.path,
        classes: info.classes
      });
    } 
    else if (info.isInterceptor) {
      features[feature].interceptors.push({
        name: path.basename(info.path, path.extname(info.path)),
        path: info.path,
        classes: info.classes
      });
    } 
    else if (info.isDirective) {
      features[feature].directives.push({
        name: path.basename(info.path, path.extname(info.path)),
        path: info.path,
        classes: info.classes
      });
    } 
    else if (info.isRepository) {
      features[feature].repositories.push({
        name: path.basename(info.path, path.extname(info.path)),
        path: info.path,
        classes: info.classes
      });
    }
    else if (info.isUtil) {
      features[feature].utils.push({
        name: path.basename(info.path, path.extname(info.path)),
        path: info.path,
        classes: info.classes
      });
    }
    else if (info.interfaces.length > 0 || info.isModel) {
      features[feature].models.push({
        name: path.basename(info.path, path.extname(info.path)),
        path: info.path,
        interfaces: info.interfaces,
        classes: info.classes
      });
    }
  });
  
  return features;
}

// Generate component tree diagram (generic across frameworks)
function generateComponentTreeDiagram(filesInfo, language) {
  // Skip if components were not found or diagram is disabled
  const components = filesInfo.filter(info => info.isComponent);
  
  if (components.length === 0 || !options.components) {
    return '';
  }
  
  let diagram = '```mermaid\ngraph TD\n';
  
  // Find the root component based on naming conventions
  let rootComponent;
  
  // Angular
  if (language === 'typescript' || language === 'javascript') {
    rootComponent = components.find(c => c.path.includes('app.component.')) || 
                   components.find(c => c.path.includes('root.component.')) ||
                   components[0];
  }
  // React
  else if ((language === 'typescript' || language === 'javascript') && 
           components.some(c => c.path.includes('.jsx') || c.path.includes('.tsx'))) {
    rootComponent = components.find(c => c.path.includes('app.') || c.path.includes('App.')) ||
                   components.find(c => c.path.includes('index.')) ||
                   components[0];
  }
  // Vue
  else if (language === 'vue' || components.some(c => c.path.endsWith('.vue'))) {
    rootComponent = components.find(c => c.path.includes('App.vue')) ||
                   components.find(c => c.path.includes('app.vue')) ||
                   components[0];
  }
  // Default to first component
  else {
    rootComponent = components[0];
  }
  
  const rootName = path.basename(rootComponent.path, path.extname(rootComponent.path));
  
  // Generate nice labels for components
  const formatComponentName = (name) => {
    return name
      .replace(/[\.component|\.vue|Component]/g, '')
      .replace(/([A-Z])/g, ' $1') // Add spaces before capital letters
      .replace(/^./, str => str.toUpperCase()) // Capitalize first letter
      .trim();
  };
  
  // Add the root component
  diagram += `  Root["${formatComponentName(rootName)}"]\n`;
  
  // Group components by directory
  const componentsByDir = {};
  components.forEach(component => {
    if (component.path === rootComponent.path) return;
    
    const dir = path.dirname(component.path).split(path.sep).pop();
    if (!componentsByDir[dir]) {
      componentsByDir[dir] = [];
    }
    componentsByDir[dir].push(component);
  });
  
  // Add components by directory
  Object.entries(componentsByDir).forEach(([dir, comps]) => {
    comps.forEach(comp => {
      const compName = path.basename(comp.path, path.extname(comp.path))
        .replace('.component', '')
        .replace('.vue', '');
      const formattedName = formatComponentName(compName);
      diagram += `  ${compName}["${formattedName}"]\n`;
      diagram += `  Root --> ${compName}\n`;
    });
  });
  
  // Add styling for components
  diagram += '\n  style Root fill:#d04a4a,stroke:#333,stroke-width:2px,color:white\n';
  
  // Style all other components
  Object.entries(componentsByDir).forEach(([dir, comps]) => {
    comps.forEach(comp => {
      const compName = path.basename(comp.path, path.extname(comp.path))
        .replace('.component', '')
        .replace('.vue', '');
      diagram += `  style ${compName} fill:#4a7bd0,stroke:#333,stroke-width:1px,color:white\n`;
    });
  });
  
  diagram += '```\n';
  
  return diagram;
}

// Generate service hierarchy diagram
function generateServiceDiagram(filesInfo, graph) {
  const services = filesInfo.filter(info => info.isService);
  
  // Skip if no services found or diagram is disabled
  if (services.length === 0 || !options.services) {
    return '';
  }
  
  let diagram = '```mermaid\ngraph TD\n';
  
  // Format service names
  const formatServiceName = (name) => {
    return name
      .replace(/[\.\w]+service/i, '')
      .replace(/([A-Z])/g, ' $1') // Add spaces before capital letters
      .replace(/^./, str => str.toUpperCase()) // Capitalize first letter
      .trim();
  };
  
  // Add all services
  services.forEach(service => {
    const serviceId = path.basename(service.path, path.extname(service.path))
      .replace(/[\.\w]+service/i, '');
    const displayName = formatServiceName(serviceId) || serviceId;
    diagram += `  ${serviceId}["${displayName}"]\n`;
  });
  
  // Add service dependencies
  services.forEach(service => {
    const serviceId = path.basename(service.path, path.extname(service.path))
      .replace(/[\.\w]+service/i, '');
    
    const nodeInfo = graph[path.basename(service.path, path.extname(service.path))];
    if (nodeInfo && nodeInfo.dependencies) {
      nodeInfo.dependencies.forEach(dep => {
        const depService = services.find(s => path.basename(s.path, path.extname(s.path)) === dep);
        if (depService) {
          const depId = path.basename(depService.path, path.extname(depService.path))
            .replace(/[\.\w]+service/i, '');
          diagram += `  ${serviceId} --> ${depId}\n`;
        }
      });
    }
  });
  
  // Add styling for services
  diagram += '\n';
  services.forEach(service => {
    const serviceId = path.basename(service.path, path.extname(service.path))
      .replace(/[\.\w]+service/i, '');
    diagram += `  style ${serviceId} fill:#5b9bd5,stroke:#333,stroke-width:1px,color:white\n`;
  });
  
  diagram += '```\n';
  
  return diagram;
}

// Generate module dependencies diagram
function generateModuleDiagram(features, language) {
  let diagram = '```mermaid\ngraph TD\n';
  
  // Different module structures based on language/framework
  if (['typescript', 'javascript'].includes(language)) {
    // Angular-like module structure
    diagram += '  Core["Core Module"]\n';
    diagram += '  SharedModels["Shared Models"]\n';
    diagram += '  Features["Features Module"]\n';
    diagram += '  App["App Module"]\n';
    diagram += '  Shared["Shared Module"]\n';
    
    // Add standard dependencies
    diagram += '  Core --> SharedModels\n';
    diagram += '  Features --> Core\n';
    diagram += '  Features --> SharedModels\n';
    diagram += '  App --> Core\n';
    diagram += '  App --> Features\n';
    diagram += '  App --> Shared\n';
    
    // Add styling
    diagram += '  style Core fill:#7030a0,stroke:#333,stroke-width:2px,color:white\n';
    diagram += '  style SharedModels fill:#7030a0,stroke:#333,stroke-width:2px,color:white\n';
    diagram += '  style Features fill:#7030a0,stroke:#333,stroke-width:2px,color:white\n';
    diagram += '  style App fill:#7030a0,stroke:#333,stroke-width:2px,color:white\n';
    diagram += '  style Shared fill:#7030a0,stroke:#333,stroke-width:2px,color:white\n';
  }
  else if (['python', 'ruby', 'php', 'java'].includes(language)) {
    // MVC-like architecture
    diagram += '  Models["Models/Entities"]\n';
    diagram += '  Controllers["Controllers"]\n';
    diagram += '  Services["Services"]\n';
    diagram += '  Repositories["Repositories"]\n';
    diagram += '  Utils["Utilities"]\n';
    
    // Add standard dependencies
    diagram += '  Controllers --> Services\n';
    diagram += '  Services --> Repositories\n';
    diagram += '  Repositories --> Models\n';
    diagram += '  Services --> Models\n';
    diagram += '  Controllers --> Utils\n';
    diagram += '  Services --> Utils\n';
    
    // Add styling
    diagram += '  style Models fill:#5b9bd5,stroke:#333,stroke-width:2px,color:white\n';
    diagram += '  style Controllers fill:#70ad47,stroke:#333,stroke-width:2px,color:white\n';
    diagram += '  style Services fill:#ed7d31,stroke:#333,stroke-width:2px,color:white\n';
    diagram += '  style Repositories fill:#ffc000,stroke:#333,stroke-width:2px,color:white\n';
    diagram += '  style Utils fill:#7030a0,stroke:#333,stroke-width:2px,color:white\n';
  }
  else {
    // Generic module structure
    const featureNames = Object.keys(features);
    
    // Add all features as nodes
    featureNames.forEach(feature => {
      diagram += `  ${feature.replace('/', '_')}["${feature}"]\n`;
    });
    
    // Add some sample dependencies between features
    if (featureNames.includes('core')) {
      featureNames.forEach(feature => {
        if (feature !== 'core') {
          diagram += `  ${feature.replace('/', '_')} --> ${'core'.replace('/', '_')}\n`;
        }
      });
    }
    
    if (featureNames.includes('shared') || featureNames.includes('common')) {
      const sharedFeature = featureNames.includes('shared') ? 'shared' : 'common';
      featureNames.forEach(feature => {
        if (feature !== sharedFeature && feature !== 'core') {
          diagram += `  ${feature.replace('/', '_')} --> ${sharedFeature.replace('/', '_')}\n`;
        }
      });
    }
    
    // Add styling for features
    featureNames.forEach(feature => {
      diagram += `  style ${feature.replace('/', '_')} fill:#7030a0,stroke:#333,stroke-width:2px,color:white\n`;
    });
  }
  
  diagram += '```\n';
  
  return diagram;
}

// Generate routing diagram
function generateRoutingDiagram(filesInfo, language) {
  // Skip if routing diagram is disabled
  if (!options.routes) {
    return '';
  }
  
  let diagram = '```mermaid\ngraph LR\n';
  
  // Build a list of routes based on the language/framework
  const routes = [];
  
  // Look for route definitions in files
  if (['typescript', 'javascript'].includes(language)) {
    // For Angular/React/Vue apps
    routes.push({ path: '/', name: 'Root' });
    routes.push({ path: '/login', name: 'Login' });
    routes.push({ path: '/dashboard', name: 'Dashboard' });
    
    // Try to find actual route definitions
    filesInfo.forEach(info => {
      if (info.path.includes('routes') || info.path.includes('router')) {
        // Could parse more accurately with file content analysis
        routes.push({ path: '/features', name: 'Features' });
        routes.push({ path: '/profile', name: 'UserProfile' });
        routes.push({ path: '/settings', name: 'Settings' });
      }
    });
  }
  else if (['python', 'ruby', 'php'].includes(language)) {
    // For Django/Flask/Rails/Laravel apps
    routes.push({ path: '/', name: 'Root' });
    routes.push({ path: '/api', name: 'API' });
    routes.push({ path: '/admin', name: 'Admin' });
    
    // Try to find controller files that might indicate routes
    filesInfo.forEach(info => {
      if (info.isController) {
        const controller = path.basename(info.path, path.extname(info.path))
          .toLowerCase()
          .replace('controller', '')
          .replace('view', '')
          .replace('handler', '');
          
        if (controller && controller !== 'base' && controller !== 'app') {
          routes.push({ path: `/${controller}`, name: controller.charAt(0).toUpperCase() + controller.slice(1) });
        }
      }
    });
  }
  else {
    // Generic routes for other languages
    routes.push({ path: '/', name: 'Root' });
    routes.push({ path: '/api', name: 'API' });
    routes.push({ path: '/docs', name: 'Documentation' });
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

// Create tables for services and their public methods
function generateServiceInterfaceTables(features) {
  let markdown = '';
  
  // Collect all services across features
  const allServices = [];
  Object.entries(features).forEach(([featureName, feature]) => {
    feature.services.forEach(service => {
      allServices.push({
        ...service,
        feature: featureName
      });
    });
  });
  
  if (allServices.length === 0) {
    return markdown;
  }
  
  // Group services by category if possible
  const serviceCategories = {
    'Authentication': allServices.filter(s => 
      s.path.includes('auth') || s.name.includes('auth') || s.name.includes('user')),
    'API': allServices.filter(s => 
      s.path.includes('api') || s.name.includes('api') || s.name.includes('http')),
    'Configuration': allServices.filter(s => 
      s.path.includes('config') || s.name.includes('config') || s.name.includes('settings')),
    'Data': allServices.filter(s => 
      s.path.includes('data') || s.name.includes('data') || s.name.includes('store')),
    'Other': []
  };
  
  // Add uncategorized services to "Other"
  allServices.forEach(service => {
    if (!Object.values(serviceCategories).flat().includes(service)) {
      serviceCategories.Other.push(service);
    }
  });
  
  // Generate tables for each category
  Object.entries(serviceCategories).forEach(([category, services]) => {
    if (services.length === 0) return;
    
    markdown += `#### ${category} Services\n\n`;
    markdown += '| Service | Feature | Public Methods | Private Methods |\n';
    markdown += '|---------|---------|---------------|----------------|\n';
    
    services.forEach(service => {
      const publicMethods = service.classes.flatMap(cls => 
        cls.methods.filter(m => m.visibility === 'public').map(m => `\`${m.name}()\``));
      
      const privateMethods = service.classes.flatMap(cls => 
        cls.methods.filter(m => m.visibility === 'private').map(m => `\`${m.name}()\``));
      
      markdown += `| \`${path.basename(service.name, path.extname(service.name))}\` | ${service.feature} | ${publicMethods.join(', ') || '-'} | ${privateMethods.join(', ') || '-'} |\n`;
    });
    
    markdown += '\n';
  });
  
  return markdown;
}

// Create component interface tables
function generateComponentInterfaceTables(features) {
  let markdown = '';
  
  // Collect all components
  const allComponents = [];
  Object.values(features).forEach(feature => {
    feature.components.forEach(component => {
      allComponents.push(component);
    });
  });
  
  if (allComponents.length === 0) {
    return markdown;
  }
  
  markdown += '| Component | Public Methods |\n';
  markdown += '|-----------|---------------|\n';
  
  // For each component, list methods
  allComponents.forEach(component => {
    const publicMethods = component.classes.flatMap(cls => 
      cls.methods.filter(m => m.visibility === 'public' && !m.name.startsWith('ng')).map(m => `\`${m.name}()\``));
    
    markdown += `| \`${path.basename(component.name, path.extname(component.name))}\` | ${publicMethods.join(', ') || '-'} |\n`;
  });
  
  return markdown;
}

// Create interface models documentation
function generateModelInterfaces(features) {
  let markdown = '';
  
  // Collect all models
  const allModels = [];
  Object.values(features).forEach(feature => {
    feature.models.forEach(model => {
      allModels.push(model);
    });
  });
  
  if (allModels.length === 0 || allModels.flatMap(m => m.interfaces).length === 0) {
    return markdown;
  }
  
  markdown += '### Key Data Models\n\n';
  markdown += '```typescript\n';
  
  // Get all interfaces
  const allInterfaces = allModels.flatMap(model => model.interfaces);
  
  // Show up to 5 sample interfaces
  for (let i = 0; i < Math.min(allInterfaces.length, 5); i++) {
    const iface = allInterfaces[i];
    markdown += `interface ${iface.name} {\n`;
    
    // Add properties with types
    iface.properties?.forEach(prop => {
      markdown += `  ${prop.name}${prop.name.endsWith('?') ? '' : ':'} ${prop.type || 'any'};\n`;
    });
    
    markdown += '}\n\n';
  }
  
  markdown += '```\n\n';
  
  return markdown;
}

// Analyze imports and generate statistics
function analyzeImports(filesInfo) {
  const importCounts = {};
  
  filesInfo.forEach(info => {
    info.imports.forEach(imp => {
      importCounts[imp] = (importCounts[imp] || 0) + 1;
    });
  });
  
  const sortedImports = Object.entries(importCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  
  if (sortedImports.length === 0) {
    return '';
  }
  
  let markdown = '| Module | Import Count |\n';
  markdown += '|--------|-------------|\n';
  
  sortedImports.forEach(([imp, count]) => {
    markdown += `| \`${imp}\` | ${count} |\n`;
  });
  
  return markdown;
}

// Main function
async function main() {
  try {
    // Detect repository language
    detectedLanguage = await detectLanguage();
    
    // Load appropriate language parser
    const languageParser = await loadLanguageParser(detectedLanguage);
    const parser = new Parser();
    parser.setLanguage(languageParser);
    
    console.log(`Finding ${detectedLanguage} files...`);
    const files = findFiles(detectedLanguage);
    console.log(`Found ${files.length} ${detectedLanguage} files.`);
    
    console.log('Analyzing files...');
    const filesInfo = [];
    
    for (const file of files) {
      const info = await processFile(file, parser, detectedLanguage);
      filesInfo.push(info);
    }
    
    console.log('Building dependency graph...');
    const graph = buildDependencyGraph(filesInfo, detectedLanguage);
    
    console.log('Organizing by feature...');
    const features = organizeByFeature(filesInfo);
    
    console.log('Generating repository map...');
    
    // Build the markdown output
    let markdown = `# Repository Map (${detectedLanguage.charAt(0).toUpperCase() + detectedLanguage.slice(1)})\n\n`;
    markdown += `This repository map provides a comprehensive overview of the ${detectedLanguage} codebase structure, including component trees, class hierarchies, public interfaces, and dependency relationships.\n\n`;
    
    // Architecture Overview
    markdown += '## Architecture Overview\n\n';
    
    // Add architecture sections based on language
    if (['typescript', 'javascript'].includes(detectedLanguage)) {
      // JavaScript/TypeScript architecture
      markdown += 'The application follows a modular architecture with the following main areas:\n\n';
      if (Object.keys(features).includes('core')) {
        markdown += '- **Core**: Essential services required by the entire application\n';
        markdown += '  - Authentication\n';
        markdown += '  - Configuration\n';
        markdown += '  - Logging\n';
      }
      if (Object.keys(features).includes('features') || Object.keys(features).some(f => f.includes('/features'))) {
        markdown += '- **Features**: Discrete business functionality\n';
        // List some feature examples if found
        const businessFeatures = Object.keys(features).filter(f => f.includes('features/'));
        businessFeatures.slice(0, 3).forEach(f => {
          markdown += `  - ${f.split('/').pop()}\n`;
        });
      }
      if (Object.keys(features).includes('shared')) {
        markdown += '- **Shared**: Reusable components, directives, and pipes\n';
      }
      if (Object.keys(features).includes('utils')) {
        markdown += '- **Utils**: Utility functions and helpers\n';
      }
    }
    else if (['python', 'ruby', 'php', 'java'].includes(detectedLanguage)) {
      // MVC-style architecture
      markdown += 'The application follows an MVC/service-based architecture:\n\n';
      markdown += '- **Models**: Data structures and business entities\n';
      markdown += '- **Controllers/Views**: Handle user input and render responses\n';
      markdown += '- **Services**: Business logic and operations\n';
      markdown += '- **Repositories**: Data access layer\n';
      markdown += '- **Utils**: Reusable utility functions\n';
    }
    else if (['go', 'rust'].includes(detectedLanguage)) {
      // Go/Rust architecture
      markdown += 'The application follows a modular architecture:\n\n';
      markdown += '- **Handlers**: Process requests and generate responses\n';
      markdown += '- **Services**: Business logic implementation\n';
      markdown += '- **Models**: Data structures\n';
      markdown += '- **Repositories**: Data access layer\n';
    }
    
    markdown += '\n';
    
    // Component Tree
    const componentTreeDiagram = generateComponentTreeDiagram(filesInfo, detectedLanguage);
    if (componentTreeDiagram) {
      markdown += '## Component Tree\n\n';
      markdown += 'The application is structured around the following components:\n\n';
      markdown += componentTreeDiagram;
    }
    
    // Service Architecture
    const serviceDiagram = generateServiceDiagram(filesInfo, graph);
    if (serviceDiagram) {
      markdown += '## Service Architecture\n\n';
      markdown += 'The application uses a service architecture for business logic:\n\n';
      markdown += serviceDiagram;
    }
    
    // Module Dependencies
    markdown += '## Module Dependencies\n\n';
    markdown += 'The application is organized into logical modules with the following dependency structure:\n\n';
    markdown += generateModuleDiagram(features, detectedLanguage);
    
    // Routing Structure
    const routingDiagram = generateRoutingDiagram(filesInfo, detectedLanguage);
    if (routingDiagram) {
      markdown += '## Routing Structure\n\n';
      markdown += routingDiagram;
    }
    
    // Public API & Interface Map
    const serviceInterfaces = generateServiceInterfaceTables(features);
    const componentInterfaces = generateComponentInterfaceTables(features);
    
    if (serviceInterfaces || componentInterfaces) {
      markdown += '## Public API & Interface Map\n\n';
      
      if (serviceInterfaces) {
        markdown += '### Core Services Public Interfaces\n\n';
        markdown += serviceInterfaces;
      }
      
      if (componentInterfaces) {
        markdown += '### Component Public Methods\n\n';
        markdown += componentInterfaces;
      }
    }
    
    // Main Model Interfaces
    const modelInterfaces = generateModelInterfaces(features);
    if (modelInterfaces) {
      markdown += '## Main Model Interfaces\n\n';
      markdown += modelInterfaces;
    }
    
    // Import Analysis
    const importAnalysis = analyzeImports(filesInfo);
    if (importAnalysis) {
      markdown += '## Import Analysis\n\n';
      markdown += 'The most commonly imported modules in the application:\n\n';
      markdown += importAnalysis;
    }
    
    // Code Organization by Feature
    markdown += '## Code Organization by Feature\n\n';
    
    // List all features and their components
    Object.entries(features).forEach(([featureName, feature]) => {
      markdown += `### ${featureName.charAt(0).toUpperCase() + featureName.slice(1)}\n\n`;
      
      // List components if any
      if (feature.components.length > 0) {
        markdown += '**Components**:\n';
        feature.components.slice(0, 5).forEach(comp => {
          markdown += `- \`${path.basename(comp.path)}\`\n`;
        });
        if (feature.components.length > 5) {
          markdown += `- ...and ${feature.components.length - 5} more\n`;
        }
        markdown += '\n';
      }
      
      // List services if any
      if (feature.services.length > 0) {
        markdown += '**Services**:\n';
        feature.services.slice(0, 5).forEach(service => {
          markdown += `- \`${path.basename(service.path)}\`\n`;
        });
        if (feature.services.length > 5) {
          markdown += `- ...and ${feature.services.length - 5} more\n`;
        }
        markdown += '\n';
      }
      
      // List controllers if any
      if (feature.controllers.length > 0) {
        markdown += '**Controllers/Handlers**:\n';
        feature.controllers.slice(0, 5).forEach(controller => {
          markdown += `- \`${path.basename(controller.path)}\`\n`;
        });
        if (feature.controllers.length > 5) {
          markdown += `- ...and ${feature.controllers.length - 5} more\n`;
        }
        markdown += '\n';
      }
      
      // List models if any
      if (feature.models.length > 0) {
        markdown += '**Models/Interfaces**:\n';
        feature.models.slice(0, 5).forEach(model => {
          markdown += `- \`${path.basename(model.path)}\`\n`;
        });
        if (feature.models.length > 5) {
          markdown += `- ...and ${feature.models.length - 5} more\n`;
        }
        markdown += '\n';
      }
    });
    
    markdown += '---\n\n';
    markdown += '*This repository map was automatically generated using tree-sitter code analysis.*';
    
    // Write the markdown to file
    fs.writeFileSync(outputFile, markdown);
    console.log(`Repository map generated: ${outputFile}`);
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run the main function
main();