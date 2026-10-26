import { Injectable } from '@nestjs/common';

import { Health } from './types';

@Injectable()
export class HealthService {

	/**
	 * Returns the health of the current service
	 *
	 * @returns
	 */
	getHealth(): Health {
		return {
			status: "ok",
			uptime: process.uptime(),
			timestamp: Date.now(),
		};
	}
}
