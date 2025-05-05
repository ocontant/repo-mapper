# Universal Repository Mapper

A powerful code visualization tool that generates comprehensive repository maps for any codebase in multiple programming languages.

## Overview

Universal Repository Mapper uses tree-sitter to analyze your codebase and generate a detailed Markdown document with visualizations of your project's architecture, including:

- Component trees
- Service architecture
- Module dependencies
- Routing structure
- Public API interfaces
- Model definitions
- Code organization by feature

The tool supports multiple programming languages including:
- JavaScript/TypeScript
- Python
- Ruby
- Go
- Rust
- C/C++
- Java
- PHP
- Swift
- HTML/CSS
- Vue

## Installation

### Global Installation (recommended)

```bash
npm install -g universal-repo-mapper
```

### Local Installation

```bash
npm install universal-repo-mapper
```

## Dependencies

First, install the required dependencies:

```bash
# Install core dependencies
repomap --install-deps

# Install parsers for specific languages
repomap --install-deps --install-langs python,ruby,go

# Install parsers for all supported languages
repomap --install-deps --install-all-langs
```

## Usage

```bash
# Basic usage (analyzes current directory)
repomap

# Specify target directory
repomap --directory /path/to/your/project

# Specify output file
repomap --output repo-documentation.md

# Force a specific language analysis
repomap --language typescript

# Exclude specific file patterns
repomap --exclude "node_modules,dist,build,.git,**/test/**"

# Include specific file patterns
repomap --include "src/**/*"

# Limit the number of files to process
repomap --max-files 500
```

## Command Options

```
Options:
  -d, --directory <dir>     Target directory to analyze (default: current directory)
  -o, --output <file>       Output file path (default: "repomap.gen.md")
  -l, --language <lang>     Force specific language (auto-detected if not specified)
  -e, --exclude <pattern>   File patterns to exclude (comma-separated)
  -m, --max-files <number>  Maximum number of files to process (default: 1000)
  -i, --include <pattern>   File patterns to include (comma-separated)
  -s, --no-services         Skip services diagram generation
  -c, --no-components       Skip component diagram generation
  -r, --no-routes           Skip routes diagram generation
  --debug                   Enable debug logging
  --install-deps            Install required dependencies
  --install-all-langs       Install parsers for all supported languages
  --install-langs <langs>   Install specific language parsers
  -h, --help                Display help for command
  -V, --version             Output the version number
```

## Example Output

The generated repository map includes:

- Architecture overview
- Component tree diagrams
- Service architecture diagrams
- Module dependency diagrams
- Routing structure
- Public API interfaces
- Model definitions
- Code organization by feature

All visualizations are generated in Mermaid.js format for rendering in markdown viewers that support it.

## Requirements

- Node.js >=12.0.0
- For full functionality, install the tree-sitter parsers for your target languages

## License

MIT