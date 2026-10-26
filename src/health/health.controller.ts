import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';
import type { Health } from './types';

@Controller('v1/health')
export class HealthController {
	constructor(private readonly healthService: HealthService) { }

	@Get()
	actionGetHealth(): Health {
		return this.healthService.getHealth();
	}
}
