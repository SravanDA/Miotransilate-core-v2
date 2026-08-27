# MioTranslate Core

MioTranslate is the enterprise translation management engine designed to sync, manage, and publish UX copy and strings for MioSalon.

## Architecture Overview
This repository contains the core components of the MioTranslate architecture:

- **`/backend`**: The Spring Boot Java API server. Contains the core MioTranslate engine (modules for Registry, Content, Translation, Publishing, and Migration) as well as the Mock Language Services.
- **`/playground`**: A React frontend environment used to safely test MioTranslate end-to-end. It acts as both the "Mock MioSalon" UI to visualize translations in real-time, and provides the interface for Language Services and Data Import.
- **`/frontend`**: The production React interface for MioTranslate translators and administrators.
- **Project Documents**: Architectural Markdown documents, DB schemas, PRDs, and wireframes are located in the root directory.

## Getting Started (Local Development)

To run the local playground environment (which spins up the mock database and the playground UI):

### 1. Start the Backend API (Mock Profile)
```bash
cd backend
export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
./gradlew :api-server:bootRun --args='--spring.profiles.active=mock'
```
*Note: The `mock` profile automatically provisions an in-memory H2 database instead of requiring PostgreSQL.*

### 2. Start the Playground Frontend
```bash
cd playground
npm install
npm run dev
```
The Playground UI will be accessible at `http://localhost:5174/`.

## Workflow
1. **Data Import (Migration)**: Initial baseline tags (e.g., from `translations.csv`) are uploaded via the Data Import Migration API to populate the MioTranslate registry.
2. **Translation**: Translators review and modify tags through the MioTranslate UI.
3. **Publishing**: Approved translations are bundled and pushed downstream to the Language Services via the `PublishingService`.

## Documentation
Refer to the `.md` files in the root directory for detailed specifications:
- `miotranslate_language_services_api_requirements.md`
- `miotranslate_system_design_v3.md`
- `miotranslate_api_design_group_10.md` (Migration APIs)
