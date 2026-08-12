import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export const PORT_CALL_STATUSES = [
  'scheduled',
  'delayed',
  'advanced',
  'arrived',
  'departed',
  'cancelled',
] as const;

export type PortCallStatus = (typeof PORT_CALL_STATUSES)[number];

function commaSeparatedValues(value: unknown): unknown[] {
  const values: readonly unknown[] = Array.isArray(value) ? value : [value];

  return values.flatMap((item) =>
    typeof item === 'string'
      ? item
          .split(',')
          .map((part) => part.trim())
          .filter(Boolean)
      : [item],
  );
}

export class PortCallFiltersQuery {
  @IsUUID()
  declare siteId: string;

  @IsOptional()
  @IsDateString({ strict: true })
  declare from?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  declare to?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => commaSeparatedValues(value))
  @IsArray()
  @ArrayMaxSize(PORT_CALL_STATUSES.length)
  @IsEnum(PORT_CALL_STATUSES, { each: true })
  declare status?: PortCallStatus[];

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 100)
  declare q?: string;
}

export class ListPortCallsQuery extends PortCallFiltersQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(250)
  declare limit?: number;
}

export class SearchPortCallsQuery extends PortCallFiltersQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  declare page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  declare pageSize?: number;

  @IsOptional()
  @IsUUID()
  declare includeId?: string;
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

  @IsOptional()
  @IsString()
  @Length(1, 100)
  declare expectedCurrentSourceRevision?: string | null;

  @IsInt()
  @Min(0)
  declare expectedTimingLockVersion: number;

  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @Length(3, 500)
  declare reason: string;

  @IsDateString({ strict: true })
  declare validUntil: string;
}

export class SetDemandProfileDto {
  @IsOptional()
  @IsUUID()
  declare demandProfileId?: string | null;
}
