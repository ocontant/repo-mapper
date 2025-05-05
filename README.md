# Universal Repository Mapper

A flexible, language-agnostic codebase visualization tool that automatically generates comprehensive repository maps with code structure analysis.

## Features

- **Language Auto-detection**: Automatically detects the primary language of your codebase
- **Multi-language Support**: Works with TypeScript, JavaScript, Python, Ruby, Go, Rust, Java, C/C++, C#, PHP, Kotlin, Swift, HTML, CSS, and Vue
- **Code Structure Analysis**: Extracts classes, interfaces, methods, imports, and more
- **Architecture Visualization**: Generates Mermaid diagrams for components, services, and module dependencies
- **Public API Documentation**: Creates tables of public interfaces and methods
- **Feature Organization**: Groups code by features/modules
- **Dependency Analysis**: Shows relationships between different parts of the codebase
- **Integrated Dependency Installation**: Can install its own dependencies with a simple flag

## Installation

### Quick Start

1. Clone this repository or copy the `universal-repo-mapper.js` file to your project
2. Make the script executable: `chmod +x universal-repo-mapper.js`
3. Install dependencies:
   ```bash
   # Install core dependencies
   node universal-repo-mapper.js --install-deps
   
   # Or install core dependencies plus all language parsers
   node universal-repo-mapper.js --install-deps --install-all-langs
   
   # Or install specific language parsers
   node universal-repo-mapper.js --install-deps --install-langs python,ruby,go
   ```

### Using npm

If you have the package.json:

```bash
npm install
npm run install-deps        # Install core dependencies
npm run install-all-langs   # Install all language parsers
```

### Global Installation

To use the tool from anywhere:

```bash
npm install -g .
```

## Usage

```bash
# Basic usage (analyzes current directory)
./universal-repo-mapper.js

# Specify a target directory
./universal-repo-mapper.js -d /path/to/project

# Set output file name
./universal-repo-mapper.js -o repomap.md

# Force a specific language
./universal-repo-mapper.js -l python

# Exclude certain patterns
./universal-repo-mapper.js -e "node_modules,dist,build"

# Limit the number of files to process
./universal-repo-mapper.js -m 500

# Skip certain diagram types
./universal-repo-mapper.js --no-services --no-routes

# Enable debug logging
./universal-repo-mapper.js --debug
```

## Command Line Options

| Option | Description |
|--------|-------------|
| `-d, --directory <dir>` | Target directory to analyze (default: current directory) |
| `-o, --output <file>` | Output file path (default: repomap.gen.md) |
| `-l, --language <lang>` | Force specific language (auto-detected if not specified) |
| `-e, --exclude <pattern>` | File patterns to exclude (comma-separated) |
| `-m, --max-files <number>` | Maximum number of files to process (default: 1000) |
| `-i, --include <pattern>` | File patterns to include (comma-separated) |
| `-s, --no-services` | Skip services diagram generation |
| `-c, --no-components` | Skip component diagram generation |
| `-r, --no-routes` | Skip routes diagram generation |
| `--debug` | Enable debug logging |
| `--install-deps` | Install required dependencies |
| `--install-all-langs` | Install parsers for all supported languages |
| `--install-langs <langs>` | Install specific language parsers (comma-separated) |

## Example Output

The tool generates a comprehensive Markdown document with:

1. **Architecture Overview**: A high-level summary of the codebase architecture
2. **Component Tree**: Visual diagram of component relationships
3. **Service Architecture**: Visualization of service dependencies
4. **Module Dependencies**: Diagram of module relationships
5. **Routing Structure**: Map of application routes (when applicable)
6. **Public API Documentation**: Tables of public interfaces and methods
7. **Model Interfaces**: Key data structures
8. **Import Analysis**: Most commonly imported modules
9. **Code Organization**: Breakdown of code by feature/module

## Supported Languages

| Language | File Extensions | Parser Package |
|----------|----------------|----------------|
| TypeScript | .ts, .tsx | tree-sitter-typescript |
| JavaScript | .js, .jsx | tree-sitter-javascript |
| Python | .py | tree-sitter-python |
| Ruby | .rb | tree-sitter-ruby |
| Go | .go | tree-sitter-go |
| Rust | .rs | tree-sitter-rust |
| C++ | .cpp, .cc, .cxx, .hpp, .h, .hxx | tree-sitter-cpp |
| C | .c, .h | tree-sitter-c |
| C# | .cs | tree-sitter-c-sharp |
| Java | .java | tree-sitter-java |
| PHP | .php | tree-sitter-php |
| Kotlin | .kt, .kts | tree-sitter-kotlin |
| Swift | .swift | tree-sitter-swift |
| HTML | .html, .htm | tree-sitter-html |
| CSS | .css | tree-sitter-css |
| Vue | .vue | tree-sitter-vue |

## How It Works

1. **Language Detection**: Analyzes file extensions to determine the primary language
2. **Parser Loading**: Loads the appropriate tree-sitter parser for the detected language
3. **File Collection**: Gathers all relevant files (respecting exclusion patterns)
4. **AST Analysis**: Parses each file and extracts code elements using AST traversal
5. **Classification**: Determines file types based on naming conventions and content
6. **Relationship Building**: Creates a dependency graph between files
7. **Feature Organization**: Groups files by feature/module based on directory structure
8. **Diagram Generation**: Creates visual representations of the codebase structure
9. **Documentation Generation**: Produces comprehensive Markdown documentation

## Requirements

- Node.js 12+
- npm or yarn

## License

MIT