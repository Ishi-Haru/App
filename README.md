# Todo Web App (MVP)

This app follows the spec in todo_web_app_spec.md. It uses local data with
localStorage to mock the Firebase layer.

## MVP features

- Quick add to Inbox
- Inbox organization (state and project changes)
- Hierarchical display in Project view
- State changes across all views
- Today view (scheduled for today and not done)
- Project view with tree structure

## Scripts

- npm install
- npm run dev
- npm run build
- npm run preview

## Firebase tasks (manual)

These steps must be done outside this environment:

1. Create a Firebase project and enable Firestore.
2. Create collections: projects and tasks.
3. Add security rules for authenticated users (or open rules for dev only).
4. Create a web app in Firebase and copy the config to a .env file.
5. Replace the localStorage data layer with Firestore reads and writes.
6. Implement auth (optional) and tie data access to user identity.

## Data shape

Tasks use states: inbox, next, scheduled, waiting, someday, done, cancelled.
Projects and tasks follow the schema defined in the spec.
