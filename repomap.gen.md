# Repository Map (Javascript)

This repository map provides a comprehensive overview of the javascript codebase structure, including component trees, class hierarchies, public interfaces, and dependency relationships.

## Architecture Overview

The application follows a modular architecture with the following main areas:


## Module Dependencies

The application is organized into logical modules with the following dependency structure:

```mermaid
graph TD
  Core["Core Module"]
  SharedModels["Shared Models"]
  Features["Features Module"]
  App["App Module"]
  Shared["Shared Module"]
  Core --> SharedModels
  Features --> Core
  Features --> SharedModels
  App --> Core
  App --> Features
  App --> Shared
  style Core fill:#7030a0,stroke:#333,stroke-width:2px,color:white
  style SharedModels fill:#7030a0,stroke:#333,stroke-width:2px,color:white
  style Features fill:#7030a0,stroke:#333,stroke-width:2px,color:white
  style App fill:#7030a0,stroke:#333,stroke-width:2px,color:white
  style Shared fill:#7030a0,stroke:#333,stroke-width:2px,color:white
```
## Routing Structure

```mermaid
graph LR
  Root["/"]
  Login["/login"]
  Dashboard["/dashboard"]
  Root --> Login
  Root --> Dashboard

  style Root fill:#4472c4,stroke:#333,stroke-width:1px,color:white
  style Login fill:#ed7d31,stroke:#333,stroke-width:1px,color:white
  style Dashboard fill:#a5a5a5,stroke:#333,stroke-width:1px,color:white
```
## Code Organization by Feature

### Ocontant

---

*This repository map was automatically generated using tree-sitter code analysis.*