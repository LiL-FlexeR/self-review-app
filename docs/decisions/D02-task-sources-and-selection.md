# D02 — sources, API tokens, and selection

Three sources use manually entered credentials. Access depends on the connection owner and the token's permissions.

## Confirmation status

Accepted 2026-11-11. Personal credentials for Linear, ClickUp, and Jira Cloud are selected; provider-specific connection and normalization requirements are defined below. [ROADMAP](../../ROADMAP.md) owns implementation status.

## Connection

| Provider | Credentials | Project unit |
| --- | --- | --- |
| Linear | Personal API key, Read, team restriction where possible | Project |
| ClickUp | Personal API token | List with a workspace/space/folder breadcrumb — confirmed |
| Jira Cloud | Email + scoped personal API token + cloudId — confirmed | Project in the specified cloud site |

The confirmed Jira adapter accepts email + scoped personal API token + cloudId and uses api.atlassian.com/ex/jira/{cloudId}. Scoped tokens let the user restrict permitted actions; cloudId identifies the cloud site rather than an individual project. The alternative unscoped-token/site-URL connection was considered and is outside the MVP. Supporting one format reduces input and routing variants. The Atlassian email can differ from the application account email; the authenticated API identity determines the report subject. Access denial and token expiration are shown explicitly. Credentials and ownership boundaries are defined in [D04](D04-auth-and-credentials.md).

To construct Jira browser links without asking for an arbitrary base URL, read /rest/api/3/serverInfo through that fixed cloudId gateway and validate baseUrl as an HTTPS origin under *.atlassian.net, without embedded credentials or a nonstandard port. Store an accepted origin as Connection.sourceBaseUrl and construct /browse/{encodedIssueKey} links in code. It is link metadata, never a new API request destination. If a safe origin is unavailable or a custom domain falls outside this MVP allowlist, keep url=null, show a link-availability warning, and retain internal snapshot citations; do not guess a host from the email, cloudId, or ticket content. This alone does not make otherwise valid imported evidence partial. The [official server-info response](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-server-info/) documents baseUrl.

The catalog must paginate through all accessible resources and label each source; one failed connection must not hide the others. “All projects” means projects accessible to this token, rather than every project in the organization. Hidden, inaccessible resources cannot be recovered. Matching names do not merge separate projects.

The confirmed ClickUp unit is one List. Folder and Space aggregation were considered as broader alternatives. Choosing a List limits the selected resource, not the number of tasks: the createdAt/status rules and complete pagination still apply. The UI must show the actual resource type and its hierarchy path. With Tasks in Multiple Lists, membership comes from the selected List's API results; a different home List alone must not exclude an included task.

The server identifies the credentials' owner when validating the connection: Linear viewer.id, ClickUp GET /api/v2/user → user.id, Jira GET /rest/api/3/myself → accountId. sourceUserId and sourceUserName are stored in Connection, and the ID is fixed in the sync. If the identity cannot be obtained reliably or read-profile permissions are missing, the connection is not considered verified. The application's email and the entered Jira email do not replace a confirmed API ID.

Official methods, checked on 2026-11-10: [Linear viewer](https://linear.app/developers/graphql), [ClickUp authorized user](https://developer.clickup.com/reference/getauthorizeduser), [Jira current user](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-myself/). The report subject is this external user, including a service account if it owns the token.

## Selection and normalization

The exact authoritative rules are defined only in the [product specification](../product/overview.md#selection-rules). The main change: sync reads the entire selected project/period without a developer filter; self-review uses the assignee membership of the API-confirmed token owner, without a user-selected developer. createdAt remains the date field chosen by the user; status is not filtered.

The confirmed calendar-date policy uses fixed UTC and labels it in the form and report. This makes selection independent of the browser's location. Interpreting dates in the browser's time zone was considered; it would require capturing that zone with each run, zone-aware boundary conversion, and daylight-saving cases. The product specification owns inclusive UI dates and the exact timestamp interval.

The common TaskSnapshot stores assignees[]: Linear/Jira usually provide one current assignee, while ClickUp may provide several. IDs are always namespaced by connection/source. Do not match users by displayName/email without separate confirmation.

Linear: includeArchived=true for accessible archived data. ClickUp: explicitly include closed tasks, subtasks, and Tasks in Multiple Lists, deduplicating external IDs; request accessible archived data separately where the API supports it. Jira: use standard project search; do not promise archived issue imports through another API in the MVP. Capability/permission exclusions appear in warnings.

Provider dates may differ in precision and timezone semantics. Make the native candidate filter broad enough, then check the exact UTC interval in code using timestamps. Do not stop pagination after the first N raw candidates when some may later be filtered out. There is no fixed task or page count cap; traverse every page in batches. If traversal is interrupted by a technical failure, explicitly report incomplete coverage rather than treating the first pages as a complete sync.

Normalize Jira rich text (ADF) to plain text without executing HTML; descriptions/comments retain provenance and dates. Code builds JQL/queries from validated IDs/variables; the model does not. For Jira, use the current enhanced search /rest/api/3/search/jql with nextPageToken, without assuming the old /search endpoint.

## Alternatives and sources

One Linear integration would reduce implementation effort; all three adapters remain in the full target plan following the revised workflow. OAuth would remove manual token entry for a public product, but would add three different authorization/refresh flows. Personal credentials are selected for the local take-home assignment.

Official sources, checked on 2026-11-10: [Linear API](https://linear.app/developers/graphql), [filtering](https://linear.app/developers/filtering), [pagination](https://linear.app/developers/pagination), [ClickUp auth](https://developer.clickup.com/docs/authentication), [Get Tasks](https://developer.clickup.com/reference/gettasks), [Atlassian tokens](https://support.atlassian.com/atlassian-account/docs/manage-api-tokens-for-your-atlassian-account), [Jira search](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-search/).

ClickUp resource mapping rechecked on 2026-11-11: [Get Tasks](https://developer.clickup.com/reference/gettasks) reads a List with pagination and explicit options for closed tasks, subtasks, and Tasks in Multiple Lists; [Get Lists](https://developer.clickup.com/reference/getlists) discovers Lists within a Folder, while [Get Filtered Team Tasks](https://developer.clickup.com/reference/getfilteredteamtasks) supports broader workspace filtering. List is the confirmed product-scope choice rather than an API restriction.

Jira connection options rechecked on 2026-11-11: [Atlassian API tokens](https://support.atlassian.com/atlassian-account/docs/manage-api-tokens-for-your-atlassian-account/) documents tokens with and without scopes, email/token authentication, and the scoped-token API gateway. The connection form should link to the official [cloud ID lookup instructions](https://support.atlassian.com/jira/kb/retrieve-my-atlassian-sites-cloud-id/), since manual cloudId entry adds a setup step.

Linear queries rechecked on 2026-11-12 against the official [published GraphQL schema](https://github.com/linear/linear/blob/master/packages/sdk/src/schema.graphql) and [API documentation](https://linear.app/developers/graphql): personal keys use the raw Authorization value; project/issue/comment connections accept includeArchived and cursor pagination. The adapter uses project-scoped issues with a broad inclusive native createdAt bound, followed by the exact half-open UTC check in code. Comments use first:6 ordered by createdAt (newest first), retaining the documented five-comment cap and exposing the sixth record/continuation as an omission. HTTP 200 GraphQL errors reject partial data. [ROADMAP](../../ROADMAP.md) records executed live checks and remaining verification limitations; documented schemas/endpoints alone do not establish live verification.
