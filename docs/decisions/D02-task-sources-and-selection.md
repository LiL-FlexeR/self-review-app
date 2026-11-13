# D02 — sources, API tokens, and selection

Three sources use manually entered credentials. Access depends on the connection owner and the token's permissions.

## Confirmation status

Accepted 2026-11-11. Personal credentials for Linear, ClickUp, and Jira Cloud are selected; provider-specific connection and normalization requirements are defined below. [ROADMAP](../../ROADMAP.md) owns implementation status.

## Connection

| Provider | Credentials | Project unit |
| --- | --- | --- |
| Linear | Personal API key, Read, team restriction where possible | Project |
| ClickUp | Personal API token | List with a workspace/space/folder breadcrumb |
| Jira Cloud | Email + scoped personal API token + cloudId | Project in the specified cloud site |

The Jira adapter accepts email + scoped personal API token + cloudId and uses api.atlassian.com/ex/jira/{cloudId}. Scoped tokens let the user restrict permitted actions; cloudId identifies the cloud site rather than an individual project. The alternative unscoped-token/site-URL connection was considered and is outside the MVP. Supporting one format reduces input and routing variants. The Atlassian email can differ from the application account email; the authenticated API identity determines the report subject. Access denial and token expiration are shown explicitly. Credentials and ownership boundaries are defined in [D04](D04-auth-and-credentials.md).

To construct Jira browser links without asking for an arbitrary base URL, read /rest/api/3/serverInfo through that fixed cloudId gateway and validate baseUrl as an HTTPS origin under *.atlassian.net, without embedded credentials or a nonstandard port. Store an accepted origin as Connection.sourceBaseUrl and construct /browse/{encodedIssueKey} links in code. It is link metadata, never a new API request destination. If a safe origin is unavailable or a custom domain falls outside this MVP allowlist, keep url=null, show a link-availability warning, and retain internal snapshot citations; do not guess a host from the email, cloudId, or ticket content. This alone does not make otherwise valid imported evidence partial. The [official server-info response](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-server-info/) documents baseUrl.

The catalog must paginate through all accessible resources and label each source; one failed connection must not hide the others. “All projects” means projects accessible to this token, rather than every project in the organization. Hidden, inaccessible resources cannot be recovered. Matching names do not merge separate projects.

The ClickUp unit is one List. Folder and Space aggregation were considered as broader alternatives. Choosing a List limits the selected resource, not the number of tasks: the createdAt/status rules and complete pagination still apply. The UI must show the actual resource type and its hierarchy path. With Tasks in Multiple Lists, membership comes from the selected List's API results; a different home List alone must not exclude an included task.

The server identifies the credentials' owner when validating the connection: Linear viewer.id, ClickUp GET /api/v2/user → user.id, Jira GET /rest/api/3/myself → accountId. sourceUserId and sourceUserName are stored in Connection, and the ID is fixed in the sync. If the identity cannot be obtained reliably or read-profile permissions are missing, the connection is not considered verified. The application's email and the entered Jira email do not replace a confirmed API ID.

