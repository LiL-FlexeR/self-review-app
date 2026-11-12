import type { IEvidenceValidationFailure } from './agent.types.js';

export class EvidenceValidationError extends Error {
	constructor(readonly details: IEvidenceValidationFailure) {
		super('INVALID_MODEL_OUTPUT');
		this.name = 'EvidenceValidationError';
	}
}
