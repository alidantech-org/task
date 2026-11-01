---
id: DOC-ARCHITECTURE-LOCAL-DASHBOARD-REFERENCE-PORT
name: Local Dashboard Reference Port
type: documentation
tags:
  - engineering
  - dashboard
---

# Local dashboard reference port

## Purpose

The local dashboard uses `reference/task-workspace-v4.html` as its visual and interaction fixture. The fixture is an unmodified copy of the supplied v4 prototype. `source/apps/local/src/app/reference.css` retains the prototype stylesheet during the initial port so its selectors and tokens can be applied directly from React components.

## Data and behavior boundary

The dashboard renders the active file-backed workspace returned by the local runtime. The prototype's seeded in-memory records are not used as application data. Task creation, status and date changes, document edits, project switching, and workspace events continue through the existing local runtime and workspace operations.

Presentation state includes the `tsb` sidebar preference tuple (`mode`, width, last visible mode), theme preference, selected task group, Live change history, and document draft conflict state. Filesystem changes without reliable origin metadata are labeled `External`. An open dirty document surfaces reload, keep-editing, and diff actions when the workspace stream reports an on-disk change.

The sidebar defaults to 240px and stores `[mode, width, lastVisibleMode]` under `tsb`. Legacy visibility, compactness, and width keys are read only when no valid `tsb` tuple exists; a previously hidden sidebar retains its last full or mini mode during migration. Sidebar resizing intentionally uses continuous width tracking between 200px and 380px while dragging; it does not collapse into mini mode at the demo's drag threshold. Mini mode remains available through the sidebar controls, and the resize separator's position and accessible current-width value follow the live drag.

## UI implementation

The dashboard shell and primary pages use the reference's class names and CSS variables, with component-specific additions in `globals.css`. The reference-matched `.body` owns vertical scrolling and mobile navigation clearance, avoiding a second scroll container. Radix primitives provide the custom selects, date picker, and task creation dialog. Markdown documents retain the existing Milkdown rich editor and offer a custom mode selector for switching to a raw Markdown code editor. The reader continues to use the workspace-aware Markdown renderer. The New task dialog follows the prototype's title and group controls; date and group tokens are parsed from the title, and task creation returns to the Board or opens Calendar at the parsed date. Calendar and board interactions use the existing drag-and-drop library and the runtime's task update operation. Activity and Workspace health remain available as routes outside the primary reference navigation.

The dashboard body uses the reference's 15px scrollbar width while retaining the app's shared scrollbar thumb styling elsewhere. Overlay scrollbars remain overlay at mobile widths. The wrapped primary and tool navigation lists use the reference's 2px vertical gap, so sidebar link positions stay aligned when task groups or document folders are expanded.

Task details open in the reference's slide-in drawer over the Tasks page. The task board remains visible behind the drawer; task status, priority, due date, archive state, and recent-history visibility use the existing file-backed task mutation operations. Board card completion bars derive from each Markdown task checklist. The Tasks toolbar follows the prototype's Board/List toggle and group chips, with task creation and workspace search remaining in the shared top bar.

Overview completion counts and ordering use each task's recorded completion transition and display a fixed Monday-first week, as in the prototype. Selecting a day in the seven-day strip opens Calendar at that date. The Overview intentionally omits the four status metric cards and the Groups progress panel shown in the v4 prototype; this is a deliberate product preference and they must not be restored during visual parity work. Keep the separate “Where things stand” status chart. Groups remain available through primary navigation and on the Groups page, which uses the prototype's clickable progress-card grid and calculates completion from non-archived tasks.

The Calendar section uses the prototype's fixed Monday-first weekday order and renders only the complete week rows needed to cover the selected month. Its Unscheduled tray is shown by default only when there are unscheduled tasks; a toolbar toggle beside Month/Week controls visibility when the tray would otherwise be empty. Clicking a calendar task opens its details in the Tasks sheet, while dragging continues to reschedule it. Board cards open the same sheet on click and remain draggable. The Documents list loads previews for every workspace document with bounded concurrency so excerpts and word counts do not stop at an arbitrary page limit. The document reader resolves incoming `[[id]]` links through the runtime search index and lists matching workspace records in its “Linked from” panel.

When changing these screens, compare rendered app styles against the reference at the handoff's viewport and theme sizes. Keep the HTML fixture unchanged. Do not claim pixel parity based only on matching class names or tokens.
