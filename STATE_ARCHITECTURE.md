# State Architecture

## Frontend state
Theme, navigation, selection, filters, local preferences, recent projects, and temporary UI drafts may live in memory/localStorage.

## Backend state
Projects, jobs, knowledge, agents, deployments, workspace, billing, permissions, and authentication are owned by DAXINI and mirrored through SDK responses.

## Rule
Presentation components render state; they do not execute business logic or call models.
