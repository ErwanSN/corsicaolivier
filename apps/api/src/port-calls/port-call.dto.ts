import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  ValidateIf,
} from 'class-validator';

const PORT_CALL_STATUSES = [
  'scheduled',
  'delayed',
  'advanced',
  'arrived',
  'departed',
  'cancelled',
] as const;

export class ListPortCallsQuery {
  @IsUUID()
  declare siteId: string;
}

export class CreatePortCallDto {
  @IsUUID()
  declare organizationId: string;

  @IsUUID()
  declare siteId: string;

  @IsUUID()
  declare vesselId: string;

  @IsOptional()
  @IsUUID()
  declare routeId?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  declare externalReference?: string;

  @ValidateIf((input: CreatePortCallDto) => !input.scheduledDepartureAt)
  @IsDateString({ strict: true })
  declare scheduledArrivalAt?: string;

  @ValidateIf((input: CreatePortCallDto) => !input.scheduledArrivalAt)
  @IsDateString({ strict: true })
  declare scheduledDepartureAt?: string;

  @IsOptional()
  @IsString()
  @Length(2, 50)
  declare source?: string;
}

export class UpdatePortCallTimingDto {
  @IsOptional()
  @IsDateString({ strict: true })
  declare estimatedArrivalAt?: string | null;

  @IsOptional()
  @IsDateString({ strict: true })
  declare estimatedDepartureAt?: string | null;

  @IsEnum(PORT_CALL_STATUSES)
  declare status: (typeof PORT_CALL_STATUSES)[number];

  @IsString()
  @Length(2, 50)
  declare source: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  declare sourceRevision?: string;
}

export class SetDemandProfileDto {
  @IsOptional()
  @IsUUID()
  declare demandProfileId?: string | null;
}
