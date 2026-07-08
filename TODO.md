- [ ] Add “Admin: Activate/Deactivate users” as a single popup/modal triggered by one button; remove current always-visible admin panel table.
- [ ] Add “Saved workspaces” button shown after first login; when no process loaded for user yet, initialize to empty workspace.
- [ ] Implement backend API calls to list processes for user (and fetch a process’s BPMN XML) and load it into the canvas.
- [ ] Wire modal actions (activate/deactivate) to existing apiAdminActivateUser/apiAdminDeactivateUser.
- [ ] Ensure read-only mode for viewer role remains intact.
- [ ] Test flows: first-time login → empty canvas + load saved workspace list; admin popup → single button toggles modal + actions update list.

