// Fixed read-only operations checked against Linear's published SDK schema.
const ISSUE_FIELDS = `id identifier title description createdAt updatedAt url
 state { type } assignee { id } project { id }`;

export const LINEAR_QUERIES = {
	identity: `query SelfReviewIdentity { viewer { id name } organization { id name } }`,
	projects: `query SelfReviewProjects($after: String) {
 organization { name }
 projects(first: 20, after: $after, includeArchived: true, orderBy: createdAt) {
  nodes { id name } pageInfo { hasNextPage endCursor }
 }
}`,
	project: `query SelfReviewProject($id: String!) { project(id: $id) { id name } }`,
	issues: `query SelfReviewIssues($id: String!, $after: String, $filter: IssueFilter!) {
 project(id: $id) { id issues(first: 50, after: $after, filter: $filter,
 includeArchived: true, orderBy: createdAt) {
  nodes { ${ISSUE_FIELDS} } pageInfo { hasNextPage endCursor }
 } }
}`,
	details: `query SelfReviewIssue($id: String!) { issue(id: $id) { ${ISSUE_FIELDS} } }`,
	comments: `query SelfReviewComments($id: String!) {
 issue(id: $id) { id project { id }
  comments(first: 6, includeArchived: true, orderBy: createdAt) {
   nodes { id body createdAt user { name } } pageInfo { hasNextPage endCursor }
  }
 }
}`,
} as const;
