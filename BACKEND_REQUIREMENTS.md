# Backend Requirements

This document describes the data and API needs of the ff-site frontend. It is not a complete specification — additional features, data types, and integrations will be added over time as the product evolves.

---

## Auth

The frontend supports token-based login with a username and password. The backend must validate credentials and return a user object containing at minimum an ID, display name, and auth token. An optional avatar image reference should also be supported. Protected operations (such as posting or deleting commentaries) must verify the token on each request.

---

## Users

Each user has a unique username used for login, a display name shown in the UI, a hashed password, and an optional avatar. A flag to distinguish administrators from regular users is needed to support moderation of commentaries.

---

## Seasons

A season represents a campaign or story arc (FF1, FF2, FF3, FF4, Vortox Machina). Each season has a short identifier used in URLs, a display name, an optional description, and a flag controlling whether it is publicly visible. The backend must be able to return a list of all available seasons.

---

## Episodes

An episode belongs to a season and contains the core archive content. Each episode has:

- A title and short description
- An episode number — this field must support both integer and string values (e.g. `1`, `2`, `"1a"`) to accommodate existing data
- A slug used for URL routing
- An ordered collection of story blocks (see below)

The backend must support fetching a list of episode metadata for a season (title, number, slug, description) and fetching the full content of a single episode.

All four main campaigns — FF1, FF2, FF3, and FF4 — use this same episode format.

### Story Blocks

Story blocks are the individual messages that make up an episode. They are always fetched as part of their episode and are never queried independently. Each block records which player sent it, which character they were playing (nullable), a timestamp, and an ordered array of content segments.

Content segments are typed. Current types include standard dialogue, quoted text, bot responses, commands, actions, and embedded cards (which have a title, a list of description lines, and an optional footer). The content model should accommodate additional types in the future.

Because story blocks are read as a unit and can number in the hundreds per episode, they should be stored in a way that avoids per-block queries. Response payloads can be large, so compression is expected.

---

## Commentaries

Commentaries are annotations left by users on specific story blocks within an episode. They are stored separately from episode content so they can be created and deleted independently. Each commentary references an episode and a block index, records the authoring user, and contains the comment text.

The backend must support creating a commentary (authenticated), deleting a commentary (authenticated, restricted to the author or an admin), and returning all commentaries for a given episode alongside the episode content.

---

## Characters

Characters are the in-game personas played by users. Each character has a name, a short slug used to look up their avatar image, and color values for both dark and light display modes. There are approximately 19 characters currently. The character list and colors must be served by the backend so they can be managed without redeploying the frontend.

---

## Vortox Machina (CYOA)

Vortox Machina is a standalone choose-your-own-adventure narrative. Its content is a sequential list of typed paragraphs — narration, dialogue (with a character attribution), action headers, and transcript blocks. The full dataset is approximately 438KB and is always fetched in its entirety. It is read-only and changes infrequently, so aggressive caching is appropriate.

---

## Full-Text Search

The backend must plan for full-text search across episode content. Search should be capable of querying across story block text within a season or across all seasons, returning matches with enough context (episode, block index, surrounding text) for the frontend to deep-link to the relevant line. The data model and storage layer should be chosen with this in mind — full-text indexing of story block content is a hard requirement, not an afterthought.

---

## General Notes

- All API responses should use JSON
- Token-based auth should be stateless (the frontend holds the user object in memory and does not persist sessions)
- The time conversion tool is pure client-side calculation and requires no backend support
- Character avatar images are static assets and do not need to be managed by the backend API
- This list is not exhaustive — new features such as user profiles, favorites, reading progress, and additional archive seasons are expected to be added over time