Identity API references: [Linear viewer](https://linear.app/developers/graphql), [ClickUp authorized user](https://developer.clickup.com/reference/getauthorizeduser), [Jira current user](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-myself/). The report subject is this external user, including a service account if it owns the token.

## Selection and normalization

The exact authoritative rules are defined only in the [product specification](../product/overview.md#selection-rules). Sync reads the entire selected project/period without a developer filter; self-review uses the assignee membership of the API-confirmed token owner, without a user-selected developer. createdAt remains the date field chosen by the user; status is not filtered.

The confirmed calendar-date policy uses fixed UTC and labels it in the form and report. This makes selection independent of the browser's location. Interpreting dates in the browser's time zone was considered; it would require capturing that zone with each run, zone-aware boundary conversion, and daylight-saving cases. The product specification owns inclusive UI dates and the exact timestamp interval.

The common TaskSnapshot stores assignees[]: Linear/Jira usually provide one current assignee, while ClickUp may provide several. IDs are always namespaced by connection/source. Do not match users by displayName/email without separate confirmation.

Provider dates may differ in precision and timezone semantics. Make native candidate filters broad enough, then check the exact UTC interval in code. Traverse every page without a task/page count cap, even when raw candidates are later filtered out. Interrupted traversal, missing/repeated continuation, or no progress is incomplete coverage, not a successful partial selection. Capability/permission exclusions appear in warnings.

## Provider reads

### Linear

Personal keys use the raw Authorization value. Fixed GraphQL queries use project-scoped issues, cursor pagination and includeArchived=true for accessible archived projects/issues/comments. Apply a broad inclusive native createdAt bound followed by the exact half-open UTC filter in code. Reject partial data when GraphQL errors accompany HTTP 200. Comments are newest first; request one record beyond the [comment cap](../architecture/agent-workflow.md#limits-and-costs) and expose that extra record/continuation as an omission.

References: [GraphQL API and viewer](https://linear.app/developers/graphql), [published schema](https://github.com/linear/linear/blob/master/packages/sdk/src/schema.graphql), [filtering](https://linear.app/developers/filtering), [pagination](https://linear.app/developers/pagination).

### ClickUp

Discovery traverses authorized workspaces, active/archived Spaces and Folders, folderless Lists and Folder Lists, retaining `parent_folder` ancestry. Task pages explicitly set `include_closed`, `subtasks`, `include_timl`, and active/archived requests; `last_page` ends traversal. Deduplicate external IDs. Selected List results establish membership even when the home List differs; selected refresh verifies the current home List or `locations` membership from Get Task. Preserve all assignees. Comments use the newest page with explicit capped-read metadata.

List is a product-scope choice, rather than an API restriction: Folder/Space aggregation and workspace-wide filtering were considered as broader alternatives. References: [authentication](https://developer.clickup.com/docs/authentication), [Get Tasks](https://developer.clickup.com/reference/gettasks), [Get Task](https://developer.clickup.com/reference/gettask), [Get Lists](https://developer.clickup.com/reference/getlists), [Get Folders](https://developer.clickup.com/reference/getfolders), [workspace filtering](https://developer.clickup.com/reference/getfilteredteamtasks), [comments](https://developer.clickup.com/reference/gettaskcomments).

### Jira Cloud

Use the fixed cloudId gateway for `myself`, optional `serverInfo`, paginated `project/search` ordered by key, enhanced `/rest/api/3/search/jql` with `nextPageToken`/`isLast`, selected issue details and newest-first comments. Standard search does not guarantee archived issue imports; another archive API is outside the MVP. Code builds JQL from validated IDs; the model does not. Widen native JQL date bounds by two UTC calendar days on each side for account-timezone interpretation, then apply the exact UTC filter in the importer.

Convert ADF to inert plain text with structural separators and explicit embedded-content omissions, preserving provenance and dates. Do not execute HTML or follow attachment/inline-card URLs. The form links to official [token setup](https://support.atlassian.com/atlassian-account/docs/manage-api-tokens-for-your-atlassian-account/) and [cloudId lookup](https://support.atlassian.com/jira/kb/retrieve-my-atlassian-sites-cloud-id/) instructions. Other references: [project search](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-projects/), [enhanced issue search](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-search/), [comments](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-comments/), [ADF](https://developer.atlassian.com/cloud/jira/platform/apis/document/structure/).

## Alternatives and consequences

One Linear integration would reduce effort; three adapters provide the agreed source coverage. Personal credentials keep local setup smaller than three OAuth authorization/refresh flows. Users must manage token permissions/expiry and provide cloudId for Jira. Complete pagination and normalization remain adapter responsibilities; identical archive capabilities are not promised.

[ROADMAP](../../ROADMAP.md#current-verification) records executed live checks and account-dependent limitations. API definitions and synthetic boundary tests do not establish live account verification.
