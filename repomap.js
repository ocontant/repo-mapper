#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const commander = require('commander');
// Import tree-sitter correctly
let Parser;
try {
  Parser = require('tree-sitter');
} catch (error) {
  console.error('Error importing tree-sitter:', error.message);
  console.error('Please install tree-sitter with npm: npm install tree-sitter');
}

// Setup commander
const program = new commander.Command();
program
  .name('repomapper')
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
  .option('--global-install', 'Install this tool globally as a CLI command', false)
  .parse(process.argv);

const options = program.opts();

// Handle global installation if requested
if (options.globalInstall) {
  console.log('Installing repomapper globally...');
  try {
    const { execSync } = require('child_process');
    execSync('npm link', { stdio: 'inherit' });
    console.log('\nSuccess! The "repomapper" command has been installed globally.');
    console.log('You can now run it from anywhere using:');
    console.log('\n  repomapper [options]\n');
    process.exit(0);
  } catch (error) {
    console.error('Failed to install globally:', error.message);
    console.error('You might need to run this command with sudo or as administrator.');
    process.exit(1);
  }
}

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
  // Convert glob-like patterns in exclude list to basic grep patterns
  const excludePattern = options.exclude
    .replace(/,/g, '\\|')
    .replace(/\*\*\//g, '')  // Remove **/ prefix
    .replace(/\/\*\*/g, '')  // Remove /** suffix
    .replace(/\*/g, '.*');   // Convert * to .* for grep

  const findCmd = process.platform === 'win32'
    ? `dir /s /b ${baseDir} | findstr /i "\\."`
    : `find ${baseDir} -type f -name "*.*" | grep -v "${excludePattern}"`;  

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
  
  // Convert glob-like patterns in exclude list to basic grep patterns
  const excludePattern = options.exclude
    .replace(/,/g, '\\|')
    .replace(/\*\*\//g, '')  // Remove **/ prefix
    .replace(/\/\*\*/g, '')  // Remove /** suffix
    .replace(/\*/g, '.*');   // Convert * to .* for grep
  
  // Create a dynamic find command based on the extensions
  let findCmd;
  if (process.platform === 'win32') {
    findCmd = `dir /s /b ${baseDir} | findstr /i "\\.${extensionPattern}$" | findstr /v "${excludePattern}"`;
  } else {
    // For Unix-like systems, use multiple -name patterns with -o (OR) operator
    const extensionPatterns = extensions.map(ext => `-name "*${ext}"`).join(' -o ');
    findCmd = `find ${baseDir} -type f \\( ${extensionPatterns} \\) | grep -v "${excludePattern}"`;
  }

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
      propertyName: 'property_identifier',
      parameter: 'formal_parameter',
      parameterName: 'identifier',
      parameterType: 'type_annotation',
      typeAnnotation: 'type_annotation',
      returnType: 'return_type',
      superClass: 'extends_clause',
      superClassName: 'identifier',
      implements: 'implements_clause',
      implementsNames: 'type_identifier',
      constructor: 'constructor_definition',
      constructorName: 'property_identifier'
    },
    javascript: {
      classDeclaration: 'class_declaration',
      className: 'identifier',
      classBody: 'class_body',
      methodDefinition: 'method_definition',
      methodName: 'property_identifier',
      publicField: 'field_definition',
      privateField: 'field_definition',
      propertyName: 'property_identifier',
      parameter: 'formal_parameter',
      parameterName: 'identifier',
      superClass: 'extends_clause',
      superClassName: 'identifier',
      constructor: 'method_definition',
      constructorName: 'property_identifier'
    },
    python: {
      classDeclaration: 'class_definition',
      className: 'identifier',
      classBody: 'block',
      methodDefinition: 'function_definition',
      methodName: 'identifier',
      publicField: 'expression_statement',
      privateField: 'expression_statement',
      propertyName: 'identifier',
      parameter: 'parameters',
      parameterName: 'identifier',
      parameterType: 'type',
      returnType: 'return_type',
      superClass: 'argument_list',
      superClassName: 'identifier',
      constructor: 'function_definition',
      constructorName: 'identifier'
    },
    ruby: {
      classDeclaration: 'class',
      className: 'constant',
      classBody: 'body_statement',
      methodDefinition: 'method',
      methodName: 'identifier',
      publicField: 'assignment',
      privateField: 'assignment',
      propertyName: 'identifier',
      parameter: 'method_parameters',
      parameterName: 'identifier',
      superClass: 'superclass',
      superClassName: 'constant',
      constructor: 'method',
      constructorName: 'identifier'
    },
    go: {
      classDeclaration: 'type_declaration',
      className: 'type_identifier',
      classBody: 'struct_type',
      methodDefinition: 'method_declaration',
      methodName: 'field_identifier',
      publicField: 'field_declaration',
      privateField: 'field_declaration',
      propertyName: 'field_identifier',
      parameter: 'parameter_declaration',
      parameterName: 'identifier',
      parameterType: 'type_identifier',
      returnType: 'return_type',
      constructor: 'function_declaration',
      constructorName: 'field_identifier'
    },
    java: {
      classDeclaration: 'class_declaration',
      className: 'identifier',
      classBody: 'class_body',
      methodDefinition: 'method_declaration',
      methodName: 'identifier',
      publicField: 'field_declaration',
      privateField: 'field_declaration',
      propertyName: 'identifier',
      parameter: 'formal_parameter',
      parameterName: 'identifier',
      parameterType: 'type_identifier',
      returnType: 'return_type',
      superClass: 'superclass',
      superClassName: 'identifier',
      implements: 'interfaces',
      implementsNames: 'identifier',
      constructor: 'constructor_declaration',
      constructorName: 'identifier'
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
      propertyName: 'property_identifier',
      parameter: 'formal_parameter',
      parameterName: 'identifier',
      parameterType: 'type_annotation',
      returnType: 'return_type',
      superClass: 'extends_clause',
      superClassName: 'identifier',
      constructor: 'method_definition',
      constructorName: 'property_identifier'
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
        let constructor = null;
        let extends_class = null;
        const implements_interfaces = [];
        
        // Check for extends (inheritance)
        const superClassNode = node.children.find(child => child.type === types.superClass);
        if (superClassNode) {
          const superClassNameNode = superClassNode.children.find(c => 
            c.type === types.superClassName || c.type === types.className);
          if (superClassNameNode) {
            extends_class = superClassNameNode.text;
          }
        }
        
        // Check for implements (interfaces)
        const implementsNode = node.children.find(child => child.type === types.implements);
        if (implementsNode) {
          implementsNode.children.forEach(child => {
            if (child.type === types.implementsNames || child.type === types.className) {
              implements_interfaces.push(child.text);
            }
          });
        }
        
        // Find the class body
        const classBody = node.children.find(child => child.type === types.classBody);
        
        if (classBody) {
          // Process class body
          for (const child of classBody.children) {
            // Check for constructor
            const isConstructor = 
              (child.type === types.constructor) || 
              (child.type === types.methodDefinition && 
               child.children.some(c => c.type === types.constructorName && 
                 (c.text === 'constructor' || c.text === 'initialize' || c.text === '__init__')));
            
            if (isConstructor) {
              const parameters = [];
              
              // Find parameters node
              const paramsNode = child.children.find(c => c.type === types.parameter || 
                                                        c.type.includes('parameter'));
              
              if (paramsNode) {
                // Extract parameters
                for (const param of paramsNode.children) {
                  if (param.type === types.parameterName || param.type === 'identifier') {
                    const paramName = param.text;
                    
                    // Try to get type if available
                    let paramType = 'any';
                    const typeNode = param.nextSibling;
                    if (typeNode && typeNode.type === types.parameterType) {
                      paramType = typeNode.text.replace(/^:\s*/, '');
                    }
                    
                    parameters.push({
                      name: paramName,
                      type: paramType
                    });
                  }
                }
              }
              
              constructor = {
                parameters
              };
            }
            // Methods
            else if (child.type === types.methodDefinition) {
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
                
                // Extract method parameters
                const parameters = [];
                
                // Find parameters node
                const paramsNode = child.children.find(c => c.type === types.parameter || 
                                                          c.type.includes('parameter'));
                
                if (paramsNode) {
                  // Extract parameters
                  for (const param of paramsNode.children) {
                    if (param.type === types.parameterName || param.type === 'identifier') {
                      const paramName = param.text;
                      
                      // Try to get type if available
                      let paramType = 'any';
                      const typeNode = param.nextSibling;
                      if (typeNode && typeNode.type === types.parameterType) {
                        paramType = typeNode.text.replace(/^:\s*/, '');
                      }
                      
                      parameters.push({
                        name: paramName,
                        type: paramType
                      });
                    }
                  }
                }
                
                // Try to get return type
                let returnType = 'void';
                const returnTypeNode = child.children.find(c => c.type === types.returnType || 
                                                           c.type === types.typeAnnotation);
                if (returnTypeNode) {
                  returnType = returnTypeNode.text.replace(/^:\s*/, '').replace(/^->\s*/, '');
                }
                
                // Build method signature
                const signature = `${nameNode.text}(${parameters.map(p => 
                  `${p.name}${p.type !== 'any' ? ': ' + p.type : ''}`).join(', ')})${
                  returnType !== 'void' ? ': ' + returnType : ''}`;
                
                methods.push({
                  name: nameNode.text,
                  visibility,
                  parameters,
                  returnType,
                  signature
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
                
                // Try to get property type
                let type = 'any';
                const typeNode = child.children.find(c => c.type === types.typeAnnotation);
                if (typeNode) {
                  type = typeNode.text.replace(/^:\s*/, '');
                }
                
                properties.push({
                  name: nameNode.text,
                  visibility,
                  type
                });
              }
            }
          }
        }
        
        classes.push({
          name: className,
          methods,
          properties,
          constructor,
          extends: extends_class,
          implements: implements_interfaces
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
      propertyType: 'type_annotation',
      method: 'method_signature',
      methodName: 'property_identifier',
      parameter: 'formal_parameter',
      parameterName: 'identifier',
      parameterType: 'type_annotation',
      returnType: 'type_annotation',
      extendsClause: 'extends_clause',
      extendedInterface: 'type_identifier',
      typeParameter: 'type_parameters',
      typeParameterName: 'type_identifier'
    },
    go: {
      interfaceDeclaration: 'type_declaration',
      interfaceName: 'type_identifier',
      interfaceBody: 'interface_type',
      property: 'method_spec',
      propertyName: 'field_identifier',
      propertyType: 'type_identifier',
      method: 'method_spec',
      methodName: 'field_identifier',
      parameter: 'parameter_list',
      parameterName: 'identifier',
      parameterType: 'type_identifier',
      returnType: 'type_identifier',
      extendsClause: 'type_identifier',
      extendedInterface: 'type_identifier'
    },
    java: {
      interfaceDeclaration: 'interface_declaration',
      interfaceName: 'identifier',
      interfaceBody: 'interface_body',
      property: 'method_declaration',
      propertyName: 'identifier',
      propertyType: 'type_identifier',
      method: 'method_declaration',
      methodName: 'identifier',
      parameter: 'formal_parameter',
      parameterName: 'identifier',
      parameterType: 'type_identifier',
      returnType: 'type_identifier',
      extendsClause: 'extends_interfaces',
      extendedInterface: 'identifier',
      typeParameter: 'type_parameters',
      typeParameterName: 'type_identifier'
    },
    // Default to TypeScript for other languages
    default: {
      interfaceDeclaration: 'interface_declaration',
      interfaceName: 'type_identifier',
      interfaceBody: 'object_type',
      property: 'property_signature',
      propertyName: 'property_identifier',
      propertyType: 'type_annotation',
      method: 'method_signature',
      methodName: 'property_identifier',
      parameter: 'formal_parameter',
      parameterName: 'identifier',
      parameterType: 'type_annotation',
      returnType: 'type_annotation',
      extendsClause: 'extends_clause',
      extendedInterface: 'type_identifier',
      typeParameter: 'type_parameters',
      typeParameterName: 'type_identifier'
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
        const methods = [];
        const extends_interfaces = [];
        const type_parameters = [];
        
        // Check for type parameters (generics)
        const typeParamNode = node.children.find(child => child.type === types.typeParameter);
        if (typeParamNode) {
          for (const param of typeParamNode.children) {
            if (param.type === types.typeParameterName) {
              type_parameters.push(param.text);
            }
          }
        }
        
        // Check for extended interfaces
        const extendsNode = node.children.find(child => child.type === types.extendsClause);
        if (extendsNode) {
          for (const ext of extendsNode.children) {
            if (ext.type === types.extendedInterface || ext.type === types.interfaceName) {
              extends_interfaces.push(ext.text);
            }
          }
        }
        
        // Find interface body
        const body = node.children.find(child => child.type === types.interfaceBody);
        
        if (body) {
          // Extract properties and methods
          for (const member of body.children) {
            // Handle properties
            if (member.type === types.property) {
              const nameNode = member.children.find(c => c.type === types.propertyName);
              const typeNode = member.children.find(c => c.type === types.propertyType);
              
              if (nameNode) {
                const type = typeNode ? typeNode.text.replace(/^:\s*/, '') : 'any';
                const optional = nameNode.text.endsWith('?');
                const name = optional ? nameNode.text.slice(0, -1) : nameNode.text;
                
                properties.push({
                  name,
                  type,
                  optional
                });
              }
            }
            // Handle methods
            else if (member.type === types.method) {
              const nameNode = member.children.find(c => c.type === types.methodName);
              
              if (nameNode) {
                // Check if method is optional
                const optional = nameNode.text.endsWith('?');
                const name = optional ? nameNode.text.slice(0, -1) : nameNode.text;
                
                // Extract method parameters
                const parameters = [];
                const paramsNode = member.children.find(c => c.type === types.parameter ||
                                                           c.type.includes('parameter'));
                
                if (paramsNode) {
                  // Extract parameters
                  for (const param of paramsNode.children) {
                    if (param.type === types.parameterName || param.type === 'identifier') {
                      const paramName = param.text;
                      
                      // Try to get type if available
                      let paramType = 'any';
                      const typeNode = param.nextSibling;
                      if (typeNode && typeNode.type === types.parameterType) {
                        paramType = typeNode.text.replace(/^:\s*/, '');
                      }
                      
                      parameters.push({
                        name: paramName,
                        type: paramType
                      });
                    }
                  }
                }
                
                // Try to get return type
                let returnType = 'void';
                const returnTypeNode = member.children.find(c => c.type === types.returnType);
                if (returnTypeNode) {
                  returnType = returnTypeNode.text.replace(/^:\s*/, '').replace(/^->\s*/, '');
                }
                
                // Build method signature
                const signature = `${name}(${parameters.map(p => 
                  `${p.name}${p.type !== 'any' ? ': ' + p.type : ''}`).join(', ')})${
                  returnType !== 'void' ? ': ' + returnType : ''}`;
                
                methods.push({
                  name,
                  parameters,
                  returnType,
                  optional,
                  signature
                });
              }
            }
          }
        }
        
        // Format the full interface signature with type parameters and extends
        let fullSignature = `interface ${interfaceName}`;
        
        // Add type parameters if any
        if (type_parameters.length > 0) {
          fullSignature += `<${type_parameters.join(', ')}>`;
        }
        
        // Add extended interfaces if any
        if (extends_interfaces.length > 0) {
          fullSignature += ` extends ${extends_interfaces.join(', ')}`;
        }
        
        interfaces.push({
          name: interfaceName,
          properties,
          methods,
          extends: extends_interfaces,
          typeParameters: type_parameters,
          signature: fullSignature
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

// Extract standalone functions from AST
function extractFunctions(tree, language) {
  const functions = [];
  
  // Define function-related node types for different languages
  const nodeTypes = {
    typescript: {
      functionDeclaration: 'function_declaration',
      functionExpression: 'function_expression',
      arrowFunction: 'arrow_function',
      functionName: 'identifier',
      parameter: 'formal_parameters',
      parameterName: 'identifier',
      parameterType: 'type_annotation',
      returnType: 'return_type',
      exportKeyword: 'export_statement',
      defaultKeyword: 'default',
      asyncKeyword: 'async'
    },
    javascript: {
      functionDeclaration: 'function_declaration',
      functionExpression: 'function_expression',
      arrowFunction: 'arrow_function',
      functionName: 'identifier',
      parameter: 'formal_parameters',
      parameterName: 'identifier',
      exportKeyword: 'export_statement',
      defaultKeyword: 'default',
      asyncKeyword: 'async'
    },
    python: {
      functionDeclaration: 'function_definition',
      functionName: 'identifier',
      parameter: 'parameters',
      parameterName: 'identifier',
      parameterType: 'type',
      returnType: 'return_type',
      decoratorList: 'decorator',
      asyncKeyword: 'async'
    },
    ruby: {
      functionDeclaration: 'method',
      functionName: 'identifier',
      parameter: 'method_parameters',
      parameterName: 'identifier'
    },
    go: {
      functionDeclaration: 'function_declaration',
      functionName: 'identifier',
      parameter: 'parameter_list',
      parameterName: 'identifier',
      parameterType: 'type_identifier',
      returnType: 'return_type'
    },
    java: {
      functionDeclaration: 'method_declaration',
      functionName: 'identifier',
      parameter: 'formal_parameters',
      parameterName: 'identifier',
      parameterType: 'type_identifier',
      returnType: 'type_identifier',
      staticKeyword: 'static',
      publicKeyword: 'public',
      privateKeyword: 'private',
      protectedKeyword: 'protected'
    },
    // Default to JavaScript mappings
    default: {
      functionDeclaration: 'function_declaration',
      functionExpression: 'function_expression',
      arrowFunction: 'arrow_function',
      functionName: 'identifier',
      parameter: 'formal_parameters',
      parameterName: 'identifier',
      parameterType: 'type_annotation',
      returnType: 'return_type',
      exportKeyword: 'export_statement',
      defaultKeyword: 'default',
      asyncKeyword: 'async'
    }
  };
  
  // Get the appropriate node types for the language
  const types = nodeTypes[language] || nodeTypes.default;
  
  // Build a stack of nodes to traverse
  let nodeStack = [{node: tree.rootNode, done: false}];
  
  while (nodeStack.length > 0) {
    const {node, done} = nodeStack.pop();
    
    if (done) {
      continue;
    }
    
    // Check for function declarations, expressions, and arrow functions
    if (
      node.type === types.functionDeclaration || 
      node.type === types.functionExpression || 
      node.type === types.arrowFunction
    ) {
      let functionName;
      let isAnonymous = false;
      let isExported = false;
      let isDefault = false;
      let isAsync = false;
      let isStatic = false;
      let visibility = 'public'; // Default to public
      
      // Check if this function is part of an export statement
      let currentNode = node;
      let parentNode = currentNode.parent;
      
      while (parentNode && !functionName) {
        // Check for export statement
        if (parentNode.type === types.exportKeyword || parentNode.type.includes('export')) {
          isExported = true;
          // Check if it's a default export
          if (parentNode.children.some(child => 
            child.type === types.defaultKeyword || child.type.includes('default')
          )) {
            isDefault = true;
          }
        }
        
        // Check for assignments to identify function expressions being assigned to variables
        if (
          (parentNode.type === 'variable_declarator' || 
           parentNode.type === 'assignment_expression') && 
          !functionName
        ) {
          // Get the variable/property name
          const nameNode = parentNode.children.find(child => 
            child.type === 'identifier' || 
            child.type === 'property_identifier'
          );
          if (nameNode) {
            functionName = nameNode.text;
          }
        }
        
        currentNode = parentNode;
        parentNode = currentNode.parent;
      }
      
      // For direct function declarations, get the name
      if (!functionName && node.type === types.functionDeclaration) {
        const nameNode = node.children.find(child => child.type === types.functionName);
        if (nameNode) {
          functionName = nameNode.text;
        }
      }
      
      // If still no name, it's anonymous
      if (!functionName) {
        isAnonymous = true;
        functionName = '<anonymous>';
      }
      
      // Check for async modifier
      if (node.children.some(child => 
        child.type === types.asyncKeyword || child.type.includes('async')
      )) {
        isAsync = true;
      }
      
      // Check for static modifier (Java/C#/TypeScript class methods)
      if (types.staticKeyword && node.children.some(child => 
        child.type === types.staticKeyword || child.type.includes('static')
      )) {
        isStatic = true;
      }
      
      // Check visibility modifiers for languages that support them
      if (types.publicKeyword && node.children.some(child => 
        child.type === types.publicKeyword || child.type.includes('public')
      )) {
        visibility = 'public';
      } else if (types.privateKeyword && node.children.some(child => 
        child.type === types.privateKeyword || child.type.includes('private')
      )) {
        visibility = 'private';
      } else if (types.protectedKeyword && node.children.some(child => 
        child.type === types.protectedKeyword || child.type.includes('protected')
      )) {
        visibility = 'protected';
      }
      
      // Gather parameters
      const parameters = [];
      const paramNode = node.children.find(child => 
        child.type === types.parameter || child.type.includes('parameter')
      );
      
      if (paramNode) {
        // Process different parameter patterns by language
        if (language === 'javascript' || language === 'typescript') {
          // JS/TS parameters are direct children of the formal_parameters node
          for (const param of paramNode.children) {
            if (param.type === types.parameterName || param.type === 'identifier') {
              const paramName = param.text;
              
              // Try to get type if available (TypeScript)
              let paramType = 'any';
              const typeAnnotation = param.nextSibling;
              if (typeAnnotation && typeAnnotation.type === types.parameterType) {
                paramType = typeAnnotation.text.replace(/^:\s*/, '');
              }
              
              parameters.push({
                name: paramName,
                type: paramType
              });
            }
          }
        } else if (language === 'python') {
          // Python parameters
          for (const param of paramNode.children) {
            if (param.type === 'identifier') {
              const paramName = param.text;
              
              // Check for type annotation
              let paramType = 'any';
              if (param.nextSibling && param.nextSibling.type === 'type') {
                paramType = param.nextSibling.text;
              }
              
              parameters.push({
                name: paramName,
                type: paramType
              });
            }
          }
        } else {
          // Generic approach for other languages
          for (const param of paramNode.children) {
            if (param.type === types.parameterName || param.type === 'identifier') {
              const paramName = param.text;
              
              // Try to get parameter type if available
              let paramType = 'any';
              if (types.parameterType) {
                const typeNode = param.nextSibling || param.parent.children.find(c => c.type === types.parameterType);
                if (typeNode && typeNode.type.includes('type')) {
                  paramType = typeNode.text;
                }
              }
              
              parameters.push({
                name: paramName,
                type: paramType
              });
            }
          }
        }
      }
      
      // Get return type if available
      let returnType = 'void';
      
      if (types.returnType) {
        const returnTypeNode = node.children.find(child => 
          child.type === types.returnType || child.type.includes('return_type')
        );
        
        if (returnTypeNode) {
          returnType = returnTypeNode.text.replace(/^:\s*/, '').replace(/^->\s*/, '');
        }
      }
      
      // Get decorators for Python functions
      const decorators = [];
      if (language === 'python' && types.decoratorList) {
        const decoratorNodes = node.parent ? 
          node.parent.children.filter(child => child.type === types.decoratorList) : 
          [];
        
        for (const decorator of decoratorNodes) {
          const decoratorName = decorator.children.find(child => child.type === 'identifier');
          if (decoratorName) {
            decorators.push(decoratorName.text);
          }
        }
      }
      
      // Generate signature based on language
      let signature;
      
      if (language === 'typescript') {
        signature = `${isAsync ? 'async ' : ''}function ${functionName}(${
          parameters.map(p => `${p.name}: ${p.type}`).join(', ')
        })${returnType !== 'void' ? ': ' + returnType : ''}`;
      } else if (language === 'javascript') {
        signature = `${isAsync ? 'async ' : ''}function ${functionName}(${
          parameters.map(p => p.name).join(', ')
        })`;
      } else if (language === 'python') {
        signature = `${isAsync ? 'async ' : ''}def ${functionName}(${
          parameters.map(p => `${p.name}${p.type !== 'any' ? ': ' + p.type : ''}`).join(', ')
        })${returnType !== 'void' ? ' -> ' + returnType : ''}`;
      } else if (language === 'go') {
        signature = `func ${functionName}(${
          parameters.map(p => `${p.name} ${p.type}`).join(', ')
        }) ${returnType !== 'void' ? returnType : ''}`;
      } else if (language === 'java') {
        signature = `${visibility} ${isStatic ? 'static ' : ''}${returnType} ${functionName}(${
          parameters.map(p => `${p.type} ${p.name}`).join(', ')
        })`;
      } else {
        // Generic signature for other languages
        signature = `function ${functionName}(${parameters.map(p => p.name).join(', ')})`;
      }
      
      // Get function description from comments if available
      let description = '';
      if (node.previousSibling && 
          (node.previousSibling.type === 'comment' || 
           node.previousSibling.type.includes('comment'))) {
        description = node.previousSibling.text
          .replace(/^\/\*\*/, '') // Remove JSDoc start
          .replace(/\*\/$/, '')   // Remove JSDoc end
          .replace(/^\s*\/\/\s*/gm, '') // Remove line comments
          .replace(/^\s*\*\s*/gm, '')  // Remove JSDoc line stars
          .trim();
      }
      
      functions.push({
        name: functionName,
        isAnonymous,
        isExported,
        isDefault,
        isAsync,
        isStatic,
        visibility,
        parameters,
        returnType,
        signature,
        decorators,
        description,
        startLine: node.startPosition.row + 1,
        endLine: node.endPosition.row + 1
      });
    }
    
    // Continue traversing the tree
    nodeStack.push({node, done: true});
    
    for (let i = node.children.length - 1; i >= 0; i--) {
      nodeStack.push({node: node.children[i], done: false});
    }
  }
  
  return functions;
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

// Detect entry points based on code structure
function detectEntryPoints(fileInfo, content, language) {
  const entryPoints = {
    cli: [],
    api: [],
    webService: [],
    program: [],
    exportedFunctions: [],
    moduleExports: []
  };
  
  // Function to check if a file appears to be a main entry point
  const isMainFile = (fileName) => {
    return fileName === 'main.js' || 
           fileName === 'main.ts' || 
           fileName === 'index.js' || 
           fileName === 'index.ts' || 
           fileName === 'app.js' || 
           fileName === 'app.ts' || 
           fileName === 'server.js' || 
           fileName === 'server.ts' ||
           fileName.endsWith('.cli.js') ||
           fileName.endsWith('.cli.ts') ||
           fileName.includes('main');
  };
  
  const fileName = path.basename(fileInfo.path);
  
  // Check for shebang line for CLI apps
  if (content.trim().startsWith('#!')) {
    entryPoints.cli.push({
      type: 'cli',
      path: fileInfo.path,
      name: path.basename(fileInfo.path, path.extname(fileInfo.path)),
      usage: `${path.basename(fileInfo.path)} [options]`
    });
  }
  
  // Look for commander, yargs, or other CLI frameworks
  if (content.includes('commander') || 
      content.includes('yargs') || 
      content.includes('program.parse') || 
      content.includes('ArgumentParser') || 
      content.includes('click') ||
      content.includes('optparse')) {
    
    // Extract CLI commands and options if possible
    const commandMatches = content.match(/program\.command\(['"](.*?)['"]/g) || [];
    const optionMatches = content.match(/program\.option\(['"](.*?)['"]/g) || [];
    
    // If using commander, extract possible command format
    if (commandMatches.length > 0 || optionMatches.length > 0) {
      let usage = `${path.basename(fileInfo.path, path.extname(fileInfo.path))}`;
      
      // Add command and option placeholders
      if (commandMatches.length > 0) {
        usage += ' <command>';
      }
      
      if (optionMatches.length > 0) {
        usage += ' [options]';
      }
      
      entryPoints.cli.push({
        type: 'cli',
        path: fileInfo.path,
        name: path.basename(fileInfo.path, path.extname(fileInfo.path)),
        commands: commandMatches.map(cmd => cmd.replace(/program\.command\(['"]|['"].*$/g, '')),
        options: optionMatches.map(opt => opt.replace(/program\.option\(['"]|['"].*$/g, '')),
        usage
      });
    }
  }
  
  // Check for web server / API code
  if (content.includes('express') || 
      content.includes('app.listen') || 
      content.includes('http.createServer') || 
      content.includes('app.get(') || 
      content.includes('app.post(') || 
      content.includes('app.use(') || 
      content.includes('router.') || 
      content.includes('@Controller') ||
      content.includes('Flask(') ||
      content.includes('django')) {
    
    // Try to identify the port the server is running on
    const portMatch = content.match(/\.listen\((\d+)/) || 
                     content.match(/port\s*=\s*(\d+)/) || 
                     content.match(/PORT\s*=\s*(\d+)/);
    
    const port = portMatch ? portMatch[1] : '3000'; // Default to common port if not found
    
    // Try to find route definitions
    const routeMatches = content.match(/app\.(get|post|put|delete|patch)\(['"](.*?)['"]/g) || [];
    const routePattern = /app\.(get|post|put|delete|patch)\(['"](.*?)['"]/;
    
    const routes = routeMatches.map(route => {
      const match = route.match(routePattern);
      if (match && match.length >= 3) {
        return {
          method: match[1].toUpperCase(),
          path: match[2]
        };
      }
      return null;
    }).filter(Boolean);
    
    entryPoints.webService.push({
      type: 'webService',
      path: fileInfo.path,
      name: path.basename(fileInfo.path, path.extname(fileInfo.path)),
      port,
      url: `http://localhost:${port}`,
      routes
    });
  }
  
  // Look for exported functions or module.exports
  if (['javascript', 'typescript'].includes(language)) {
    const exportedFuncMatches = content.match(/export(\s+default)?\s+function\s+(\w+)/g) || [];
    const moduleExportsMatches = content.match(/module\.exports\s*=\s*{([\s\S]*?)}/g) || [];
    
    // Extract exported function names
    exportedFuncMatches.forEach(match => {
      const funcNameMatch = match.match(/function\s+(\w+)/);
      if (funcNameMatch && funcNameMatch[1]) {
        entryPoints.exportedFunctions.push({
          type: 'exportedFunction',
          name: funcNameMatch[1],
          isDefault: match.includes('default'),
          path: fileInfo.path
        });
      }
    });
    
    // Extract module.exports properties
    if (moduleExportsMatches.length > 0) {
      const propertiesMatch = moduleExportsMatches[0].match(/module\.exports\s*=\s*{([\s\S]*?)}/);
      if (propertiesMatch && propertiesMatch[1]) {
        const properties = propertiesMatch[1]
          .split(',')
          .map(prop => prop.trim())
          .filter(Boolean)
          .map(prop => {
            const keyValue = prop.split(':');
            return keyValue[0].trim();
          });
        
        entryPoints.moduleExports.push({
          type: 'moduleExport',
          path: fileInfo.path,
          exports: properties
        });
      }
    }
  }
  
  // Check if this is a main program file
  if (isMainFile(fileName) || 
      content.includes('public static void main(') || // Java
      content.includes('if __name__ == "__main__"') || // Python
      content.match(/func\s+main\(\)/)) { // Go
    
    entryPoints.program.push({
      type: 'program',
      path: fileInfo.path,
      name: path.basename(fileInfo.path, path.extname(fileInfo.path))
    });
  }
  
  return entryPoints;
}

// Process a file to extract code elements - updated for more generic classifications
async function processFile(filePath, parser, language) {
  console.log(`Processing ${filePath}...`);
  
  const fileInfo = {
    path: filePath,
    classes: [],
    interfaces: [],
    functions: [],
    imports: [],
    decorators: [],
    entryPoints: null,
    
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
    isScript: false,
    isEntryPoint: false,
    
    // Keep original flags for backward compatibility
    isModule: false,
    isGuard: false,
    isInterceptor: false,
    isDirective: false,
    isModel: false,
    isRepository: false,
    isUtil: false
  };
  
  try {
    const content = readFileContent(filePath);
    if (!content) return fileInfo;
    
    const tree = parser.parse(content);
    
    // Extract data
    fileInfo.classes = extractClasses(tree, language);
    fileInfo.interfaces = extractInterfaces(tree, language);
    fileInfo.functions = extractFunctions(tree, language);
    fileInfo.imports = extractImports(tree, language);
    fileInfo.decorators = extractDecorators(tree, language);
    
    // Detect entry points like CLI, API, services
    fileInfo.entryPoints = detectEntryPoints(fileInfo, content, language);
    
    // If any entry points are found, mark this as an entry point file
    fileInfo.isEntryPoint = Object.values(fileInfo.entryPoints).some(arr => arr.length > 0);
    
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
    
    // Set legacy model flag too
    fileInfo.isModel = fileInfo.isDataModel;
    
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
    
    // Set legacy util flag too
    fileInfo.isUtil = fileInfo.isUtility;
    
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
    
    // Legacy Angular-specific classifications
    if (['typescript', 'javascript'].includes(language)) {
      fileInfo.isModule = fileInfo.decorators.some(d => d.type === 'NgModule') || fileName.includes('.module.');
      fileInfo.isGuard = fileName.includes('.guard.');
      fileInfo.isInterceptor = fileName.includes('.interceptor.');
      fileInfo.isDirective = fileInfo.decorators.some(d => d.type === 'Directive') || fileName.includes('.directive.');
    }
    
    // Legacy repository classification
    fileInfo.isRepository = fileName.includes('repository') || 
                           fileName.includes('dao') || 
                           dirPath.includes('/repositories') || 
                           dirPath.includes('/daos');
    
    return fileInfo;
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
    return fileInfo;
  }
}

// Identify logical modules in the codebase based on functionality
function detectLogicalModules(filesInfo) {
  // Define logical module categories
  const logicalModules = {
    'Entry Point': {
      files: [],
      description: 'Main entry points and CLI interface',
      functions: [],
      classes: [],
      interfaces: [],
      dependencies: []
    },
    'Language Detection': {
      files: [],
      description: 'Code for detecting and loading language parsers',
      functions: [],
      classes: [],
      interfaces: [],
      dependencies: []
    },
    'File Processing': {
      files: [],
      description: 'Code for finding and reading files',
      functions: [],
      classes: [],
      interfaces: [],
      dependencies: []
    },
    'Code Analysis': {
      files: [],
      description: 'Class, interface, and function extraction',
      functions: [],
      classes: [],
      interfaces: [],
      dependencies: []
    },
    'Dependency Analysis': {
      files: [],
      description: 'Code for building dependency graphs',
      functions: [],
      classes: [],
      interfaces: [],
      dependencies: []
    },
    'Documentation Generation': {
      files: [],
      description: 'Code for generating markdown documentation',
      functions: [],
      classes: [],
      interfaces: [],
      dependencies: []
    },
    'Utility': {
      files: [],
      description: 'Helper functions and utilities',
      functions: [],
      classes: [],
      interfaces: [],
      dependencies: []
    },
    'Dependency Management': {
      files: [],
      description: 'Code for installing and managing dependencies',
      functions: [],
      classes: [],
      interfaces: [],
      dependencies: []
    }
  };
  
  // Map functions to modules based on function name and content
  filesInfo.forEach(fileInfo => {
    // Add file to appropriate module based on its functions
    let fileAdded = false;
    
    if (fileInfo.isEntryPoint) {
      logicalModules['Entry Point'].files.push(fileInfo.path);
      fileAdded = true;
    }
    
    // Process functions from the file
    if (fileInfo.functions) {
      fileInfo.functions.forEach(func => {
        let moduleKey = null;
        
        // Determine logical module based on function name/purpose
        if (func.name === 'main') {
          moduleKey = 'Entry Point';
        } else if (func.name.includes('detectLanguage') || func.name.includes('loadLanguageParser')) {
          moduleKey = 'Language Detection';
        } else if (func.name.includes('findFiles') || func.name.includes('readFileContent')) {
          moduleKey = 'File Processing';
        } else if (func.name.includes('extract') || func.name.includes('processFile')) {
          moduleKey = 'Code Analysis';
        } else if (func.name.includes('buildDependency') || func.name.includes('Graph')) {
          moduleKey = 'Dependency Analysis';
        } else if (func.name.includes('generate') || func.name.includes('markdown')) {
          moduleKey = 'Documentation Generation';
        } else if (func.name.includes('install') || func.name.includes('Dependencies')) {
          moduleKey = 'Dependency Management';
        } else {
          moduleKey = 'Utility';
        }
        
        // Add function to the appropriate module
        if (moduleKey) {
          logicalModules[moduleKey].functions.push({
            name: func.name,
            signature: func.signature,
            description: func.description,
            parameters: func.parameters,
            returnType: func.returnType,
            sourceFile: fileInfo.path,
            startLine: func.startLine,
            endLine: func.endLine
          });
          
          // Add file to module if not already added
          if (!fileAdded && !logicalModules[moduleKey].files.includes(fileInfo.path)) {
            logicalModules[moduleKey].files.push(fileInfo.path);
            fileAdded = true;
          }
        }
      });
    }
    
    // Add classes to appropriate modules
    fileInfo.classes.forEach(cls => {
      let moduleKey = null;
      
      // Determine module based on class name
      if (cls.name.includes('Parser') || cls.name.includes('Analyzer')) {
        moduleKey = 'Code Analysis';
      } else if (cls.name.includes('Generator') || cls.name.includes('Markdown')) {
        moduleKey = 'Documentation Generation';
      } else {
        moduleKey = 'Utility'; // Default
      }
      
      // Add class to the appropriate module
      logicalModules[moduleKey].classes.push({
        name: cls.name,
        methods: cls.methods,
        properties: cls.properties,
        extends: cls.extends,
        implements: cls.implements,
        sourceFile: fileInfo.path
      });
      
      // Add file to module if not already added
      if (!fileAdded && !logicalModules[moduleKey].files.includes(fileInfo.path)) {
        logicalModules[moduleKey].files.push(fileInfo.path);
        fileAdded = true;
      }
    });
    
    // If file hasn't been categorized based on functions or classes, add it to Utility
    if (!fileAdded && fileInfo.path) {
      logicalModules['Utility'].files.push(fileInfo.path);
    }
  });
  
  // For each module, determine dependencies between them
  Object.keys(logicalModules).forEach(moduleKey => {
    const module = logicalModules[moduleKey];
    
    // Create a set of all function names in this module
    const moduleFunctionNames = new Set(module.functions.map(f => f.name));
    
    // For each function in the module, check for calls to functions in other modules
    module.functions.forEach(func => {
      if (func.description) {
        // Check function description for mentions of other functions
        Object.keys(logicalModules).forEach(otherModuleKey => {
          if (otherModuleKey === moduleKey) return; // Skip self
          
          const otherModule = logicalModules[otherModuleKey];
          const otherFunctions = otherModule.functions.map(f => f.name);
          
          // Check if this function mentions any function from the other module
          const mentions = otherFunctions.filter(otherFunc => 
            func.description.includes(otherFunc) || 
            (func.signature && func.signature.includes(otherFunc))
          );
          
          if (mentions.length > 0 && !module.dependencies.includes(otherModuleKey)) {
            module.dependencies.push(otherModuleKey);
          }
        });
      }
    });
  });
  
  return logicalModules;
}

// Identify module interfaces (exported classes, functions, types)
function detectModuleInterfaces(filesInfo) {
  const moduleInterfaces = {};
  
  // First, identify logical modules
  const logicalModules = detectLogicalModules(filesInfo);
  
  filesInfo.forEach(fileInfo => {
    const moduleName = path.basename(fileInfo.path, path.extname(fileInfo.path));
    
    // Initialize entry if it doesn't exist
    if (!moduleInterfaces[moduleName]) {
      moduleInterfaces[moduleName] = {
        path: fileInfo.path,
        exportedClasses: [],
        exportedFunctions: [],
        exportedInterfaces: [],
        defaultExport: null,
        isEntryPoint: fileInfo.isEntryPoint,
        usageExamples: [],
        // Add logical module categorization
        logicalModule: determineLogicalModule(fileInfo, logicalModules)
      };
    }
    
    // Add exported classes (look for classes with public methods)
    fileInfo.classes.forEach(classInfo => {
      // Consider a class as exported if:
      // 1. The file has export statements and likely contains this class
      // 2. This is an entry point file (like main file)
      // 3. This is a significant component/service class
      
      const hasPublicMethods = classInfo.methods && classInfo.methods.some(m => m.visibility === 'public');
      
      if (hasPublicMethods) {
        // Build class usage example
        let usageExample = '';
        let constructorParams = '';
        
        if (classInfo.constructor && classInfo.constructor.parameters) {
          constructorParams = classInfo.constructor.parameters
            .map(p => `${p.name}: ${p.type}`)
            .join(', ');
        }
        
        // Create basic usage example
        if (fileInfo.imports.some(imp => imp.includes('require'))) {
          // CommonJS style
          usageExample = `const { ${classInfo.name} } = require('${moduleName}');\nconst instance = new ${classInfo.name}(${constructorParams});`;
        } else {
          // ES Module style
          usageExample = `import { ${classInfo.name} } from '${moduleName}';\nconst instance = new ${classInfo.name}(${constructorParams});`;
        }
        
        moduleInterfaces[moduleName].exportedClasses.push({
          name: classInfo.name,
          constructorParams: classInfo.constructor ? classInfo.constructor.parameters : [],
          publicMethods: classInfo.methods.filter(m => m.visibility === 'public'),
          properties: classInfo.properties,
          extends: classInfo.extends,
          implements: classInfo.implements,
          usageExample,
          // Add logical module categorization
          logicalModule: getClassLogicalModule(classInfo, logicalModules)
        });
        
        // Add to usage examples
        moduleInterfaces[moduleName].usageExamples.push({
          type: 'class',
          name: classInfo.name,
          example: usageExample
        });
      }
    });
    
    // Add exported functions from the standalone function list
    if (fileInfo.functions) {
      fileInfo.functions.forEach(func => {
        if (func.isExported) {
          // Build function usage example
          let usageExample = '';
          
          // Create different examples based on how the function is exported
          if (func.isDefault) {
            // Default export
            usageExample = `import ${func.name} from '${moduleName}';\n${func.name}(${func.parameters.map(p => p.name).join(', ')});`;
            
            // Track default export separately
            moduleInterfaces[moduleName].defaultExport = {
              type: 'function',
              name: func.name,
              signature: func.signature,
              parameters: func.parameters,
              returnType: func.returnType,
              usageExample,
              // Add logical module categorization
              logicalModule: getFunctionLogicalModule(func, logicalModules)
            };
          } else {
            // Named export
            usageExample = `import { ${func.name} } from '${moduleName}';\n${func.name}(${func.parameters.map(p => p.name).join(', ')});`;
            
            moduleInterfaces[moduleName].exportedFunctions.push({
              name: func.name,
              signature: func.signature,
              parameters: func.parameters,
              returnType: func.returnType,
              description: func.description,
              usageExample,
              // Add logical module categorization
              logicalModule: getFunctionLogicalModule(func, logicalModules)
            });
          }
          
          // Add to usage examples
          moduleInterfaces[moduleName].usageExamples.push({
            type: 'function',
            name: func.name,
            example: usageExample
          });
        }
      });
    }
    
    // Add exported interfaces
    fileInfo.interfaces.forEach(iface => {
      // Check if filename matches interface name, which is a common pattern for exported interfaces
      const filenameRoot = path.basename(fileInfo.path, path.extname(fileInfo.path));
      
      // Consider an interface likely exported if:
      // 1. Filename has interface or type in name
      // 2. File is a in models/types/interfaces directory 
      // 3. Filename matches interface name (common pattern)
      const isLikelyExported = 
        filenameRoot.includes('interface') || 
        filenameRoot.includes('type') || 
        fileInfo.isDataModel || 
        filenameRoot.toLowerCase() === iface.name.toLowerCase();
      
      if (isLikelyExported) {
        // Build interface usage example
        let usageExample = '';
        
        // Create example
        usageExample = `import { ${iface.name} } from '${moduleName}';\n\n// Example usage:\nconst data: ${iface.name} = {\n`;
        
        // Add sample property values
        if (iface.properties && iface.properties.length > 0) {
          iface.properties.forEach(prop => {
            // Skip optional properties for brevity
            if (!prop.optional) {
              let sampleValue = '';
              
              // Generate appropriate sample values based on type
              if (prop.type.includes('string')) {
                sampleValue = `'sample ${prop.name}'`;
              } else if (prop.type.includes('number')) {
                sampleValue = '0';
              } else if (prop.type.includes('boolean')) {
                sampleValue = 'false';
              } else if (prop.type.includes('[]')) {
                sampleValue = '[]';
              } else if (prop.type.includes('object')) {
                sampleValue = '{}';
              } else {
                sampleValue = 'undefined /* provide appropriate value */';
              }
              
              usageExample += `  ${prop.name}: ${sampleValue},\n`;
            }
          });
        }
        
        usageExample += '};';
        
        moduleInterfaces[moduleName].exportedInterfaces.push({
          name: iface.name,
          properties: iface.properties,
          methods: iface.methods,
          signature: iface.signature,
          extends: iface.extends,
          typeParameters: iface.typeParameters,
          usageExample,
          // Add logical module categorization - most interfaces belong to the Code Analysis module
          logicalModule: 'Code Analysis'
        });
        
        // Add to usage examples
        moduleInterfaces[moduleName].usageExamples.push({
          type: 'interface',
          name: iface.name,
          example: usageExample
        });
      }
    });
    
    // Check for entry points - CLI, API, services etc.
    if (fileInfo.entryPoints) {
      // CLI entry points
      if (fileInfo.entryPoints.cli && fileInfo.entryPoints.cli.length > 0) {
        fileInfo.entryPoints.cli.forEach(cli => {
          moduleInterfaces[moduleName].usageExamples.push({
            type: 'cli',
            name: cli.name,
            example: `# Command line usage:\n${cli.usage}`
          });
        });
      }
      
      // Web service / API entry points
      if (fileInfo.entryPoints.webService && fileInfo.entryPoints.webService.length > 0) {
        fileInfo.entryPoints.webService.forEach(service => {
          // Generate example for each route if available
          if (service.routes && service.routes.length > 0) {
            service.routes.forEach(route => {
              moduleInterfaces[moduleName].usageExamples.push({
                type: 'api',
                name: `${route.method} ${route.path}`,
                example: `# API Endpoint:\n${route.method} ${service.url}${route.path}`
              });
            });
          } else {
            // Generic web service example if no specific routes
            moduleInterfaces[moduleName].usageExamples.push({
              type: 'webService',
              name: service.name,
              example: `# Web Service:\nService running at ${service.url}`
            });
          }
        });
      }
    }
  });
  
  // Add the logical modules to the result
  moduleInterfaces._logicalModules = logicalModules;
  
  return moduleInterfaces;
}

// Helper function to determine which logical module a file belongs to
function determineLogicalModule(fileInfo, logicalModules) {
  // Check each logical module to see if this file is included
  for (const [moduleName, module] of Object.entries(logicalModules)) {
    if (module.files.includes(fileInfo.path)) {
      return moduleName;
    }
  }
  
  // If not found in any logical module, determine based on file characteristics
  if (fileInfo.isEntryPoint) {
    return 'Entry Point';
  } else if (fileInfo.functions && fileInfo.functions.some(f => 
    f.name.includes('extract') || f.name.includes('parse')
  )) {
    return 'Code Analysis';
  } else if (fileInfo.functions && fileInfo.functions.some(f => 
    f.name.includes('generate')
  )) {
    return 'Documentation Generation';
  }
  
  return 'Utility'; // Default
}

// Helper function to determine which logical module a function belongs to
function getFunctionLogicalModule(func, logicalModules) {
  // Check each logical module to see if this function is included
  for (const [moduleName, module] of Object.entries(logicalModules)) {
    if (module.functions.some(f => f.name === func.name)) {
      return moduleName;
    }
  }
  
  // If not found, determine based on function name/signature
  if (func.name === 'main') {
    return 'Entry Point';
  } else if (func.name.includes('Language') || func.name.includes('Parser')) {
    return 'Language Detection';
  } else if (func.name.includes('extract') || func.name.includes('parse')) {
    return 'Code Analysis';
  } else if (func.name.includes('generate') || func.name.includes('markdown')) {
    return 'Documentation Generation';
  } else if (func.name.includes('find') || func.name.includes('read')) {
    return 'File Processing';
  }
  
  return 'Utility'; // Default
}

// Helper function to determine which logical module a class belongs to
function getClassLogicalModule(cls, logicalModules) {
  // Check each logical module to see if this class is included
  for (const [moduleName, module] of Object.entries(logicalModules)) {
    if (module.classes.some(c => c.name === cls.name)) {
      return moduleName;
    }
  }
  
  // If not found, determine based on class name/characteristics
  if (cls.name.includes('Parser') || cls.name.includes('Extractor')) {
    return 'Code Analysis';
  } else if (cls.name.includes('Generator') || cls.name.includes('Markdown')) {
    return 'Documentation Generation';
  } else if (cls.name.includes('File') || cls.name.includes('Reader')) {
    return 'File Processing';
  }
  
  return 'Utility'; // Default
}

// Build dependency graph between files
function buildDependencyGraph(filesInfo) {
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
  Object.entries(componentsByDir).forEach(([, comps]) => {
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

// Generate module dependencies diagram - More generic version
function generateModuleDiagram(features, language) {
  let diagram = '```mermaid\ngraph TD\n';
  
  // Define common module categories that appear in most codebases
  const coreModules = [];
  const uiModules = [];
  const dataModules = [];
  const utilModules = [];
  const apiModules = [];
  
  // Categorize the features based on naming conventions
  Object.keys(features).forEach(feature => {
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
  Object.keys(features).forEach(feature => {
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

  // Generate routing diagram
function generateRoutingDiagram(filesInfo) {
  // Skip if routing diagram is disabled
  if (!options.routes) {
    return '';
  }

  let diagram = '```mermaid\ngraph LR\n';
  
  // Build a list of routes based on discovered
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

// Generate architecture overview - Universal version based on actual codebase structure
function generateArchitectureOverview(filesInfo, features) {
  let markdown = '';
  
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
    if (info.isDataModel || info.isModel) fileTypes.add('data-model');
    if (info.isController) fileTypes.add('controller');
    if (info.isUtility || info.isUtil) fileTypes.add('utility');
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

// Generate module interface documentation
function generateModuleInterfaceDocumentation(moduleInterfaces) {
  let markdown = '';
  
  // Filter to show only modules with interfaces or exports
  const relevantModules = Object.entries(moduleInterfaces).filter(([_, module]) => {
    return (
      module && 
      ((module.exportedClasses && module.exportedClasses.length > 0) || 
      (module.exportedFunctions && module.exportedFunctions.length > 0) || 
      (module.exportedInterfaces && module.exportedInterfaces.length > 0) || 
      module.defaultExport || 
      (module.usageExamples && module.usageExamples.length > 0))
    );
  });
  
  if (relevantModules.length === 0) {
    return '';
  }
  
  // Generate documentation for each module
  relevantModules.forEach(([moduleName, module]) => {
    markdown += `### ${moduleName}\n\n`;
    
    // If module is an entry point, mention that first
    if (module.isEntryPoint) {
      // Check what kind of entry point
      const entryTypes = module.usageExamples
        .filter(ex => ['cli', 'api', 'webService', 'program'].includes(ex.type))
        .map(ex => ex.type);
      
      if (entryTypes.length > 0) {
        markdown += `**Entry point type**: ${entryTypes.join(', ')}\n\n`;
      } else {
        markdown += `**Entry point**: Yes\n\n`;
      }
    }
    
    // If there's a default export, document it first
    if (module && module.defaultExport) {
      markdown += `**Default export**: \`${module.defaultExport.name}\` (${module.defaultExport.type})\n\n`;
      
      if (module.defaultExport.type === 'function' && module.defaultExport.signature) {
        markdown += '```typescript\n';
        markdown += module.defaultExport.signature;
        markdown += '\n```\n\n';
      }
    }
    
    // Exported classes
    if (module.exportedClasses.length > 0) {
      markdown += '#### Exported Classes\n\n';
      
      module.exportedClasses.forEach(cls => {
        markdown += `##### \`${cls.name}\`\n\n`;
        
        // Show inheritance if available
        if (cls.extends || (cls.implements && cls.implements.length > 0)) {
          if (cls.extends) {
            markdown += `Extends: \`${cls.extends}\``;
            
            if (cls.implements && cls.implements.length > 0) {
              markdown += `, Implements: ${cls.implements.map(i => `\`${i}\``).join(', ')}`;
            }
            
            markdown += '\n\n';
          } else if (cls.implements && cls.implements.length > 0) {
            markdown += `Implements: ${cls.implements.map(i => `\`${i}\``).join(', ')}\n\n`;
          }
        }
        
        // Constructor
        if (cls.constructorParams && cls.constructorParams.length > 0) {
          markdown += '**Constructor:**\n\n';
          markdown += '```typescript\n';
          markdown += `constructor(${cls.constructorParams.map(p => `${p.name}: ${p.type}`).join(', ')})`;
          markdown += '\n```\n\n';
        }
        
        // Public methods
        if (cls.publicMethods && cls.publicMethods.length > 0) {
          markdown += '**Public Methods:**\n\n';
          markdown += '| Method | Parameters | Return Type |\n';
          markdown += '|--------|------------|-------------|\n';
          
          cls.publicMethods.forEach(method => {
            const params = method.parameters ? 
              method.parameters.map(p => `${p.name}: ${p.type}`).join(', ') : '';
            markdown += `| \`${method.name}\` | ${params} | ${method.returnType || 'void'} |\n`;
          });
          
          markdown += '\n';
        }
        
        // Usage example
        if (cls.usageExample) {
          markdown += '**Usage Example:**\n\n';
          markdown += '```typescript\n';
          markdown += cls.usageExample;
          markdown += '\n```\n\n';
        }
      });
    }
    
    // Exported functions
    if (module.exportedFunctions.length > 0) {
      markdown += '#### Exported Functions\n\n';
      
      markdown += '| Function | Signature | Description |\n';
      markdown += '|----------|-----------|-------------|\n';
      
      module.exportedFunctions.forEach(func => {
        const description = func.description ? 
          (func.description.length > 50 ? func.description.substring(0, 47) + '...' : func.description) : 
          '';
        
        markdown += `| \`${func.name}\` | \`${func.signature}\` | ${description} |\n`;
      });
      
      markdown += '\n';
      
      // Show detailed function documentation for important functions
      const importantFunctions = module.exportedFunctions.filter(f => f.description || f.parameters.length > 1);
      
      if (importantFunctions.length > 0) {
        importantFunctions.forEach(func => {
          markdown += `##### \`${func.name}\`\n\n`;
          
          if (func.description) {
            markdown += `${func.description}\n\n`;
          }
          
          markdown += '```typescript\n';
          markdown += func.signature;
          markdown += '\n```\n\n';
          
          if (func.parameters && func.parameters.length > 0) {
            markdown += '**Parameters:**\n\n';
            
            func.parameters.forEach(param => {
              markdown += `- \`${param.name}\`: ${param.type}\n`;
            });
            
            markdown += '\n';
          }
          
          if (func.returnType && func.returnType !== 'void') {
            markdown += `**Returns:** \`${func.returnType}\`\n\n`;
          }
        });
      }
    }
    
    // Exported interfaces
    if (module.exportedInterfaces.length > 0) {
      markdown += '#### Exported Interfaces\n\n';
      
      // First, create a summary table
      markdown += '| Interface | Properties | Methods |\n';
      markdown += '|-----------|------------|--------|\n';
      
      module.exportedInterfaces.forEach(iface => {
        const propCount = iface.properties ? iface.properties.length : 0;
        const methodCount = iface.methods ? iface.methods.length : 0;
        
        markdown += `| \`${iface.name}\` | ${propCount} | ${methodCount} |\n`;
      });
      
      markdown += '\n';
      
      // Then provide more detailed interface definitions
      module.exportedInterfaces.forEach(iface => {
        markdown += `##### \`${iface.name}\`\n\n`;
        
        if (iface.extends && iface.extends.length > 0) {
          markdown += `Extends: ${iface.extends.map(ext => `\`${ext}\``).join(', ')}\n\n`;
        }
        
        markdown += '```typescript\n';
        markdown += iface.signature || `interface ${iface.name} {`;
        
        if (!iface.signature) {
          markdown += '\n';
          
          // Add properties
          if (iface.properties && iface.properties.length > 0) {
            iface.properties.forEach(prop => {
              markdown += `  ${prop.name}${prop.optional ? '?' : ''}: ${prop.type};\n`;
            });
          }
          
          // Add methods
          if (iface.methods && iface.methods.length > 0) {
            if (iface.properties && iface.properties.length > 0) {
              markdown += '\n';
            }
            
            iface.methods.forEach(method => {
              markdown += `  ${method.signature};\n`;
            });
          }
          
          markdown += '}';
        }
        
        markdown += '\n```\n\n';
      });
    }
    
    // Command-line or API usage examples
    const cliExamples = module.usageExamples.filter(ex => ex.type === 'cli');
    const apiExamples = module.usageExamples.filter(ex => ['api', 'webService'].includes(ex.type));
    
    if (cliExamples.length > 0) {
      markdown += '#### Command Line Usage\n\n';
      
      cliExamples.forEach(ex => {
        markdown += '```bash\n';
        markdown += ex.example;
        markdown += '\n```\n\n';
      });
    }
    
    if (apiExamples.length > 0) {
      markdown += '#### API Endpoints\n\n';
      
      apiExamples.forEach(ex => {
        markdown += `**${ex.name}**\n\n`;
        markdown += '```\n';
        markdown += ex.example;
        markdown += '\n```\n\n';
      });
    }
    
    markdown += '---\n\n';
  });
  
  return markdown;
}

// Generate documentation about code repository entry points with execution flow
function generateEntryPointDocumentation(filesInfo, moduleInterfaces) {
  // Filter to files identified as entry points
  const entryPoints = filesInfo.filter(file => file.isEntryPoint);
  
  if (entryPoints.length === 0) {
    return '';
  }
  
  let markdown = '';
  
  // Access the logical modules to show dependencies
  const logicalModules = (moduleInterfaces && moduleInterfaces._logicalModules) ? moduleInterfaces._logicalModules : {};
  
  // Get all functions from all files for analysis
  const allFunctions = filesInfo.flatMap(file => file.functions || []);
  
  // Group entry points by type
  const cliEntryPoints = entryPoints.filter(ep => 
    ep.entryPoints && ep.entryPoints.cli && ep.entryPoints.cli.length > 0
  );
  
  const webServiceEntryPoints = entryPoints.filter(ep => 
    ep.entryPoints && ep.entryPoints.webService && ep.entryPoints.webService.length > 0
  );
  
  const programEntryPoints = entryPoints.filter(ep => 
    ep.entryPoints && ep.entryPoints.program && ep.entryPoints.program.length > 0
  );
  
  // CLI entry points 
  if (cliEntryPoints.length > 0) {
    markdown += '### Command Line Interfaces\n\n';
    
    cliEntryPoints.forEach(ep => {
      ep.entryPoints.cli.forEach(cli => {
        markdown += `#### ${cli.name}\n\n`;
        markdown += '```bash\n';
        markdown += cli.usage;
        markdown += '\n```\n\n';
        
        // Add commands and options if available
        if (cli.commands && cli.commands.length > 0) {
          markdown += '**Available Commands:**\n\n';
          cli.commands.forEach(cmd => {
            markdown += `- \`${cmd}\`\n`;
          });
          markdown += '\n';
        }
        
        if (cli.options && cli.options.length > 0) {
          markdown += '**Available Options:**\n\n';
          cli.options.forEach(opt => {
            markdown += `- \`${opt}\`\n`;
          });
          markdown += '\n';
        }
        
        // Add execution flow showing how CLI commands might be processed
        markdown += '**Possible Execution Flow:**\n\n';
        markdown += 'Based on the code analysis, when you run this CLI command, something like this execution flow may occur:\n\n';
        
        // Find main functions to determine potential flow
        const mainFunctions = allFunctions.filter(f => 
          f.name.toLowerCase() === 'main' || 
          f.name.toLowerCase().includes('init') ||
          f.name.startsWith('handle') ||
          f.name.startsWith('process') ||
          f.name.toLowerCase().includes('command') ||
          f.name.toLowerCase().includes('cli')
        );
        
        // If we found some potential flow-related functions
        if (mainFunctions.length > 0) {
          // Sort by complexity (parameter count)
          mainFunctions.sort((a, b) => 
            (b.parameters ? b.parameters.length : 0) - 
            (a.parameters ? a.parameters.length : 0)
          );
          
          // Convert to steps
          mainFunctions.slice(0, 5).forEach((func, idx) => {
            const stepNum = idx + 1;
            const desc = func.description ? 
              func.description.split('.')[0] : // Get first sentence
              `Executes the ${func.name} function`;
            
            markdown += `${stepNum}. **${func.name}**: ${desc}\n`;
          });
        } else {
          // Generic execution flow based on CLI patterns
          markdown += '1. **Parse Arguments**: Command-line arguments are processed\n';
          markdown += '2. **Validate Input**: Ensure required parameters are provided\n';
          markdown += '3. **Setup Environment**: Configure environment based on options\n';
          markdown += '4. **Execute Command**: Run the requested operation\n';
          markdown += '5. **Output Results**: Return results to the user\n';
        }
        
        markdown += '\n';
        
        // Include a diagram showing the likely flow based on discovered functions
        markdown += '```mermaid\nflowchart TD\n';
        
        // Start with CLI entrypoint
        markdown += '  CLI[CLI Entry Point] --> Parser[Parse Arguments]\n';
        
        // Add all significant functions as nodes in the flowchart
        const flowFunctions = mainFunctions.slice(0, 7); // Limit to 7 for readability
        
        if (flowFunctions.length > 0) {
          let prevNode = 'Parser';
          
          flowFunctions.forEach((func, idx) => {
            const nodeId = func.name.replace(/[^a-zA-Z0-9]/g, '');
            const nodeName = func.name;
            
            // Create the node
            markdown += `  ${nodeId}[${nodeName}]\n`;
            
            // Connect from previous node
            markdown += `  ${prevNode} --> ${nodeId}\n`;
            
            prevNode = nodeId;
            
            // Add branches for complex functions
            if (func.parameters && func.parameters.length > 1) {
              const branchId = `${nodeId}Branch`;
              markdown += `  ${nodeId} --> ${branchId}{Process Options}\n`;
              
              // Create some reasonable branches based on parameters
              const param = func.parameters[0];
              if (param) {
                markdown += `  ${branchId} -->|${param.name}| ${nodeId}Result[Result]\n`;
              }
              
              prevNode = `${nodeId}Result`;
            }
          });
          
          // Final output
          markdown += `  ${prevNode} --> Output[Return Results]\n`;
        } else {
          // Generic flow if no specific functions found
          markdown += '  Parser --> Validate[Validate Input]\n';
          markdown += '  Validate --> Execute[Execute Command]\n';
          markdown += '  Execute --> Output[Return Results]\n';
        }
        
        // Style the diagram
        markdown += '\n';
        markdown += '  style CLI fill:#f96,stroke:#333,stroke-width:2px\n';
        markdown += '  style Parser fill:#9cf,stroke:#333,stroke-width:1px\n';
        markdown += '  style Output fill:#c9f,stroke:#333,stroke-width:1px\n';
        
        // Add styles for discovered functions
        flowFunctions.forEach(func => {
          const nodeId = func.name.replace(/[^a-zA-Z0-9]/g, '');
          markdown += `  style ${nodeId} fill:#9c6,stroke:#333,stroke-width:1px\n`;
          
          if (func.parameters && func.parameters.length > 1) {
            markdown += `  style ${nodeId}Branch fill:#fc9,stroke:#333,stroke-width:1px\n`;
            markdown += `  style ${nodeId}Result fill:#c9c,stroke:#333,stroke-width:1px\n`;
          }
        });
        
        markdown += '```\n\n';
        
        // Find most significant functions to include in a key functions table
        const significantFuncs = [];
        
        // Add functions that seem most important based on name patterns
        allFunctions.forEach(func => {
          // Main/entry point functions
          if (func.name.toLowerCase() === 'main' || 
              func.name.toLowerCase().includes('init') ||
              func.name.startsWith('start') ||
              func.name.startsWith('run')) {
            significantFuncs.push({
              category: 'Entry Point',
              function: func,
              purpose: func.description || 'Program entry point'
            });
          }
          
          // Command/CLI functions
          else if (func.name.toLowerCase().includes('command') ||
                  func.name.toLowerCase().includes('cli') ||
                  func.name.toLowerCase().includes('parse')) {
            significantFuncs.push({
              category: 'Command Processing',
              function: func,
              purpose: func.description || 'Processes command input'
            });
          }
          
          // Core business logic
          else if (func.name.toLowerCase().includes('process') ||
                  func.name.toLowerCase().includes('execute') ||
                  func.name.toLowerCase().includes('handle')) {
            significantFuncs.push({
              category: 'Core Logic',
              function: func,
              purpose: func.description || 'Executes business logic'
            });
          }
          
          // Data/file processing
          else if (func.name.toLowerCase().includes('file') ||
                  func.name.toLowerCase().includes('read') ||
                  func.name.toLowerCase().includes('write') ||
                  func.name.toLowerCase().includes('load')) {
            significantFuncs.push({
              category: 'Data Processing',
              function: func,
              purpose: func.description || 'Handles data operations'
            });
          }
          
          // Export/output functions
          else if (func.name.toLowerCase().includes('export') ||
                  func.name.toLowerCase().includes('output') ||
                  func.name.toLowerCase().includes('generate') ||
                  func.name.toLowerCase().includes('print')) {
            significantFuncs.push({
              category: 'Output Generation',
              function: func,
              purpose: func.description || 'Produces output'
            });
          }
        });
        
        // Include key functions table if we found anything significant
        if (significantFuncs.length > 0) {
          markdown += '**Key Functions Involved:**\n\n';
          markdown += '| Category | Function | Purpose |\n';
          markdown += '|----------|----------|--------|\n';
          
          // Sort by category and limit to reasonable number
          significantFuncs
            .sort((a, b) => a.category.localeCompare(b.category))
            .slice(0, 10)
            .forEach(item => {
              const funcName = item.function.name;
              const shortPurpose = item.purpose.length > 50 ? 
                item.purpose.substring(0, 47) + '...' : 
                item.purpose;
              
              markdown += `| ${item.category} | \`${funcName}()\` | ${shortPurpose} |\n`;
            });
          
          markdown += '\n';
        }
      });
    });
  }
  
  // Web service / API entry points
  if (webServiceEntryPoints.length > 0) {
    markdown += '### API Endpoints\n\n';
    
    webServiceEntryPoints.forEach(ep => {
      ep.entryPoints.webService.forEach(service => {
        markdown += `#### ${service.name}\n\n`;
        markdown += `Base URL: \`${service.url}\`\n\n`;
        
        if (service.routes && service.routes.length > 0) {
          markdown += '| Method | Endpoint | Description |\n';
          markdown += '|--------|----------|-------------|\n';
          
          service.routes.forEach(route => {
            markdown += `| ${route.method} | \`${route.path}\` | - |\n`;
          });
          
          markdown += '\n';
          
          // Add request flow diagram for API requests
          markdown += '**API Request Flow:**\n\n';
          
          markdown += '```mermaid\nsequenceDiagram\n';
          markdown += '    participant Client\n';
          markdown += '    participant API as API Server\n';
          markdown += '    participant Handler as Request Handler\n';
          markdown += '    participant Service as Service Layer\n';
          markdown += '    participant Data as Data Access Layer\n';
          markdown += '\n';
          markdown += '    Client->>API: HTTP Request\n';
          markdown += '    API->>Handler: Route to appropriate handler\n';
          markdown += '    Handler->>Service: Process business logic\n';
          markdown += '    Service->>Data: Query/Update data\n';
          markdown += '    Data-->>Service: Return data\n';
          markdown += '    Service-->>Handler: Return result\n';
          markdown += '    Handler-->>API: Format response\n';
          markdown += '    API-->>Client: HTTP Response\n';
          markdown += '```\n\n';
        } else {
          markdown += 'Specific API routes not detected.\n\n';
        }
      });
    });
  }
  
  // Main program entry points
  if (programEntryPoints.length > 0) {
    markdown += '### Main Program Entry Points\n\n';
    
    programEntryPoints.forEach(ep => {
      ep.entryPoints.program.forEach(program => {
        markdown += `- \`${program.name}\` (${program.path})\n`;
      });
    });
    
    markdown += '\n';
  }
  
  return markdown;
}

// Identify and document key repository elements
function generateKeyElementsDocumentation(filesInfo, features, moduleInterfaces) {
  let markdown = '';
  
  // Find files with significant importance
  const entryPointFiles = filesInfo.filter(f => f.isEntryPoint);
  
  // Find core classes (classes with most methods or important names)
  const allClasses = filesInfo.flatMap(f => f.classes)
    .filter(cls => cls.methods && cls.methods.length > 0)
    .sort((a, b) => b.methods.length - a.methods.length);
  
  // Find core interfaces
  const allInterfaces = filesInfo.flatMap(f => f.interfaces)
    .filter(iface => iface.properties && iface.properties.length > 0)
    .sort((a, b) => b.properties.length - a.properties.length);
  
  // Find core utility functions  
  const allFunctions = filesInfo.flatMap(f => f.functions || [])
    .filter(func => func.isExported)
    .sort((a, b) => (b.parameters ? b.parameters.length : 0) - (a.parameters ? a.parameters.length : 0));
  
  if (allClasses.length === 0 && allInterfaces.length === 0 && allFunctions.length === 0) {
    return '';
  }
  
  markdown += '## Key Repository Elements\n\n';
  markdown += 'This section highlights the most important elements in the repository based on code analysis.\n\n';
  
  // Key classes
  if (allClasses.length > 0) {
    markdown += '### Core Classes\n\n';
    markdown += '| Class | Methods | Properties | Description |\n';
    markdown += '|-------|---------|------------|-------------|\n';
    
    // Show top classes by number of methods (max 10)
    const topClasses = allClasses.slice(0, 10);
    
    topClasses.forEach(cls => {
      const methodCount = cls.methods ? cls.methods.length : 0;
      const propCount = cls.properties ? cls.properties.length : 0;
      
      // Try to generate a brief description based on class name and inheritance
      let description = '';
      if (cls.extends) {
        description = `Extends ${cls.extends}`;
      } else if (cls.implements && cls.implements.length > 0) {
        description = `Implements ${cls.implements.join(', ')}`;
      } else {
        // Try to infer from name
        if (cls.name.includes('Service')) {
          description = 'Service component';
        } else if (cls.name.includes('Controller')) {
          description = 'Controller component';
        } else if (cls.name.includes('Component')) {
          description = 'UI component';
        } else if (cls.name.includes('Model')) {
          description = 'Data model';
        } else if (cls.name.includes('Repository')) {
          description = 'Data access layer';
        } else {
          description = ''; 
        }
      }
      
      markdown += `| \`${cls.name}\` | ${methodCount} | ${propCount} | ${description} |\n`;
    });
    
    markdown += '\n';
  }
  
  // Key interfaces
  if (allInterfaces.length > 0) {
    markdown += '### Core Interfaces\n\n';
    markdown += '| Interface | Properties | Methods | Description |\n';
    markdown += '|-----------|------------|---------|-------------|\n';
    
    // Show top interfaces by property count (max 8)
    const topInterfaces = allInterfaces.slice(0, 8);
    
    topInterfaces.forEach(iface => {
      const propCount = iface.properties ? iface.properties.length : 0;
      const methodCount = iface.methods ? iface.methods.length : 0;
      
      // Try to generate a brief description based on interface name and extension
      let description = '';
      if (iface.extends && iface.extends.length > 0) {
        description = `Extends ${iface.extends.join(', ')}`;
      } else {
        // Try to infer from name
        if (iface.name.includes('Config')) {
          description = 'Configuration interface';
        } else if (iface.name.includes('Props')) {
          description = 'Component props';
        } else if (iface.name.includes('State')) {
          description = 'State definition';
        } else if (iface.name.includes('Options')) {
          description = 'Options configuration';
        } else if (iface.name.includes('Response')) {
          description = 'API response type';
        } else if (iface.name.includes('Request')) {
          description = 'API request type';
        } else {
          description = 'Data structure';
        }
      }
      
      markdown += `| \`${iface.name}\` | ${propCount} | ${methodCount} | ${description} |\n`;
    });
    
    markdown += '\n';
  }
  
  // Key utility functions
  if (allFunctions.length > 0) {
    markdown += '### Core Utility Functions\n\n';
    markdown += '| Function | Parameters | Return Type | Description |\n';
    markdown += '|----------|------------|-------------|-------------|\n';
    
    // Show top functions by parameter count and description (max 8)
    const topFunctions = allFunctions
      .filter(f => !f.name.startsWith('_') && !f.isAnonymous)
      .slice(0, 8);
    
    topFunctions.forEach(func => {
      const paramCount = func.parameters ? func.parameters.length : 0;
      const returnType = func.returnType || 'void';
      const description = func.description ? 
        (func.description.length > 40 ? func.description.substring(0, 37) + '...' : func.description) : 
        '';
      
      markdown += `| \`${func.name}\` | ${paramCount} | ${returnType} | ${description} |\n`;
    });
    
    markdown += '\n';
  }
  
  return markdown;
}

// Generate call hierarchy diagrams to visualize function relationships
function generateCallHierarchyDiagrams(moduleInterfaces, filesInfo) {
  if (!filesInfo || filesInfo.length === 0) {
    return '';
  }
  
  let markdown = '';
  
  // Find significant functions across the codebase
  const allFunctions = filesInfo.flatMap(file => file.functions || []);
  
  if (allFunctions.length === 0) {
    return '';
  }
  
  // Find potential entry points (main functions, exported functions with no parameters)
  const entryPointFunctions = allFunctions.filter(func => 
    func.name.toLowerCase() === 'main' || 
    func.name.toLowerCase().includes('init') ||
    (func.isExported && (!func.parameters || func.parameters.length === 0))
  );
  
  // If no clear entry points, use the most complex functions
  const significantFunctions = entryPointFunctions.length > 0 ? 
    entryPointFunctions : 
    allFunctions
      .filter(f => f.parameters && f.parameters.length > 0)
      .sort((a, b) => (b.parameters ? b.parameters.length : 0) - (a.parameters ? a.parameters.length : 0))
      .slice(0, 3);
  
  // Create a more sophisticated call graph based on code analysis
  const callGraph = {};
  
  // First pass: create basic function entries
  allFunctions.forEach(func => {
    callGraph[func.name] = {
      calls: [],
      calledBy: [],
      description: func.description || '',
      parameters: func.parameters || [],
      isAsync: func.isAsync || false,
      returnType: func.returnType || 'void',
      sourceFile: func.sourceFile || '',
      importance: 0  // We'll calculate this
    };
  });
  
  // Second pass: analyze function bodies (via descriptions/signatures) for calls
  allFunctions.forEach(func => {
    // Get function text from description and signature
    let funcText = (func.description || '') + ' ' + (func.signature || '');
    
    // Look for function calls in the text
    allFunctions.forEach(potentialCallee => {
      // Skip self-calls
      if (potentialCallee.name === func.name) return;
      
      // More robust function call detection
      const callPattern = new RegExp(`\\b${potentialCallee.name}\\s*\\(`, 'i');
      const simplePattern = new RegExp(`\\b${potentialCallee.name}\\b`, 'i');
      
      // If we find a clear function call or the function name is mentioned
      if (callPattern.test(funcText) || 
         (simplePattern.test(funcText) && potentialCallee.name.length > 3)) { // Avoid short names like "add"
        callGraph[func.name].calls.push(potentialCallee.name);
        
        // Record the inverse relationship too
        if (callGraph[potentialCallee.name]) {
          callGraph[potentialCallee.name].calledBy.push(func.name);
        }
      }
    });
  });
  
  // Calculate function importance based on:
  // 1. How many places call this function
  // 2. How many parameters it has
  // 3. Whether it's exported
  allFunctions.forEach(func => {
    if (callGraph[func.name]) {
      const callCount = callGraph[func.name].calledBy.length;
      const paramCount = func.parameters ? func.parameters.length : 0;
      const isExported = func.isExported ? 5 : 0;
      const namePriority = func.name.toLowerCase() === 'main' ? 10 : 0;
      
      callGraph[func.name].importance = callCount * 2 + paramCount + isExported + namePriority;
    }
  });
  
  // Find the most important functions to display
  // First sort by importance
  const importantFunctions = Object.entries(callGraph)
    .map(([name, info]) => ({
      name,
      ...info
    }))
    .sort((a, b) => b.importance - a.importance)
    .slice(0, 10); // Limit to top 10 for readability
  
  // Generate the call hierarchy for most important function
  if (importantFunctions.length > 0) {
    const mainFunction = importantFunctions[0];
    
    markdown += `### Primary Call Flow: ${mainFunction.name}()\n\n`;
    markdown += 'This diagram shows the key function call relationships for the most important function in the codebase:\n\n';
    markdown += '```mermaid\nsequenceDiagram\n';
    
    // Build a tree of function calls up to a certain depth
    const usedFunctions = new Set([mainFunction.name]);
    
    // Add the main function as participant
    markdown += `  participant Main as ${mainFunction.name}()\n`;
    
    // DFS to add important called functions - more selective approach
    function traverseCalls(funcName, depth = 0, maxDepth = 3, maxBranches = 4) {
      if (depth >= maxDepth || !callGraph[funcName]) return;
      
      // Sort calls by importance and take only the most important ones
      const calls = callGraph[funcName].calls
        .filter(calledName => callGraph[calledName]) // Ensure the called function exists
        .sort((a, b) => callGraph[b].importance - callGraph[a].importance) // Sort by importance
        .slice(0, maxBranches); // Limit branching factor
      
      calls.forEach(calledFunc => {
        if (!usedFunctions.has(calledFunc)) {
          usedFunctions.add(calledFunc);
          
          // Add as participant
          const participantId = calledFunc.replace(/[^a-zA-Z0-9]/g, '');
          markdown += `  participant ${participantId} as ${calledFunc}()\n`;
          
          // Recursively add important functions called by this one
          traverseCalls(calledFunc, depth + 1, maxDepth, Math.max(2, maxBranches - 1));
        }
      });
    }
    
    // Start the traversal
    traverseCalls(mainFunction.name, 0, 3, 5);
    
    // Add sequence of calls
    markdown += '\n';
    
    // Generate realistic call sequences based on the identified function relationships
    function generateCallSequence(funcName, depth = 0, maxDepth = 3, indent = '', processedCalls = new Set()) {
      if (depth >= maxDepth || !callGraph[funcName] || processedCalls.has(funcName)) return;
      
      // Mark this function as processed to prevent cycles
      processedCalls.add(funcName);
      
      // Get calls that we've already added as participants
      const calls = callGraph[funcName].calls
        .filter(f => usedFunctions.has(f))
        .sort((a, b) => callGraph[b].importance - callGraph[a].importance)
        .slice(0, depth === 0 ? 5 : 3); // More calls at top level, fewer at deeper levels
      
      // If we have no calls, create a dummy note mentioning internal processing
      if (calls.length === 0 && depth === 0) {
        markdown += `${indent}Note over Main: Internal processing\n`;
        return;
      }
      
      calls.forEach((calledFunc, idx) => {
        if (callGraph[calledFunc]) {
          const sourceId = depth === 0 ? 'Main' : funcName.replace(/[^a-zA-Z0-9]/g, '');
          const targetId = calledFunc.replace(/[^a-zA-Z0-9]/g, '');
          
          // Get parameters to show in call
          const params = callGraph[calledFunc].parameters;
          
          // If this is an important function with params, show them
          let paramText;
          if (callGraph[calledFunc].importance > 5 && params && params.length > 0) {
            paramText = `(${params.map(p => p.name).join(', ')})`;
          } else if (params && params.length > 0) {
            paramText = `(${params.length} params)`;
          } else {
            paramText = '()';
          }
          
          // Add call with description if available
          if (callGraph[calledFunc].description && callGraph[calledFunc].importance > 5) {
            const shortDesc = callGraph[calledFunc].description.split('.')[0];
            if (shortDesc && shortDesc.length < 40) {
              markdown += `${indent}Note right of ${targetId}: ${shortDesc}\n`;
            }
          }
          
          // Add call
          markdown += `${indent}${sourceId}->>+${targetId}: ${calledFunc}${paramText}\n`;
          
          // For async functions, add note
          if (callGraph[calledFunc].isAsync) {
            markdown += `${indent}Note over ${targetId}: async\n`;
          }
          
          // Recursively add nested calls with proper indentation - only for important functions
          if (callGraph[calledFunc].importance > 3) {
            generateCallSequence(calledFunc, depth + 1, maxDepth, indent + '  ', new Set(processedCalls));
          }
          
          // Add return
          let returnDesc = callGraph[calledFunc].returnType;
          if (returnDesc === 'void' || !returnDesc) {
            returnDesc = depth === 0 ? 'Returns results' : 'Complete';
          }
          markdown += `${indent}${targetId}-->>-${sourceId}: ${returnDesc}\n`;
        }
      });
    }
    
    // Start sequence generation
    generateCallSequence(mainFunction.name);
    
    markdown += '```\n\n';
  }
  
  // Show functions that are frequently called by others (hub functions)
  // Different perspective: find functions that are called by many others
  if (importantFunctions.length > 1) {
    const mainFunctionName = importantFunctions[0].name;
    
    // Find a function that's called by many others but isn't the main function
    const hubFunctions = importantFunctions
      .filter(f => f.calledBy.length > 1 && f.name !== mainFunctionName)
      .sort((a, b) => b.calledBy.length - a.calledBy.length);
    
    // If we found a good hub function, show its call flow
    if (hubFunctions.length > 0) {
      const hubFunction = hubFunctions[0];
      
      markdown += `### Secondary Flow: ${hubFunction.name}() - Called by ${hubFunction.calledBy.length} Functions\n\n`;
      markdown += 'This diagram shows a different perspective - a core function that is called by many other parts of the codebase:\n\n';
      markdown += '```mermaid\nsequenceDiagram\n';
      
      // Show the callers of this function
      const usedCallers = new Set();
      
      // First add the hub as participant
      markdown += `  participant Hub as ${hubFunction.name}()\n`;
      
      // Sort callers by importance and add up to 5
      const callers = hubFunction.calledBy
        .filter(caller => callGraph[caller])
        .sort((a, b) => callGraph[b].importance - callGraph[a].importance)
        .slice(0, 5);
      
      // Add caller participants
      callers.forEach(caller => {
        usedCallers.add(caller);
        const callerId = caller.replace(/[^a-zA-Z0-9]/g, '');
        markdown += `  participant ${callerId} as ${caller}()\n`;
      });
      
      // Add hub's calls to other functions too
      const targetFunctions = hubFunction.calls
        .filter(call => callGraph[call] && !usedCallers.has(call) && call !== hubFunction.name)
        .sort((a, b) => callGraph[b].importance - callGraph[a].importance)
        .slice(0, 3);
      
      // Add targets as participants
      targetFunctions.forEach(target => {
        const targetId = target.replace(/[^a-zA-Z0-9]/g, '');
        markdown += `  participant ${targetId} as ${target}()\n`;
      });
      
      markdown += '\n';
      
      // Add sequence calls to hub function
      callers.forEach(caller => {
        const callerId = caller.replace(/[^a-zA-Z0-9]/g, '');
        
        // Get parameters to show in call
        let paramText = '()';
        if (hubFunction.parameters && hubFunction.parameters.length > 0) {
          paramText = `(${hubFunction.parameters.map(p => p.name).join(', ')})`;
        }
        
        // Add call
        markdown += `  ${callerId}->>Hub: ${hubFunction.name}${paramText}\n`;
      });
      
      // Show hub function calling other functions
      targetFunctions.forEach(target => {
        const targetId = target.replace(/[^a-zA-Z0-9]/g, '');
        
        // Get parameters
        const params = callGraph[target].parameters;
        const paramText = params && params.length > 0 ? 
          `(${params.map(p => p.name).join(', ')})` : '()';
        
        // Add call
        markdown += `  Hub->>+${targetId}: ${target}${paramText}\n`;
        
        // Add return
        const returnType = callGraph[target].returnType || 'result';
        markdown += `  ${targetId}-->>-Hub: ${returnType}\n`;
      });
      
      // Add returns to callers
      callers.forEach(caller => {
        const callerId = caller.replace(/[^a-zA-Z0-9]/g, '');
        const returnType = hubFunction.returnType || 'result';
        markdown += `  Hub-->>+${callerId}: ${returnType}\n`;
      });
    } 
    // Otherwise, just show another important function
    else {
      const secondFunction = importantFunctions[1];
      
      markdown += `### Secondary Flow: ${secondFunction.name}()\n\n`;
      markdown += 'This diagram shows another important function call flow in the codebase:\n\n';
      markdown += '```mermaid\nsequenceDiagram\n';
      
      // Similar approach but for the second function
      const usedFunctions = new Set([secondFunction.name]);
      
      // Add the main function as participant
      markdown += `  participant Main as ${secondFunction.name}()\n`;
      
      // Find directly called functions, sorted by importance
      const directCalls = callGraph[secondFunction.name] ? 
        callGraph[secondFunction.name].calls
          .filter(call => callGraph[call])
          .sort((a, b) => callGraph[b].importance - callGraph[a].importance)
          .slice(0, 5) : [];
      
      directCalls.forEach(calledFunc => {
        if (callGraph[calledFunc]) {
          usedFunctions.add(calledFunc);
          const funcId = calledFunc.replace(/[^a-zA-Z0-9]/g, '');
          markdown += `  participant ${funcId} as ${calledFunc}()\n`;
        }
      });
      
      markdown += '\n';
      
      // Add sequence of calls with more information
      directCalls.forEach(calledFunc => {
        if (callGraph[calledFunc]) {
          const targetId = calledFunc.replace(/[^a-zA-Z0-9]/g, '');
          
          // Get parameters to show in call
          const params = callGraph[calledFunc].parameters;
          let paramText;
          if (params && params.length > 0) {
            paramText = `(${params.map(p => p.name).join(', ')})`;
          } else {
            paramText = '()';
          }
          
          // Add call with description if available
          if (callGraph[calledFunc].description) {
            const shortDesc = callGraph[calledFunc].description.split('.')[0];
            if (shortDesc && shortDesc.length < 40) {
              markdown += `  Note right of ${targetId}: ${shortDesc}\n`;
            }
          }
          
          // Add call
          markdown += `  Main->>+${targetId}: ${calledFunc}${paramText}\n`;
          
          // Add return
          const returnType = callGraph[calledFunc].returnType || 'result';
          markdown += `  ${targetId}-->>-Main: ${returnType}\n`;
        }
      });
    }
    
    markdown += '```\n\n';
  }
  
  return markdown;
}

// Main function
async function main() {
  try {
    // Detect repository language
    detectedLanguage = await detectLanguage();
    
    // Load appropriate language parser
    const languageParser = await loadLanguageParser(detectedLanguage);
    
    // Create parser instance
    let parser;
    try {
      if (typeof Parser === 'function') {
        parser = new Parser();
      } else if (Parser && typeof Parser.Parser === 'function') {
        parser = new Parser.Parser();
      } else {
        throw new Error('Could not initialize Parser - tree-sitter may not be installed correctly');
      }
      parser.setLanguage(languageParser);
    } catch (error) {
      console.error('Error initializing parser:', error.message);
      console.error('This may be due to missing dependencies. Try running with --install-deps flag');
      process.exit(1);
    }
    
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
    
    console.log('Detecting module interfaces...');
    const moduleInterfaces = detectModuleInterfaces(filesInfo);
    
    console.log('Organizing by feature...');
    const features = organizeByFeature(filesInfo);
    
    console.log('Generating repository map...');
    
    // Build the markdown output
    let markdown = `# Repository Map (${detectedLanguage.charAt(0).toUpperCase() + detectedLanguage.slice(1)})\n\n`;
    markdown += `This repository map provides a comprehensive overview of the ${detectedLanguage} codebase structure, including component trees, class hierarchies, interfaces, function signatures, and dependency relationships.\n\n`;
    
    // Table of Contents
    markdown += '## Table of Contents\n\n';
    markdown += '1. [Architecture Overview](#architecture-overview)\n';
    markdown += '2. [Module Structure](#module-structure)\n';
    markdown += '3. [Key Repository Elements](#key-repository-elements)\n';
    markdown += '4. [Entry Points](#entry-points)\n';
    markdown += '5. [Call Hierarchy](#call-hierarchy)\n';
    
    if (Object.keys(moduleInterfaces).some(m => 
      moduleInterfaces[m] && 
      ((moduleInterfaces[m].exportedClasses && moduleInterfaces[m].exportedClasses.length > 0) || 
       (moduleInterfaces[m].exportedFunctions && moduleInterfaces[m].exportedFunctions.length > 0)))) {
      markdown += '6. [Module Interfaces](#module-interfaces)\n';
    }
    
    markdown += '7. [Function Index](#function-index)\n';
    
    if (filesInfo.some(f => f.isComponent)) {
      markdown += '8. [Component Tree](#component-tree)\n';
    }
    
    if (filesInfo.some(f => f.isService)) {
      markdown += '9. [Service Architecture](#service-architecture)\n';
    }
    
    if (filesInfo.some(f => f.isController)) {
      markdown += '10. [API & Route Structure](#api--route-structure)\n';
    }
    
    markdown += '11. [Code Organization by Feature](#code-organization-by-feature)\n';
    markdown += '\n';
    
    // Architecture Overview
    markdown += '## Architecture Overview\n\n';
    
    // Use our dynamic architecture overview generator
    markdown += generateArchitectureOverview(filesInfo, features, detectedLanguage);
    
    // Generate Module Structure diagram
    markdown += '## Module Structure\n\n';
    markdown += 'The repository is organized into the following logical modules:\n\n';
    
    // Generate module structure diagram dynamically based on code analysis
    const moduleStructure = {};
    
    // Analyze functions to identify modules and relationships
    if (filesInfo && filesInfo.length > 0) {
      // Gather all functions for analysis
      const allFunctions = filesInfo.flatMap(file => file.functions || []);
      
      // Group functions into modules based on names and relationships
      const functionGroups = {
        'Entry Point': allFunctions.filter(f => 
          f.name.toLowerCase() === 'main' || 
          f.name.toLowerCase().includes('init') ||
          f.name.toLowerCase().includes('start') ||
          f.name.toLowerCase().includes('boot')
        ),
        'CLI Handling': allFunctions.filter(f => 
          f.name.toLowerCase().includes('command') || 
          f.name.toLowerCase().includes('cli') ||
          f.name.toLowerCase().includes('arg') ||
          f.name.toLowerCase().includes('option')
        ),
        'Language Processing': allFunctions.filter(f => 
          f.name.toLowerCase().includes('language') || 
          f.name.toLowerCase().includes('detect') ||
          f.name.toLowerCase().includes('parser')
        ),
        'File Operations': allFunctions.filter(f => 
          f.name.toLowerCase().includes('file') || 
          f.name.toLowerCase().includes('read') ||
          f.name.toLowerCase().includes('write') ||
          f.name.toLowerCase().includes('path')
        ),
        'Code Analysis': allFunctions.filter(f => 
          f.name.toLowerCase().includes('extract') || 
          f.name.toLowerCase().includes('analyze') ||
          f.name.toLowerCase().includes('parse') ||
          f.name.toLowerCase().includes('process')
        ),
        'Dependency Analysis': allFunctions.filter(f => 
          f.name.toLowerCase().includes('depend') || 
          f.name.toLowerCase().includes('graph') ||
          f.name.toLowerCase().includes('relation')
        ),
        'Documentation Generation': allFunctions.filter(f => 
          f.name.toLowerCase().includes('generate') || 
          f.name.toLowerCase().includes('doc') ||
          f.name.toLowerCase().includes('markdown') ||
          f.name.toLowerCase().includes('diagram')
        )
      };
      
      // Only include modules that actually have functions
      Object.entries(functionGroups).forEach(([name, funcs]) => {
        if (funcs.length > 0) {
          moduleStructure[name] = {
            functions: funcs,
            dependencies: [],
            description: `Contains ${funcs.length} related functions`
          };
        }
      });
      
      // Detect function dependencies between modules by analyzing function content
      Object.entries(moduleStructure).forEach(([moduleName, module]) => {
        Object.entries(moduleStructure).forEach(([targetModule, targetInfo]) => {
          if (moduleName !== targetModule) {
            // Check if functions in this module call functions in the target module
            const calls = module.functions.some(func => {
              // Check if func's description or signature mentions target module functions
              const funcText = (func.description || '') + ' ' + (func.signature || '');
              return targetInfo.functions.some(targetFunc => 
                funcText.includes(targetFunc.name)
              );
            });
            
            if (calls) {
              module.dependencies.push(targetModule);
            }
          }
        });
      });
      
      // Add a fallback "Utilities" module for any functions not yet categorized
      const categorizedFuncs = Object.values(moduleStructure)
        .flatMap(m => m.functions.map(f => f.name));
      
      const uncategorizedFuncs = allFunctions.filter(f => 
        !categorizedFuncs.includes(f.name)
      );
      
      if (uncategorizedFuncs.length > 0) {
        moduleStructure['Utilities'] = {
          functions: uncategorizedFuncs,
          dependencies: [],
          description: `Contains ${uncategorizedFuncs.length} utility functions`
        };
      }
    }
    
    // If we have identified modules, create the diagram
    if (Object.keys(moduleStructure).length > 0) {
      markdown += '```mermaid\ngraph TD\n';
      
      // Add nodes for each module
      Object.entries(moduleStructure).forEach(([moduleName, module]) => {
        const nodeId = moduleName.replace(/\s+/g, '');
        const safeName = moduleName.replace(/'/g, '');
        const functionCount = module.functions.length;
        markdown += `  ${nodeId}["${safeName} (${functionCount} functions)"]\n`;
      });
      
      // Add edges for dependencies
      Object.entries(moduleStructure).forEach(([moduleName, module]) => {
        const sourceId = moduleName.replace(/\s+/g, '');
        
        if (module.dependencies && module.dependencies.length > 0) {
          module.dependencies.forEach(dep => {
            const targetId = dep.replace(/\s+/g, '');
            markdown += `  ${sourceId} --> ${targetId}\n`;
          });
        }
      });
      
      // Add styling
      const colors = {
        'Entry Point': '#f96',
        'CLI Handling': '#f99',
        'Language Processing': '#9cf',
        'File Operations': '#9c6',
        'Code Analysis': '#fc9',
        'Dependency Analysis': '#c9c',
        'Documentation Generation': '#c9f',
        'Utilities': '#ccc'
      };
      
      Object.entries(moduleStructure).forEach(([moduleName, module]) => {
        const nodeId = moduleName.replace(/\s+/g, '');
        const color = colors[moduleName] || '#ddd';
        markdown += `  style ${nodeId} fill:${color},stroke:#333,stroke-width:1px,color:white\n`;
      });
      
      markdown += '```\n\n';
      
      // Add module descriptions
      markdown += '### Core Modules\n\n';
      
      Object.entries(moduleStructure).forEach(([moduleName, module]) => {
        markdown += `#### ${moduleName}\n\n`;
        markdown += `${module.description}.\n\n`;
        
        // List key functions in this module
        if (module.functions.length > 0) {
          markdown += '**Key Functions:**\n\n';
          
          // Sort functions by complexity (parameter count) to show most important ones first
          const sortedFunctions = [...module.functions]
            .sort((a, b) => (b.parameters ? b.parameters.length : 0) - (a.parameters ? a.parameters.length : 0))
            .slice(0, Math.min(5, module.functions.length));
          
          sortedFunctions.forEach(func => {
            const description = func.description ? 
              (func.description.length > 70 ? func.description.substring(0, 67) + '...' : func.description) : 
              `${func.name} function`;
            
            markdown += `- \`${func.name}()\`: ${description}\n`;
          });
          
          if (module.functions.length > 5) {
            markdown += `- ...and ${module.functions.length - 5} more functions\n`;
          }
          
          markdown += '\n';
        }
      });
    } else {
      // Fall back to basic structure if dynamic analysis failed
      const moduleDescriptions = {
        'Entry Point': 'Handles command-line arguments and contains the main program flow',
        'Language Detection': 'Detects repository language and loads the appropriate parser',
        'File Processing': 'Finds and reads files to be analyzed',
        'Code Analysis': 'Extracts classes, interfaces, functions, and other code elements',
        'Dependency Analysis': 'Builds dependency graphs between code elements',
        'Documentation Generation': 'Creates markdown documentation from the analyzed code',
        'Utility': 'Helper functions and utilities',
        'Dependency Management': 'Installs and manages dependencies'
      };
      
      Object.entries(logicalModules).forEach(([moduleName, module]) => {
        markdown += `#### ${moduleName}\n\n`;
        
        // Add description
        const description = moduleDescriptions[moduleName] || 'Module functions';
        markdown += `${description}.\n\n`;
        
        // List key functions in this module
        if (module.functions.length > 0) {
          markdown += '**Functions:**\n\n';
          
          module.functions.slice(0, 5).forEach(func => {
            markdown += `- \`${func.name}()\`: ${func.description || 'No description available'}\n`;
          });
          
          if (module.functions.length > 5) {
            markdown += `- ...and ${module.functions.length - 5} more functions\n`;
          }
          
          markdown += '\n';
        }
      });
    }
    
    // Key Repository Elements
    const keyElementsDoc = generateKeyElementsDocumentation(filesInfo, features, moduleInterfaces);
    if (keyElementsDoc) {
      markdown += keyElementsDoc;
    }
    
    // Entry Points Documentation
    const entryPointsDoc = generateEntryPointDocumentation(filesInfo, moduleInterfaces);
    if (entryPointsDoc) {
      markdown += '## Entry Points\n\n';
      markdown += entryPointsDoc;
    }
    
    // Call Hierarchy
    const callHierarchyDiagrams = generateCallHierarchyDiagrams(moduleInterfaces, filesInfo);
    if (callHierarchyDiagrams) {
      markdown += '## Call Hierarchy\n\n';
      markdown += 'The following diagrams show the key function call flows in the codebase, dynamically analyzed based on function declarations, parameters, and relationships.\n\n';
      markdown += callHierarchyDiagrams;
    }
    
    // Module Interface Documentation
    const moduleInterfaceDoc = generateModuleInterfaceDocumentation(moduleInterfaces);
    if (moduleInterfaceDoc) {
      markdown += '## Module Interfaces\n\n';
      markdown += 'This section documents the public interfaces of key modules, including exported classes, functions, and types.\n\n';
      markdown += moduleInterfaceDoc;
    }
    
    // Function Index
    if (filesInfo.some(f => f.functions && f.functions.length > 0)) {
      markdown += '## Function Index\n\n';
      
      markdown += '| Function | Module | Description | Signature |\n';
      markdown += '|----------|--------|-------------|----------|\n';
      
      // Collect all functions from logical modules
      const allFunctions = [];
      if (moduleInterfaces._logicalModules) {
        Object.entries(moduleInterfaces._logicalModules).forEach(([moduleName, module]) => {
          module.functions.forEach(func => {
            allFunctions.push({
              name: func.name,
              module: moduleName,
              description: func.description || '',
              signature: func.signature || `function ${func.name}()`
            });
          });
        });
      }
      
      // Sort functions by name
      allFunctions.sort((a, b) => a.name.localeCompare(b.name));
      
      // Add functions to table
      allFunctions.forEach(func => {
        const shortDesc = func.description.length > 30 
          ? func.description.substring(0, 27) + '...' 
          : func.description;
        markdown += `| \`${func.name}\` | ${func.module} | ${shortDesc} | \`${func.signature}\` |\n`;
      });
      
      markdown += '\n';
    }
    
    // Component Tree (if components exist)
    const componentTreeDiagram = generateComponentTreeDiagram(filesInfo, detectedLanguage);
    if (componentTreeDiagram) {
      markdown += '## Component Tree\n\n';
      markdown += 'The application is structured around the following components:\n\n';
      markdown += componentTreeDiagram;
    }
    
    // Service Architecture (if services exist)
    const serviceDiagram = generateServiceDiagram(filesInfo, graph);
    if (serviceDiagram) {
      markdown += '## Service Architecture\n\n';
      markdown += 'The application uses a service architecture for business logic:\n\n';
      markdown += serviceDiagram;
    }
    
    // API/Routes Structure
    const routingDiagram = generateRoutingDiagram(filesInfo, detectedLanguage);
    if (routingDiagram) {
      markdown += '## API & Route Structure\n\n';
      markdown += 'The application exposes the following routes and API endpoints:\n\n';
      markdown += routingDiagram;
    }
    
    // Code Organization by Feature
    markdown += '## Code Organization by Feature\n\n';
    
    // Group by logical module first
    if (moduleInterfaces._logicalModules) {
      markdown += 'Below is the breakdown of code organization by feature and logical modules:\n\n';
      
      // List all features and their components
      Object.entries(features).forEach(([featureName, feature]) => {
        markdown += `### ${featureName.charAt(0).toUpperCase() + featureName.slice(1)}\n\n`;
        
        // List components if any
        if (feature.components.length > 0) {
          markdown += '**Components**:\n';
          feature.components.slice(0, 5).forEach(comp => {
            const moduleName = determineComponentLogicalModule(comp, moduleInterfaces);
            markdown += `- \`${path.basename(comp.path)}\` (${moduleName})\n`;
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
            const moduleName = determineServiceLogicalModule(service, moduleInterfaces);
            markdown += `- \`${path.basename(service.path)}\` (${moduleName})\n`;
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
        
        // List utility functions if any
        const moduleFunctions = filesInfo
          .filter(f => path.dirname(f.path).includes(featureName) && f.functions && f.functions.length > 0)
          .flatMap(f => f.functions.filter(fn => fn.isExported));
        
        if (moduleFunctions.length > 0) {
          markdown += '**Utility Functions**:\n';
          moduleFunctions.slice(0, 5).forEach(func => {
            const moduleName = determineFunctionLogicalModule(func, moduleInterfaces);
            markdown += `- \`${func.name}(${func.parameters.map(p => p.name).join(', ')})\` (${moduleName})\n`;
          });
          if (moduleFunctions.length > 5) {
            markdown += `- ...and ${moduleFunctions.length - 5} more\n`;
          }
          markdown += '\n';
        }
      });
    } else {
      // Fall back to the original implementation if logical modules aren't available
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
        
        // List utility functions if any
        const moduleFunctions = filesInfo
          .filter(f => path.dirname(f.path).includes(featureName) && f.functions && f.functions.length > 0)
          .flatMap(f => f.functions.filter(fn => fn.isExported));
        
        if (moduleFunctions.length > 0) {
          markdown += '**Utility Functions**:\n';
          moduleFunctions.slice(0, 5).forEach(func => {
            markdown += `- \`${func.name}(${func.parameters.map(p => p.name).join(', ')})\`\n`;
          });
          if (moduleFunctions.length > 5) {
            markdown += `- ...and ${moduleFunctions.length - 5} more\n`;
          }
          markdown += '\n';
        }
      });
    }
    
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

// Helper functions to determine logical module for components, services, and functions
function determineComponentLogicalModule(component, moduleInterfaces) {
  // Try to find the component in module interfaces
  const moduleName = Object.keys(moduleInterfaces || {}).find(name => 
    moduleInterfaces[name] && moduleInterfaces[name].exportedClasses && 
    moduleInterfaces[name].exportedClasses.some(cls => cls.name === component.name)
  );
  
  if (moduleName && moduleInterfaces[moduleName] && moduleInterfaces[moduleName].logicalModule) {
    return moduleInterfaces[moduleName].logicalModule;
  }
  
  return 'UI Component';
}

function determineServiceLogicalModule(service, moduleInterfaces) {
  // Try to find the service in module interfaces
  const moduleName = Object.keys(moduleInterfaces || {}).find(name => 
    moduleInterfaces[name] && moduleInterfaces[name].exportedClasses && 
    moduleInterfaces[name].exportedClasses.some(cls => cls.name === service.name)
  );
  
  if (moduleName && moduleInterfaces[moduleName] && moduleInterfaces[moduleName].logicalModule) {
    return moduleInterfaces[moduleName].logicalModule;
  }
  
  return 'Service';
}

function determineFunctionLogicalModule(func, moduleInterfaces) {
  if (!moduleInterfaces || !moduleInterfaces._logicalModules) {
    return 'Utility';
  }
  
  // Check each logical module for this function
  for (const [moduleName, module] of Object.entries(moduleInterfaces._logicalModules)) {
    if (module.functions.some(f => f.name === func.name)) {
      return moduleName;
    }
  }
  
  // Determine based on function name
  if (func.name.includes('extract') || func.name.includes('parse')) {
    return 'Code Analysis';
  } else if (func.name.includes('generate') || func.name.includes('create')) {
    return 'Documentation Generation';
  } else if (func.name.includes('find') || func.name.includes('read')) {
    return 'File Processing';
  }
  
  return 'Utility';
}

// Run the main function
main();