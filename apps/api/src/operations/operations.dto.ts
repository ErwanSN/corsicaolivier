import {
  IsEnum,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class OrganizationQuery {
  @IsUUID()
  declare organizationId: string;
}

export class SiteQuery {
  @IsUUID()
  declare siteId: string;
}

export class PortCallQuery {
  @IsUUID()
  declare portCallId: string;
}

export class PlanningPeriodQuery {
  @IsUUID()
  declare planningPeriodId: string;
}

export class CreateSkillDto {
  @IsUUID()
  declare organizationId: string;

  @Matches(/^[A-Z0-9-]{1,32}$/)
  declare code: string;

  @IsString()
  @Length(1, 120)
  declare name: string;

  @IsOptional()
  @IsString()
  @Length(1, 500)
  declare description?: string;
}

export class CreateVesselDto {
  @IsUUID()
  declare organizationId: string;

  @Matches(/^[A-Z0-9-]{1,16}$/)
  declare code: string;

  @IsString()
  @Length(1, 120)
  declare name: string;

  @IsOptional()
  @Matches(/^[0-9]{7}$/)
  declare imoNumber?: string;
}

export class CreateLoadForecastDto {
  @IsUUID()
  declare organizationId: string;

  @IsUUID()
  declare siteId: string;

  @IsUUID()
  declare portCallId: string;

  @IsInt()
  @Min(0)
  declare passengerCount: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  declare passengerQuota?: number;

  @IsInt()
  @Min(0)
  declare vehicleCount: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  declare freightUnitCount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  declare coachCount?: number;

  @IsString()
  @Length(3, 500)
  declare reason: string;

  @IsDateString({ strict: true })
  declare validUntil: string;

  @IsOptional()
  @IsUUID()
  declare expectedEffectiveForecastId?: string;
}

export class CreateDemandProfileDto {
  @IsUUID()
  declare organizationId: string;

  @IsUUID()
  declare siteId: string;

  @Matches(/^[A-Z0-9-]{2,32}$/)
  declare code: string;

  @IsString()
  @Length(2, 120)
  declare name: string;

  @IsInt()
  @Min(1)
  declare version: number;
}

export class CreateDemandProfileLineDto {
  @IsUUID()
  declare organizationId: string;

  @IsUUID()
  declare siteId: string;

  @IsUUID()
  declare positionId: string;

  @IsEnum(['arrival', 'departure'])
  declare anchor: 'arrival' | 'departure';

  @IsInt()
  @Min(-1440)
  @Max(1440)
  declare startsOffsetMinutes: number;

  @IsInt()
  @Min(15)
  @Max(1440)
  declare durationMinutes: number;

  @IsInt()
  @Min(0)
  @Max(100)
  declare baseAgents: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  declare passengersPerExtraAgent?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  declare vehiclesPerExtraAgent?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  declare freightUnitsPerExtraAgent?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  declare coachesPerExtraAgent?: number;

  @IsInt()
  @Min(0)
  @Max(100)
  declare minimumAgents: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  declare maximumAgents?: number;
}
